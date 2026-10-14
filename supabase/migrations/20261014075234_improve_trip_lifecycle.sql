-- Lifecycle operations are serialized on their parent row and authorized in the database.
create function private.delete_trip(p_trip_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  trip_row public.trips%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  select * into trip_row from public.trips where id = p_trip_id for update;
  if not found or trip_row.organizer_id <> auth.uid()
     or not private.is_group_member(trip_row.group_id) then
    raise exception 'not_organizer' using errcode = '42501';
  end if;
  if trip_row.status not in ('draft', 'cancelled', 'completed') then
    raise exception 'cancel_trip_first' using errcode = '22023';
  end if;
  delete from public.invite_links where trip_id = p_trip_id;
  update public.trips set selected_date_option_id = null, selected_place_option_id = null
    where id = p_trip_id;
  delete from public.trips where id = p_trip_id;
  return trip_row.group_id;
end;
$$;

create function private.delete_group(p_group_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform 1 from public.groups where id = p_group_id for update;
  if not found or not private.is_group_admin(p_group_id) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  perform 1 from public.trips where group_id = p_group_id for update;
  if exists (
    select 1 from public.trips where group_id = p_group_id
      and status in ('voting', 'confirmed')
  ) then
    raise exception 'active_trips_exist' using errcode = '22023';
  end if;
  delete from public.invite_links where group_id = p_group_id;
  update public.trips set selected_date_option_id = null, selected_place_option_id = null
    where group_id = p_group_id;
  delete from public.trips where group_id = p_group_id;
  delete from public.groups where id = p_group_id;
end;
$$;

create function private.leave_group(p_group_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  member_role text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  perform 1 from public.groups where id = p_group_id for update;
  if not found then raise exception 'group_not_found' using errcode = '22023'; end if;
  select role into member_role from public.group_members
    where group_id = p_group_id and user_id = auth.uid() for update;
  if member_role is null then raise exception 'not_member' using errcode = '42501'; end if;
  if member_role = 'admin' and (
    select count(*) from public.group_members
      where group_id = p_group_id and role = 'admin'
  ) <= 1 then
    raise exception 'last_admin' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.trips where group_id = p_group_id
      and organizer_id = auth.uid()
      and status in ('draft', 'voting', 'confirmed')
  ) then
    raise exception 'transfer_active_trips_first' using errcode = '22023';
  end if;
  delete from public.group_members where group_id = p_group_id and user_id = auth.uid();
end;
$$;

-- A declined participant's old answers must not reappear if they join later.
create function private.respond_to_trip_invitation(p_trip_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  trip_row public.trips%rowtype;
begin
  if auth.uid() is null or p_status not in ('interested', 'declined') then
    raise exception 'invalid_response' using errcode = '22023';
  end if;
  select * into trip_row from public.trips where id = p_trip_id for update;
  if not found or trip_row.status in ('cancelled', 'completed')
     or not private.is_group_member(trip_row.group_id)
     or (p_status = 'declined' and trip_row.organizer_id = auth.uid()) then
    raise exception 'response_not_allowed' using errcode = '42501';
  end if;
  perform 1 from public.trip_participants
    where trip_id = p_trip_id and user_id = auth.uid() for update;
  if not found then raise exception 'not_invited' using errcode = '42501'; end if;
  if p_status = 'declined' then
    delete from public.date_votes where trip_id = p_trip_id and user_id = auth.uid();
    delete from public.place_votes where trip_id = p_trip_id and user_id = auth.uid();
    delete from public.vote_submissions where trip_id = p_trip_id and user_id = auth.uid();
    delete from public.trip_rsvps where trip_id = p_trip_id
      and user_id = auth.uid() and plan_version = trip_row.plan_version;
  end if;
  update public.trip_participants set invitation_status = p_status
    where trip_id = p_trip_id and user_id = auth.uid();
end;
$$;

-- A past date range cannot be offered for a future decision.
create function private.date_option_future_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  trip_timezone text;
  deadline_local_date date;
begin
  select timezone, (vote_deadline at time zone timezone)::date
    into trip_timezone, deadline_local_date
    from public.trips where id = new.trip_id;
  if new.ends_on < (clock_timestamp() at time zone trip_timezone)::date
     or new.ends_on < deadline_local_date then
    raise exception 'date_option_in_past' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger date_options_future_guard before insert or update on public.date_options
  for each row execute function private.date_option_future_guard();

-- Existing draft options may predate this migration; block opening voting
-- until the organizer removes or edits invalid dates.
create function private.valid_dates_before_voting()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'draft' and new.status = 'voting' and exists (
    select 1 from public.date_options option_row
      where option_row.trip_id = new.id
        and (option_row.ends_on < (clock_timestamp() at time zone new.timezone)::date
          or option_row.ends_on < (new.vote_deadline at time zone new.timezone)::date)
  ) then
    raise exception 'date_option_in_past' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger trips_valid_dates_before_voting before update of status on public.trips
  for each row execute function private.valid_dates_before_voting();

-- Removing a group member also removes their trip answers, including when an admin
-- removes them through the existing member-management function.
create function private.clear_departed_member_participation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.trip_participants p using public.trips t
    where p.trip_id = t.id and t.group_id = old.group_id and p.user_id = old.user_id;
  return old;
end;
$$;
create trigger group_member_departed after delete on public.group_members
  for each row execute function private.clear_departed_member_participation();

-- A vote or RSVP waiting on the trip lock must not write after a decline.
create function private.active_participant_answer_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.trip_participants p
    join public.trips t on t.id = p.trip_id
    join public.group_members m on m.group_id = t.group_id and m.user_id = p.user_id
    where p.trip_id = new.trip_id and p.user_id = new.user_id
      and p.invitation_status <> 'declined'
  ) then
    raise exception 'not_active_participant' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger date_votes_active_participant before insert or update on public.date_votes
  for each row execute function private.active_participant_answer_guard();
create trigger place_votes_active_participant before insert or update on public.place_votes
  for each row execute function private.active_participant_answer_guard();
create trigger vote_submissions_active_participant before insert or update on public.vote_submissions
  for each row execute function private.active_participant_answer_guard();
create trigger trip_rsvps_active_participant before insert or update on public.trip_rsvps
  for each row execute function private.active_participant_answer_guard();

-- Bring existing rows into the same state as future departures and declines.
delete from public.trip_participants p using public.trips t
  where p.trip_id = t.id and not exists (
    select 1 from public.group_members m
      where m.group_id = t.group_id and m.user_id = p.user_id
  );
delete from public.date_votes v using public.trip_participants p
  where v.trip_id = p.trip_id and v.user_id = p.user_id
    and p.invitation_status = 'declined';
delete from public.place_votes v using public.trip_participants p
  where v.trip_id = p.trip_id and v.user_id = p.user_id
    and p.invitation_status = 'declined';
delete from public.vote_submissions s using public.trip_participants p
  where s.trip_id = p.trip_id and s.user_id = p.user_id
    and p.invitation_status = 'declined';
delete from public.trip_rsvps r using public.trip_participants p, public.trips t
  where r.trip_id = p.trip_id and r.user_id = p.user_id
    and t.id = p.trip_id and r.plan_version = t.plan_version
    and p.invitation_status = 'declined';

-- Responding to a confirmed plan also accepts any still-pending invitation.
create or replace function private.submit_rsvp(p_trip_id uuid, p_response text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  trip_row public.trips%rowtype;
begin
  if auth.uid() is null or not private.is_trip_participant(p_trip_id) then
    raise exception 'not_participant' using errcode = '42501';
  end if;
  select * into trip_row from public.trips where id = p_trip_id for update;
  if not found or trip_row.status <> 'confirmed'
     or p_response not in ('going', 'maybe', 'not_going') then
    raise exception 'invalid_rsvp' using errcode = '22023';
  end if;
  insert into public.trip_rsvps (trip_id, user_id, plan_version, response, updated_at)
    values (p_trip_id, auth.uid(), trip_row.plan_version, p_response, clock_timestamp())
    on conflict on constraint trip_rsvps_pkey do update
      set response = excluded.response, updated_at = excluded.updated_at;
  update public.trip_participants set invitation_status = 'interested'
    where trip_id = p_trip_id and user_id = auth.uid() and invitation_status = 'pending';
  return trip_row.plan_version;
end;
$$;

revoke all on function private.delete_trip(uuid), private.delete_group(uuid),
  private.leave_group(uuid), private.respond_to_trip_invitation(uuid, text),
  private.date_option_future_guard(), private.valid_dates_before_voting(),
  private.clear_departed_member_participation(), private.active_participant_answer_guard()
  from public, anon, authenticated;
grant execute on function private.delete_trip(uuid), private.delete_group(uuid),
  private.leave_group(uuid), private.respond_to_trip_invitation(uuid, text)
  to authenticated;

create function public.delete_trip(p_trip_id uuid)
returns uuid language sql security invoker set search_path = '' as $$
  select private.delete_trip(p_trip_id);
$$;
create function public.delete_group(p_group_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.delete_group(p_group_id);
$$;
create function public.leave_group(p_group_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.leave_group(p_group_id);
$$;
create function public.respond_to_trip_invitation(p_trip_id uuid, p_status text)
returns void language sql security invoker set search_path = '' as $$
  select private.respond_to_trip_invitation(p_trip_id, p_status);
$$;
revoke all on function public.delete_trip(uuid), public.delete_group(uuid),
  public.leave_group(uuid), public.respond_to_trip_invitation(uuid, text)
  from public, anon;
grant execute on function public.delete_trip(uuid), public.delete_group(uuid),
  public.leave_group(uuid), public.respond_to_trip_invitation(uuid, text)
  to authenticated;

-- Other clients must use the same transactional response path.
revoke update (invitation_status) on public.trip_participants from authenticated;
drop policy trip_participants_respond on public.trip_participants;

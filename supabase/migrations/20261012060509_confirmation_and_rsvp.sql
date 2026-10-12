create function private.validate_plan(
  p_trip public.trips, p_date_id uuid, p_place_id uuid,
  p_meeting_at timestamptz, p_meeting_point text
)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  chosen_date public.date_options%rowtype;
begin
  select * into chosen_date from public.date_options
    where id = p_date_id and trip_id = p_trip.id;
  if not found or not exists (
    select 1 from public.place_options where id = p_place_id and trip_id = p_trip.id
  ) then
    raise exception 'option_not_in_trip' using errcode = '22023';
  end if;
  if p_meeting_at is null or p_meeting_at <= clock_timestamp()
     or (p_meeting_at at time zone p_trip.timezone)::date
        not between chosen_date.starts_on and chosen_date.ends_on
     or p_meeting_point is null
     or length(trim(p_meeting_point)) not between 1 and 500 then
    raise exception 'invalid_meeting' using errcode = '22023';
  end if;
end;
$$;

create function private.confirm_trip(
  p_trip_id uuid, p_date_id uuid, p_place_id uuid,
  p_meeting_at timestamptz, p_meeting_point text
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  trip_row public.trips%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into trip_row from public.trips where id = p_trip_id for update;
  if not found or trip_row.organizer_id <> auth.uid()
     or not private.is_group_member(trip_row.group_id) then
    raise exception 'not_organizer' using errcode = '42501';
  end if;
  if trip_row.status <> 'voting' or trip_row.vote_deadline > clock_timestamp() then
    raise exception 'voting_not_closed' using errcode = '22023';
  end if;
  perform private.validate_plan(trip_row, p_date_id, p_place_id, p_meeting_at, p_meeting_point);

  update public.trips set status = 'confirmed',
    selected_date_option_id = p_date_id,
    selected_place_option_id = p_place_id,
    meeting_at = p_meeting_at,
    meeting_point = trim(p_meeting_point),
    plan_version = 1,
    updated_at = now()
    where id = p_trip_id;
  insert into public.trip_events (trip_id, actor_id, event_type, detail)
    values (p_trip_id, auth.uid(), 'confirmed', '{"plan_version": 1}'::jsonb);
  return 1;
end;
$$;

create function private.change_plan(
  p_trip_id uuid, p_date_id uuid, p_place_id uuid,
  p_meeting_at timestamptz, p_meeting_point text
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  trip_row public.trips%rowtype;
  next_version integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into trip_row from public.trips where id = p_trip_id for update;
  if not found or trip_row.organizer_id <> auth.uid()
     or not private.is_group_member(trip_row.group_id) then
    raise exception 'not_organizer' using errcode = '42501';
  end if;
  if trip_row.status <> 'confirmed' then
    raise exception 'trip_not_confirmed' using errcode = '22023';
  end if;
  perform private.validate_plan(trip_row, p_date_id, p_place_id, p_meeting_at, p_meeting_point);
  if trip_row.selected_date_option_id = p_date_id
     and trip_row.selected_place_option_id = p_place_id
     and trip_row.meeting_at = p_meeting_at
     and trip_row.meeting_point = trim(p_meeting_point) then
    return trip_row.plan_version;
  end if;

  next_version := trip_row.plan_version + 1;
  update public.trips set
    selected_date_option_id = p_date_id,
    selected_place_option_id = p_place_id,
    meeting_at = p_meeting_at,
    meeting_point = trim(p_meeting_point),
    plan_version = next_version,
    updated_at = now()
    where id = p_trip_id;
  insert into public.trip_events (trip_id, actor_id, event_type, detail)
    values (p_trip_id, auth.uid(), 'plan_changed',
      jsonb_build_object('plan_version', next_version));
  return next_version;
end;
$$;

create function private.submit_rsvp(p_trip_id uuid, p_response text)
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
  return trip_row.plan_version;
end;
$$;

create function private.cancel_trip(p_trip_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  trip_row public.trips%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into trip_row from public.trips where id = p_trip_id for update;
  if not found or trip_row.organizer_id <> auth.uid()
     or not private.is_group_member(trip_row.group_id) then
    raise exception 'not_organizer' using errcode = '42501';
  end if;
  if trip_row.status not in ('draft', 'voting', 'confirmed')
     or length(coalesce(p_reason, '')) > 500 then
    raise exception 'trip_cannot_cancel' using errcode = '22023';
  end if;
  update public.trips set status = 'cancelled',
    cancelled_reason = nullif(trim(p_reason), ''), updated_at = now()
    where id = p_trip_id;
  insert into public.trip_events (trip_id, actor_id, event_type)
    values (p_trip_id, auth.uid(), 'cancelled');
end;
$$;

create function private.complete_trip(p_trip_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  trip_row public.trips%rowtype;
  end_date date;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into trip_row from public.trips where id = p_trip_id for update;
  if not found or trip_row.organizer_id <> auth.uid()
     or not private.is_group_member(trip_row.group_id) then
    raise exception 'not_organizer' using errcode = '42501';
  end if;
  if trip_row.status <> 'confirmed' then
    raise exception 'trip_not_confirmed' using errcode = '22023';
  end if;
  select ends_on into end_date from public.date_options
    where id = trip_row.selected_date_option_id and trip_id = p_trip_id;
  if end_date >= (clock_timestamp() at time zone trip_row.timezone)::date then
    raise exception 'trip_not_finished' using errcode = '22023';
  end if;
  update public.trips set status = 'completed', updated_at = now() where id = p_trip_id;
end;
$$;

revoke all on function private.validate_plan(public.trips, uuid, uuid, timestamptz, text),
  private.confirm_trip(uuid, uuid, uuid, timestamptz, text),
  private.change_plan(uuid, uuid, uuid, timestamptz, text),
  private.submit_rsvp(uuid, text), private.cancel_trip(uuid, text),
  private.complete_trip(uuid) from public;
grant execute on function private.confirm_trip(uuid, uuid, uuid, timestamptz, text),
  private.change_plan(uuid, uuid, uuid, timestamptz, text),
  private.submit_rsvp(uuid, text), private.cancel_trip(uuid, text),
  private.complete_trip(uuid) to authenticated;

create function public.confirm_trip(p_trip_id uuid, p_date_id uuid, p_place_id uuid,
  p_meeting_at timestamptz, p_meeting_point text)
returns integer language sql security invoker set search_path = '' as $$
  select private.confirm_trip(p_trip_id, p_date_id, p_place_id, p_meeting_at, p_meeting_point);
$$;
create function public.change_plan(p_trip_id uuid, p_date_id uuid, p_place_id uuid,
  p_meeting_at timestamptz, p_meeting_point text)
returns integer language sql security invoker set search_path = '' as $$
  select private.change_plan(p_trip_id, p_date_id, p_place_id, p_meeting_at, p_meeting_point);
$$;
create function public.submit_rsvp(p_trip_id uuid, p_response text)
returns integer language sql security invoker set search_path = '' as $$
  select private.submit_rsvp(p_trip_id, p_response);
$$;
create function public.cancel_trip(p_trip_id uuid, p_reason text)
returns void language sql security invoker set search_path = '' as $$
  select private.cancel_trip(p_trip_id, p_reason);
$$;
create function public.complete_trip(p_trip_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.complete_trip(p_trip_id);
$$;

revoke all on function public.confirm_trip(uuid, uuid, uuid, timestamptz, text),
  public.change_plan(uuid, uuid, uuid, timestamptz, text),
  public.submit_rsvp(uuid, text), public.cancel_trip(uuid, text),
  public.complete_trip(uuid) from public, anon;
grant execute on function public.confirm_trip(uuid, uuid, uuid, timestamptz, text),
  public.change_plan(uuid, uuid, uuid, timestamptz, text),
  public.submit_rsvp(uuid, text), public.cancel_trip(uuid, text),
  public.complete_trip(uuid) to authenticated;

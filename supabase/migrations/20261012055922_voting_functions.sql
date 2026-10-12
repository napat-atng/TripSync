alter table public.place_options
  add constraint place_options_map_url_http_check
  check (map_url is null or map_url ~* '^https?://');

create policy date_options_add on public.date_options for insert to authenticated
  with check (created_by = (select auth.uid()) and exists (
    select 1 from public.trips t where t.id = date_options.trip_id
      and t.status = 'draft' and private.is_trip_participant(t.id)
  ));
create policy date_options_edit on public.date_options for update to authenticated
  using (exists (select 1 from public.trips t where t.id = date_options.trip_id
    and t.status = 'draft' and t.organizer_id = (select auth.uid())))
  with check (exists (select 1 from public.trips t where t.id = date_options.trip_id
    and t.status = 'draft' and t.organizer_id = (select auth.uid())));
create policy date_options_remove on public.date_options for delete to authenticated
  using (exists (select 1 from public.trips t where t.id = date_options.trip_id
    and t.status = 'draft' and t.organizer_id = (select auth.uid())));

create policy place_options_add on public.place_options for insert to authenticated
  with check (created_by = (select auth.uid()) and exists (
    select 1 from public.trips t where t.id = place_options.trip_id
      and t.status = 'draft' and private.is_trip_participant(t.id)
  ));
create policy place_options_edit on public.place_options for update to authenticated
  using (exists (select 1 from public.trips t where t.id = place_options.trip_id
    and t.status = 'draft' and t.organizer_id = (select auth.uid())))
  with check (exists (select 1 from public.trips t where t.id = place_options.trip_id
    and t.status = 'draft' and t.organizer_id = (select auth.uid())));
create policy place_options_remove on public.place_options for delete to authenticated
  using (exists (select 1 from public.trips t where t.id = place_options.trip_id
    and t.status = 'draft' and t.organizer_id = (select auth.uid())));

grant insert (trip_id, starts_on, ends_on, created_by),
  update (starts_on, ends_on), delete on public.date_options to authenticated;
grant insert (trip_id, name, address, map_url, created_by),
  update (name, address, map_url), delete on public.place_options to authenticated;

create function private.open_voting(p_trip_id uuid)
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
  if trip_row.status <> 'draft' or trip_row.vote_deadline <= clock_timestamp() then
    raise exception 'trip_not_ready' using errcode = '22023';
  end if;
  if not exists (select 1 from public.date_options where trip_id = p_trip_id)
     or not exists (select 1 from public.place_options where trip_id = p_trip_id) then
    raise exception 'options_required' using errcode = '22023';
  end if;

  update public.trips set status = 'voting', updated_at = now() where id = p_trip_id;
  insert into public.trip_events (trip_id, actor_id, event_type)
    values (p_trip_id, auth.uid(), 'voting_opened');
end;
$$;

create function private.submit_date_votes(p_trip_id uuid, p_votes jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  trip_row public.trips%rowtype;
  option_count integer;
  answer_count integer;
begin
  if auth.uid() is null or not private.is_trip_participant(p_trip_id) then
    raise exception 'not_participant' using errcode = '42501';
  end if;
  select * into trip_row from public.trips where id = p_trip_id for update;
  if not found or trip_row.status <> 'voting' or trip_row.vote_deadline <= clock_timestamp() then
    raise exception 'voting_closed' using errcode = '22023';
  end if;
  if coalesce(jsonb_typeof(p_votes), '') <> 'array' then
    raise exception 'invalid_date_votes' using errcode = '22023';
  end if;

  select count(*) into option_count from public.date_options where trip_id = p_trip_id;
  select count(*) into answer_count from jsonb_to_recordset(p_votes)
    as answer(option_id uuid, response text);
  if option_count = 0 or answer_count <> option_count then
    raise exception 'all_dates_required' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_votes) as answer(option_id uuid, response text)
    left join public.date_options option_row
      on option_row.id = answer.option_id and option_row.trip_id = p_trip_id
    where option_row.id is null or answer.response not in ('available', 'maybe', 'unavailable')
  ) or (select count(distinct answer.option_id) from jsonb_to_recordset(p_votes)
      as answer(option_id uuid, response text)) <> option_count then
    raise exception 'invalid_date_votes' using errcode = '22023';
  end if;

  delete from public.date_votes where trip_id = p_trip_id and user_id = auth.uid();
  insert into public.date_votes (trip_id, option_id, user_id, response)
    select p_trip_id, answer.option_id, auth.uid(), answer.response
    from jsonb_to_recordset(p_votes) as answer(option_id uuid, response text);
  insert into public.vote_submissions (trip_id, user_id, date_submitted_at)
    values (p_trip_id, auth.uid(), clock_timestamp())
    on conflict (trip_id, user_id) do update
      set date_submitted_at = excluded.date_submitted_at;
  update public.trip_participants set invitation_status = 'interested'
    where trip_id = p_trip_id and user_id = auth.uid() and invitation_status = 'pending';
end;
$$;

create function private.submit_place_votes(p_trip_id uuid, p_place_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  trip_row public.trips%rowtype;
begin
  if auth.uid() is null or not private.is_trip_participant(p_trip_id) then
    raise exception 'not_participant' using errcode = '42501';
  end if;
  select * into trip_row from public.trips where id = p_trip_id for update;
  if not found or trip_row.status <> 'voting' or trip_row.vote_deadline <= clock_timestamp() then
    raise exception 'voting_closed' using errcode = '22023';
  end if;
  if p_place_ids is null or array_position(p_place_ids, null) is not null
     or (select count(distinct id) from unnest(p_place_ids) as id) <> cardinality(p_place_ids)
     or exists (
       select 1 from unnest(p_place_ids) as submitted(id)
       left join public.place_options option_row
         on option_row.id = submitted.id and option_row.trip_id = p_trip_id
       where option_row.id is null
     ) then
    raise exception 'invalid_place_votes' using errcode = '22023';
  end if;

  delete from public.place_votes where trip_id = p_trip_id and user_id = auth.uid();
  insert into public.place_votes (trip_id, option_id, user_id)
    select p_trip_id, id, auth.uid() from unnest(p_place_ids) as id;
  insert into public.vote_submissions (trip_id, user_id, place_submitted_at)
    values (p_trip_id, auth.uid(), clock_timestamp())
    on conflict (trip_id, user_id) do update
      set place_submitted_at = excluded.place_submitted_at;
  update public.trip_participants set invitation_status = 'interested'
    where trip_id = p_trip_id and user_id = auth.uid() and invitation_status = 'pending';
end;
$$;

revoke all on function private.open_voting(uuid), private.submit_date_votes(uuid, jsonb),
  private.submit_place_votes(uuid, uuid[]) from public;
grant execute on function private.open_voting(uuid), private.submit_date_votes(uuid, jsonb),
  private.submit_place_votes(uuid, uuid[]) to authenticated;

create function public.open_voting(p_trip_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.open_voting(p_trip_id);
$$;
create function public.submit_date_votes(p_trip_id uuid, p_votes jsonb)
returns void language sql security invoker set search_path = '' as $$
  select private.submit_date_votes(p_trip_id, p_votes);
$$;
create function public.submit_place_votes(p_trip_id uuid, p_place_ids uuid[])
returns void language sql security invoker set search_path = '' as $$
  select private.submit_place_votes(p_trip_id, p_place_ids);
$$;

revoke all on function public.open_voting(uuid), public.submit_date_votes(uuid, jsonb),
  public.submit_place_votes(uuid, uuid[]) from public, anon;
grant execute on function public.open_voting(uuid), public.submit_date_votes(uuid, jsonb),
  public.submit_place_votes(uuid, uuid[]) to authenticated;

create function private.assert_draft_option_mutation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  trip_row public.trips%rowtype;
  target_trip_id uuid;
begin
  target_trip_id := case when tg_op = 'DELETE' then old.trip_id else new.trip_id end;
  select * into trip_row from public.trips where id = target_trip_id for update;
  if not found or trip_row.status <> 'draft' then
    raise exception 'options_locked' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' then
    if auth.uid() is null or new.created_by <> auth.uid()
       or not private.is_trip_participant(target_trip_id) then
      raise exception 'not_participant' using errcode = '42501';
    end if;
    return new;
  end if;
  if auth.uid() is null or trip_row.organizer_id <> auth.uid()
     or not private.is_group_member(trip_row.group_id) then
    raise exception 'not_organizer' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.trip_id <> old.trip_id or new.created_by <> old.created_by then
      raise exception 'option_identity_locked' using errcode = '22023';
    end if;
    return new;
  end if;
  return old;
end;
$$;

revoke all on function private.assert_draft_option_mutation() from public;
create trigger date_options_draft_guard before insert or update or delete on public.date_options
  for each row execute function private.assert_draft_option_mutation();
create trigger place_options_draft_guard before insert or update or delete on public.place_options
  for each row execute function private.assert_draft_option_mutation();

create function private.log_participant_invite()
returns trigger language plpgsql security definer set search_path = '' as $$
declare organizer_id uuid;
begin
  select t.organizer_id into organizer_id from public.trips t where t.id = new.trip_id;
  if new.user_id <> organizer_id then
    insert into public.trip_events (trip_id, actor_id, event_type, detail)
      values (new.trip_id, auth.uid(), 'invited',
        jsonb_build_object('user_id', new.user_id));
  end if;
  return new;
end;
$$;

revoke all on function private.log_participant_invite() from public;
create trigger trip_participant_invited after insert on public.trip_participants
  for each row execute function private.log_participant_invite();

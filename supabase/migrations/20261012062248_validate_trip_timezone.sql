create function private.validate_trip_timezone()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.timezone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names where name = new.timezone
  ) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_trip_timezone() from public;
create trigger trips_validate_timezone before insert or update of timezone on public.trips
  for each row execute function private.validate_trip_timezone();

drop policy trips_insert on public.trips;
create policy trips_insert on public.trips for insert to authenticated
  with check (organizer_id = (select auth.uid())
    and private.is_group_member(group_id) and status = 'draft' and plan_version = 0
    and vote_deadline > clock_timestamp());

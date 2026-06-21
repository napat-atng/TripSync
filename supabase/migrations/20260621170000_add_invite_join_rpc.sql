-- Allow invite-token lookup and joining without exposing all trips through RLS.

create or replace function public.get_trip_by_invite_token(target_token text)
returns public.trips
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  found_trip public.trips;
begin
  select *
  into found_trip
  from public.trips
  where invite_token = trim(target_token);

  if not found then
    raise exception 'Invalid invite token' using errcode = 'P0002';
  end if;

  return found_trip;
end;
$$;

create or replace function public.join_trip_by_invite_token(
  target_token text,
  target_display_name text default null
)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  found_trip public.trips;
  current_user_id uuid := auth.uid();
  clean_display_name text := nullif(trim(coalesce(target_display_name, '')), '');
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select *
  into found_trip
  from public.trips
  where invite_token = trim(target_token);

  if not found then
    raise exception 'Invalid invite token' using errcode = 'P0002';
  end if;

  insert into public.trip_members (trip_id, user_id, display_name, role)
  values (found_trip.id, current_user_id, clean_display_name, 'member')
  on conflict (trip_id, user_id) do update
    set display_name = coalesce(excluded.display_name, public.trip_members.display_name);

  return found_trip;
end;
$$;

grant execute on function public.get_trip_by_invite_token(text) to anon, authenticated;
grant execute on function public.join_trip_by_invite_token(text, text) to authenticated;

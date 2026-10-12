-- Run inside a transaction so no sample users or trips remain in the project.
begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000c3');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

insert into public.profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'A'),
  ('00000000-0000-0000-0000-0000000000b2', 'B');

insert into public.groups (id, name, created_by) values
  ('00000000-0000-0000-0000-000000000111', 'Test group', '00000000-0000-0000-0000-0000000000a1');

insert into public.group_members (group_id, user_id) values
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-0000000000b2');

insert into public.trips (id, group_id, organizer_id, title, vote_deadline) values
  ('00000000-0000-0000-0000-000000000222', '00000000-0000-0000-0000-000000000111',
   '00000000-0000-0000-0000-0000000000a1', 'Test trip', now() + interval '1 day');

insert into public.trip_events (id, trip_id, actor_id, event_type) values
  ('00000000-0000-0000-0000-000000000333', '00000000-0000-0000-0000-000000000222',
   '00000000-0000-0000-0000-0000000000a1', 'invited');

set local role authenticated;

do $$
declare
  visible_count integer;
  changed_count integer;
  created_group uuid;
  created_trip uuid;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  select count(*) into visible_count from public.groups;
  if visible_count <> 1 then raise exception 'creator cannot read group'; end if;
  select count(*) into visible_count from public.trip_events;
  if visible_count <> 1 then raise exception 'organizer cannot read trip event'; end if;
  update public.profiles set display_name = 'A updated' where user_id = '00000000-0000-0000-0000-0000000000a1';
  get diagnostics changed_count = row_count;
  if changed_count <> 1 then raise exception 'user cannot update own profile'; end if;
  insert into public.groups (name, created_by)
    values ('Created with RLS', '00000000-0000-0000-0000-0000000000a1');
  select id into created_group from public.groups where name = 'Created with RLS';
  select count(*) into visible_count from public.group_members
    where group_id = created_group and user_id = '00000000-0000-0000-0000-0000000000a1';
  if visible_count <> 1 then raise exception 'group creator was not made admin'; end if;
  insert into public.trips (group_id, organizer_id, title, vote_deadline)
    values (created_group, '00000000-0000-0000-0000-0000000000a1',
            'Created with RLS', now() + interval '1 day')
    returning id into created_trip;
  select count(*) into visible_count from public.trip_participants
    where trip_id = created_trip and user_id = '00000000-0000-0000-0000-0000000000a1';
  if visible_count <> 1 then raise exception 'trip organizer was not made participant'; end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
  select count(*) into visible_count from public.groups;
  if visible_count <> 1 then raise exception 'member can read an unrelated group'; end if;
  select count(*) into visible_count from public.trips;
  if visible_count <> 1 then raise exception 'member cannot read trip'; end if;
  select count(*) into visible_count from public.trip_events;
  if visible_count <> 0 then raise exception 'uninvited member can read trip event'; end if;
  update public.groups set name = 'B changed it';
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then raise exception 'member changed group'; end if;
  update public.profiles set display_name = 'B changed A' where user_id = '00000000-0000-0000-0000-0000000000a1';
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then raise exception 'member changed another profile'; end if;
  begin
    insert into public.groups (name, created_by)
      values ('Forged creator', '00000000-0000-0000-0000-0000000000a1');
    raise exception 'member forged group creator';
  exception when insufficient_privilege then
    null;
  end;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
  select count(*) into visible_count from public.groups;
  if visible_count <> 0 then raise exception 'outsider can read group'; end if;
  select count(*) into visible_count from public.trips;
  if visible_count <> 0 then raise exception 'outsider can read trip'; end if;
  select count(*) into visible_count from public.profiles;
  if visible_count <> 0 then raise exception 'outsider can read profiles'; end if;
end;
$$;

rollback;

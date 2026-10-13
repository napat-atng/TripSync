begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(1);

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000c3');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into public.groups (id, name, created_by) values
  ('00000000-0000-0000-0000-000000000111', 'Notification test', '00000000-0000-0000-0000-0000000000a1');
insert into public.group_members (group_id, user_id) values
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-0000000000b2');
insert into public.trips (id, group_id, organizer_id, title, vote_deadline) values
  ('00000000-0000-0000-0000-000000000222', '00000000-0000-0000-0000-000000000111',
   '00000000-0000-0000-0000-0000000000a1', 'Notification test', now() + interval '1 day');
insert into public.trip_participants (trip_id, user_id) values
  ('00000000-0000-0000-0000-000000000222', '00000000-0000-0000-0000-0000000000b2');

set local role authenticated;
do $$
declare event_id uuid; visible_count integer;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
  select id into event_id from public.trip_events
    where trip_id = '00000000-0000-0000-0000-000000000222' and event_type = 'invited';
  if event_id is null then raise exception 'invitee cannot see invitation event'; end if;
  insert into public.notification_reads (event_id, user_id)
    values (event_id, '00000000-0000-0000-0000-0000000000b2');

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
  select count(*) into visible_count from public.trip_events;
  if visible_count <> 0 then raise exception 'outsider saw event'; end if;
  begin
    insert into public.notification_reads (event_id, user_id)
      values (event_id, '00000000-0000-0000-0000-0000000000c3');
    raise exception 'outsider marked event read';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select pass('08_notifications assertions');
select * from finish();
rollback;

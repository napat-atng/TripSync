begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000c3');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into public.groups (id, name, created_by) values
  ('00000000-0000-0000-0000-000000000111', 'Confirm test', '00000000-0000-0000-0000-0000000000a1');
insert into public.group_members (group_id, user_id) values
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-0000000000c3');
insert into public.trips (id, group_id, organizer_id, title, vote_deadline, status) values
  ('00000000-0000-0000-0000-000000000222', '00000000-0000-0000-0000-000000000111',
   '00000000-0000-0000-0000-0000000000a1', 'Confirm test', now() + interval '1 hour', 'draft');
insert into public.trip_participants (trip_id, user_id, invitation_status) values
  ('00000000-0000-0000-0000-000000000222', '00000000-0000-0000-0000-0000000000b2', 'interested');
insert into public.date_options (id, trip_id, starts_on, ends_on, created_by) values
  ('00000000-0000-0000-0000-000000000331', '00000000-0000-0000-0000-000000000222',
   current_date + 7, current_date + 7, '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000332', '00000000-0000-0000-0000-000000000222',
   current_date + 14, current_date + 14, '00000000-0000-0000-0000-0000000000a1');
insert into public.place_options (id, trip_id, name, created_by) values
  ('00000000-0000-0000-0000-000000000441', '00000000-0000-0000-0000-000000000222',
   'First place', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000442', '00000000-0000-0000-0000-000000000222',
   'Second place', '00000000-0000-0000-0000-0000000000a1');

set local role authenticated;
select public.open_voting('00000000-0000-0000-0000-000000000222');
do $$
declare
  first_meeting timestamptz;
begin
  first_meeting := ((current_date + 7) + time '10:00') at time zone 'Asia/Bangkok';
  begin
    perform public.confirm_trip('00000000-0000-0000-0000-000000000222',
      '00000000-0000-0000-0000-000000000331', '00000000-0000-0000-0000-000000000441',
      first_meeting, 'Station');
    raise exception 'confirmed before deadline';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

reset role;
update public.trips set vote_deadline = now() - interval '1 second'
  where id = '00000000-0000-0000-0000-000000000222';
set local role authenticated;

do $$
declare
  first_meeting timestamptz;
  second_meeting timestamptz;
  current_version integer;
  reply_count integer;
begin
  first_meeting := ((current_date + 7) + time '10:00') at time zone 'Asia/Bangkok';
  second_meeting := ((current_date + 14) + time '11:00') at time zone 'Asia/Bangkok';
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
  begin
    perform public.confirm_trip('00000000-0000-0000-0000-000000000222',
      '00000000-0000-0000-0000-000000000331', '00000000-0000-0000-0000-000000000441',
      first_meeting, 'Station');
    raise exception 'non-organizer confirmed';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  begin
    perform public.confirm_trip('00000000-0000-0000-0000-000000000222',
      '00000000-0000-0000-0000-000000000999', '00000000-0000-0000-0000-000000000441',
      first_meeting, 'Station');
    raise exception 'confirmed foreign date option';
  exception when invalid_parameter_value then null;
  end;
  current_version := public.confirm_trip('00000000-0000-0000-0000-000000000222',
    '00000000-0000-0000-0000-000000000331', '00000000-0000-0000-0000-000000000441',
    first_meeting, 'Station');
  if current_version <> 1 then raise exception 'first plan version is not 1'; end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
  current_version := public.submit_rsvp('00000000-0000-0000-0000-000000000222', 'going');
  if current_version <> 1 then raise exception 'RSVP used wrong plan version'; end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
  begin
    perform public.submit_rsvp('00000000-0000-0000-0000-000000000222', 'going');
    raise exception 'uninvited member sent RSVP';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  current_version := public.change_plan('00000000-0000-0000-0000-000000000222',
    '00000000-0000-0000-0000-000000000332', '00000000-0000-0000-0000-000000000442',
    second_meeting, 'New station');
  if current_version <> 2 then raise exception 'plan version did not increase'; end if;
  current_version := public.change_plan('00000000-0000-0000-0000-000000000222',
    '00000000-0000-0000-0000-000000000332', '00000000-0000-0000-0000-000000000442',
    second_meeting, 'New station');
  if current_version <> 2 then raise exception 'unchanged plan increased version'; end if;
  select count(*) into reply_count from public.trip_rsvps
    where trip_id = '00000000-0000-0000-0000-000000000222' and plan_version = 1
      and user_id = '00000000-0000-0000-0000-0000000000b2';
  if reply_count <> 1 then raise exception 'old RSVP was lost'; end if;
  select count(*) into reply_count from public.trip_rsvps
    where trip_id = '00000000-0000-0000-0000-000000000222' and plan_version = 2
      and user_id = '00000000-0000-0000-0000-0000000000b2';
  if reply_count <> 0 then raise exception 'old RSVP counted for new plan'; end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
  current_version := public.submit_rsvp('00000000-0000-0000-0000-000000000222', 'maybe');
  if current_version <> 2 then raise exception 'new RSVP used wrong plan version'; end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  perform public.cancel_trip('00000000-0000-0000-0000-000000000222', 'Weather');
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
  begin
    perform public.submit_rsvp('00000000-0000-0000-0000-000000000222', 'going');
    raise exception 'RSVP accepted after cancellation';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

rollback;

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
  ('00000000-0000-0000-0000-000000000111', 'Voting test', '00000000-0000-0000-0000-0000000000a1');
insert into public.group_members (group_id, user_id) values
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-0000000000c3');
insert into public.trips (id, group_id, organizer_id, title, vote_deadline) values
  ('00000000-0000-0000-0000-000000000222', '00000000-0000-0000-0000-000000000111',
   '00000000-0000-0000-0000-0000000000a1', 'Voting test', now() + interval '1 day');
insert into public.trip_participants (trip_id, user_id) values
  ('00000000-0000-0000-0000-000000000222', '00000000-0000-0000-0000-0000000000b2');

set local role authenticated;

do $$
declare
  date_one uuid;
  date_two uuid;
  place_one uuid;
  answer_count integer;
  changed_count integer;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  begin
    perform public.open_voting('00000000-0000-0000-0000-000000000222');
    raise exception 'opened vote without options';
  exception when invalid_parameter_value then null;
  end;

  insert into public.date_options (trip_id, starts_on, ends_on, created_by)
    values ('00000000-0000-0000-0000-000000000222', current_date + 7, current_date + 7,
            '00000000-0000-0000-0000-0000000000a1') returning id into date_one;
  insert into public.place_options (trip_id, name, created_by)
    values ('00000000-0000-0000-0000-000000000222', 'Beach',
            '00000000-0000-0000-0000-0000000000a1') returning id into place_one;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
  insert into public.date_options (trip_id, starts_on, ends_on, created_by)
    values ('00000000-0000-0000-0000-000000000222', current_date + 14, current_date + 14,
            '00000000-0000-0000-0000-0000000000b2') returning id into date_two;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
  begin
    perform public.open_voting('00000000-0000-0000-0000-000000000222');
    raise exception 'non-organizer opened vote';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  perform public.open_voting('00000000-0000-0000-0000-000000000222');
  select count(*) into answer_count from public.trips
    where id = '00000000-0000-0000-0000-000000000222' and status = 'voting';
  if answer_count <> 1 then raise exception 'vote did not open'; end if;
  update public.date_options set starts_on = current_date + 8 where id = date_one;
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then raise exception 'edited option after voting opened'; end if;
  delete from public.place_options where id = place_one;
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then raise exception 'deleted option after voting opened'; end if;
  perform public.submit_place_votes('00000000-0000-0000-0000-000000000222', array[place_one]);

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
  begin
    insert into public.date_options (trip_id, starts_on, ends_on, created_by)
      values ('00000000-0000-0000-0000-000000000222', current_date + 21, current_date + 21,
              '00000000-0000-0000-0000-0000000000b2');
    raise exception 'added date after voting opened';
  exception when insufficient_privilege or invalid_parameter_value then null;
  end;
  begin
    perform public.submit_date_votes('00000000-0000-0000-0000-000000000222',
      jsonb_build_array(jsonb_build_object('option_id', date_one, 'response', 'available')));
    raise exception 'submitted incomplete date answers';
  exception when invalid_parameter_value then null;
  end;
  perform public.submit_date_votes('00000000-0000-0000-0000-000000000222',
    jsonb_build_array(
      jsonb_build_object('option_id', date_one, 'response', 'available'),
      jsonb_build_object('option_id', date_two, 'response', 'unavailable')));
  perform public.submit_place_votes('00000000-0000-0000-0000-000000000222', array[]::uuid[]);
  select count(*) into answer_count from public.vote_submissions
    where trip_id = '00000000-0000-0000-0000-000000000222'
      and user_id = '00000000-0000-0000-0000-0000000000b2'
      and date_submitted_at is not null and place_submitted_at is not null;
  if answer_count <> 1 then raise exception 'empty place selection was not submitted'; end if;
  select count(*) into answer_count from public.place_votes
    where trip_id = '00000000-0000-0000-0000-000000000222'
      and user_id = '00000000-0000-0000-0000-0000000000b2';
  if answer_count <> 0 then raise exception 'empty place selection created a vote'; end if;
  select count(*) into answer_count from public.place_votes
    where trip_id = '00000000-0000-0000-0000-000000000222'
      and user_id = '00000000-0000-0000-0000-0000000000a1';
  if answer_count <> 1 then raise exception 'organizer place vote disappeared'; end if;

  perform public.submit_date_votes('00000000-0000-0000-0000-000000000222',
    jsonb_build_array(
      jsonb_build_object('option_id', date_one, 'response', 'maybe'),
      jsonb_build_object('option_id', date_two, 'response', 'unavailable')));
  select count(*) into answer_count from public.date_votes
    where trip_id = '00000000-0000-0000-0000-000000000222'
      and user_id = '00000000-0000-0000-0000-0000000000b2' and response = 'maybe';
  if answer_count <> 1 then raise exception 'updated date vote not reflected'; end if;
  select count(*) into answer_count from public.date_votes
    where trip_id = '00000000-0000-0000-0000-000000000222'
      and user_id = '00000000-0000-0000-0000-0000000000b2';
  if answer_count <> 2 then raise exception 'duplicate date answers after edit'; end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
  begin
    perform public.submit_place_votes('00000000-0000-0000-0000-000000000222', array[place_one]);
    raise exception 'uninvited member voted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
update public.trips set vote_deadline = now() - interval '1 second'
  where id = '00000000-0000-0000-0000-000000000222';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
do $$
begin
  begin
    perform public.submit_place_votes('00000000-0000-0000-0000-000000000222', array[]::uuid[]);
    raise exception 'vote accepted after deadline';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

reset role;
select pass('04_voting assertions');
select * from finish();
rollback;

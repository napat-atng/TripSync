begin;

insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000a1');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into public.groups (id, name, created_by) values
  ('00000000-0000-0000-0000-000000000111', 'Timezone test', '00000000-0000-0000-0000-0000000000a1');

set local role authenticated;
do $$
begin
  insert into public.trips (id, group_id, organizer_id, title, vote_deadline, timezone) values
    ('00000000-0000-0000-0000-000000000222', '00000000-0000-0000-0000-000000000111',
     '00000000-0000-0000-0000-0000000000a1', 'Valid timezone', now() + interval '1 day', 'Europe/London');
  begin
    insert into public.trips (group_id, organizer_id, title, vote_deadline, timezone) values
      ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-0000000000a1',
       'Invalid timezone', now() + interval '1 day', 'Invalid/Zone');
    raise exception 'invalid timezone inserted';
  exception when invalid_parameter_value then null;
  end;
  begin
    insert into public.trips (group_id, organizer_id, title, vote_deadline, timezone) values
      ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-0000000000a1',
       'Past deadline', now() - interval '1 minute', 'Asia/Bangkok');
    raise exception 'past deadline inserted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;

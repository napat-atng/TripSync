begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000c3');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into public.groups (id, name, created_by) values
  ('00000000-0000-0000-0000-000000000111', 'Management test', '00000000-0000-0000-0000-0000000000a1');
insert into public.group_members (group_id, user_id) values
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-0000000000b2');
insert into public.trips (id, group_id, organizer_id, title, vote_deadline) values
  ('00000000-0000-0000-0000-000000000222', '00000000-0000-0000-0000-000000000111',
   '00000000-0000-0000-0000-0000000000a1', 'Management test', now() + interval '1 day');

set local role authenticated;
do $$
declare actual_id uuid;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
  begin
    perform public.manage_group_member('00000000-0000-0000-0000-000000000111',
      '00000000-0000-0000-0000-0000000000b2', 'promote');
    raise exception 'member promoted self';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.transfer_trip_organizer('00000000-0000-0000-0000-000000000222',
      '00000000-0000-0000-0000-0000000000b2');
    raise exception 'member transferred organizer';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  begin
    perform public.manage_group_member('00000000-0000-0000-0000-000000000111',
      '00000000-0000-0000-0000-0000000000a1', 'demote');
    raise exception 'last admin demoted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.manage_group_member('00000000-0000-0000-0000-000000000111',
      '00000000-0000-0000-0000-0000000000a1', 'remove');
    raise exception 'active organizer removed';
  exception when invalid_parameter_value then null;
  end;

  perform public.manage_group_member('00000000-0000-0000-0000-000000000111',
    '00000000-0000-0000-0000-0000000000b2', 'promote');
  perform public.transfer_trip_organizer('00000000-0000-0000-0000-000000000222',
    '00000000-0000-0000-0000-0000000000b2');
  select organizer_id into actual_id from public.trips where id = '00000000-0000-0000-0000-000000000222';
  if actual_id <> '00000000-0000-0000-0000-0000000000b2' then
    raise exception 'organizer not transferred';
  end if;
  if not exists (select 1 from public.trip_participants
      where trip_id = '00000000-0000-0000-0000-000000000222'
        and user_id = actual_id and invitation_status = 'interested') then
    raise exception 'new organizer not participating';
  end if;
  perform public.manage_group_member('00000000-0000-0000-0000-000000000111',
    '00000000-0000-0000-0000-0000000000a1', 'remove');
  if exists (select 1 from public.group_members
      where group_id = '00000000-0000-0000-0000-000000000111'
        and user_id = '00000000-0000-0000-0000-0000000000a1') then
    raise exception 'former organizer still member';
  end if;
end;
$$;

rollback;

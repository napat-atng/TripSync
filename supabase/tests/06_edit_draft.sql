begin;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
insert into public.groups (id, name, created_by) values
  ('00000000-0000-0000-0000-000000000111', 'Draft edit test', '00000000-0000-0000-0000-0000000000a1');
insert into public.group_members (group_id, user_id) values
  ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-0000000000b2');
insert into public.trips (id, group_id, organizer_id, title, vote_deadline) values
  ('00000000-0000-0000-0000-000000000222', '00000000-0000-0000-0000-000000000111',
   '00000000-0000-0000-0000-0000000000a1', 'Old title', now() + interval '1 day');

set local role authenticated;
do $$
declare changed_count integer;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
  update public.trips set title = 'Member edit' where id = '00000000-0000-0000-0000-000000000222';
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then raise exception 'member edited draft'; end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  update public.trips set title = 'Updated title', vote_deadline = now() + interval '2 days'
    where id = '00000000-0000-0000-0000-000000000222';
  get diagnostics changed_count = row_count;
  if changed_count <> 1 then raise exception 'organizer could not edit draft'; end if;
  begin
    update public.trips set vote_deadline = now() - interval '1 minute'
      where id = '00000000-0000-0000-0000-000000000222';
    raise exception 'past deadline allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
update public.trips set status = 'voting' where id = '00000000-0000-0000-0000-000000000222';
set local role authenticated;
do $$
declare changed_count integer;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  update public.trips set title = 'Late edit' where id = '00000000-0000-0000-0000-000000000222';
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then raise exception 'organizer edited voting trip'; end if;
end;
$$;

rollback;

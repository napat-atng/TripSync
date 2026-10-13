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
  ('00000000-0000-0000-0000-000000000111', 'Invite test', '00000000-0000-0000-0000-0000000000a1');
insert into public.trips (id, group_id, organizer_id, title, vote_deadline) values
  ('00000000-0000-0000-0000-000000000222', '00000000-0000-0000-0000-000000000111',
   '00000000-0000-0000-0000-0000000000a1', 'Trip invite test', now() + interval '1 day');
insert into public.invite_links (group_id, token_hash, created_by, expires_at) values
  ('00000000-0000-0000-0000-000000000111',
   encode(extensions.digest(repeat('b', 64), 'sha256'), 'hex'),
   '00000000-0000-0000-0000-0000000000a1', now() - interval '1 hour');

set local role authenticated;

do $$
declare
  preview record;
  membership_count integer;
  revoked_id uuid;
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  insert into public.invite_links (group_id, trip_id, token_hash, created_by, expires_at)
    values ('00000000-0000-0000-0000-000000000111',
            '00000000-0000-0000-0000-000000000222',
            encode(extensions.digest(repeat('a', 64), 'sha256'), 'hex'),
            '00000000-0000-0000-0000-0000000000a1', now() + interval '7 days');

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
  select count(*) into membership_count from public.trips;
  if membership_count <> 0 then raise exception 'outsider read trip before joining'; end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
  select * into preview from public.preview_invite(repeat('a', 64));
  if preview.invite_status <> 'valid' or preview.group_name <> 'Invite test'
     or preview.trip_title <> 'Trip invite test' then
    raise exception 'valid invite preview failed';
  end if;
  select * into preview from public.preview_invite(repeat('b', 64));
  if preview.invite_status <> 'expired' then raise exception 'expired invite accepted for preview'; end if;

  perform public.accept_invite(repeat('a', 64));
  perform public.accept_invite(repeat('a', 64));
  select count(*) into membership_count from public.group_members
    where group_id = '00000000-0000-0000-0000-000000000111'
      and user_id = '00000000-0000-0000-0000-0000000000b2';
  if membership_count <> 1 then raise exception 'duplicate group membership'; end if;
  select count(*) into membership_count from public.trip_participants
    where trip_id = '00000000-0000-0000-0000-000000000222'
      and user_id = '00000000-0000-0000-0000-0000000000b2';
  if membership_count <> 1 then raise exception 'duplicate trip participant'; end if;

  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  update public.invite_links set revoked_at = now()
    where token_hash = encode(extensions.digest(repeat('a', 64), 'sha256'), 'hex')
    returning id into revoked_id;
  if revoked_id is null then raise exception 'organizer could not revoke link'; end if;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
  select * into preview from public.preview_invite(repeat('a', 64));
  if preview.invite_status <> 'revoked' then raise exception 'revoked invite preview failed'; end if;
  begin
    perform public.accept_invite(repeat('a', 64));
    raise exception 'revoked invite was accepted';
  exception when invalid_parameter_value then
    null;
  end;
end;
$$;

reset role;
select pass('02_invites assertions');
select * from finish();
rollback;

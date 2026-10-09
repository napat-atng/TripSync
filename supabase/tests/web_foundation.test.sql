begin;
create extension if not exists pgtap with schema extensions;
set local search_path = tripsync, extensions, public;
select plan(17);

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000001', 'foundation-a@example.invalid', '{"full_name":"Alice","avatar_url":"https://example.invalid/a.png"}'),
  ('10000000-0000-4000-8000-000000000002', 'foundation-b@example.invalid', '{"full_name":"Bob"}');
select is((select display_name from tripsync.profiles where id = '10000000-0000-4000-8000-000000000001'), 'Alice', 'Google metadata initializes the profile');
select is((select count(*)::integer from tripsync.profiles where id in ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002')), 2, 'Both Auth accounts receive profiles');
select ok(not has_schema_privilege('anon', 'tripsync', 'usage'), 'Anonymous users cannot access the web schema');
select ok(not has_function_privilege('anon', 'tripsync.create_trip(text,text,text,text)', 'execute'), 'Anonymous users cannot create rooms');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}';
select set_config('test.trip_a', tripsync.create_trip('Room A', '', 'Asia/Bangkok', 'open')::text, true);
select is((select count(*)::integer from tripsync.trip_members where trip_id = current_setting('test.trip_a')::uuid), 1, 'Room creation atomically creates the owner membership');
select ok(tripsync.is_owner(current_setting('test.trip_a')::uuid), 'Creator is the room owner');
select is((select count(*)::integer from tripsync.profiles), 1, 'Unrelated profiles are hidden');
select throws_ok($$select tripsync.create_trip('Bad', '', 'Invalid/Timezone', 'open')$$, '22023', 'Invalid timezone', 'RPC validates timezones on the server');
select throws_ok($$insert into tripsync.trip_members(trip_id,user_id) values (current_setting('test.trip_a')::uuid,'10000000-0000-4000-8000-000000000002')$$, '42501', 'permission denied for table trip_members', 'Clients cannot forge membership');
select throws_ok($$update tripsync.profiles set created_at = now() where id = auth.uid()$$, '42501', 'permission denied for table profiles', 'Clients cannot rewrite profile system fields');
update tripsync.profiles set display_name = 'Alice edited' where id = auth.uid();
select is((select display_name from tripsync.profiles where id = auth.uid()), 'Alice edited', 'Users can edit their own profile');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}';
select is((select count(*)::integer from tripsync.trips), 0, 'A second account cannot see another room');
select is((select count(*)::integer from tripsync.trip_members), 0, 'A second account cannot see private memberships');
select ok(not tripsync.is_owner(current_setting('test.trip_a')::uuid), 'A second account is not an owner');
update tripsync.profiles set display_name = 'Hacked' where id = '10000000-0000-4000-8000-000000000001';

reset role;
select is((select display_name from tripsync.profiles where id = '10000000-0000-4000-8000-000000000001'), 'Alice edited', 'Cross-account profile updates have no effect');
insert into tripsync.trip_members(trip_id, user_id) values (current_setting('test.trip_a')::uuid, '10000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*)::integer from tripsync.profiles), 2, 'Approved members can see co-member profiles');
select is((select count(*)::integer from tripsync.trips), 1, 'Approved members can read their room');
select * from finish();
rollback;

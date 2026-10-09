-- Additive web foundation: never remove legacy tables, Auth users, or other apps.
create schema tripsync;
grant usage on schema tripsync to authenticated, service_role;

create table tripsync.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 100),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tripsync.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  timezone text not null default 'Asia/Bangkok',
  join_mode text not null default 'open' check (join_mode in ('open', 'approval')),
  status text not null default 'active' check (status in ('active', 'closed')),
  owner_id uuid not null references tripsync.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tripsync.trip_members (
  trip_id uuid not null references tripsync.trips(id) on delete cascade,
  user_id uuid not null references tripsync.profiles(id),
  status text not null default 'active' check (status in ('active', 'left', 'removed')),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
create index trip_members_user_idx on tripsync.trip_members(user_id, status);
alter table tripsync.trips add constraint owner_is_member
  foreign key (id, owner_id) references tripsync.trip_members(trip_id, user_id)
  deferrable initially deferred;

create function tripsync.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger profiles_updated_at before update on tripsync.profiles
  for each row execute function tripsync.touch_updated_at();
create trigger trips_updated_at before update on tripsync.trips
  for each row execute function tripsync.touch_updated_at();

create function tripsync.initialize_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into tripsync.profiles(id, display_name, avatar_url)
  values (new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
                  nullif(btrim(new.raw_user_meta_data->>'name'), ''), 'สมาชิก TripSync'), 100),
    case when new.raw_user_meta_data->>'avatar_url' ~ '^https://'
      then new.raw_user_meta_data->>'avatar_url' else null end)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger tripsync_auth_profile after insert on auth.users
  for each row execute function tripsync.initialize_profile();
-- Existing Auth accounts retain their identities and can start fresh web trips.
insert into tripsync.profiles(id, display_name, avatar_url)
select id,
  left(coalesce(nullif(btrim(raw_user_meta_data->>'full_name'), ''),
                nullif(btrim(raw_user_meta_data->>'name'), ''), 'สมาชิก TripSync'), 100),
  case when raw_user_meta_data->>'avatar_url' ~ '^https://'
    then raw_user_meta_data->>'avatar_url' else null end
from auth.users on conflict (id) do nothing;

create function tripsync.is_member(p_trip_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from tripsync.trip_members
    where trip_id = p_trip_id and user_id = auth.uid() and status = 'active');
$$;
create function tripsync.is_owner(p_trip_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from tripsync.trips
    where id = p_trip_id and owner_id = auth.uid()) and tripsync.is_member(p_trip_id);
$$;
create function tripsync.shares_trip(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from tripsync.trip_members mine
    join tripsync.trip_members theirs on theirs.trip_id = mine.trip_id
    where mine.user_id = auth.uid() and mine.status = 'active'
      and theirs.user_id = p_user_id and theirs.status = 'active');
$$;

alter table tripsync.profiles enable row level security;
alter table tripsync.trips enable row level security;
alter table tripsync.trip_members enable row level security;
create policy profiles_visible on tripsync.profiles for select to authenticated
  using (id = auth.uid() or tripsync.shares_trip(id));
create policy profiles_edit_self on tripsync.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy trips_visible on tripsync.trips for select to authenticated
  using (tripsync.is_member(id));
create policy members_visible on tripsync.trip_members for select to authenticated
  using (tripsync.is_member(trip_id));

create function tripsync.create_trip(
  p_name text, p_description text default '', p_timezone text default 'Asia/Bangkok',
  p_join_mode text default 'open'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Invalid timezone' using errcode = '22023';
  end if;
  insert into tripsync.trips(name, description, timezone, join_mode, owner_id)
    values (btrim(p_name), btrim(p_description), p_timezone, p_join_mode, v_user)
    returning id into v_id;
  insert into tripsync.trip_members(trip_id, user_id) values (v_id, v_user);
  return v_id;
end;
$$;

grant select on tripsync.profiles, tripsync.trips, tripsync.trip_members to authenticated;
grant update (display_name, avatar_url) on tripsync.profiles to authenticated;
grant all on all tables in schema tripsync to service_role;
revoke all on all functions in schema tripsync from public, anon, authenticated;
grant execute on function tripsync.is_member(uuid), tripsync.is_owner(uuid), tripsync.shares_trip(uuid),
  tripsync.create_trip(text, text, text, text) to authenticated;
grant execute on all functions in schema tripsync to service_role;

alter publication supabase_realtime add table tripsync.trips, tripsync.trip_members, tripsync.profiles;

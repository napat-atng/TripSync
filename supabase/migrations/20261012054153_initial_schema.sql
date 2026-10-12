create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 120),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  description text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  organizer_id uuid not null references auth.users(id),
  title text not null check (length(trim(title)) between 1 and 160),
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'voting', 'confirmed', 'completed', 'cancelled')),
  vote_deadline timestamptz not null,
  timezone text not null default 'Asia/Bangkok',
  selected_date_option_id uuid,
  selected_place_option_id uuid,
  meeting_at timestamptz,
  meeting_point text,
  plan_version integer not null default 0 check (plan_version >= 0),
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, group_id),
  check (status <> 'confirmed' or (selected_date_option_id is not null and selected_place_option_id is not null and meeting_at is not null and nullif(trim(meeting_point), '') is not null and plan_version > 0))
);

create table public.trip_participants (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invitation_status text not null default 'pending' check (invitation_status in ('pending', 'interested', 'declined')),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table public.date_options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (trip_id, id),
  check (ends_on >= starts_on)
);

create table public.place_options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  address text,
  map_url text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (trip_id, id)
);

alter table public.trips
  add constraint trips_selected_date_same_trip_fk
    foreign key (id, selected_date_option_id) references public.date_options(trip_id, id),
  add constraint trips_selected_place_same_trip_fk
    foreign key (id, selected_place_option_id) references public.place_options(trip_id, id);

create table public.invite_links (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  trip_id uuid,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (trip_id, group_id) references public.trips(id, group_id)
);

create table public.date_votes (
  trip_id uuid not null,
  option_id uuid not null,
  user_id uuid not null,
  response text not null check (response in ('available', 'maybe', 'unavailable')),
  updated_at timestamptz not null default now(),
  primary key (option_id, user_id),
  foreign key (trip_id, option_id) references public.date_options(trip_id, id) on delete cascade,
  foreign key (trip_id, user_id) references public.trip_participants(trip_id, user_id) on delete cascade
);

create table public.place_votes (
  trip_id uuid not null,
  option_id uuid not null,
  user_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (option_id, user_id),
  foreign key (trip_id, option_id) references public.place_options(trip_id, id) on delete cascade,
  foreign key (trip_id, user_id) references public.trip_participants(trip_id, user_id) on delete cascade
);

create table public.vote_submissions (
  trip_id uuid not null,
  user_id uuid not null,
  date_submitted_at timestamptz,
  place_submitted_at timestamptz,
  primary key (trip_id, user_id),
  foreign key (trip_id, user_id) references public.trip_participants(trip_id, user_id) on delete cascade
);

create table public.trip_rsvps (
  trip_id uuid not null,
  user_id uuid not null,
  plan_version integer not null check (plan_version > 0),
  response text not null check (response in ('going', 'maybe', 'not_going')),
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id, plan_version),
  foreign key (trip_id, user_id) references public.trip_participants(trip_id, user_id) on delete cascade
);

create table public.trip_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  actor_id uuid references auth.users(id),
  event_type text not null check (event_type in ('invited', 'voting_opened', 'confirmed', 'plan_changed', 'cancelled')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.notification_reads (
  event_id uuid not null references public.trip_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index group_members_user_id_idx on public.group_members (user_id, group_id);
create index trips_group_status_idx on public.trips (group_id, status, created_at desc);
create index trips_organizer_idx on public.trips (organizer_id);
create index trip_participants_user_idx on public.trip_participants (user_id, trip_id);
create index invite_links_group_idx on public.invite_links (group_id, expires_at);
create index date_options_trip_idx on public.date_options (trip_id);
create index place_options_trip_idx on public.place_options (trip_id);
create index date_votes_trip_option_idx on public.date_votes (trip_id, option_id);
create index place_votes_trip_option_idx on public.place_votes (trip_id, option_id);
create index vote_submissions_user_idx on public.vote_submissions (user_id, trip_id);
create index trip_rsvps_current_idx on public.trip_rsvps (trip_id, plan_version, response);
create index trip_events_trip_created_idx on public.trip_events (trip_id, created_at desc);
create index notification_reads_user_idx on public.notification_reads (user_id, read_at desc);

create function private.is_group_member(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = auth.uid()
  );
$$;

create function private.is_group_admin(p_group_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.group_members m
    where m.group_id = p_group_id and m.user_id = auth.uid() and m.role = 'admin'
  );
$$;

create function private.is_trip_participant(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.trip_participants p
    join public.trips t on t.id = p.trip_id
    join public.group_members m on m.group_id = t.group_id and m.user_id = p.user_id
    where p.trip_id = p_trip_id and p.user_id = auth.uid()
      and p.invitation_status <> 'declined'
  );
$$;

create function private.can_read_profile(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    p_user_id = auth.uid() or exists (
      select 1 from public.group_members mine
      join public.group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = auth.uid() and theirs.user_id = p_user_id
    )
  );
$$;

create function private.can_read_event(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.trip_events e
    join public.trip_participants p on p.trip_id = e.trip_id and p.user_id = auth.uid()
    join public.trips t on t.id = e.trip_id
    join public.group_members m on m.group_id = t.group_id and m.user_id = auth.uid()
    where e.id = p_event_id and p.invitation_status <> 'declined'
  );
$$;

create function private.add_group_creator()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or new.created_by <> auth.uid() then
    raise exception 'invalid group creator' using errcode = '42501';
  end if;
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$;

create trigger groups_add_creator after insert on public.groups
for each row execute function private.add_group_creator();

create function private.add_trip_organizer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or new.organizer_id <> auth.uid() or not private.is_group_member(new.group_id) then
    raise exception 'invalid trip organizer' using errcode = '42501';
  end if;
  insert into public.trip_participants (trip_id, user_id, invitation_status)
  values (new.id, new.organizer_id, 'interested');
  return new;
end;
$$;

create trigger trips_add_organizer after insert on public.trips
for each row execute function private.add_trip_organizer();

revoke all on all functions in schema private from public;
grant execute on function private.is_group_member(uuid), private.is_group_admin(uuid),
  private.is_trip_participant(uuid), private.can_read_profile(uuid), private.can_read_event(uuid)
  to authenticated;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.trips enable row level security;
alter table public.trip_participants enable row level security;
alter table public.date_options enable row level security;
alter table public.place_options enable row level security;
alter table public.invite_links enable row level security;
alter table public.date_votes enable row level security;
alter table public.place_votes enable row level security;
alter table public.vote_submissions enable row level security;
alter table public.trip_rsvps enable row level security;
alter table public.trip_events enable row level security;
alter table public.notification_reads enable row level security;

create policy profiles_read on public.profiles for select to authenticated
  using (private.can_read_profile(user_id));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy groups_read on public.groups for select to authenticated
  using (private.is_group_member(id));
create policy groups_insert on public.groups for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy groups_update on public.groups for update to authenticated
  using (private.is_group_admin(id)) with check (private.is_group_admin(id));

create policy group_members_read on public.group_members for select to authenticated
  using (private.is_group_member(group_id));
create policy trips_read on public.trips for select to authenticated
  using (private.is_group_member(group_id));
create policy trips_insert on public.trips for insert to authenticated
  with check (organizer_id = (select auth.uid()) and private.is_group_member(group_id) and status = 'draft' and plan_version = 0);
create policy trip_participants_read on public.trip_participants for select to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and private.is_group_member(t.group_id)));
create policy date_options_read on public.date_options for select to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and private.is_group_member(t.group_id)));
create policy place_options_read on public.place_options for select to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and private.is_group_member(t.group_id)));
create policy invite_links_read on public.invite_links for select to authenticated
  using (private.is_group_admin(group_id) or exists (
    select 1 from public.trips t where t.id = trip_id and t.organizer_id = (select auth.uid())
  ));
create policy date_votes_read on public.date_votes for select to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and private.is_group_member(t.group_id)));
create policy place_votes_read on public.place_votes for select to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and private.is_group_member(t.group_id)));
create policy vote_submissions_read on public.vote_submissions for select to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and private.is_group_member(t.group_id)));
create policy trip_rsvps_read on public.trip_rsvps for select to authenticated
  using (exists (select 1 from public.trips t where t.id = trip_id and private.is_group_member(t.group_id)));
create policy trip_events_read on public.trip_events for select to authenticated
  using (private.is_trip_participant(trip_id));
create policy notification_reads_read on public.notification_reads for select to authenticated
  using (user_id = (select auth.uid()));
create policy notification_reads_insert on public.notification_reads for insert to authenticated
  with check (user_id = (select auth.uid()) and private.can_read_event(event_id));
create policy notification_reads_update on public.notification_reads for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and private.can_read_event(event_id));

grant usage on schema public to authenticated;
grant select on public.profiles, public.groups, public.group_members, public.trips,
  public.trip_participants, public.date_options, public.place_options, public.invite_links,
  public.date_votes, public.place_votes, public.vote_submissions, public.trip_rsvps,
  public.trip_events, public.notification_reads to authenticated;
grant insert (user_id, display_name, avatar_url), update (display_name, avatar_url, updated_at)
  on public.profiles to authenticated;
grant insert (name, description, created_by), update (name, description)
  on public.groups to authenticated;
grant insert (group_id, organizer_id, title, description, vote_deadline, timezone)
  on public.trips to authenticated;
grant insert (event_id, user_id), update (read_at)
  on public.notification_reads to authenticated;

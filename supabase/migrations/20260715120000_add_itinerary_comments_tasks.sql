-- ================================================================
-- TripSync — Itinerary Builder, Discussion, and To-Do/Packing List
-- ================================================================

-- ----------------------------------------------------------------
-- trips: add duration_days so the Itinerary Builder can generate
-- day-by-day tabs from confirmed_date + duration_days
-- ----------------------------------------------------------------
alter table public.trips
  add column if not exists duration_days integer;

alter table public.trips
  drop constraint if exists trips_duration_days_check;
alter table public.trips
  add constraint trips_duration_days_check check (duration_days is null or (duration_days between 1 and 60));

-- ----------------------------------------------------------------
-- Helper: is the current user the 'leader' of this trip?
-- Distinct from is_trip_creator — leadership lives on trip_members.role,
-- so this still works for trips where created_by is null (guest flows).
-- ----------------------------------------------------------------
create or replace function public.is_trip_leader(target_trip_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = target_trip_id and user_id = auth.uid() and role = 'leader'
  );
$$;

grant execute on function public.is_trip_leader(uuid) to authenticated;

-- ----------------------------------------------------------------
-- Generic updated_at trigger helper (reusable)
-- ----------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ================================================================
-- 1) itinerary_events — day-by-day timeline
-- ================================================================
create table if not exists public.itinerary_events (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  event_date    date not null,
  title         text not null,
  description   text,
  start_time    time not null,
  end_time      time,
  location      text,
  cost_estimate numeric,
  created_by    uuid references public.trip_members(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint itinerary_events_time_check check (end_time is null or end_time >= start_time),
  constraint itinerary_events_cost_check check (cost_estimate is null or cost_estimate >= 0)
);

create index if not exists idx_itinerary_events_trip_id   on public.itinerary_events(trip_id);
create index if not exists idx_itinerary_events_trip_date on public.itinerary_events(trip_id, event_date, start_time);

drop trigger if exists set_itinerary_events_updated_at on public.itinerary_events;
create trigger set_itinerary_events_updated_at
  before update on public.itinerary_events
  for each row execute function public.set_updated_at();

alter table public.itinerary_events enable row level security;

drop policy if exists "Trip members can read itinerary events"  on public.itinerary_events;
drop policy if exists "Trip leaders can manage itinerary events" on public.itinerary_events;
create policy "Trip members can read itinerary events" on public.itinerary_events
  for select using (public.is_trip_member(trip_id));
create policy "Trip leaders can manage itinerary events" on public.itinerary_events
  for all using (public.is_trip_leader(trip_id)) with check (public.is_trip_leader(trip_id));

alter publication supabase_realtime add table public.itinerary_events;

-- ================================================================
-- 2) trip_comments — general trip discussion, or scoped to a
--    specific itinerary event (itinerary_event_id null = general)
-- ================================================================
create table if not exists public.trip_comments (
  id                  uuid primary key default gen_random_uuid(),
  trip_id             uuid not null references public.trips(id) on delete cascade,
  itinerary_event_id  uuid references public.itinerary_events(id) on delete cascade,
  member_id           uuid not null references public.trip_members(id) on delete cascade,
  message             text not null check (char_length(btrim(message)) > 0),
  created_at          timestamptz not null default now()
);

create index if not exists idx_trip_comments_trip_id  on public.trip_comments(trip_id, created_at);
create index if not exists idx_trip_comments_event_id on public.trip_comments(itinerary_event_id);

-- Guard: if a comment is scoped to an event, that event must belong to the same trip
create or replace function public.validate_comment_event_trip()
returns trigger
language plpgsql
as $$
declare
  event_trip_id uuid;
begin
  if new.itinerary_event_id is not null then
    select trip_id into event_trip_id from public.itinerary_events where id = new.itinerary_event_id;
    if event_trip_id is distinct from new.trip_id then
      raise exception 'Comment itinerary_event_id must belong to the same trip';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_comment_event_trip_before_write on public.trip_comments;
create trigger validate_comment_event_trip_before_write
  before insert or update on public.trip_comments
  for each row execute function public.validate_comment_event_trip();

alter table public.trip_comments enable row level security;

drop policy if exists "Trip members can read comments"  on public.trip_comments;
drop policy if exists "Trip members can post comments"  on public.trip_comments;
drop policy if exists "Members can delete own comments" on public.trip_comments;
create policy "Trip members can read comments" on public.trip_comments
  for select using (public.is_trip_member(trip_id));
create policy "Trip members can post comments" on public.trip_comments
  for insert with check (
    exists (
      select 1 from public.trip_members tm
      where tm.id = trip_comments.member_id
        and tm.trip_id = trip_comments.trip_id
        and tm.user_id = auth.uid()
    )
  );
create policy "Members can delete own comments" on public.trip_comments
  for delete using (
    exists (
      select 1 from public.trip_members tm
      where tm.id = trip_comments.member_id and tm.user_id = auth.uid()
    )
  );

alter publication supabase_realtime add table public.trip_comments;

-- ================================================================
-- 3) trip_tasks — shared to-do / packing checklist
-- ================================================================
create table if not exists public.trip_tasks (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references public.trips(id) on delete cascade,
  title         text not null,
  is_completed  boolean not null default false,
  assigned_to   uuid references public.trip_members(id) on delete set null,
  created_by    uuid references public.trip_members(id) on delete set null,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create index if not exists idx_trip_tasks_trip_id     on public.trip_tasks(trip_id);
create index if not exists idx_trip_tasks_assigned_to on public.trip_tasks(assigned_to);

alter table public.trip_tasks enable row level security;

-- Any trip member can create/edit/check off/assign tasks — it's a shared list
drop policy if exists "Trip members can read tasks"   on public.trip_tasks;
drop policy if exists "Trip members can manage tasks" on public.trip_tasks;
create policy "Trip members can read tasks" on public.trip_tasks
  for select using (public.is_trip_member(trip_id));
create policy "Trip members can manage tasks" on public.trip_tasks
  for all using (public.is_trip_member(trip_id)) with check (public.is_trip_member(trip_id));

alter publication supabase_realtime add table public.trip_tasks;

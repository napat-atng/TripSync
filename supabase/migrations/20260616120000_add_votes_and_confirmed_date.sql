-- ================================================================
-- TripSync — add confirmed_date + voting feature
-- ================================================================

-- Add confirmed_date to trips (for "Set as trip date")
alter table public.trips
  add column if not exists confirmed_date date;

-- ----------------------------------------------------------------
-- Votes (simple Yes/No poll created by the leader)
-- ----------------------------------------------------------------
create table if not exists public.votes (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  created_by  uuid not null references public.trip_members(id) on delete cascade,
  title       text not null,
  description text,
  status      text not null default 'open',
  created_at  timestamptz not null default now(),
  constraint votes_status_check check (status in ('open', 'closed'))
);

create table if not exists public.vote_responses (
  id         uuid primary key default gen_random_uuid(),
  vote_id    uuid not null references public.votes(id) on delete cascade,
  member_id  uuid not null references public.trip_members(id) on delete cascade,
  answer     boolean not null, -- true = yes, false = no
  created_at timestamptz not null default now(),
  unique (vote_id, member_id)
);

create index if not exists idx_votes_trip_id            on public.votes(trip_id);
create index if not exists idx_vote_responses_vote_id    on public.vote_responses(vote_id);
create index if not exists idx_vote_responses_member_id  on public.vote_responses(member_id);

-- ----------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------
alter table public.votes          enable row level security;
alter table public.vote_responses enable row level security;

drop policy if exists "Trip members can read votes"   on public.votes;
drop policy if exists "Trip creators can create votes" on public.votes;
drop policy if exists "Trip creators can update votes" on public.votes;
create policy "Trip members can read votes" on public.votes for select
  using (public.is_trip_member(trip_id));
create policy "Trip creators can create votes" on public.votes for insert
  with check (public.is_trip_creator(trip_id));
create policy "Trip creators can update votes" on public.votes for update
  using (public.is_trip_creator(trip_id)) with check (public.is_trip_creator(trip_id));

drop policy if exists "Trip members can read vote responses"   on public.vote_responses;
drop policy if exists "Trip members can submit own vote response" on public.vote_responses;
create policy "Trip members can read vote responses" on public.vote_responses for select
  using (exists (
    select 1 from public.votes v where v.id = vote_responses.vote_id and public.is_trip_member(v.trip_id)
  ));
create policy "Trip members can submit own vote response" on public.vote_responses for all
  using (exists (
    select 1 from public.trip_members tm
    where tm.id = vote_responses.member_id and tm.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.trip_members tm
    where tm.id = vote_responses.member_id and tm.user_id = auth.uid()
  ));

-- Enable realtime for vote_responses (and votes) so clients can subscribe
alter publication supabase_realtime add table public.votes;
alter publication supabase_realtime add table public.vote_responses;

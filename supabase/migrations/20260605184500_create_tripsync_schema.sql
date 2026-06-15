-- ================================================================
-- TripSync Schema — fixed version
-- แก้ composite FK ใน availability และ expenses
-- ================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------
-- Functions
-- ----------------------------------------------------------------

create or replace function public.generate_invite_token()
returns text
language sql
volatile
as $$
  select string_agg(substr('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', floor(random() * 62)::int + 1, 1), '')
  from generate_series(1, 8);
$$;

create or replace function public.set_trip_invite_token()
returns trigger
language plpgsql
as $$
begin
  if new.invite_token is null or new.invite_token = '' then
    loop
      new.invite_token := public.generate_invite_token();
      exit when not exists (
        select 1 from public.trips where invite_token = new.invite_token
      );
    end loop;
  end if;
  return new;
end;
$$;

create or replace function public.validate_survey_response_trip_member()
returns trigger
language plpgsql
as $$
declare
  question_trip_id uuid;
  member_trip_id   uuid;
begin
  select trip_id into question_trip_id from public.survey_questions where id = new.question_id;
  select trip_id into member_trip_id   from public.trip_members      where id = new.member_id;
  if question_trip_id is distinct from member_trip_id then
    raise exception 'Survey response member must belong to the same trip as the question';
  end if;
  return new;
end;
$$;

create or replace function public.validate_expense_split_trip_member()
returns trigger
language plpgsql
as $$
declare
  expense_trip_id uuid;
  member_trip_id  uuid;
begin
  select trip_id into expense_trip_id from public.expenses     where id = new.expense_id;
  select trip_id into member_trip_id  from public.trip_members where id = new.member_id;
  if expense_trip_id is distinct from member_trip_id then
    raise exception 'Expense split member must belong to the same trip as the expense';
  end if;
  return new;
end;
$$;

-- ----------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------

create table if not exists public.users (
  id          uuid primary key,
  name        text        not null,
  email       text        not null unique,
  avatar_url  text,
  provider    text,
  provider_id text,
  created_at  timestamptz not null default now(),
  unique (provider, provider_id)
);

create table if not exists public.trips (
  id           uuid primary key default gen_random_uuid(),
  created_by   uuid        not null references public.users(id) on delete cascade,
  title        text        not null,
  description  text,
  status       text        not null default 'planning',
  invite_token text        not null unique,
  created_at   timestamptz not null default now(),
  constraint trips_status_check check (status in ('planning', 'active', 'completed', 'cancelled'))
);

create table if not exists public.trip_members (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid        not null references public.trips(id) on delete cascade,
  user_id      uuid                 references public.users(id) on delete set null,
  role         text        not null default 'member',
  display_name text        not null,
  joined_at    timestamptz not null default now(),
  constraint trip_members_role_check check (role in ('owner', 'admin', 'member')),
  unique (trip_id, user_id)
);

create table if not exists public.survey_questions (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references public.trips(id) on delete cascade,
  type        text not null,
  question    text not null,
  options     jsonb not null default '[]'::jsonb,
  order_index int  not null default 0,
  constraint survey_questions_type_check check (type in ('single_choice', 'multiple_choice', 'text', 'date', 'rating')),
  unique (trip_id, order_index)
);

create table if not exists public.survey_responses (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid        not null references public.survey_questions(id) on delete cascade,
  member_id    uuid        not null references public.trip_members(id)     on delete cascade,
  answer       jsonb       not null,
  submitted_at timestamptz not null default now(),
  unique (question_id, member_id)
);

create table if not exists public.availability (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid    not null references public.trips(id)        on delete cascade,
  member_id  uuid    not null references public.trip_members(id) on delete cascade,
  date       date    not null,
  available  boolean not null default false,
  unique (trip_id, member_id, date)
);

create table if not exists public.expenses (
  id           uuid        primary key default gen_random_uuid(),
  trip_id      uuid        not null references public.trips(id)        on delete cascade,
  paid_by      uuid        not null references public.trip_members(id) on delete restrict,
  title        text        not null,
  amount       numeric     not null,
  currency     text        not null default 'THB',
  expense_date timestamptz not null default now(),
  constraint expenses_amount_check   check (amount >= 0),
  constraint expenses_currency_check check (currency ~ '^[A-Z]{3}$')
);

create table if not exists public.expense_splits (
  id           uuid    primary key default gen_random_uuid(),
  expense_id   uuid    not null references public.expenses(id)     on delete cascade,
  member_id    uuid    not null references public.trip_members(id) on delete cascade,
  share_amount numeric not null,
  settled      boolean not null default false,
  constraint expense_splits_share_amount_check check (share_amount >= 0),
  unique (expense_id, member_id)
);

-- ----------------------------------------------------------------
-- Triggers
-- ----------------------------------------------------------------

drop trigger if exists set_trip_invite_token_before_insert on public.trips;
create trigger set_trip_invite_token_before_insert
  before insert on public.trips
  for each row execute function public.set_trip_invite_token();

drop trigger if exists validate_survey_response_trip_member_before_write on public.survey_responses;
create trigger validate_survey_response_trip_member_before_write
  before insert or update on public.survey_responses
  for each row execute function public.validate_survey_response_trip_member();

drop trigger if exists validate_expense_split_trip_member_before_write on public.expense_splits;
create trigger validate_expense_split_trip_member_before_write
  before insert or update on public.expense_splits
  for each row execute function public.validate_expense_split_trip_member();

-- ----------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------

create index if not exists idx_trips_created_by             on public.trips(created_by);
create index if not exists idx_trip_members_trip_id         on public.trip_members(trip_id);
create index if not exists idx_trip_members_user_id         on public.trip_members(user_id);
create index if not exists idx_survey_questions_trip_id     on public.survey_questions(trip_id);
create index if not exists idx_survey_responses_question_id on public.survey_responses(question_id);
create index if not exists idx_survey_responses_member_id   on public.survey_responses(member_id);
create index if not exists idx_availability_trip_id         on public.availability(trip_id);
create index if not exists idx_availability_member_id       on public.availability(member_id);
create index if not exists idx_expenses_trip_id             on public.expenses(trip_id);
create index if not exists idx_expense_splits_expense_id    on public.expense_splits(expense_id);
create index if not exists idx_expense_splits_member_id     on public.expense_splits(member_id);

-- ----------------------------------------------------------------
-- Helper functions (RLS)
-- ----------------------------------------------------------------

create or replace function public.is_trip_member(target_trip_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = target_trip_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_trip_creator(target_trip_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.trips
    where id = target_trip_id and created_by = auth.uid()
  );
$$;

-- ----------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------

alter table public.users          enable row level security;
alter table public.trips          enable row level security;
alter table public.trip_members   enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_responses enable row level security;
alter table public.availability   enable row level security;
alter table public.expenses       enable row level security;
alter table public.expense_splits enable row level security;

-- users
drop policy if exists "Users can read themselves"   on public.users;
drop policy if exists "Users can create themselves" on public.users;
drop policy if exists "Users can update themselves" on public.users;
create policy "Users can read themselves"   on public.users for select using (id = auth.uid());
create policy "Users can create themselves" on public.users for insert with check (id = auth.uid());
create policy "Users can update themselves" on public.users for update using (id = auth.uid()) with check (id = auth.uid());

-- trips
drop policy if exists "Trip members can read trips"  on public.trips;
drop policy if exists "Creators can create trips"    on public.trips;
drop policy if exists "Creators can update trips"    on public.trips;
drop policy if exists "Creators can delete trips"    on public.trips;
create policy "Trip members can read trips" on public.trips for select using (public.is_trip_member(id));
create policy "Creators can create trips"  on public.trips for insert with check (created_by = auth.uid());
create policy "Creators can update trips"  on public.trips for update using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "Creators can delete trips"  on public.trips for delete using (created_by = auth.uid());

-- trip_members
drop policy if exists "Trip members can read trip members"    on public.trip_members;
drop policy if exists "Trip creators can add trip members"    on public.trip_members;
drop policy if exists "Trip creators can update trip members" on public.trip_members;
drop policy if exists "Trip creators can delete trip members" on public.trip_members;
create policy "Trip members can read trip members"    on public.trip_members for select using (public.is_trip_member(trip_id));
create policy "Trip creators can add trip members"    on public.trip_members for insert with check (public.is_trip_creator(trip_id));
create policy "Trip creators can update trip members" on public.trip_members for update using (public.is_trip_creator(trip_id)) with check (public.is_trip_creator(trip_id));
create policy "Trip creators can delete trip members" on public.trip_members for delete using (public.is_trip_creator(trip_id));

-- survey_questions
drop policy if exists "Trip members can read survey questions"    on public.survey_questions;
drop policy if exists "Trip creators can manage survey questions" on public.survey_questions;
create policy "Trip members can read survey questions"    on public.survey_questions for select using (public.is_trip_member(trip_id));
create policy "Trip creators can manage survey questions" on public.survey_questions for all    using (public.is_trip_creator(trip_id)) with check (public.is_trip_creator(trip_id));

-- survey_responses
drop policy if exists "Trip members can read survey responses"        on public.survey_responses;
drop policy if exists "Trip members can submit survey responses"      on public.survey_responses;
drop policy if exists "Trip members can update own survey responses"  on public.survey_responses;
create policy "Trip members can read survey responses" on public.survey_responses for select
  using (exists (
    select 1 from public.survey_questions sq
    where sq.id = survey_responses.question_id and public.is_trip_member(sq.trip_id)
  ));
create policy "Trip members can submit survey responses" on public.survey_responses for insert
  with check (exists (
    select 1 from public.survey_questions sq
    join public.trip_members tm on tm.id = survey_responses.member_id and tm.trip_id = sq.trip_id
    where sq.id = survey_responses.question_id and tm.user_id = auth.uid()
  ));
create policy "Trip members can update own survey responses" on public.survey_responses for update
  using (exists (
    select 1 from public.trip_members tm
    where tm.id = survey_responses.member_id and tm.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.survey_questions sq
    join public.trip_members tm on tm.id = survey_responses.member_id and tm.trip_id = sq.trip_id
    where sq.id = survey_responses.question_id and tm.user_id = auth.uid()
  ));

-- availability
drop policy if exists "Trip members can read availability"        on public.availability;
drop policy if exists "Trip members can manage own availability"  on public.availability;
create policy "Trip members can read availability" on public.availability for select
  using (public.is_trip_member(trip_id));
create policy "Trip members can manage own availability" on public.availability for all
  using (exists (
    select 1 from public.trip_members tm
    where tm.id = availability.member_id and tm.trip_id = availability.trip_id and tm.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.trip_members tm
    where tm.id = availability.member_id and tm.trip_id = availability.trip_id and tm.user_id = auth.uid()
  ));

-- expenses
drop policy if exists "Trip members can read expenses"        on public.expenses;
drop policy if exists "Trip members can create expenses"      on public.expenses;
drop policy if exists "Trip members can update own expenses"  on public.expenses;
create policy "Trip members can read expenses" on public.expenses for select using (public.is_trip_member(trip_id));
create policy "Trip members can create expenses" on public.expenses for insert
  with check (exists (
    select 1 from public.trip_members tm
    where tm.id = expenses.paid_by and tm.trip_id = expenses.trip_id and tm.user_id = auth.uid()
  ));
create policy "Trip members can update own expenses" on public.expenses for update
  using (exists (
    select 1 from public.trip_members tm
    where tm.id = expenses.paid_by and tm.trip_id = expenses.trip_id and tm.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.trip_members tm
    where tm.id = expenses.paid_by and tm.trip_id = expenses.trip_id and tm.user_id = auth.uid()
  ));

-- expense_splits
drop policy if exists "Trip members can read expense splits"        on public.expense_splits;
drop policy if exists "Expense payers can manage expense splits"    on public.expense_splits;
create policy "Trip members can read expense splits" on public.expense_splits for select
  using (exists (
    select 1 from public.expenses e
    where e.id = expense_splits.expense_id and public.is_trip_member(e.trip_id)
  ));
create policy "Expense payers can manage expense splits" on public.expense_splits for all
  using (exists (
    select 1 from public.expenses e
    join public.trip_members payer on payer.id = e.paid_by
    join public.trip_members sm    on sm.id    = expense_splits.member_id
    where e.id = expense_splits.expense_id
      and sm.trip_id    = e.trip_id
      and payer.trip_id = e.trip_id
      and payer.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.expenses e
    join public.trip_members payer on payer.id = e.paid_by
    join public.trip_members sm    on sm.id    = expense_splits.member_id
    where e.id = expense_splits.expense_id
      and sm.trip_id    = e.trip_id
      and payer.trip_id = e.trip_id
      and payer.user_id = auth.uid()
  ));

-- ----------------------------------------------------------------
-- Grants
-- ----------------------------------------------------------------

grant execute on function public.generate_invite_token() to anon, authenticated;
grant execute on function public.is_trip_member(uuid)    to authenticated;
grant execute on function public.is_trip_creator(uuid)   to authenticated;

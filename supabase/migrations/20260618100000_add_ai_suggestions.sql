-- Add ai_suggestions column to trips for caching Claude's suggestions
alter table public.trips
  add column if not exists ai_suggestions jsonb;

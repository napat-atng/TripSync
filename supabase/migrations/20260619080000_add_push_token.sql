-- Add push_token column to users for Expo push notifications
alter table public.users
  add column if not exists push_token text;

-- Index for fast lookup when sending notifications to multiple users
create index if not exists idx_users_push_token on public.users(push_token)
  where push_token is not null;

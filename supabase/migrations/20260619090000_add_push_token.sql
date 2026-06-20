-- Add push_token column to users for Expo push notifications
alter table public.users
  add column if not exists push_token text;

-- Allow users to update their own push_token
drop policy if exists "Users can update own push token" on public.users;
create policy "Users can update own push token" on public.users
  for update using (id = auth.uid())
  with check (id = auth.uid());

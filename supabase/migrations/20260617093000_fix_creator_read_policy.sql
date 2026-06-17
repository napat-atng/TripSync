-- ================================================================
-- Fix Creator Read Policy & User Sync
-- ================================================================

-- 1. Fix the 403 Forbidden on createTrip
-- The .insert().select() requires a SELECT policy to return the inserted row.
-- Creators need to be able to read the trip immediately after creation, 
-- before they are added to trip_members.
create policy "Creators can read trips" on public.trips for select using (created_by = auth.uid());

-- 2. Automatically sync auth.users to public.users
-- Since trips.created_by references public.users(id), we need to ensure users exist there.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Backfill any existing users that might have been created before the trigger
insert into public.users (id, name, email)
select id, coalesce(raw_user_meta_data->>'name', email), email
from auth.users
on conflict (id) do nothing;

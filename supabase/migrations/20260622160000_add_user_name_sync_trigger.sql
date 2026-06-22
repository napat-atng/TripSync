-- Trigger to automatically sync user's name to all their trip_members rows
-- This runs securely on the server and bypasses the RLS policy that prevents 
-- regular members from updating their own trip_members rows directly.

create or replace function public.sync_user_name_to_trip_members()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.name is distinct from old.name and new.name is not null then
    update public.trip_members
    set display_name = new.name
    where user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_user_name_on_update on public.users;
create trigger sync_user_name_on_update
  after update on public.users
  for each row execute function public.sync_user_name_to_trip_members();

-- In case a user joins and then later their name changes, or vice versa
drop trigger if exists sync_user_name_on_insert on public.users;
create trigger sync_user_name_on_insert
  after insert on public.users
  for each row execute function public.sync_user_name_to_trip_members();

-- Add DELETE policy for votes so Trip Creators can delete them

drop policy if exists "Trip creators can delete votes" on public.votes;
create policy "Trip creators can delete votes" on public.votes for delete
  using (public.is_trip_creator(trip_id));

-- Allow trip creator to delete their own trips
-- (cascade delete handles child tables automatically via FK ON DELETE CASCADE)

drop policy if exists "Creators can delete trips" on public.trips;
create policy "Creators can delete trips" on public.trips
  for delete using (created_by = auth.uid());

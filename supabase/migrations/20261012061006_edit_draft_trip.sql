create policy trips_update_draft on public.trips for update to authenticated
  using (status = 'draft' and organizer_id = (select auth.uid())
    and private.is_group_member(group_id))
  with check (status = 'draft' and organizer_id = (select auth.uid())
    and private.is_group_member(group_id) and vote_deadline > clock_timestamp());

grant update (title, description, vote_deadline, updated_at)
  on public.trips to authenticated;

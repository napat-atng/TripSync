drop policy trip_participants_respond on public.trip_participants;

create policy trip_participants_respond on public.trip_participants for update to authenticated
  using (
    user_id = (select auth.uid()) and exists (
      select 1 from public.trips t
      where t.id = trip_participants.trip_id
        and t.status not in ('cancelled', 'completed')
        and private.is_group_member(t.group_id)
    )
  )
  with check (
    user_id = (select auth.uid()) and invitation_status in ('interested', 'declined')
    and exists (
      select 1 from public.trips t
      where t.id = trip_participants.trip_id
        and t.status not in ('cancelled', 'completed')
        and private.is_group_member(t.group_id)
        and (t.organizer_id <> trip_participants.user_id or invitation_status = 'interested')
    )
  );

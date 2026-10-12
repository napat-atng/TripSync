create policy trip_participants_invite on public.trip_participants for insert to authenticated
  with check (
    invitation_status = 'pending'
    and exists (
      select 1 from public.trips t
      join public.group_members m on m.group_id = t.group_id
        and m.user_id = trip_participants.user_id
      where t.id = trip_participants.trip_id
        and t.organizer_id = (select auth.uid()) and t.status = 'draft'
    )
  );

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
    )
  );

create policy trip_participants_remove on public.trip_participants for delete to authenticated
  using (
    user_id <> (select auth.uid()) and exists (
      select 1 from public.trips t
      where t.id = trip_participants.trip_id
        and t.organizer_id = (select auth.uid()) and t.status = 'draft'
    )
  );

grant insert (trip_id, user_id, invitation_status), update (invitation_status), delete
  on public.trip_participants to authenticated;

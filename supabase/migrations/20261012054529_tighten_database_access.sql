-- The project-provided event trigger runs as postgres; API roles need no EXECUTE.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

create index date_options_created_by_idx on public.date_options (created_by);
create index date_votes_participant_idx on public.date_votes (trip_id, user_id);
create index groups_created_by_idx on public.groups (created_by);
create index invite_links_created_by_idx on public.invite_links (created_by);
create index invite_links_trip_group_idx on public.invite_links (trip_id, group_id);
create index place_options_created_by_idx on public.place_options (created_by);
create index place_votes_participant_idx on public.place_votes (trip_id, user_id);
create index trip_events_actor_idx on public.trip_events (actor_id);
create index trips_selected_date_idx on public.trips (id, selected_date_option_id);
create index trips_selected_place_idx on public.trips (id, selected_place_option_id);

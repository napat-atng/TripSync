create function private.manage_group_member(p_group_id uuid, p_user_id uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  member_role text;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  perform 1 from public.groups where id = p_group_id for update;
  if not found or not private.is_group_admin(p_group_id) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  select role into member_role from public.group_members
    where group_id = p_group_id and user_id = p_user_id for update;
  if member_role is null or p_action not in ('promote', 'demote', 'remove') then
    raise exception 'invalid_member_action' using errcode = '22023';
  end if;
  if p_action in ('demote', 'remove') and member_role = 'admin'
     and (select count(*) from public.group_members
          where group_id = p_group_id and role = 'admin') <= 1 then
    raise exception 'last_admin' using errcode = '22023';
  end if;
  if p_action = 'remove' then
    if exists (select 1 from public.trips where group_id = p_group_id
        and organizer_id = p_user_id and status in ('draft', 'voting', 'confirmed')) then
      raise exception 'transfer_active_trips_first' using errcode = '22023';
    end if;
    delete from public.group_members where group_id = p_group_id and user_id = p_user_id;
  else
    update public.group_members set role = case when p_action = 'promote' then 'admin' else 'member' end
      where group_id = p_group_id and user_id = p_user_id;
  end if;
end;
$$;

create function private.transfer_trip_organizer(p_trip_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  trip_row public.trips%rowtype;
  target_group_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select group_id into target_group_id from public.trips where id = p_trip_id;
  if target_group_id is null then raise exception 'not_admin' using errcode = '42501'; end if;
  perform 1 from public.groups where id = target_group_id for update;
  select * into trip_row from public.trips where id = p_trip_id for update;
  if not found or not private.is_group_admin(trip_row.group_id) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if trip_row.status not in ('draft', 'voting', 'confirmed')
     or trip_row.organizer_id = p_user_id
     or not exists (select 1 from public.group_members
       where group_id = trip_row.group_id and user_id = p_user_id) then
    raise exception 'invalid_transfer' using errcode = '22023';
  end if;
  insert into public.trip_participants (trip_id, user_id, invitation_status)
    values (p_trip_id, p_user_id, 'interested')
    on conflict on constraint trip_participants_pkey do update
      set invitation_status = 'interested';
  update public.trips set organizer_id = p_user_id, updated_at = now() where id = p_trip_id;
end;
$$;

revoke all on function private.manage_group_member(uuid, uuid, text),
  private.transfer_trip_organizer(uuid, uuid) from public;
grant execute on function private.manage_group_member(uuid, uuid, text),
  private.transfer_trip_organizer(uuid, uuid) to authenticated;

create function public.manage_group_member(p_group_id uuid, p_user_id uuid, p_action text)
returns void language sql security invoker set search_path = '' as $$
  select private.manage_group_member(p_group_id, p_user_id, p_action);
$$;
create function public.transfer_trip_organizer(p_trip_id uuid, p_user_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.transfer_trip_organizer(p_trip_id, p_user_id);
$$;
revoke all on function public.manage_group_member(uuid, uuid, text),
  public.transfer_trip_organizer(uuid, uuid) from public, anon;
grant execute on function public.manage_group_member(uuid, uuid, text),
  public.transfer_trip_organizer(uuid, uuid) to authenticated;

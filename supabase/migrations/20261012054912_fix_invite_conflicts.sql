create or replace function private.accept_invite(p_token text)
returns table (group_id uuid, trip_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  link_row public.invite_links%rowtype;
  trip_status text;
begin
  if auth.uid() is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'invite_not_found' using errcode = '22023';
  end if;

  select * into link_row from public.invite_links l
    where l.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    for update;
  if not found then raise exception 'invite_not_found' using errcode = '22023'; end if;
  if link_row.revoked_at is not null then raise exception 'invite_revoked' using errcode = '22023'; end if;
  if link_row.expires_at <= now() then raise exception 'invite_expired' using errcode = '22023'; end if;

  if link_row.trip_id is not null then
    select t.status into trip_status from public.trips t where t.id = link_row.trip_id;
    if trip_status in ('cancelled', 'completed') then
      raise exception 'invite_closed' using errcode = '22023';
    end if;
  end if;

  insert into public.group_members (group_id, user_id)
    values (link_row.group_id, auth.uid())
    on conflict on constraint group_members_pkey do nothing;

  if link_row.trip_id is not null then
    insert into public.trip_participants (trip_id, user_id, invitation_status)
      values (link_row.trip_id, auth.uid(), 'interested')
      on conflict on constraint trip_participants_pkey
      do update set invitation_status = 'interested';
  end if;

  return query select link_row.group_id, link_row.trip_id;
end;
$$;

create policy invite_links_insert on public.invite_links for insert to authenticated
  with check (
    created_by = (select auth.uid()) and revoked_at is null
    and expires_at > now() and expires_at <= now() + interval '30 days'
    and (
      (trip_id is null and private.is_group_admin(group_id))
      or (trip_id is not null and exists (
        select 1 from public.trips t
        where t.id = trip_id and t.group_id = invite_links.group_id
          and t.organizer_id = (select auth.uid())
          and t.status not in ('cancelled', 'completed')
      ))
    )
  );

create policy invite_links_revoke on public.invite_links for update to authenticated
  using (
    (trip_id is null and private.is_group_admin(group_id)) or (trip_id is not null and exists (
      select 1 from public.trips t
      where t.id = trip_id and t.organizer_id = (select auth.uid())
    ))
  )
  with check (
    revoked_at is not null and (
      (trip_id is null and private.is_group_admin(group_id)) or (trip_id is not null and exists (
        select 1 from public.trips t
        where t.id = trip_id and t.organizer_id = (select auth.uid())
      ))
    )
  );

grant insert (group_id, trip_id, token_hash, created_by, expires_at), update (revoked_at)
  on public.invite_links to authenticated;

create function private.preview_invite(p_token text)
returns table (group_name text, trip_title text, invite_status text)
language plpgsql stable security definer set search_path = '' as $$
declare
  link_row record;
begin
  if auth.uid() is null or p_token !~ '^[0-9a-f]{64}$' then
    return query select null::text, null::text, 'not_found'::text;
    return;
  end if;

  select l.expires_at, l.revoked_at, g.name, t.title, t.status
    into link_row
    from public.invite_links l
    join public.groups g on g.id = l.group_id
    left join public.trips t on t.id = l.trip_id
    where l.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if not found then
    return query select null::text, null::text, 'not_found'::text;
  elsif link_row.revoked_at is not null then
    return query select null::text, null::text, 'revoked'::text;
  elsif link_row.expires_at <= now() then
    return query select null::text, null::text, 'expired'::text;
  elsif link_row.status in ('cancelled', 'completed') then
    return query select null::text, null::text, 'closed'::text;
  else
    return query select link_row.name::text, link_row.title::text, 'valid'::text;
  end if;
end;
$$;

create function private.accept_invite(p_token text)
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
    on conflict (group_id, user_id) do nothing;

  if link_row.trip_id is not null then
    insert into public.trip_participants (trip_id, user_id, invitation_status)
      values (link_row.trip_id, auth.uid(), 'interested')
      on conflict (trip_id, user_id) do update set invitation_status = 'interested';
  end if;

  return query select link_row.group_id, link_row.trip_id;
end;
$$;

revoke all on function private.preview_invite(text), private.accept_invite(text) from public;
grant execute on function private.preview_invite(text), private.accept_invite(text) to authenticated;

create function public.preview_invite(p_token text)
returns table (group_name text, trip_title text, invite_status text)
language sql stable security invoker set search_path = '' as $$
  select * from private.preview_invite(p_token);
$$;

create function public.accept_invite(p_token text)
returns table (group_id uuid, trip_id uuid)
language sql security invoker set search_path = '' as $$
  select * from private.accept_invite(p_token);
$$;

revoke all on function public.preview_invite(text), public.accept_invite(text) from public, anon;
grant execute on function public.preview_invite(text), public.accept_invite(text) to authenticated;

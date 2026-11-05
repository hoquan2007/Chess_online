-- S5: account-owned friend requests, blocks and notification inbox.
-- Apply to isolated staging only after independent review and RLS tests.
create table public.friendships (
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_low, user_high),
  constraint friendship_order check (user_low < user_high),
  constraint friendship_requester check (requested_by in (user_low, user_high)),
  constraint friendship_accept_time check ((status = 'accepted') = (accepted_at is not null))
);
create index friendships_high_idx on public.friendships(user_high);

create table public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.social_notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('friend_request','friend_accepted')),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (recipient_id <> actor_id)
);
create index social_notifications_inbox_idx on public.social_notifications(recipient_id, created_at desc);

-- Retain an independent send counter after a friendship is withdrawn, so
-- repeated request/withdraw cycles cannot bypass the rolling rate cap.
create table public.friend_request_attempts (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default clock_timestamp()
);
create index friend_request_attempts_idx on public.friend_request_attempts(actor_id, created_at desc);

alter table public.friendships enable row level security;
alter table public.user_blocks enable row level security;
alter table public.social_notifications enable row level security;
alter table public.friend_request_attempts enable row level security;

create policy friendship_members_read on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_low, user_high));
create policy user_blocks_own_read on public.user_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy social_notifications_own_read on public.social_notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

revoke all on public.friendships, public.user_blocks, public.social_notifications,
  public.friend_request_attempts from public, anon, authenticated;
grant select on public.friendships, public.user_blocks, public.social_notifications to authenticated;

-- Realtime publishes account-owned inbox changes as refresh hints. The
-- recipient-only SELECT policy above also governs Postgres Changes delivery;
-- the browser always refetches its inbox through the authenticated API.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'social_notifications'
     ) then
    alter publication supabase_realtime add table public.social_notifications;
  end if;
end;
$$;

-- Execute with the caller's JWT. The actor is always auth.uid(), never a
-- client-supplied user ID. Only this function can mutate social tables.
create or replace function public.rookline_social_action(p_action text, p_target uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_low uuid;
  v_high uuid;
  v_friend public.friendships%rowtype;
  v_now timestamptz;
begin
  if v_actor is null then raise exception 'sign_in_required'; end if;
  if p_action is null or p_action not in ('request','accept','decline','remove','block','unblock') or
      p_target is null or p_target = v_actor then raise exception 'invalid_social_action'; end if;
  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'target_unavailable';
  end if;

  v_low := least(v_actor, p_target);
  v_high := greatest(v_actor, p_target);
  -- Serialize competing actions for this pair in every connection.
  perform pg_advisory_xact_lock(hashtextextended(v_low::text || v_high::text, 0));

  if p_action = 'unblock' then
    delete from public.user_blocks where blocker_id = v_actor and blocked_id = p_target;
    return 'unblocked';
  end if;

  if p_action = 'block' then
    insert into public.user_blocks(blocker_id, blocked_id) values(v_actor, p_target)
      on conflict do nothing;
    delete from public.friendships where user_low = v_low and user_high = v_high;
    delete from public.social_notifications
      where (recipient_id = v_actor and actor_id = p_target)
         or (recipient_id = p_target and actor_id = v_actor);
    return 'blocked';
  end if;

  if exists (select 1 from public.user_blocks
             where (blocker_id = v_actor and blocked_id = p_target)
                or (blocker_id = p_target and blocked_id = v_actor)) then
    raise exception 'social_connection_unavailable';
  end if;

  select * into v_friend from public.friendships
    where user_low = v_low and user_high = v_high;

  if p_action = 'request' then
    if found then return case when v_friend.status = 'accepted' then 'already_friends' else 'already_pending' end; end if;
    -- Different pairs can be requested concurrently, so serialize the
    -- account's rolling-window counter in addition to the pair lock.
    perform pg_advisory_xact_lock(hashtextextended('friend_rate:' || v_actor::text, 0));
    v_now := clock_timestamp();
    if (select count(*) from public.friend_request_attempts
        where actor_id = v_actor and created_at > v_now - interval '24 hours') >= 20 then
      raise exception 'friend_request_rate_limited';
    end if;
    insert into public.friend_request_attempts(actor_id) values(v_actor);
    insert into public.friendships(user_low, user_high, requested_by)
      values(v_low, v_high, v_actor);
    insert into public.social_notifications(recipient_id, actor_id, kind)
      values(p_target, v_actor, 'friend_request');
    return 'requested';
  end if;

  if p_action = 'accept' then
    if not found or v_friend.status <> 'pending' or v_friend.requested_by = v_actor then
      raise exception 'friend_request_unavailable';
    end if;
    update public.friendships set status='accepted', accepted_at=clock_timestamp()
      where user_low = v_low and user_high = v_high;
    delete from public.social_notifications where recipient_id=v_actor and actor_id=p_target and kind='friend_request';
    insert into public.social_notifications(recipient_id, actor_id, kind)
      values(p_target, v_actor, 'friend_accepted');
    return 'accepted';
  end if;

  if not found then return 'no_connection'; end if;
  if p_action = 'decline' then
    if v_friend.status <> 'pending' or v_friend.requested_by = v_actor then
      raise exception 'friend_request_unavailable';
    end if;
  end if;
  if p_action = 'remove' and v_friend.status <> 'accepted' and v_friend.requested_by <> v_actor then
    raise exception 'friend_request_unavailable';
  end if;
  delete from public.friendships where user_low = v_low and user_high = v_high;
  delete from public.social_notifications where (recipient_id=v_actor and actor_id=p_target)
    or (recipient_id=p_target and actor_id=v_actor);
  return 'removed';
end $$;

create or replace function public.rookline_social_mark_read()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'sign_in_required'; end if;
  update public.social_notifications set read_at = clock_timestamp()
    where recipient_id = auth.uid() and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function public.rookline_social_action(text,uuid) from public, anon, authenticated;
revoke all on function public.rookline_social_mark_read() from public, anon, authenticated;
grant execute on function public.rookline_social_action(text,uuid) to authenticated;
grant execute on function public.rookline_social_mark_read() to authenticated;

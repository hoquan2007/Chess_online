-- CH-15: private, account-scoped text messages between accepted friends.
-- Apply only to isolated staging after reviewing the prior social migration.
-- Direct authenticated INSERT/UPDATE/DELETE is intentionally forbidden.
create table public.private_messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  client_nonce uuid not null,
  body text not null check (char_length(body) between 1 and 500 and
    octet_length(body) <= 2000 and body = btrim(body)),
  created_at timestamptz not null default clock_timestamp(),
  constraint private_message_distinct_users check (sender_id <> recipient_id),
  constraint private_message_retry_key unique (sender_id, client_nonce)
);
create index private_messages_sender_recipient_idx
  on public.private_messages(sender_id, recipient_id, created_at desc);
create index private_messages_recipient_sender_idx
  on public.private_messages(recipient_id, sender_id, created_at desc);
create index private_messages_sender_recent_idx
  on public.private_messages(sender_id, created_at desc);

alter table public.private_messages enable row level security;

-- SECURITY DEFINER is required here: a user cannot read the other person's
-- block row through user_blocks RLS. Reading old conversation history is
-- suspended whenever the friendship is removed or either party blocks.
create or replace function public.rookline_private_chat_allowed(p_sender uuid, p_recipient uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null
    and auth.uid() in (p_sender, p_recipient)
    and exists (
      select 1 from public.friendships f
      where f.user_low = least(p_sender, p_recipient)
        and f.user_high = greatest(p_sender, p_recipient)
        and f.status = 'accepted'
    )
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = p_sender and b.blocked_id = p_recipient)
         or (b.blocker_id = p_recipient and b.blocked_id = p_sender)
    );
$$;
revoke all on function public.rookline_private_chat_allowed(uuid,uuid) from public, anon, authenticated;
grant execute on function public.rookline_private_chat_allowed(uuid,uuid) to authenticated;

create policy private_message_participant_read on public.private_messages
  for select to authenticated
  using (public.rookline_private_chat_allowed(sender_id, recipient_id));
revoke all on public.private_messages from public, anon, authenticated;
grant select on public.private_messages to authenticated;

create or replace function public.rookline_private_chat_send(
  p_recipient uuid, p_body text, p_nonce uuid
) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_existing public.private_messages%rowtype;
  v_id bigint;
  v_now timestamptz;
begin
  if v_actor is null then raise exception 'sign_in_required'; end if;
  if p_recipient is null or p_recipient = v_actor or p_nonce is null or
      p_body is null or char_length(p_body) not between 1 and 500 or
      octet_length(p_body) > 2000 or p_body <> btrim(p_body) then
    raise exception 'invalid_private_message';
  end if;

  -- Serialize with friendship/block mutations in rookline_social_action.
  perform pg_advisory_xact_lock(hashtextextended(
    least(v_actor, p_recipient)::text || greatest(v_actor, p_recipient)::text, 0));
  if not public.rookline_private_chat_allowed(v_actor, p_recipient) then
    raise exception 'private_chat_unavailable';
  end if;

  -- Serialize a user's rate accounting even across different recipients.
  perform pg_advisory_xact_lock(hashtextextended('private_chat_rate:' || v_actor::text, 0));
  select * into v_existing from public.private_messages
    where sender_id = v_actor and client_nonce = p_nonce;
  if found then
    if v_existing.recipient_id <> p_recipient or v_existing.body <> p_body then
      raise exception 'private_message_nonce_conflict';
    end if;
    return v_existing.id;
  end if;

  v_now := clock_timestamp();
  if (select count(*) from public.private_messages
      where sender_id = v_actor and created_at > v_now - interval '1 minute') >= 20 then
    raise exception 'private_message_rate_limited';
  end if;
  insert into public.private_messages(sender_id, recipient_id, client_nonce, body, created_at)
    values(v_actor, p_recipient, p_nonce, p_body, v_now) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.rookline_private_chat_send(uuid,text,uuid)
  from public, anon, authenticated;
grant execute on function public.rookline_private_chat_send(uuid,text,uuid) to authenticated;

-- The challenge creator can revoke an unseated invitation. Joining and
-- cancelling serialize through the same games row lock.
alter table public.game_rate_limits drop constraint if exists game_rate_limits_action_check;
alter table public.game_rate_limits add constraint game_rate_limits_action_check
  check (action in ('create','join','move','resign','claim','cancel'));

create or replace function public.rookline_consume_game_limit(
  p_user uuid, p_action text, p_max integer, p_period_seconds integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_hits integer;
  v_now timestamptz := clock_timestamp();
begin
  if p_user is null or p_action not in ('create','join','move','resign','claim','cancel') or
    p_max not between 1 and 100 or p_period_seconds not between 1 and 3600 then
    raise exception 'invalid_limit_parameters';
  end if;
  insert into public.game_rate_limits(user_id, action, window_start, hits)
  values (p_user, p_action, v_now, 1)
  on conflict (user_id, action) do update set
    window_start = case when public.game_rate_limits.window_start <= v_now - make_interval(secs => p_period_seconds)
      then v_now else public.game_rate_limits.window_start end,
    hits = case when public.game_rate_limits.window_start <= v_now - make_interval(secs => p_period_seconds)
      then 1 else public.game_rate_limits.hits + 1 end
  returning hits into v_hits;
  return v_hits <= p_max;
end $$;

revoke all on function public.rookline_consume_game_limit(uuid,text,integer,integer) from public, anon, authenticated;
grant execute on function public.rookline_consume_game_limit(uuid,text,integer,integer) to service_role;

create or replace function public.rookline_cancel_challenge(p_game uuid, p_player uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g public.games%rowtype;
begin
  select * into g from public.games where id = p_game for update;
  if not found then raise exception 'game_not_found'; end if;
  if p_player is null or g.white_id <> p_player then raise exception 'not_challenge_creator'; end if;
  if g.status = 'cancelled' then return jsonb_build_object('status','cancelled'); end if;
  if g.status <> 'waiting' or g.black_id is not null then raise exception 'game_not_waiting'; end if;
  update public.games set status = 'cancelled', expires_at = clock_timestamp()
    where id = p_game;
  return jsonb_build_object('status','cancelled');
end $$;

revoke all on function public.rookline_cancel_challenge(uuid,uuid) from public, anon, authenticated;
grant execute on function public.rookline_cancel_challenge(uuid,uuid) to service_role;

-- Server-validated, transactional draw claims. This requires all earlier migrations.
-- Client calls are prohibited: only an authenticated Next.js server calls this RPC.
alter table public.game_rate_limits drop constraint if exists game_rate_limits_action_check;
alter table public.game_rate_limits add constraint game_rate_limits_action_check
  check (action in ('create','join','move','resign','claim'));

create or replace function public.rookline_consume_game_limit(
  p_user uuid, p_action text, p_max integer, p_period_seconds integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_hits integer;
  v_now timestamptz := clock_timestamp();
begin
  if p_user is null or p_action not in ('create','join','move','resign','claim') or
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

create or replace function public.rookline_claim_draw(
  p_game uuid, p_player uuid, p_expected_ply integer, p_rule text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g public.games%rowtype;
  v_now timestamptz := clock_timestamp();
  v_elapsed integer;
  v_remaining integer;
begin
  if p_rule not in ('repetition','fiftyMoves') then raise exception 'invalid_draw_rule'; end if;
  select * into g from public.games where id = p_game for update;
  if not found then raise exception 'game_not_found'; end if;
  if p_player not in (g.white_id,g.black_id) then raise exception 'not_a_player'; end if;
  if g.status <> 'active' or g.ply <> p_expected_ply then raise exception 'stale_game'; end if;
  if (g.turn = 'w' and g.white_id <> p_player) or (g.turn = 'b' and g.black_id <> p_player)
    then raise exception 'not_your_turn'; end if;
  if g.clock_anchor_at is null then raise exception 'clock_not_started'; end if;
  v_elapsed := greatest(0, floor(extract(epoch from (v_now - g.clock_anchor_at)) * 1000)::integer);
  v_remaining := case when g.turn = 'w' then g.white_ms else g.black_ms end;
  if v_elapsed >= v_remaining then raise exception 'clock_expired'; end if;
  -- Server replays the durable PGN with chess.js and verifies this exact rule.
  -- The locked row and expected ply prevent the reviewed state from changing.
  update public.games set status='completed',
    result=case when p_rule = 'repetition' then 'Draw: claimed threefold repetition'
      else 'Draw: claimed fifty-move rule' end,
    winner_id=null, finished_at=v_now, clock_anchor_at=null
  where id=p_game;
  return jsonb_build_object('status','completed','ply',g.ply,'rule',p_rule);
end $$;

revoke all on function public.rookline_claim_draw(uuid,uuid,integer,text) from public, anon, authenticated;
grant execute on function public.rookline_claim_draw(uuid,uuid,integer,text) to service_role;

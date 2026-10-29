-- Evaluate elapsed time only after the game-row lock has been acquired.
-- Reading clock_timestamp() in a DECLARE initializer can predate a blocked
-- SELECT ... FOR UPDATE, allowing a move or draw claim after flag fall.
-- Use bigint for elapsed milliseconds so an abandoned game cannot overflow.

create or replace function public.rookline_commit_move(
  p_game uuid, p_player uuid, p_expected_ply integer, p_request uuid,
  p_from text, p_to text, p_promotion text, p_san text,
  p_fen text, p_pgn text, p_turn text, p_game_over boolean, p_result text, p_winner uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g public.games%rowtype;
  v_now timestamptz;
  v_elapsed bigint;
  v_remaining integer;
  v_white integer;
  v_black integer;
  v_previous public.moves%rowtype;
  v_timeout_winner uuid;
begin
  select * into g from public.games where id = p_game for update;
  if not found then raise exception 'game_not_found'; end if;
  if p_player not in (g.white_id, g.black_id) then raise exception 'not_a_player'; end if;

  select * into v_previous from public.moves
    where game_id = p_game and player_id = p_player and idempotency_key = p_request;
  if found then
    if v_previous.ply <> p_expected_ply + 1 or
      v_previous.from_square <> p_from or v_previous.to_square <> p_to or
      v_previous.promotion is distinct from p_promotion then
      raise exception 'idempotency_key_reused';
    end if;
    return jsonb_build_object('status','duplicate','ply',v_previous.ply);
  end if;

  if g.status <> 'active' then raise exception 'game_not_active'; end if;
  if p_expected_ply <> g.ply then raise exception 'stale_ply'; end if;
  if (g.turn = 'w' and g.white_id <> p_player) or (g.turn = 'b' and g.black_id <> p_player)
    then raise exception 'out_of_turn'; end if;
  if p_turn not in ('w','b') or p_turn = g.turn then raise exception 'invalid_next_turn'; end if;
  if length(p_san) > 32 or length(p_fen) > 120 or length(p_pgn) > 100000
    then raise exception 'payload_too_large'; end if;
  if g.clock_anchor_at is null then raise exception 'clock_not_started'; end if;

  v_now := clock_timestamp();
  v_elapsed := greatest(0, floor(extract(epoch from (v_now - g.clock_anchor_at)) * 1000)::bigint);
  v_remaining := case when g.turn = 'w' then g.white_ms else g.black_ms end;
  if v_elapsed >= v_remaining then
    v_timeout_winner := public.rookline_timeout_winner(g.fen,g.turn,g.white_id,g.black_id);
    update public.games set status='completed',
      result=case when v_timeout_winner is null then 'Draw: timeout without mating material' else 'timeout' end,
      winner_id=v_timeout_winner,
      finished_at=v_now, clock_anchor_at=null,
      white_ms=case when g.turn='w' then 0 else g.white_ms end,
      black_ms=case when g.turn='b' then 0 else g.black_ms end where id=p_game;
    return jsonb_build_object('status','timeout','ply',g.ply);
  end if;

  -- Cast only after proving elapsed < the stored (integer) remaining time.
  v_white := case when g.turn='w' then g.white_ms-v_elapsed::integer+g.increment_ms else g.white_ms end;
  v_black := case when g.turn='b' then g.black_ms-v_elapsed::integer+g.increment_ms else g.black_ms end;
  update public.games set fen=p_fen, pgn=p_pgn, turn=p_turn, ply=g.ply+1,
    white_ms=v_white, black_ms=v_black, clock_anchor_at=case when p_game_over then null else v_now end,
    status=case when p_game_over then 'completed' else 'active' end,
    result=case when p_game_over then p_result else null end,
    winner_id=case when p_game_over then p_winner else null end,
    finished_at=case when p_game_over then v_now else null end
  where id=p_game;
  insert into public.moves (game_id, player_id, ply, idempotency_key, from_square,
    to_square, promotion, san, fen_after, white_ms, black_ms, played_at)
  values (p_game, p_player, g.ply+1, p_request, p_from, p_to, p_promotion,
    p_san, p_fen, v_white, v_black, v_now);
  return jsonb_build_object('status','accepted','ply',g.ply+1);
end $$;

-- Also allow the expiration job to settle games that were abandoned for
-- longer than ~24.8 days without overflowing a 32-bit millisecond counter.
create or replace function public.rookline_expire_game(p_game uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g public.games%rowtype;
  v_now timestamptz;
  v_elapsed bigint;
  v_remaining integer;
  v_timeout_winner uuid;
begin
  select * into g from public.games where id = p_game for update;
  if not found then raise exception 'game_not_found'; end if;
  if g.status <> 'active' then return jsonb_build_object('status',g.status); end if;
  if g.clock_anchor_at is null then raise exception 'clock_not_started'; end if;

  v_now := clock_timestamp();
  v_elapsed := greatest(0, floor(extract(epoch from (v_now - g.clock_anchor_at)) * 1000)::bigint);
  v_remaining := case when g.turn='w' then g.white_ms else g.black_ms end;
  if v_elapsed < v_remaining then return jsonb_build_object('status','active'); end if;

  v_timeout_winner := public.rookline_timeout_winner(g.fen,g.turn,g.white_id,g.black_id);
  update public.games set status='completed',
    result=case when v_timeout_winner is null then 'Draw: timeout without mating material' else 'timeout' end,
    finished_at=v_now, winner_id=v_timeout_winner, clock_anchor_at=null,
    white_ms=case when g.turn='w' then 0 else g.white_ms end,
    black_ms=case when g.turn='b' then 0 else g.black_ms end where id=p_game;
  return jsonb_build_object('status','timeout');
end $$;

create or replace function public.rookline_claim_draw(
  p_game uuid, p_player uuid, p_expected_ply integer, p_rule text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g public.games%rowtype;
  v_now timestamptz;
  v_elapsed bigint;
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

  v_now := clock_timestamp();
  v_elapsed := greatest(0, floor(extract(epoch from (v_now - g.clock_anchor_at)) * 1000)::bigint);
  v_remaining := case when g.turn = 'w' then g.white_ms else g.black_ms end;
  if v_elapsed >= v_remaining then raise exception 'clock_expired'; end if;
  -- The server has replayed and verified the exact draw claim against this ply.
  update public.games set status='completed',
    result=case when p_rule = 'repetition' then 'Draw: claimed threefold repetition'
      else 'Draw: claimed fifty-move rule' end,
    winner_id=null, finished_at=v_now, clock_anchor_at=null,
    white_ms=case when g.turn='w' then g.white_ms-v_elapsed::integer else g.white_ms end,
    black_ms=case when g.turn='b' then g.black_ms-v_elapsed::integer else g.black_ms end
  where id=p_game;
  return jsonb_build_object('status','completed','ply',g.ply,'rule',p_rule);
end $$;

-- Reassert the service-only grant after replacing privileged functions.
revoke all on function public.rookline_commit_move(uuid,uuid,integer,uuid,text,text,text,text,text,text,text,boolean,text,uuid)
  from public, anon, authenticated;
revoke all on function public.rookline_claim_draw(uuid,uuid,integer,text)
  from public, anon, authenticated;
revoke all on function public.rookline_expire_game(uuid)
  from public, anon, authenticated;
grant execute on function public.rookline_commit_move(uuid,uuid,integer,uuid,text,text,text,text,text,text,text,boolean,text,uuid)
  to service_role;
grant execute on function public.rookline_claim_draw(uuid,uuid,integer,text) to service_role;
grant execute on function public.rookline_expire_game(uuid) to service_role;

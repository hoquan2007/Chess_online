-- An expired clock is adjudicated before a resignation can settle the game.
-- Keep this as a new migration so existing staging databases can upgrade safely.
create or replace function public.rookline_resign_game(p_game uuid, p_player uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g public.games%rowtype;
  v_now timestamptz;
  v_elapsed bigint;
  v_remaining integer;
  v_white integer;
  v_black integer;
  v_winner uuid;
begin
  select * into g from public.games where id = p_game for update;
  if not found or p_player not in (g.white_id, g.black_id) then
    raise exception 'not_a_player';
  end if;
  if g.status <> 'active' then raise exception 'game_not_active'; end if;
  if g.clock_anchor_at is null then raise exception 'clock_not_started'; end if;

  -- Read the trusted time *after* acquiring the row lock, never before.
  v_now := clock_timestamp();
  v_elapsed := greatest(0, floor(extract(epoch from (v_now - g.clock_anchor_at)) * 1000)::bigint);
  v_remaining := case when g.turn = 'w' then g.white_ms else g.black_ms end;

  if v_elapsed >= v_remaining then
    v_winner := public.rookline_timeout_winner(g.fen, g.turn, g.white_id, g.black_id);
    update public.games set status = 'completed',
      result = case when v_winner is null then 'Draw: timeout without mating material' else 'timeout' end,
      winner_id = v_winner, finished_at = v_now, clock_anchor_at = null,
      white_ms = case when g.turn = 'w' then 0 else g.white_ms end,
      black_ms = case when g.turn = 'b' then 0 else g.black_ms end
    where id = p_game;
    return jsonb_build_object('status', 'timeout', 'ply', g.ply);
  end if;

  v_white := case when g.turn = 'w' then g.white_ms - v_elapsed::integer else g.white_ms end;
  v_black := case when g.turn = 'b' then g.black_ms - v_elapsed::integer else g.black_ms end;
  update public.games set status = 'completed', result = 'resignation',
    winner_id = case when p_player = g.white_id then g.black_id else g.white_id end,
    white_ms = v_white, black_ms = v_black,
    clock_anchor_at = null, finished_at = v_now
  where id = p_game;
  return jsonb_build_object('status', 'completed', 'ply', g.ply);
end $$;

revoke all on function public.rookline_resign_game(uuid,uuid) from public, anon, authenticated;
grant execute on function public.rookline_resign_game(uuid,uuid) to service_role;

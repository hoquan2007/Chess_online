-- FIDE 5.1.2 and 6.9: resignation and flag fall are draws if the opponent
-- cannot give mate by *any* legal sequence, even with cooperation.
-- Multiple promoted bishops on a single square color cannot mate a bare king;
-- neither can bishops on both sides if every bishop uses the same color.
-- This replaces the prior material-count helper without modifying applied migrations.
create or replace function public.rookline_timeout_winner(
  p_fen text, p_flagged_turn text, p_white uuid, p_black uuid
) returns uuid language plpgsql immutable set search_path = '' as $$
declare
  v_board text := split_part(p_fen, ' ', 1);
  v_winner_pieces text;
  v_flagged_pieces text;
  v_row text;
  v_character text;
  v_rank integer;
  v_index integer;
  v_file integer;
  v_bishop_color integer;
  v_current_color integer;
  v_same_color boolean := true;
begin
  if p_flagged_turn = 'w' then
    v_winner_pieces := replace(regexp_replace(v_board, '[^a-z]', '', 'g'), 'k', '');
    v_flagged_pieces := replace(regexp_replace(v_board, '[^A-Z]', '', 'g'), 'K', '');
  elsif p_flagged_turn = 'b' then
    v_winner_pieces := replace(regexp_replace(v_board, '[^A-Z]', '', 'g'), 'K', '');
    v_flagged_pieces := replace(regexp_replace(v_board, '[^a-z]', '', 'g'), 'k', '');
  else
    raise exception 'invalid_turn';
  end if;

  if length(v_winner_pieces) = 0 or
      (v_winner_pieces in ('b', 'B', 'n', 'N') and length(v_flagged_pieces) = 0) then
    return null;
  end if;

  if v_winner_pieces ~* '^b+$' and v_flagged_pieces ~* '^b*$' then
    for v_rank in 1..8 loop
      v_row := split_part(v_board, '/', v_rank);
      v_file := 1;
      for v_index in 1..length(v_row) loop
        v_character := substr(v_row, v_index, 1);
        if v_character ~ '^[1-8]$' then
          v_file := v_file + v_character::integer;
        else
          if lower(v_character) = 'b' then
            v_current_color := (v_rank + v_file) % 2;
            if v_bishop_color is null then
              v_bishop_color := v_current_color;
            elsif v_bishop_color <> v_current_color then
              v_same_color := false;
            end if;
          end if;
          v_file := v_file + 1;
        end if;
      end loop;
    end loop;
    if v_same_color then return null; end if;
  end if;

  return case when p_flagged_turn = 'w' then p_black else p_white end;
end $$;

-- An on-time resignation also observes the FIDE 5.1.2 draw exception.
-- Preserve the existing row lock and expired-clock precedence from migration 04000.
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
  v_resigning_side text;
begin
  select * into g from public.games where id = p_game for update;
  if not found or p_player not in (g.white_id, g.black_id) then
    raise exception 'not_a_player';
  end if;
  if g.status <> 'active' then raise exception 'game_not_active'; end if;
  if g.clock_anchor_at is null then raise exception 'clock_not_started'; end if;

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

  v_resigning_side := case when p_player = g.white_id then 'w' else 'b' end;
  v_winner := public.rookline_timeout_winner(g.fen, v_resigning_side, g.white_id, g.black_id);
  v_white := case when g.turn = 'w' then g.white_ms - v_elapsed::integer else g.white_ms end;
  v_black := case when g.turn = 'b' then g.black_ms - v_elapsed::integer else g.black_ms end;
  update public.games set status = 'completed',
    result = case when v_winner is null then 'Draw: resignation without mating material' else 'resignation' end,
    winner_id = v_winner, white_ms = v_white, black_ms = v_black,
    clock_anchor_at = null, finished_at = v_now
  where id = p_game;
  return jsonb_build_object('status', 'completed', 'ply', g.ply);
end $$;

revoke all on function public.rookline_timeout_winner(text,text,uuid,uuid) from public, anon, authenticated;
revoke all on function public.rookline_resign_game(uuid,uuid) from public, anon, authenticated;
grant execute on function public.rookline_resign_game(uuid,uuid) to service_role;

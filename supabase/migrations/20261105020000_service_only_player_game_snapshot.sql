-- One service-only RPC returns an authorized game in one database round trip.
-- Healthy unrated clocks use a nonlocking read, so frequent opponent refreshes
-- cannot queue behind a move's exclusive lock (or block its commit).
-- Near-expiry, malformed-anchor and rated games still call the authoritative
-- row-locked expiry function, then re-read within the same transaction.
create or replace function public.rookline_read_player_game(p_game uuid, p_player uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g public.games%rowtype;
  v_now timestamptz;
  v_remaining bigint;
begin
  select * into g from public.games where id = p_game;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  -- IS DISTINCT FROM handles the NULL black seat of an open invitation.
  if p_player is null or
     (p_player is distinct from g.white_id and p_player is distinct from g.black_id) then
    return jsonb_build_object('result', 'forbidden', 'joinable', g.status = 'waiting');
  end if;

  if g.status = 'active' then
    -- This fast-path decision uses only a committed DB row and PostgreSQL
    -- clock. It never authorizes moves or determines the official result.
    v_now := clock_timestamp();
    v_remaining := case when g.turn = 'w' then g.white_ms else g.black_ms end;
    if g.rated or g.clock_anchor_at is null or g.clock_anchor_at > v_now or
       v_remaining is null or v_remaining <= 0 or
       (greatest(0, floor(extract(epoch from (v_now - g.clock_anchor_at)) * 1000)::bigint)
        + 60000 >= v_remaining) then
      perform public.rookline_expire_game(p_game);
      -- Expiry takes the game-row lock after any racing move/resignation.
      -- Read again so we never return a pre-lock board or expired clock.
      select * into g from public.games where id = p_game;
      if not found then return jsonb_build_object('result', 'not_found'); end if;
      if p_player is distinct from g.white_id and p_player is distinct from g.black_id then
        return jsonb_build_object('result', 'forbidden', 'joinable', g.status = 'waiting');
      end if;
    end if;
  end if;
  return jsonb_build_object('result', 'ok', 'game', to_jsonb(g));
end $$;

revoke all on function public.rookline_read_player_game(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.rookline_read_player_game(uuid,uuid) to service_role;

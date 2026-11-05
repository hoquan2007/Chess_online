-- One service-only RPC collapses three remote reads into one database call.
-- The row lock and the existing authoritative timeout function run in the
-- same transaction, so a concurrent move/resignation cannot split the state.
create or replace function public.rookline_read_player_game(p_game uuid, p_player uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g public.games%rowtype;
begin
  select * into g from public.games where id = p_game for update;
  if not found then return jsonb_build_object('result', 'not_found'); end if;
  -- IS DISTINCT FROM handles the NULL black seat of an open invitation.
  if p_player is null or
     (p_player is distinct from g.white_id and p_player is distinct from g.black_id) then
    return jsonb_build_object('result', 'forbidden', 'joinable', g.status = 'waiting');
  end if;

  if g.status = 'active' then
    perform public.rookline_expire_game(p_game);
    -- Re-read the row after the timeout settlement, with the lock still held.
    select * into g from public.games where id = p_game;
  end if;
  return jsonb_build_object('result', 'ok', 'game', to_jsonb(g));
end $$;

revoke all on function public.rookline_read_player_game(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.rookline_read_player_game(uuid,uuid) to service_role;

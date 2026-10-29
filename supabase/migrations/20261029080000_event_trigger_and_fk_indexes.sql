-- Restrict the pre-existing automatic-RLS event trigger to trusted callers.
-- Event-trigger invocation by PostgreSQL is unaffected by Data API grants.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- Cover foreign keys used by joins and referenced-row maintenance.
create index if not exists games_winner_id_idx on public.games (winner_id);
create index if not exists moves_player_id_idx on public.moves (player_id);
create index if not exists rating_history_user_id_idx on public.rating_history (user_id);

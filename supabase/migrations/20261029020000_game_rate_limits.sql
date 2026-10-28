-- Authenticated per-user game mutation throttling, enforced within Postgres.
-- This migration must be applied before exposing game mutation endpoints.
create table public.game_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('create','join','move','resign')),
  window_start timestamptz not null,
  hits integer not null check (hits >= 1),
  primary key (user_id, action)
);

alter table public.game_rate_limits enable row level security;
revoke all on table public.game_rate_limits from public, anon, authenticated;

create or replace function public.rookline_consume_game_limit(
  p_user uuid, p_action text, p_max integer, p_period_seconds integer
) returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_hits integer;
  v_now timestamptz := clock_timestamp();
begin
  if p_user is null or p_action not in ('create','join','move','resign') or
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

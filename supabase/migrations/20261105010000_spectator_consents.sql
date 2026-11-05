-- CH-16: A private, unrated game becomes watchable only while both players consent.
-- This migration does not widen games/moves RLS or expose participant identifiers.
create table public.game_spectator_consents (
  game_id uuid primary key references public.games(id) on delete cascade,
  white_consent boolean not null default false,
  black_consent boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.game_spectator_consents enable row level security;
revoke all on public.game_spectator_consents from public, anon, authenticated;

create function public.rookline_spectator_consent(p_game uuid, p_enabled boolean)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  g public.games%rowtype;
  c public.game_spectator_consents%rowtype;
  actor uuid := (select auth.uid());
  seat text;
begin
  if actor is null or p_game is null or p_enabled is null then
    raise exception 'spectator_unavailable' using errcode = 'P0001';
  end if;
  -- Serialize seat checks, joins, cancellations and consent updates.
  select * into g from public.games where id = p_game for update;
  if not found or g.rated or g.status not in ('active', 'completed') or g.black_id is null then
    raise exception 'spectator_unavailable' using errcode = 'P0001';
  end if;
  if actor = g.white_id then seat := 'w';
  elsif actor = g.black_id then seat := 'b';
  else raise exception 'spectator_unavailable' using errcode = 'P0001';
  end if;

  insert into public.game_spectator_consents (game_id, white_consent, black_consent)
  values (p_game, seat = 'w' and p_enabled, seat = 'b' and p_enabled)
  on conflict (game_id) do update set
    white_consent = case when seat = 'w' then p_enabled else public.game_spectator_consents.white_consent end,
    black_consent = case when seat = 'b' then p_enabled else public.game_spectator_consents.black_consent end,
    updated_at = now()
  returning * into c;
  return jsonb_build_object('role', 'player', 'enabled',
    case when seat = 'w' then c.white_consent else c.black_consent end,
    'otherEnabled', case when seat = 'w' then c.black_consent else c.white_consent end,
    'open', c.white_consent and c.black_consent);
end;
$$;

create function public.rookline_spectator_snapshot(p_game uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  g public.games%rowtype;
  c public.game_spectator_consents%rowtype;
  actor uuid := (select auth.uid());
  seat text;
begin
  if actor is null or p_game is null then return null; end if;
  -- A snapshot and a consent revocation take compatible row-lock order.
  select * into g from public.games where id = p_game for share;
  if not found or g.rated or g.status not in ('active', 'completed') or g.black_id is null then
    return null;
  end if;
  select * into c from public.game_spectator_consents where game_id = p_game;
  if actor = g.white_id then seat := 'w';
  elsif actor = g.black_id then seat := 'b';
  else seat := null;
  end if;
  if seat is not null then
    return jsonb_build_object('role', 'player', 'enabled',
      case when seat = 'w' then coalesce(c.white_consent, false) else coalesce(c.black_consent, false) end,
      'otherEnabled', case when seat = 'w' then coalesce(c.black_consent, false) else coalesce(c.white_consent, false) end,
      'open', coalesce(c.white_consent, false) and coalesce(c.black_consent, false));
  end if;
  if not coalesce(c.white_consent, false) or not coalesce(c.black_consent, false) then return null; end if;

  -- Whitelisted public display fields only: never return games.* or user IDs.
  return jsonb_build_object(
    'role', 'spectator',
    'game', jsonb_build_object('id', g.id, 'status', g.status, 'fen', g.fen,
      'pgn', g.pgn, 'turn', g.turn, 'ply', g.ply,
      'base_ms', g.base_ms, 'increment_ms', g.increment_ms,
      'white_ms', g.white_ms, 'black_ms', g.black_ms,
      'clock_anchor_at', g.clock_anchor_at, 'result', g.result),
    'serverNow', (extract(epoch from clock_timestamp()) * 1000)::bigint);
end;
$$;

revoke all on function public.rookline_spectator_consent(uuid, boolean) from public, anon, authenticated;
revoke all on function public.rookline_spectator_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.rookline_spectator_consent(uuid, boolean) to authenticated;
grant execute on function public.rookline_spectator_snapshot(uuid) to authenticated;

-- Rookline foundation. Apply to a Supabase staging project before enabling online play.
-- All writes to authoritative games, moves, clocks and ratings are server-only.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '' check (char_length(display_name) <= 80),
  avatar_url text check (char_length(avatar_url) <= 2048),
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_username_ci on public.profiles(lower(username));

create or replace function public.create_profile_for_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, 'rook_' || substr(replace(new.id::text, '-', ''), 1, 12),
    left(coalesce(new.raw_user_meta_data->>'display_name', ''), 80));
  return new;
end;
$$;
drop trigger if exists on_rookline_auth_user on auth.users;
create trigger on_rookline_auth_user after insert on auth.users
for each row execute function public.create_profile_for_user();

create table if not exists public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark','light')),
  sounds_enabled boolean not null default false
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  white_id uuid not null references auth.users(id),
  black_id uuid references auth.users(id),
  status text not null default 'waiting' check (status in ('waiting','active','completed','cancelled')),
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn text not null default '',
  turn text not null default 'w' check (turn in ('w','b')),
  ply integer not null default 0 check (ply >= 0),
  base_ms integer not null check (base_ms in (180000, 300000, 600000)),
  increment_ms integer not null check (increment_ms in (0, 2000)),
  white_ms integer not null check (white_ms >= 0),
  black_ms integer not null check (black_ms >= 0),
  clock_anchor_at timestamptz,
  result text,
  winner_id uuid references auth.users(id),
  rated boolean not null default false,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz not null default (now() + interval '48 hours'),
  constraint games_distinct_players check (black_id is null or black_id <> white_id)
);
create index if not exists games_white_recent on public.games (white_id, created_at desc);
create index if not exists games_black_recent on public.games (black_id, created_at desc);

create table if not exists public.moves (
  id bigint generated always as identity primary key,
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references auth.users(id),
  ply integer not null check (ply > 0),
  idempotency_key uuid not null,
  from_square text not null check (from_square ~ '^[a-h][1-8]$'),
  to_square text not null check (to_square ~ '^[a-h][1-8]$'),
  promotion text,
  san text not null,
  fen_after text not null,
  white_ms integer not null,
  black_ms integer not null,
  played_at timestamptz not null default clock_timestamp(),
  unique (game_id, ply),
  unique (game_id, player_id, idempotency_key)
);

create table if not exists public.ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('bullet','blitz','rapid')),
  rating integer not null default 1200 check (rating between 100 and 4000),
  games_played integer not null default 0,
  primary key (user_id, category)
);
create table if not exists public.rating_history (
  game_id uuid not null references public.games(id),
  user_id uuid not null references auth.users(id),
  category text not null,
  old_rating integer not null,
  new_rating integer not null,
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

alter table public.profiles enable row level security;
alter table public.preferences enable row level security;
alter table public.games enable row level security;
alter table public.moves enable row level security;
alter table public.ratings enable row level security;
alter table public.rating_history enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy preferences_own on public.preferences for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy games_players_read on public.games for select to authenticated using ((select auth.uid()) in (white_id, black_id));
create policy moves_players_read on public.moves for select to authenticated using (exists (
  select 1 from public.games g where g.id = game_id and (select auth.uid()) in (g.white_id, g.black_id)
));
create policy ratings_read on public.ratings for select to authenticated using (true);
create policy rating_history_own_read on public.rating_history for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.games, public.moves, public.ratings, public.rating_history from anon, authenticated;
grant select on public.games, public.moves, public.ratings, public.rating_history to authenticated;
-- The owner may edit only presentation fields, never id or creation metadata.
grant select on public.profiles to authenticated;
grant update (username, display_name, avatar_url) on public.profiles to authenticated;
grant select, insert, update, delete on public.preferences to authenticated;

-- The following SECURITY DEFINER functions are callable ONLY by the service role.
-- The Next.js API verifies a Supabase user JWT, derives p_player from auth.getUser(),
-- validates the chess.js move, and invokes an atomic function under a row lock.
-- FIDE 6.9: flag fall is drawn if the opponent cannot possibly give mate.
-- In particular, a bare king cannot mate; a lone bishop/knight cannot mate a
-- bare king. Other cases remain eligible for mate with possible cooperation.
create or replace function public.rookline_timeout_winner(
  p_fen text, p_flagged_turn text, p_white uuid, p_black uuid
) returns uuid language plpgsql immutable set search_path = '' as $$
declare
  v_board text := split_part(p_fen, ' ', 1);
  v_winner_pieces text;
  v_flagged_pieces text;
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
    (v_winner_pieces in ('b','n','B','N') and length(v_flagged_pieces) = 0) then
    return null;
  end if;
  return case when p_flagged_turn = 'w' then p_black else p_white end;
end $$;

create or replace function public.rookline_join_game(p_game uuid, p_player uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare g public.games%rowtype;
begin
  select * into g from public.games where id = p_game for update;
  if not found then raise exception 'game_not_found'; end if;
  if g.status <> 'waiting' or g.black_id is not null then raise exception 'game_not_waiting'; end if;
  if g.white_id = p_player then raise exception 'cannot_play_both_sides'; end if;
  if g.expires_at <= clock_timestamp() then raise exception 'challenge_expired'; end if;
  update public.games set black_id = p_player, status = 'active',
    started_at = clock_timestamp(), clock_anchor_at = clock_timestamp()
  where id = p_game;
  return jsonb_build_object('status','active');
end $$;

create or replace function public.rookline_commit_move(
  p_game uuid, p_player uuid, p_expected_ply integer, p_request uuid,
  p_from text, p_to text, p_promotion text, p_san text,
  p_fen text, p_pgn text, p_turn text, p_game_over boolean, p_result text, p_winner uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g public.games%rowtype;
  v_now timestamptz := clock_timestamp();
  v_elapsed integer;
  v_remaining integer;
  v_white integer;
  v_black integer;
  v_previous public.moves%rowtype;
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
  v_elapsed := greatest(0, floor(extract(epoch from (v_now - g.clock_anchor_at)) * 1000)::integer);
  v_remaining := case when g.turn = 'w' then g.white_ms else g.black_ms end;
  if v_elapsed >= v_remaining then
    update public.games set status='completed',
      result=case when public.rookline_timeout_winner(g.fen,g.turn,g.white_id,g.black_id) is null
        then 'Draw: timeout without mating material' else 'timeout' end,
      winner_id=public.rookline_timeout_winner(g.fen,g.turn,g.white_id,g.black_id),
      finished_at=v_now, clock_anchor_at=null,
      white_ms=case when g.turn='w' then 0 else g.white_ms end,
      black_ms=case when g.turn='b' then 0 else g.black_ms end where id=p_game;
    return jsonb_build_object('status','timeout','ply',g.ply);
  end if;
  v_white := case when g.turn='w' then g.white_ms-v_elapsed+g.increment_ms else g.white_ms end;
  v_black := case when g.turn='b' then g.black_ms-v_elapsed+g.increment_ms else g.black_ms end;
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

create or replace function public.rookline_resign_game(p_game uuid, p_player uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare g public.games%rowtype;
begin
  select * into g from public.games where id=p_game for update;
  if not found or p_player not in (g.white_id,g.black_id) then raise exception 'not_a_player'; end if;
  if g.status <> 'active' then raise exception 'game_not_active'; end if;
  update public.games set status='completed', result='resignation',
    winner_id=case when p_player=g.white_id then g.black_id else g.white_id end,
    clock_anchor_at=null, finished_at=clock_timestamp() where id=p_game;
  return jsonb_build_object('status','completed');
end $$;

create or replace function public.rookline_expire_game(p_game uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  g public.games%rowtype;
  v_elapsed integer;
  v_remaining integer;
begin
  select * into g from public.games where id=p_game for update;
  if not found then raise exception 'game_not_found'; end if;
  if g.status <> 'active' then return jsonb_build_object('status',g.status); end if;
  v_elapsed := greatest(0, floor(extract(epoch from (clock_timestamp()-g.clock_anchor_at))*1000)::integer);
  v_remaining := case when g.turn='w' then g.white_ms else g.black_ms end;
  if v_elapsed < v_remaining then return jsonb_build_object('status','active'); end if;
  update public.games set status='completed',
    result=case when public.rookline_timeout_winner(g.fen,g.turn,g.white_id,g.black_id) is null
      then 'Draw: timeout without mating material' else 'timeout' end,
    finished_at=clock_timestamp(),
    winner_id=public.rookline_timeout_winner(g.fen,g.turn,g.white_id,g.black_id),
    clock_anchor_at=null,
    white_ms=case when g.turn='w' then 0 else g.white_ms end,
    black_ms=case when g.turn='b' then 0 else g.black_ms end where id=p_game;
  return jsonb_build_object('status','timeout');
end $$;

revoke all on function public.rookline_join_game(uuid,uuid) from public, anon, authenticated;
revoke all on function public.rookline_timeout_winner(text,text,uuid,uuid) from public, anon, authenticated;
revoke all on function public.rookline_commit_move(uuid,uuid,integer,uuid,text,text,text,text,text,text,text,boolean,text,uuid) from public, anon, authenticated;
revoke all on function public.rookline_resign_game(uuid,uuid) from public, anon, authenticated;
revoke all on function public.rookline_expire_game(uuid) from public, anon, authenticated;
grant execute on function public.rookline_join_game(uuid,uuid) to service_role;
grant execute on function public.rookline_commit_move(uuid,uuid,integer,uuid,text,text,text,text,text,text,text,boolean,text,uuid) to service_role;
grant execute on function public.rookline_resign_game(uuid,uuid) to service_role;
grant execute on function public.rookline_expire_game(uuid) to service_role;

-- Realtime carries committed state notifications only. Clients always refetch a snapshot.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='games') then
    alter publication supabase_realtime add table public.games;
  end if;
end $$;

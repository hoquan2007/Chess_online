-- S0 Rookline real PostgreSQL RLS policy test, using three disposable UUIDs.
-- Run on authorized staging only. Always executes in a rolled-back transaction.
-- SET ROLE + request.jwt.claim.sub checks database RLS, NOT live Auth/JWT,
-- browser cookies, or actual API and Realtime delivery.
begin;

do $fixture$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  c uuid := gen_random_uuid();
  g_ab uuid := gen_random_uuid();
  g_bc uuid := gen_random_uuid();
begin
  perform set_config('rookline.test.a', a::text, true);
  perform set_config('rookline.test.b', b::text, true);
  perform set_config('rookline.test.c', c::text, true);
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at)
  values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rookline_rls_' || a || '@example.invalid', '', now(), now(), now()),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rookline_rls_' || b || '@example.invalid', '', now(), now(), now()),
    (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rookline_rls_' || c || '@example.invalid', '', now(), now(), now());
  insert into public.preferences (user_id, theme) values
    (a, 'dark'), (b, 'light'), (c, 'dark');
  insert into public.games (id, white_id, black_id, status, base_ms, increment_ms,
    white_ms, black_ms, started_at, clock_anchor_at)
  values
    (g_ab, a, b, 'active', 180000, 2000, 180000, 180000, now(), now()),
    (g_bc, b, c, 'active', 180000, 2000, 180000, 180000, now(), now());
  insert into public.moves (game_id, player_id, ply, idempotency_key,
    from_square, to_square, san, fen_after, white_ms, black_ms)
  values (g_ab, a, 1, gen_random_uuid(), 'e2', 'e4', 'e4',
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 179500, 180000);
  insert into public.rating_history (game_id, user_id, category, old_rating, new_rating)
  values (g_ab, a, 'blitz', 1200, 1220), (g_ab, b, 'blitz', 1200, 1180);
end $fixture$;

set local role authenticated;

select set_config('request.jwt.claim.sub', current_setting('rookline.test.a'), true);
do $a$
declare n integer;
begin
  if auth.uid()::text <> current_setting('rookline.test.a') then
    raise exception 'A JWT-sub simulation failed';
  end if;
  select count(*) into n from public.games;
  if n <> 1 then raise exception 'A must see only AB game: %', n; end if;
  select count(*) into n from public.moves;
  if n <> 1 then raise exception 'A must see only AB move: %', n; end if;
  select count(*) into n from public.preferences;
  if n <> 1 then raise exception 'A must see only own preferences: %', n; end if;
  select count(*) into n from public.rating_history;
  if n <> 1 then raise exception 'A must see only own rating history: %', n; end if;
  update public.profiles set display_name='unauthorized' where
    id = current_setting('rookline.test.b')::uuid;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'A could update B profile'; end if;
  update public.profiles set display_name='authorized' where
    id = current_setting('rookline.test.a')::uuid;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'A cannot update own profile'; end if;
  if has_table_privilege('authenticated','public.games','UPDATE') or
     has_table_privilege('authenticated','public.moves','INSERT') or
     has_table_privilege('authenticated','public.ratings','UPDATE') or
     has_table_privilege('authenticated','public.rating_history','INSERT') then
    raise exception 'authoritative tables writable by authenticated';
  end if;
end $a$;

select set_config('request.jwt.claim.sub', current_setting('rookline.test.b'), true);
do $b$
declare n integer;
begin
  select count(*) into n from public.games;
  if n <> 2 then raise exception 'B must see AB and BC games: %', n; end if;
  select count(*) into n from public.rating_history;
  if n <> 1 then raise exception 'B must see own rating entry: %', n; end if;
  select count(*) into n from public.preferences;
  if n <> 1 then raise exception 'B must see only own preferences: %', n; end if;
end $b$;

select set_config('request.jwt.claim.sub', current_setting('rookline.test.c'), true);
do $c$
declare n integer;
begin
  select count(*) into n from public.games;
  if n <> 1 then raise exception 'C must see only BC game: %', n; end if;
  select count(*) into n from public.moves;
  if n <> 0 then raise exception 'C could see AB move'; end if;
  select count(*) into n from public.rating_history;
  if n <> 0 then raise exception 'C could see AB rating history'; end if;
end $c$;

reset role;
rollback;

-- CH-10 database acceptance. Execute ONLY on an isolated, authorized test DB
-- after 20261030120000_atomic_rated_settlement.sql has been installed.
-- The entire fixture is rolled back. This does NOT test parallel transactions;
-- run the separate two-connection protocol for that requirement.
begin;

do $rookline_rating_acceptance$
declare
  v_white uuid := gen_random_uuid();
  v_black uuid := gen_random_uuid();
  v_game uuid := gen_random_uuid();
  v_draw uuid := gen_random_uuid();
  v_invalid uuid := gen_random_uuid();
  v_insert uuid := gen_random_uuid();
  v_count integer;
  v_rating integer;
  v_played integer;
begin
  if has_function_privilege('authenticated', 'public.rookline_rating_after(integer,integer,integer,numeric)', 'EXECUTE')
     or has_function_privilege('anon', 'public.rookline_rating_after(integer,integer,integer,numeric)', 'EXECUTE') then
    raise exception 'rating helper must not be client callable';
  end if;
  if public.rookline_rating_after(1200, 0, 1200, 1) <> 1220 or
     public.rookline_rating_after(1200, 0, 1200, 0) <> 1180 or
     public.rookline_rating_after(1000, 20, 1400, 0.5) <> 1010 then
    raise exception 'rating calculation differs from TypeScript formula';
  end if;

  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at)
  values (v_white, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'rookline_rating_' || v_white || '@example.invalid', '', now(), now(), now()),
    (v_black, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'rookline_rating_' || v_black || '@example.invalid', '', now(), now(), now());

  -- A direct INSERT of a finished rated game would bypass an UPDATE-only
  -- settlement trigger. The database must reject it before it becomes durable.
  begin
    insert into public.games (id, white_id, black_id, status, base_ms, increment_ms,
        white_ms, black_ms, rated, started_at, finished_at, result)
    values (v_insert, v_white, v_black, 'completed', 180000, 2000,
        180000, 180000, true, now(), now(), 'Checkmate');
    raise exception 'finalized rated INSERT unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'rated_game_must_activate_before_completion' then raise; end if;
  end;
  if exists (select 1 from public.games where id = v_insert) then
    raise exception 'invalid direct rated INSERT was persisted';
  end if;

  insert into public.games (id, white_id, black_id, status, base_ms, increment_ms,
      white_ms, black_ms, rated, started_at, clock_anchor_at)
  values (v_game, v_white, v_black, 'active', 180000, 2000,
      180000, 180000, true, now(), now());

  update public.games set status='completed', result='Checkmate', winner_id=v_white,
    finished_at=clock_timestamp(), clock_anchor_at=null where id=v_game;

  select count(*) into v_count from public.rating_history where game_id=v_game;
  if v_count <> 2 then raise exception 'expected exactly two rating ledger rows'; end if;
  select rating, games_played into v_rating,v_played from public.ratings
    where user_id=v_white and category='blitz';
  if v_rating <> 1220 or v_played <> 1 then raise exception 'incorrect white settlement'; end if;
  select rating, games_played into v_rating,v_played from public.ratings
    where user_id=v_black and category='blitz';
  if v_rating <> 1180 or v_played <> 1 then raise exception 'incorrect black settlement'; end if;

  begin
    update public.games set status='completed' where id=v_game;
    raise exception 'replay unexpectedly changed a completed game';
  exception when raise_exception then
    -- Confirm our guard's exact error rather than accidentally accepting
    -- the deliberate assertion exception above.
    if sqlerrm <> 'game_already_finalized' then raise; end if;
  end;
  select count(*) into v_count from public.rating_history where game_id=v_game;
  if v_count <> 2 then raise exception 'duplicate ledger after replay'; end if;

  -- Another rated result with the same players must use current ratings and
  -- create one new ledger pair, without changing the first game's history.
  insert into public.games (id, white_id, black_id, status, base_ms, increment_ms,
      white_ms, black_ms, rated, started_at, clock_anchor_at)
  values (v_draw, v_white, v_black, 'active', 300000, 0,
      300000, 300000, true, now(), now());
  update public.games set status='completed', result='Stalemate', winner_id=null,
    finished_at=clock_timestamp(), clock_anchor_at=null where id=v_draw;
  select count(*) into v_count from public.rating_history
    where game_id in (v_game, v_draw);
  if v_count <> 4 then raise exception 'second game ledger is incomplete'; end if;
  select games_played into v_played from public.ratings
    where user_id=v_white and category='blitz';
  if v_played <> 2 then raise exception 'second game did not increment games_played'; end if;

  -- Invalid winner causes the entire finalization to fail, including ledger.
  insert into public.games (id, white_id, black_id, status, base_ms, increment_ms,
      white_ms, black_ms, rated, started_at, clock_anchor_at)
  values (v_invalid, v_white, v_black, 'active', 600000, 0,
      600000, 600000, true, now(), now());
  -- A forged draw with a winner, a decisive outcome without a winner, or
  -- an unrecognized label must fail before any ratings are changed.
  begin
    update public.games set status='completed', result='Stalemate',
      winner_id=v_white, finished_at=clock_timestamp() where id=v_invalid;
    raise exception 'draw with a winner unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'inconsistent_game_result' then raise; end if;
  end;
  begin
    update public.games set status='completed', result='Checkmate',
      winner_id=null, finished_at=clock_timestamp() where id=v_invalid;
    raise exception 'decisive result without a winner unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'inconsistent_game_result' then raise; end if;
  end;
  begin
    update public.games set status='completed', result='unknown',
      winner_id=v_white, finished_at=clock_timestamp() where id=v_invalid;
    raise exception 'unrecognized outcome unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'inconsistent_game_result' then raise; end if;
  end;
  begin
    update public.games set status='completed', result='invalid',
      winner_id=gen_random_uuid(), finished_at=clock_timestamp() where id=v_invalid;
    raise exception 'invalid winner unexpectedly accepted';
  exception when foreign_key_violation then null;
    when raise_exception then
      if sqlerrm <> 'invalid_game_completion' then raise; end if;
  end;
  if exists(select 1 from public.rating_history where game_id=v_invalid) or
     exists(select 1 from public.games where id=v_invalid and status <> 'active') then
    raise exception 'failed settlement mutated durable state';
  end if;

  -- If either player's counter would overflow, completion and BOTH ratings
  -- must roll back together. This guard is never exposed through the UI.
  insert into public.ratings (user_id, category, games_played)
  values (v_white, 'rapid', 2147483646), (v_black, 'rapid', 0);
  begin
    update public.games set status='completed', result='Checkmate', winner_id=v_white,
      finished_at=clock_timestamp(), clock_anchor_at=null where id=v_invalid;
    raise exception 'overflow settlement unexpectedly committed';
  exception when check_violation then null;
  end;
  if exists (select 1 from public.rating_history where game_id = v_invalid) or
     exists (select 1 from public.games where id = v_invalid and status <> 'active') or
     (select games_played from public.ratings
        where user_id = v_white and category = 'rapid') <> 2147483646 or
     (select games_played from public.ratings
        where user_id = v_black and category = 'rapid') <> 0 then
    raise exception 'failed rated transaction was partially committed';
  end if;

  raise notice 'Rookline rated settlement transactional acceptance passed (ROLLBACK follows).';
end
$rookline_rating_acceptance$;

rollback;

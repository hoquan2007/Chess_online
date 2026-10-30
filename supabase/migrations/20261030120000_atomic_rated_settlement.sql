-- Rookline CH-10: all completed rated games settle atomically with the result.
-- Staging only after migration-history reconciliation and dedicated integration QA.
-- This migration does not enable rated creation or matchmaking in the API.

alter table public.games add constraint games_rated_control_supported check (
  not rated or
  (base_ms = 180000 and increment_ms = 2000) or
  (base_ms = 300000 and increment_ms = 0) or
  (base_ms = 600000 and increment_ms = 0)
);

-- Never let a malformed counter overflow on a later transactional settlement.
alter table public.ratings add constraint ratings_games_played_sane
  check (games_played between 0 and 2147483646);

-- Finalized results and ratings cannot be rewritten by a later service call.
create or replace function public.rookline_guard_game_finality()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- A completed rated game must have passed through the active->completed
  -- transition, so that the AFTER UPDATE settlement cannot be bypassed.
  if tg_op = 'INSERT' then
    if new.rated and new.status = 'completed' then
      raise exception 'rated_game_must_activate_before_completion';
    end if;
    return new;
  end if;
  if old.status in ('completed', 'cancelled') then
    raise exception 'game_already_finalized';
  end if;
  if old.status = 'active' and
      (new.rated, new.white_id, new.black_id, new.base_ms, new.increment_ms)
      is distinct from
      (old.rated, old.white_id, old.black_id, old.base_ms, old.increment_ms) then
    raise exception 'active_game_seats_or_control_locked';
  end if;
  if new.status = 'completed' and
      (old.status <> 'active' or new.finished_at is null or new.result is null or
       new.black_id is null or
       (new.winner_id is not null and new.winner_id not in (new.white_id, new.black_id))) then
    raise exception 'invalid_game_completion';
  end if;
  -- A result must agree with its winner. These are the canonical labels
  -- emitted by the hosted move/clock/resignation/draw-claim paths.
  if new.status = 'completed' and (
      ((new.result like 'Draw:%' or new.result = 'Stalemate')
        and new.winner_id is not null) or
      (new.result in ('Checkmate', 'timeout', 'resignation')
        and new.winner_id is null) or
      (new.result not like 'Draw:%' and
       new.result not in ('Stalemate', 'Checkmate', 'timeout', 'resignation'))
    ) then
    raise exception 'inconsistent_game_result';
  end if;
  return new;
end $$;

drop trigger if exists rookline_guard_game_finality on public.games;
create trigger rookline_guard_game_finality before insert or update on public.games
for each row execute function public.rookline_guard_game_finality();

-- Same Elo-style provisional/established formula as src/lib/online/rating.ts.
-- floor(delta + 0.5) matches JavaScript Math.round, including negative deltas.
create or replace function public.rookline_rating_after(
  p_rating integer, p_games integer, p_opponent integer, p_score numeric
) returns integer language plpgsql immutable strict set search_path = '' as $$
declare
  v_k integer;
  v_delta numeric;
begin
  if p_rating not between 100 and 4000 or p_opponent not between 100 and 4000 or
     p_games not between 0 and 2147483646 or p_score not in (0, 0.5, 1) then
    raise exception 'invalid_rating_inputs';
  end if;
  v_k := case when p_games < 20 then 40 else 24 end;
  v_delta := v_k * (p_score - (1 / (1 + power(10::numeric, (p_opponent - p_rating)::numeric / 400))));
  return least(4000, greatest(100, p_rating + floor(v_delta + 0.5)::integer));
end $$;

create or replace function public.rookline_settle_rated_completion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_category text;
  v_white public.ratings%rowtype;
  v_black public.ratings%rowtype;
  v_locked public.ratings%rowtype;
  v_white_score numeric;
  v_white_after integer;
  v_black_after integer;
  v_locked_count integer := 0;
begin
  -- Triggered only on the transition to completed for a rated game.
  if old.status <> 'active' or new.black_id is null or new.white_id = new.black_id or
      (new.winner_id is not null and new.winner_id not in (new.white_id, new.black_id)) then
    raise exception 'invalid_rated_completion';
  end if;

  if (new.base_ms = 180000 and new.increment_ms = 2000) or
     (new.base_ms = 300000 and new.increment_ms = 0) then
    v_category := 'blitz';
  elsif new.base_ms = 600000 and new.increment_ms = 0 then
    v_category := 'rapid';
  else
    raise exception 'unsupported_rated_control';
  end if;

  if exists (select 1 from public.rating_history where game_id = new.id) then
    raise exception 'rated_game_already_settled';
  end if;

  -- Unique rows are provisioned in UUID order, then both locked in UUID order.
  -- Concurrent games involving either player serialize; no partial updates.
  insert into public.ratings (user_id, category)
    select seat.user_id, v_category
    from (values (new.white_id), (new.black_id)) as seat(user_id)
    order by seat.user_id
    on conflict (user_id, category) do nothing;

  for v_locked in
    select * from public.ratings
    where category = v_category and user_id in (new.white_id, new.black_id)
    order by user_id for update
  loop
    v_locked_count := v_locked_count + 1;
    if v_locked.user_id = new.white_id then v_white := v_locked;
    else v_black := v_locked;
    end if;
  end loop;
  if v_locked_count <> 2 then raise exception 'missing_rated_player'; end if;

  v_white_score := case when new.winner_id is null then 0.5
    when new.winner_id = new.white_id then 1 else 0 end;
  v_white_after := public.rookline_rating_after(
    v_white.rating, v_white.games_played, v_black.rating, v_white_score);
  v_black_after := public.rookline_rating_after(
    v_black.rating, v_black.games_played, v_white.rating, 1 - v_white_score);

  update public.ratings set rating = v_white_after, games_played = games_played + 1
    where user_id = new.white_id and category = v_category;
  update public.ratings set rating = v_black_after, games_played = games_played + 1
    where user_id = new.black_id and category = v_category;

  insert into public.rating_history (game_id, user_id, category, old_rating, new_rating)
  values (new.id, new.white_id, v_category, v_white.rating, v_white_after),
         (new.id, new.black_id, v_category, v_black.rating, v_black_after);

  return new;
end $$;

drop trigger if exists rookline_settle_rated_completion on public.games;
create trigger rookline_settle_rated_completion
after update of status on public.games
for each row when (old.status is distinct from new.status and
                   new.status = 'completed' and new.rated)
execute function public.rookline_settle_rated_completion();

revoke all on function public.rookline_guard_game_finality() from public, anon, authenticated;
revoke all on function public.rookline_settle_rated_completion() from public, anon, authenticated;
revoke all on function public.rookline_rating_after(integer,integer,integer,numeric) from public, anon, authenticated;
grant execute on function public.rookline_rating_after(integer,integer,integer,numeric) to service_role;

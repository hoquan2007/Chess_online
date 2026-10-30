# Rookline staging: authoritative clock and row-lock regression

This test is **PENDING**, not a passing result. Run only against an isolated
Rookline staging Supabase PostgreSQL database after applying migrations
`20261029010000` through `20261029090000` in order. These nine migrations
have now been applied to the dedicated project; the proposed tenth rated
settlement migration is **not applied**. **This protocol has not executed.** Do not run on another
project's database. Use two distinct authorized test accounts, a disposable
unrated active game between them, and two SQL connections to the same database.

The bug fixed in migration `06000` was a pre-lock `clock_timestamp()` read in
`rookline_commit_move` and `rookline_claim_draw`. A transaction that waited for
the row lock could previously use a timestamp from before the wait to accept
an action after the player's flag had fallen. `rookline_expire_game` also
converted milliseconds to `integer`, which overflows after ~24.85 days.

## Preparation

1. Confirm the target database is the dedicated Rookline staging project.
   Record the project ref without exposing credentials. Verify all nine ordered
   migrations; inspect `pg_proc`, security-definer flags, function grants, RLS,
   and rate-limit policies. Verify unauthenticated and ordinary authenticated
   roles cannot execute `rookline_commit_move`, `rookline_claim_draw`, or
   `rookline_expire_game`; `service_role` must be allowed.
2. Create a disposable unrated game through the normal API with two **real**
   authenticated users; join Black to make it active. Record its `game_id`
   and White's `user_id`. Replay and verify the initial FEN and ply=0.
   **Create a fresh active game for EACH test case below.** The proposed rated
   settlement migration makes completed/cancelled games immutable; do not
   attempt to reset a finalized game to `active` for another scenario.
3. Restrict the following direct SQL test to an authorized staging DB owner;
   direct RPC calls bypass the Next.js chess.js draw/move validation and do
   **not** by themselves verify the public API. Never expose `service_role`.

## Concurrent late move

On a dedicated staging connection, configure **only the new active** disposable game:

```sql
update public.games set turn='w', ply=0,
  white_ms=500, black_ms=180000, clock_anchor_at=clock_timestamp()
where id='<GAME_UUID>'::uuid;
```

Immediately start **Session A** to hold its row lock:

```sql
begin;
select id from public.games where id='<GAME_UUID>'::uuid for update;
select pg_sleep(2);
commit;
```

While Session A is sleeping, start **Session B**, with White's authenticated
identity already verified separately by the app, to simulate the corresponding
trusted server RPC. The function will block until A commits:

```sql
select public.rookline_commit_move(
  '<GAME_UUID>'::uuid, '<WHITE_USER_UUID>'::uuid,
  0, gen_random_uuid(), 'e2', 'e4', null, 'e4',
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  '1. e4', 'b', false, null, null
);
```

**Expected:** `{"status":"timeout","ply":0}`; the game's White clock
is zero, status is completed, and there is no accepted move in the ledger.
An accepted move or a recorded ply=1 is a failure. Verify the exact result
and (if winner can mate) Black's `winner_id`. Repeat with real API calls and
two browser sessions to test replay legality, idempotency and race ordering.

## Concurrent late draw claim

Create a **new** disposable active game, configure `turn='w'`, `ply=0`, White
500ms, and `clock_anchor_at=clock_timestamp()`; hold the Session A row lock for
two seconds. While A is sleeping, call from Session B:

```sql
select public.rookline_claim_draw(
  '<GAME_UUID>'::uuid, '<WHITE_USER_UUID>'::uuid, 0, 'repetition'
);
```

**Expected:** `clock_expired` error, no claimed-draw result committed. The
direct call intentionally bypasses the Next.js rule replay: it measures the
clock gate only. A subsequent `rookline_expire_game` call must settle timeout.
For a positive claim test, use a *genuine threefold repeated position* and
the public authenticated API before flag fall; verify the final clocks are
frozen with the elapsed time charged. Never use this direct call to certify
the chess rule or an authorization boundary.

## Abandoned-game overflow

Create another new active disposable game with White to play and nonzero White
remaining time, then set its anchor at least 26 days in the past:

```sql
update public.games set turn='w', white_ms=500,
  clock_anchor_at=clock_timestamp() - interval '26 days'
where id='<GAME_UUID>'::uuid;
select public.rookline_expire_game('<GAME_UUID>'::uuid);
```

**Expected:** `status=timeout` without `integer out of range`; game clocks
and result remain immutable on retry. Also test duplicate move requests,
simultaneous different moves, clock versus resignation, FIDE insufficient
mating material, reconnect, and an out-of-turn client against real RPCs.
Record database ID (nonsecret), timestamps, transaction results and two-client
browser evidence in `TEST_RESULTS.md`. Keep all hosted acceptance gates open
until the test has actually run and passed.

## Rated settlement two-connection protocol (PENDING)

Run only after an explicit review of `20261030120000_atomic_rated_settlement.sql`,
reconciling remote migration history, and applying it to an authorized isolated
staging database. First run `supabase/tests/rated-settlement-acceptance.sql`
with a DB owner; its fixture rolls back. This is separate from the real Auth
and public API checks required before enabling rated play.

1. Create two **fresh** rated `active` games `G1` and `G2` between the same two
   real disposable identities `W` and `B`. Swap colors in G2, use `3+2` and
   `5+0` respectively (both map to blitz), and record ratings and games played
   before either completes. Do not create completed rated games directly.
2. **Session A:** `begin; update public.games set status='completed',
   result='Checkmate', winner_id='<W>'::uuid,
   finished_at=clock_timestamp(), clock_anchor_at=null where id='<G1>'::uuid;`
   Keep the transaction open. Its AFTER UPDATE trigger must hold both rating
   rows until commit.
3. **Session B (concurrently):** execute the analogous final update on `G2`,
   with `winner_id` set to the actual winning seat. It must wait for A's rating
   locks. Commit A, then allow B to finish and commit. Repeat in an isolated
   fixture with A rolled back instead; B must still settle correctly.
4. Query both games and rating histories. Exactly **four** unique
   `(game_id,user_id)` ledger rows must exist after two committed games, and
   each player's `games_played` must increase by two. Every `old_rating` must
   equal the rating from the immediately preceding committed game; compare
   both deltas with `src/lib/online/rating.ts`. Retry each final update and
   assert `game_already_finalized` with unchanged ratings and history.
5. Verify `anon` and `authenticated` cannot invoke settlement helpers or
   directly write `ratings`, `rating_history`, or completed games. Inspect
   per-player RLS and run the external two-client flow before allowing rated
   creation in the product. Report precise timings, isolation levels, any
   deadlocks/timeouts and all failure cases; **no test is claimed as run here**.

## Installed ninth migration: invitation cancellation race still pending live validation

`20261029090000_cancel_waiting_challenge.sql` was installed and structurally
verified on the **dedicated staging project** at remote version `20261030003110`.
Its browser authorization and concurrent join/cancel behavior still require
live verification. Do not run `db push` with unreconciled migration IDs.
Use real separate Auth sessions and two fresh waiting games, created through
the app. Verify outsider and unseated opponent receive HTTP 409 for cancel,
and direct `authenticated` execution of `rookline_cancel_challenge` is denied.
The creator's first cancellation must persist across reload; repeating it
should return HTTP 200, while a later join must return HTTP 409. Start a
creator cancel and opponent join at the same time on a **new** waiting game;
expect exactly one HTTP 200 and one HTTP 409, with final state `cancelled`
or `active` matching the winner. If `active`, a subsequent cancel must reject.
Verify the row lock guarantees these outcomes and clean all disposable games
and users. The opt-in `e2e/staging-online.spec.ts` contains this scenario but
it has **not run against real staging**.

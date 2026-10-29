# Rookline staging: authoritative clock and row-lock regression

This test is **PENDING**, not a passing result. Run only against an isolated
Rookline staging Supabase PostgreSQL database after applying migrations
`20261029010000` through `20261029060000` in order. Do not run on another
project's database. Use two distinct authorized test accounts, a disposable
unrated active game between them, and two SQL connections to the same database.

The bug fixed in migration `06000` was a pre-lock `clock_timestamp()` read in
`rookline_commit_move` and `rookline_claim_draw`. A transaction that waited for
the row lock could previously use a timestamp from before the wait to accept
an action after the player's flag had fallen. `rookline_expire_game` also
converted milliseconds to `integer`, which overflows after ~24.85 days.

## Preparation

1. Confirm the target database is the dedicated Rookline staging project.
   Record the project ref without exposing credentials. Apply all six ordered
   migrations; inspect `pg_proc`, security-definer flags, function grants, RLS,
   and rate-limit policies. Verify unauthenticated and ordinary authenticated
   roles cannot execute `rookline_commit_move`, `rookline_claim_draw`, or
   `rookline_expire_game`; `service_role` must be allowed.
2. Create a disposable unrated game through the normal API with two **real**
   authenticated users; join Black to make it active. Record its `game_id`
   and White's `user_id`. Replay and verify the initial FEN and ply=0.
3. Restrict the following direct SQL test to an authorized staging DB owner;
   direct RPC calls bypass the Next.js chess.js draw/move validation and do
   **not** by themselves verify the public API. Never expose `service_role`.

## Concurrent late move

On a dedicated staging connection, first reset **only** the disposable game:

```sql
update public.games set status='active', turn='w', ply=0,
  white_ms=500, black_ms=180000, clock_anchor_at=clock_timestamp(),
  result=null, winner_id=null, finished_at=null
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

Reset only the disposable game to `active`, `turn='w'`, `ply=0`, White 500ms,
and `clock_anchor_at=clock_timestamp()`; hold the same Session A row lock for
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

Reset the disposable game to `active` with White to play and nonzero White
remaining time, then set its anchor at least 26 days in the past:

```sql
update public.games set status='active', turn='w', white_ms=500,
  clock_anchor_at=clock_timestamp() - interval '26 days',
  result=null, winner_id=null, finished_at=null
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

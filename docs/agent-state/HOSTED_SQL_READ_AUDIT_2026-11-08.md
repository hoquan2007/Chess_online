# Hosted multiplayer SQL read-only audit — 2026-11-08

Project `tyvczicinpjixmxgjhjn` was inspected through the connected Supabase SQL interface. No schema, role, row or environment mutations were made. These results do **not** replace independent S2 PostgreSQL sessions or a real hosted two-player latency run.

## Deployed SQL parity

`pg_get_functiondef` was read for four installed `public` game RPCs. The PL/pgSQL bodies were compared to the latest relevant local migration definitions after lowercasing and stripping whitespace and `--` comments (a lexical check, **not** a byte-for-byte dump):

| Remote function | Corresponding local definition | Normalized body |
| --- | --- | --- |
| `rookline_commit_move` | `20261029060000_locked_move_and_claim_clocks.sql` | MATCH |
| `rookline_claim_draw` | `20261029060000_locked_move_and_claim_clocks.sql` | MATCH |
| `rookline_expire_game` | `20261029060000_locked_move_and_claim_clocks.sql` | MATCH |
| `rookline_cancel_challenge` | `20261029090000_cancel_waiting_challenge.sql` | MATCH |

All four are owned by `postgres`, use `SECURITY DEFINER` and a fixed empty `search_path`. Current database privilege checks show `EXECUTE = false` for both `anon` and `authenticated`, and `EXECUTE = true` for `service_role` for each function. Candidate `rookline_read_player_game` is **absent**. Do not apply that candidate or enable `ROOKLINE_FAST_GAME_SNAPSHOT` before S2 independent-session lock/clock tests and hosted authorization verification.

`games` has an ID primary key plus `games_white_recent`, `games_black_recent` and winner indexes. `moves` has a primary key, unique `(game_id, ply)`, unique `(game_id, player_id, idempotency_key)` and player lookup index. Supabase performance advisors returned **zero** current notices.

## Execution time sampling; interpretation limits

Read-only `pg_stat_statements` aggregate snapshot since its reset at `2026-10-29 13:50:11 UTC`:

| Normalized PostgREST statement | Calls | Mean execution | Max execution |
| --- | ---: | ---: | ---: |
| `public.games` SELECT by ID | 1,628 | 0.06 ms | 4.10 ms |
| `public.games` selected-field read | 228 | 0.21 ms | 6.28 ms |
| `public.moves` SELECT for a game | 181 | 0.04 ms | 1.21 ms |

These are **cumulative SQL execution statistics**, not correlated traces from the same 32-ply browser test. They exclude Vercel request routing, authentication, PostgREST/network round trips, Realtime delivery, JavaScript scheduling, rendering and current concurrent-load effects. Do not translate them into a browser p50/p95 or assume all game GETs use just one SQL statement. The last genuine opponent-visible p50/p95 remains **998/1120 ms**, with an acceptance target of **p95 <800 ms**.

## Remaining acceptance work

Obtain two genuinely independent direct PostgreSQL sessions to check row-lock contention, idempotent competing moves, server-clock expiry and rating finality under concurrency. Retain full remote migration-history, RLS, role and trigger review. Once Vercel staging quota and correct deployment-scoped browser identity allow it, publish the exact development SHA to protected `staging`/`sin1` and run 32 actual moves between two distinct Supabase Auth users. Correlate opponent-visible browser timings with first canonical GET, Realtime hints and GET rate so a request-load tradeoff can be assessed. Rated mode remains OFF; no main merge or production promotion.

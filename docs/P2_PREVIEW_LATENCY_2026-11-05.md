# P2 — measured protected-Preview multiplayer latency

## Checkpoint 163: local healthy-game GET fast path (2026-11-08)

The default GET handler now avoids expiry RPC plus a second game SELECT for **unrated active** games whose server-estimated remaining clock exceeds 60 seconds. The first authenticated, participant-checked SELECT still supplies the canonical database state, and the server alone derives its expiry-path decision. Near-expiry games, invalid clock anchors and any rated game still take the existing locked `rookline_expire_game` route with a second SELECT. The database remains authoritative for accepted moves, timeouts and results. The route's new common-case call-count assertion and near-deadline/rated regression pass locally, alongside 316 unit and 132 executable Chromium tests. **No new hosted p95 has been measured** at this SHA. The 2026-11-05 opponent p95 of 1,120 ms below is historical and the <800 ms target remains unverified. Before claiming an improvement, run the same 32-ply two-real-account Preview scenario and compare GET and opponent-visible p50/p95. Server wall-clock skew is a residual consideration in this conservative shortcut; S2 independently tested database clock/lock ordering remains mandatory before rated enablement.

## Checkpoint 153: opponent update latency decomposed (2026-11-05)

Recomputed **paired per-move** differences from all 32 unchanged optimized-Preview samples in `evidence/staging-latency-verified-sin1-2026-11-05.json`. The timing origin is still the local browser's Move click. Opponent Realtime here is the **independent authenticated Node test subscriber** for the opponent's color, not an instrumented timestamp inside the browser room.

| Measured component | p50 | p95 | Maximum |
| --- | ---: | ---: | ---: |
| Move click → opponent's independent Realtime event | **665 ms** | **722 ms** | 747 ms |
| Opponent's first canonical GET (request → response) | **328 ms** | **458 ms** | 484 ms |
| Opponent's GET response → visible move | **6 ms** | **10 ms** | 11 ms |
| Opponent Realtime event → visible move (paired) | **334 ms** | **412 ms** | 466 ms |
| Opponent Realtime event → first GET start (paired) | **2 ms** | **9 ms** | 10 ms |

The first opponent GET began before the independent Realtime test callback on **4/32** moves. Focus/poll events or timing differences between independent subscribers and browser-room subscribers can cause this; the data cannot attribute the trigger. The GET spans include browser/network, Vercel handler, authentication, PostgREST and PostgreSQL; the data do **not** yet isolate those segments. Rendering after the GET response is already fast, so the remaining useful targets are authenticated server read cost and the move-to-Realtime path.

**Next implementation prepared locally (not enabled on hosted staging):** added a service-role-only `rookline_read_player_game(uuid,uuid)` PostgreSQL RPC that verifies the signed-in player's seat, takes the same row lock as authoritative clock expiry, calls `rookline_expire_game` and returns the canonical game within **one database transaction and one remote PostgREST RPC**. The GET route activates it only with server-side `ROOKLINE_FAST_GAME_SNAPSHOT=1`; without this opt-in, the existing verified three-round-trip read remains in use. Auth is still checked on the server; malformed and missing RPC results fail closed. The new migration has **not been installed on the staging database**, so the 32-move numbers above are **not** evidence that this candidate improves latency. Before enabling, back up/reconcile remote migration history, review the SQL security grants, execute direct database clock/lock tests, then measure a fresh 32-move same-region Preview benchmark and compare GET and opponent-board p50/p95 under otherwise identical conditions. Keep rated OFF and production unchanged.

**Additional read-only staging inspection, checkpoint 153:** all **nine installed baseline migration version IDs** match the nine local baseline filenames; this does not prove their SQL bodies match and a reviewed backup is still required before schema changes. `rookline_read_player_game` is **not installed**. The existing `rookline_expire_game` has `SECURITY DEFINER`, an empty search path, `service_role` EXECUTE **true**, and `anon`/`authenticated` EXECUTE **false**. Cumulative `pg_stat_statements` for its PostgREST invocation returned **522 calls, mean SQL execution 0.528 ms, minimum 0.130 ms and maximum 40.493 ms**; these numbers are not an isolated GET sample or a SQL p95. The proposed fast read also obtains an exclusive row lock on every game GET, which could delay moves during bursts; staged two-session contention and sustained-read tests must pass before enabling it.

**Status: P2 baseline and optimized Preview comparison MEASURED (2026-11-05).** Both runs used real hosted HTTPS, two distinct disposable Supabase Auth identities and two independent authenticated Chromium browser contexts, but both contexts ran on **one Windows machine**. This is real two-account hosted multiplayer evidence, **not a test with two human-operated devices in different locations**.

## Verified optimized Preview and before/after comparison

- Optimized **protected, nonproduction** Vercel Preview: `https://chessonline-kotyvnzx0-hnquan.vercel.app`, deployment `dpl_5bft2J4BoSP2yLUgFPp1UrPgiJ1s` (**READY**). Isolated reviewed release checkout `D:\Chess_online\.release-p2-sin1`, branch `codex/p2-realtime-preview`, commit `5e41c0548138e5b07cc66b5c0f5febd2a6a3bb2b`. Vercel inspection showed serving Functions in **`sin1` (Singapore)**, close to the Supabase staging database in **`ap-southeast-1` (Singapore)**. This records the tested source checkout and deployed URL; it does not claim the Preview contains unrelated uncommitted development-worktree features.
- The isolated Preview includes server-canonical move response snapshots, immediate sender rendering, request coalescing, and authenticated game-room Realtime subscriptions with a single `postgres_changes` binding. The intermediate same-region Preview without the complete game-room fix still took ~3 seconds to show moves to the opponent because its room subscriber received no game change frames; successful database publication alone did not ensure the browser was subscribed correctly.
- Optimized run completed **1/1 PASS**, **32/32 legal alternating half-moves**, 2 real signed-in users, 2 browser contexts, and **32/32 canonical snapshots**. Run recorded `2026-11-05T01:32:36.541Z`; sanitized per-move evidence: [`evidence/staging-latency-verified-sin1-2026-11-05.json`](evidence/staging-latency-verified-sin1-2026-11-05.json). Both disposable accounts and the temporary game were cleaned up.

| Browser measurement, click-to-event | Old Virginia Preview p50 / p95 | Optimized Singapore Preview p50 / p95 | Observed reduction p50 / p95 |
| --- | ---: | ---: | ---: |
| Move POST response | 2,604 / 4,403 ms | **450 / 646 ms** | **2,154 / 3,757 ms** |
| Sender's rendered move history | 4,018 / 6,531 ms | **457 / 652 ms** | **3,561 / 5,879 ms** |
| Opponent's rendered move history | 4,536 / 6,415 ms | **998 / 1,120 ms** | **3,538 / 5,295 ms** |
| White's independent Realtime callback | 2,691 / 4,663 ms | **665 / 722 ms** | **2,026 / 3,941 ms** |
| Black's independent Realtime callback | 2,688 / 4,663 ms | **665 / 738 ms** | **2,023 / 3,925 ms** |

The nearest-rank percentiles use 32 samples in each run. Values start when the move is submitted in the test browser, and include the relevant upstream processing and rendering. The observed reductions are **old percentile minus new percentile**, **not** per-move causal effects, one-way RTTs, or proof of a universal latency SLO. The two deployments differ in **both region and code**, so an isolated A/B attribution to either factor is not possible. The optimized opponent-board p95 of **1,120 ms** also does **not** meet the proposed <800 ms same-region target.

**Optimized Realtime verification:** Both game-room WebSockets opened once, joined successfully **with an Auth token and exactly one `postgres_changes` binding each**, delivered **32/32 relevant changes per browser** and had **zero observed disconnects**. Separate independent Supabase Realtime test subscriptions both reached `SUBSCRIBED` and each received **32/32** events. This verifies real delivered messages for this run; it does not quantify global delivery rates. The optimized independent Realtime callback p50/p95 was 665/722 ms for White and 665/738 ms for Black from move submission, not an isolated WebSocket hop measurement.

**PostgreSQL after optimized run:** Read-only staging `pg_stat_statements` inspection at **2026-11-05 01:35:15 UTC** showed `rookline_commit_move` **154 cumulative calls**, **mean SQL execution 1.580 ms**, minimum **0.413 ms**, maximum **16.132 ms**, standard deviation **2.233 ms**, total **243.355 ms**. These are cumulative across other staging traffic, **not a 32-call isolated post-run cohort** and do not provide SQL p50/p95. `public.games` remained in `supabase_realtime`, and a point-in-time database snapshot saw **25 sessions and 0 waiting on locks**; a snapshot cannot rule out transient contention. The remaining ~1-second opponent p95 can include WebSocket event delivery, authenticated GET, network and browser processing, none individually isolated by these SQL aggregates.

## Original Preview baseline (before optimization)

## Deployment and scope

- Protected nonproduction Vercel Preview: `https://chessonline-6ar5bozpb-hnquan.vercel.app`, deployment `dpl_B9oECfvArxLL4PbHxyxDeTVtvgkV`, Git SHA `c48970bbd9486949c7b595dba9c0bcd67f8e5cd0`, READY.
- Vercel server function region: **`iad1` (Northern Virginia, USA)**. Dedicated Supabase staging project `tyvczicinpjixmxgjhjn` region: **`ap-southeast-1` (Singapore)**. This transcontinental deployment/database mismatch is a plausible contributor to round-trip latency, but it does not quantify causality by itself.
- This deployed SHA **predates the local P0/P1 response-snapshot and request-coalescing changes**. Baseline response had **0/32 canonical game snapshots**; the newer local route has not yet been deployed to this origin.
- Benchmark: `e2e/staging-latency.spec.ts`; 2 disposable real Supabase Auth identities, 2 separate signed-in Chromium contexts, genuine private 10+0 challenge, 32 legal alternating half-moves, authenticated HTTP requests, and 2 independent Supabase Realtime subscriptions to `public.games`. Run finished **1 PASS / 0 FAIL** in 2.9 minutes. Both test accounts and game were deleted successfully.
- Recorded at **2026-11-05T00:43:22Z** (07:43:22 UTC+7). Raw, sanitized per-ply evidence: [`evidence/staging-latency-preview-2026-11-05.json`](evidence/staging-latency-preview-2026-11-05.json). Generated local output: `test-results/staging-latency-report.json` (ignored by Git).

## Browser evidence (32 moves, elapsed milliseconds from clicking Move)

| Instrumented point | Samples | p50 | p95 | Maximum |
| --- | ---: | ---: | ---: | ---: |
| Move POST response | 32 | **2,604** | **4,403** | 4,658 |
| Sender's rendered move history | 32 | **4,018** | **6,531** | 6,532 |
| Opponent's rendered move history | 32 | **4,536** | **6,415** | 6,923 |
| White's authenticated Realtime callback | 32 | **2,691** | **4,663** | 4,769 |
| Black's authenticated Realtime callback | 32 | **2,688** | **4,663** | 4,766 |

Percentiles use the **nearest-rank** method on 32 samples (p50 is rank 16, p95 rank 31). Full browser interaction, RPC/network waits and rendering are included; this is **not a one-way network RTT**. Derived from per-ply deltas, opponent-board time **minus POST response time** has p50 **612 ms**, p95 **3,524 ms**; White Realtime event time **minus POST response** has p50 **46 ms**, p95 **254 ms** (some events can arrive before HTTP completion). Do not subtract independently aggregated p95 values to estimate per-move deltas.

**Realtime health:** Both independent channels reached `SUBSCRIBED`; each saw **32/32** expected game UPDATE/ply events, with no observed missing ply in this sample. The measured Realtime callback time includes upstream move processing, so it is **not isolated Realtime transport latency**. A successful sample does not prove global delivery SLOs or geographic two-client behavior.

## Database evidence (read-only staging SQL, after the run)

- The observed `pg_stat_statements` entry for the principal `rookline_commit_move` RPC increased from **14 calls before** to **46 after** the 32-ply test. Across these **46 cumulative calls**, `mean_exec_time = 1.915 ms`, minimum **0.417 ms**, maximum **16.132 ms**, standard deviation **2.945 ms**, total **88.070 ms**. These are **SQL execution timings only**, not HTTP, DNS, authentication, cold starts, queueing, network or client rendering. `pg_stat_statements` does not expose a per-call p50/p95.
- Database activity snapshot at **2026-11-05 00:45:10 UTC**: **16 sessions**, **0 lock-waiting sessions** at that instant. It does not rule out transient contention during the earlier game.
- `supabase_realtime` publication included `public.games` (one matching publication-table row). Actual authenticated client delivery was corroborated by both 32/32 event counts.

Reproducible read-only checks:

```sql
SELECT calls, mean_exec_time, min_exec_time, max_exec_time,
       stddev_exec_time, total_exec_time
FROM pg_stat_statements
WHERE query ILIKE '%rookline_commit_move%'
ORDER BY calls DESC LIMIT 4;

SELECT count(*) FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public' AND tablename = 'games';
```

## Interpretation and next test

The old Preview was **slow**: p95 **4.4 s** to get the accepted move response and **6.4 s** to show it on the opponent's board. Realtime delivered all events to the independent test subscriptions and cumulative SQL function time was in **single-digit milliseconds on average**, so neither missing test-subscription messages nor slow SQL execution alone explains the multi-second end-to-end response. The old client awaited a second authenticated GET after POST and the function/database ran on different continents; both were candidates for delay. Function invocation breakdown, HTTP timings, cold-start frequency and mid-flight row locks were **not instrumented**, so do not assign exact percentages to those causes.

**Comparison is now complete** for the controlled 32-move, same-runner Preview protocol; the optimized deployment and its `sin1` region were verified. Next: measure from **two distinct physical client devices/networks**, preferably different geographic regions and with separately captured latency traces; repeat multiple runs and instrument per-request warm/cold API spans, Auth/GET and Realtime delivery. A region-vs-code causal A/B would require controlling the other variable. Continue separate **S2 dual-PostgreSQL-session** clock/lock races before rated release. Preserve server-authoritative clocks/moves, private Realtime and rated OFF.

**Scope:** An isolated protected **Preview** was deployed; no **production** deployment, merge to `main`, Supabase migration or SQL schema change occurred in this P2 measurement. S2 independent dual-PostgreSQL-session row-lock/clock races and all 20 release gates remain open.

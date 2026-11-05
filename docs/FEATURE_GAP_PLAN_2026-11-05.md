# Rookline feature gap audit and execution plan — 2026-11-05

**Status:** IN_PROGRESS / 20 release gates OPEN / rated games OFF. Audited development branch `codex/chess-platform-foundation` at `c7bc639`, including existing uncommitted changes. Scope follows `PROJECT_VISION.md` and `agent-state/BACKLOG.md`; security boundaries follow `ARCHITECTURE.md` and `SECURITY_MODEL.md`.

**Checkpoint 150 update:** The locally implemented CH-17 practice planner also supports portable versioned JSON draft import/export and standings/schedule CSV. JSON is size/schema/roster/result validated and re-generates fixtures; CSV protects spreadsheet-opening users from formula execution in player names. This closes **practice-file portability only**, not hosted organizer, pairing, authoritative scoring or rated tournaments. Latest local verification: **516 Vitest PASS; 9 historical SQL source hashes, lint, strict TS and 23-page production build PASS; complete Chromium 124 PASS / 3 conditional SKIP / 0 FAIL (127)**. Protected hosted S2–S6 evidence and exact-current-SHA CI/deployment are still pending.

## Implemented and tested locally

- Local chess, computer play, clocks, archive, chess.js rules, accessible result feedback, puzzle/opening lessons, analysis and licensed Stockfish Worker.
- Online Auth, challenges, authoritative move route and game UI exist. **S0/S1 passed real 3-user RLS and private Realtime on a previous protected Preview at SHA `c48970bb`**, not at the current uncommitted working-tree revision.
- Social connections, blocks, notifications, private chat, tournaments create/join/leave/cancel, moderation and spectator opt-in/replay exist as local code; newer migrations have not been independently verified on live staging.
- **Checkpoint 147:** read-only spectator replay plus revocation; previous local evidence 505 Vitest PASS and 119 production Chromium PASS / 4 conditional SKIP.
- **Checkpoint 148 (this slice):** browser-only `/tournaments/planner` round robin: 4–16 unique names, every pair once, alternating colors, one bye each for odd entrants, practice score selection/clearing, standings based on wins/draws. No server schedule, no Supabase storage, no rating.

## Missing features / prioritized plan

| Priority | Gap | Required work and proof |
| --- | --- | --- |
| P0 | S2: trusted DB clock and concurrency | Obtain two **independent direct PostgreSQL sessions** and isolated disposable nonproduction fixtures. Prove lock ordering, server clock, late move/claim/resign races, request idempotency and RPC grants. **BLOCKED_EXTERNAL.** |
| P0 | S3: rated integrity | Review/install pending atomic settlement migration **after S2**, verify concurrent exactly-once rating events, replay and rollback cases, abuse prevention; keep rated OFF until successful. **BLOCKED_BY_S2_AND_MIGRATION.** |
| P0 | Hosted Auth, migration and RLS | Back up staging, reconcile remote database versions, review and install the five unapplied learning/social/tournament/private-chat/spectator migrations in isolated staging. Use three real users to test RLS, chat privacy, spectator consent, moderator permissions and reconnect. Separately verify public signup → actual inbox → callback → logout → login after an authorized release. |
| P1 | CH-09 matchmaking / rematch | Add request queue, cancellation, expiries, rematch acceptance and concurrent-request protection; run a real two-client plus forbidden third-client E2E. |
| P1 | CH-10/11 rated outcomes / leaderboard | Durable event ledger, result settlement, idempotent rating calculations, trusted ranking query and account privacy; real staging race and identity tests. |
| P1 | CH-17 hosted tournament | Extend registration to organizer start, persisted rounds/pairings, authoritative game assignment, forfeit/finish results, standings and tie breaks with RLS and migration tests. The offline planner **does not close CH-17**. |
| P1 | S4/S5 full learning/community | Prove hosted progress, profile ownership, notifications, chat/blocks, moderation/reporting and spectator opt-in using separate identities, reconnect and owner-revocation tests. |
| P2 | S6 final release | Evidence for each of 20 acceptance gates at exact release SHA: independent security, accessibility, performance, mobile/responsive, CI, licensed content, staged DB and real-hosted E2E. **NO-GO until all pass.** |

## Work performed and next execution gates

1. **Done:** Added deterministic offline round-robin planning domain/UI/routes and Vitest checks for pairing counts, color/byes and standings over 4–16 participants. Added Chromium UI flow and fixed an ambiguous alert selector found by the first browser run.
2. **Current local proof:** pinned historical migration SQL snapshot **9/9 PASS** (remote **not queried**); ESLint PASS; TypeScript PASS; **513/513 Vitest PASS in 78 files**; Next.js 16.4.3 Webpack production build PASS with **23 generated static pages**; full production Chromium **121 PASS / 4 conditional SKIP / 0 FAIL (125)**. Restricted Windows build hit generated `.next` EPERM; approved native build succeeded.
3. **Next:** obtain authorized isolated staging database connections and backup, execute S2 direct-PG race proofs, review five pending migrations and rerun real three-user hosted tests; only then progress S3 rated and CH-09/10/11/17 in reviewable vertical slices.
4. **Release:** publish a reviewed development commit, verify exact SHA with Linux CI and protected Preview, then close individual S6 gates. No merge into `main`, production deployment or rated-game activation occurred.

All previously modified/untracked workspace files remain preserved. This evidence applies to the local working tree, not a clean Git commit or deployed revision.

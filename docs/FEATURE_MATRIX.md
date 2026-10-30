# Rookline feature matrix

Statuses: `LOCALLY_TESTED` means a named local unit/browser flow passed, **not** complete acceptance; `IMPLEMENTED_UNVERIFIED` means code exists without a needed real integration test; `PARTIAL` means only a subset exists; `PLANNED` means no complete functional implementation; `BLOCKED_EXTERNAL` requires live services. A unit test or local E2E passing is not hosted multiplayer proof.

| ID | Priority | Capability | Dependencies | Status | Acceptance and evidence | Review |
| --- | --- | --- | --- | --- | --- | --- |
| CH-01 | P0 | Original responsive shell, themes, navigation | Next, tokens | LOCALLY_TESTED | Browser mobile no overflow, theme/settings and navigation, coordinate keyboard input in local/analysis and keyboard promotion focus/Escape locally pass; full accessibility/visual audit pending | Partial QA |
| CH-02 | P0 | Legal chess rules, SAN/PGN/FEN | chess.js | PARTIAL | Local PGN exports result headers and custom setup FEN with unit/browser evidence; claimable 3-fold/50, automatic 5-fold/75, timeout, promotion, same-colored bishops and resignation draw all tested. Hosted claim RPC and latest mating-material SQL unverified | FIDE edge-case/SQL QA pending |
| CH-03 | P0 | Local game, actions, clock, save | CH-02 | LOCALLY_TESTED | Browser legal/keyboard moves, keyboard-accessible promotion, clock-restoring undo/reload, active-clock reload expiry, throttled-tab timeout refusal, Fool's Mate, corrupt storage, archive replay and withdrawal of obsolete completed archive results after Undo, winning and drawn resignation PGN; sustained long-game review pending | Partial QA |
| CH-04 | P0 | Computer opponent four levels | CH-02, worker | LOCALLY_TESTED | Real browser Worker produced legal first move; stale Worker errors after reset ignored; resignation while bot thinks charges human side and threefold claims disabled on bot turn (browser-tested); Undo preserves opening ply/clock; resumed expired-bot clock suppresses move; skill/time and long-game QA pending | Basic minimax |
| CH-05 | P0 | Supabase Auth, secure sessions | schema, credentials | IMPLEMENTED_UNVERIFIED | Login/register/callback code exists; real Auth E2E pending | Live security pending |
| CH-06 | P0 | Persistent authenticated game and state | CH-05, migrations | IMPLEMENTED_UNVERIFIED | SQL and protected create/join/read routes exist; all 9 migrations applied to dedicated hosted project; structural RLS/grant/index checks passed, but no real identity/game E2E | Live security pending |
| CH-07 | P0 | Transactional move server, timeout | CH-06 | IMPLEMENTED_UNVERIFIED | Legal server replay and deployed locked-row RPC/clock migrations; hosted structural SQL verified selected timeout helper inputs; authenticated atomic/concurrent moves, late clock and draw claims untested | Real concurrency pending |
| CH-08 | P0 | Realtime reconnection, two browsers | CH-07, Realtime | IMPLEMENTED_UNVERIFIED | Local mocked browser tests prove stale HTTP 200/403 responses cannot rewind the displayed room; real two-context Realtime E2E missing | Live integration pending |
| CH-09 | P0 | Matchmaking, challenge, rematch | CH-08 | PARTIAL | Private invitation and creator-only cancellation API/UI locally tested; ninth migration deployed to dedicated staging with row-lock/grant structural checks PASS; real join-versus-cancel race and two authenticated identities still untested; matching/rematch absent | Live security pending |
| CH-10 | P0 | Exactly once rated settlement | CH-07, ledger | PLANNED | Concurrent settlement integration tests | Security pending |
| CH-11 | P1 | Profiles, history, leaderboard | CH-05, CH-10 | PARTIAL | `/games` browser archive of completed local/computer games with replay/download and retracted result cleanup after local Undo browser-tested; hosted-read page code exists, live Auth/DB verification and rating absent | Pending |
| CH-12 | P1 | PGN/FEN analysis/review | CH-02 | PARTIAL | Local PGN Result/FEN/export, archive replay and Result-preserving re-export browser-tested; malformed archive/PGN recovery, analysis keyboard promotion/underpromotion and Escape/focus trap tested; online room PGN uses mocked API; engine evaluations outstanding | Partial QA |
| CH-13 | P1 | Original puzzles and local progress | CH-02 | PARTIAL | 3 original puzzles, unit/browser tests pass; rating scale outstanding | Partial QA |
| CH-14 | P1 | Opening explorer and lessons | Licenses, CH-02 | LOCALLY_TESTED | Original interactive content and browser navigation pass; breadth pending | Partial QA |
| CH-15 | P2 | Chat/friends/search | CH-05, CH-08 | PLANNED | Authentication/moderation tests | Pending |
| CH-16 | P2 | Notifications, spectators | CH-08 | PLANNED | Channel authorization/reconnect | Pending |
| CH-17 | P2 | Tournaments and standings | CH-10 | PLANNED | Tournament E2E | Pending |
| CH-18 | P0 | Security, abuse and rate limits | All hosted features | PARTIAL | Origin/body checks and security headers browser-tested, DB rate limiter draft; RLS/IDOR/abuse integration pending | Partial QA |
| CH-19 | P0 | CI/CD, full regression, accessibility | All features | PARTIAL | Checkpoint 24 lint/typecheck, 52/52 unit and native Webpack build 17/17 pages PASS; Chromium 41 PASS / 1 guarded staging SKIP; hosted CI, broader accessibility, cross-browser and public preview pending | Partial QA |
| CH-20 | P0 | Evidence-based release audit | CH-01..19 | PLANNED | 20 acceptance gates with citations | Pending |

See `docs/TEST_RESULTS.md` for exact observed results. No feature has yet passed all its required evidence gates.

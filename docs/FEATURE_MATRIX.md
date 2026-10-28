# Rookline feature matrix

Statuses: `LOCALLY_TESTED` means a named local unit/browser flow passed, **not** complete acceptance; `IMPLEMENTED_UNVERIFIED` means code exists without a needed real integration test; `PARTIAL` means only a subset exists; `PLANNED` means no complete functional implementation; `BLOCKED_EXTERNAL` requires live services. A unit test or local E2E passing is not hosted multiplayer proof.

| ID | Priority | Capability | Dependencies | Status | Acceptance and evidence | Review |
| --- | --- | --- | --- | --- | --- | --- |
| CH-01 | P0 | Original responsive shell, themes, navigation | Next, tokens | LOCALLY_TESTED | Browser mobile no overflow, theme/settings and navigation, coordinate keyboard input in local/analysis pass; full accessibility/visual audit pending | Partial QA |
| CH-02 | P0 | Legal chess rules, SAN/PGN/FEN | chess.js | PARTIAL | Unit tests cover claimable 3-fold/50, automatic 5-fold/75, timeout material, coordinate notation and promotions; browser local claim/analysis underpromotion works. Hosted claim RPC unverified | FIDE edge-case/SQL QA pending |
| CH-03 | P0 | Local game, actions, clock, save | CH-02 | LOCALLY_TESTED | Browser legal/keyboard moves, clock-restoring undo/reload, throttled-tab timeout refusal, Fool's Mate and corrupt storage recovery pass; sustained long-game timing review pending | Partial QA |
| CH-04 | P0 | Computer opponent four levels | CH-02, worker | LOCALLY_TESTED | Real browser Worker produced legal first move; Undo preserves a sole opening bot ply; strength/time control and long-game QA pending | Basic minimax |
| CH-05 | P0 | Supabase Auth, secure sessions | schema, credentials | IMPLEMENTED_UNVERIFIED | Login/register/callback code exists; real Auth E2E pending | Live security pending |
| CH-06 | P0 | Persistent authenticated game and state | CH-05, migrations | IMPLEMENTED_UNVERIFIED | SQL and protected create/join/read routes exist; migrations not applied | Live security pending |
| CH-07 | P0 | Transactional move server, timeout | CH-06 | IMPLEMENTED_UNVERIFIED | Legal server replay, DB RPC draft, timeout and draw-claim draft; no live atomic/concurrent or SQL verification | Live security pending |
| CH-08 | P0 | Realtime reconnection, two browsers | CH-07, Realtime | IMPLEMENTED_UNVERIFIED | Local mocked browser tests prove stale HTTP 200/403 responses cannot rewind the displayed room; real two-context Realtime E2E missing | Live integration pending |
| CH-09 | P0 | Matchmaking, challenge, rematch | CH-08 | PLANNED | Two authenticated players | Security pending |
| CH-10 | P0 | Exactly once rated settlement | CH-07, ledger | PLANNED | Concurrent settlement integration tests | Security pending |
| CH-11 | P1 | Profiles, history, leaderboard | CH-05, CH-10 | PARTIAL | Hosted-read page code exists, live Auth/DB verification and rating absent | Pending |
| CH-12 | P1 | PGN/FEN analysis/review | CH-02 | PARTIAL | PGN import/download with saved content, FEN load, keyboard moves and underpromotion browser-tested; engine evaluations outstanding | Partial QA |
| CH-13 | P1 | Original puzzles and local progress | CH-02 | PARTIAL | 3 original puzzles, unit/browser tests pass; rating scale outstanding | Partial QA |
| CH-14 | P1 | Opening explorer and lessons | Licenses, CH-02 | LOCALLY_TESTED | Original interactive content and browser navigation pass; breadth pending | Partial QA |
| CH-15 | P2 | Chat/friends/search | CH-05, CH-08 | PLANNED | Authentication/moderation tests | Pending |
| CH-16 | P2 | Notifications, spectators | CH-08 | PLANNED | Channel authorization/reconnect | Pending |
| CH-17 | P2 | Tournaments and standings | CH-10 | PLANNED | Tournament E2E | Pending |
| CH-18 | P0 | Security, abuse and rate limits | All hosted features | PARTIAL | Origin/body checks and security headers browser-tested, DB rate limiter draft; RLS/IDOR/abuse integration pending | Partial QA |
| CH-19 | P0 | CI/CD, full regression, accessibility | All features | PARTIAL | Local lint/typecheck/42 unit/21 browser/Webpack build pass at checkpoint 5; CI run, full keyboard audit, preview pending | Partial QA |
| CH-20 | P0 | Evidence-based release audit | CH-01..19 | PLANNED | 20 acceptance gates with citations | Pending |

See `docs/TEST_RESULTS.md` for exact observed results. No feature has yet passed all its required evidence gates.

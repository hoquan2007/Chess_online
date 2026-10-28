# Prioritized backlog

1. `[P0][CH-01/02/03/04/19]` Continue foundation hardening: 42 unit / 21 browser, lint/typecheck and Webpack checks are locally passing at checkpoint 5; throttled-tab late move is tested, but still review long-game clocks, engine races, accessibility and broader chess rules. Dependency: local dependencies. Acceptance: actual long-game interactions plus additional evidence.
2. `[P0][CH-05/06]` Supabase auth, profiles, transactional game schema, security-grant tests. Dependency: credentials for integration. Acceptance: two users can sign in, create/join distinct seats, view persisted room; evidence pending.
3. `[P0][CH-07/08]` Server legal moves, atomic DB RPC, trusted server time, realtime reconnect. Dependency: CH-05/06. Acceptance: out-of-turn/illegal/replay rejected; independent browsers complete match; evidence pending.
4. `[P0][CH-09/10]` Matchmaking, rated game flow, exact-once ratings. Dependency: verified CH-07/08. Acceptance: concurrency tests + archived rated results; evidence pending.
5. `[P1][CH-11/12/13/14]` Profile, history, licensed analysis engine, puzzles and opening/lesson catalogue. PGN import/download, FEN and underpromotion are browser-tested; engine evaluation and hosted pieces remain. Dependency: CH-05 for hosted pieces. Acceptance: functional routes and content tests; evidence pending.
6. `[P2][CH-15/16/17]` Friends, chat, spectator permissions, notifications, tournament basics, moderation. Dependency: hosted game and auth. Acceptance: two-user browser and authorization tests; evidence pending.
7. `[P0][CH-18/19/20]` Security, accessibility, CI, dependency audit, Vercel preview, full evidence audit. Dependency: all critical functionality. Acceptance: 20 gates proven; evidence pending.

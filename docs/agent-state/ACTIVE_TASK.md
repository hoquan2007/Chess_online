# Active task

**CH-03/11/12:** Added device-local completed game history to `/games` and replay in `/analysis?localGame=...`, with downloaded PGN and preserved result. Continue accessibility and secure hosted chess games between two authenticated users.

Local lint/typecheck, **47/47** unit tests and **24/24** complete Playwright suite passed at checkpoint 8 (47.3 s). Webpack build passed (17/17 static pages). Three online browser cases use mocked API state. Four SQL migrations, private create/join/move/resign/claim routes, server replay, locked-row RPC drafts and room UI exist but are **not** verified against live Supabase. Next: locally verifiable accessibility/analysis QA, then stage SQL migrations, RLS and concurrent two-user end-to-end game with clocks/draw claims once a dedicated staging project exists.

Current status: IN_PROGRESS. No live Supabase environment configured; all 20 acceptance gates remain open.

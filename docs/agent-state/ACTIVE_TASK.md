# Active task

**CH-01/03/12/19:** Shared promotion dialog now supports keyboard focus, Tab/Shift+Tab wrapping, Escape cancellation and focus return in local/computer, analysis and online room. Local promotion ending a game restores focus to an enabled PGN action. Continue local accessibility and secure hosted chess games between two authenticated users.

Local lint/typecheck, **49/49** unit tests and **30/30** complete Playwright suite passed at checkpoint 11 (58.0 s). Webpack build passed (17/17 static pages). Three online browser cases use mocked API state; hosted room promotion has no real-game test. Five SQL migrations, private create/join/move/resign/claim routes, server replay, locked-row RPC drafts and room UI exist but are **not** verified against live Supabase. Next: locally verifiable keyboard/long-game QA, then stage SQL migrations, RLS and concurrent two-user end-to-end game with clocks/draw claims once a dedicated staging project exists.

Current status: IN_PROGRESS. No live Supabase environment configured; all 20 acceptance gates remain open.

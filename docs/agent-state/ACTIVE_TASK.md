# Active task

**CH-02/03/07:** Corrected local FIDE timeout/resignation no-mating-material draws, including same-colored bishops, and added PostgreSQL migration `20261029050000_mating_potential_adjudication.sql` (unrun). Continue accessibility and secure hosted chess games between two authenticated users.

Local lint/typecheck, **49/49** unit tests and **25/25** complete Playwright suite passed at checkpoint 9 (50.8 s). Webpack build passed (17/17 static pages). Three online browser cases use mocked API state. Five SQL migrations, private create/join/move/resign/claim routes, server replay, locked-row RPC drafts and room UI exist but are **not** verified against live Supabase. Next: locally verifiable accessibility/analysis QA, then stage SQL migrations, RLS and concurrent two-user end-to-end game with clocks/draw claims once a dedicated staging project exists.

Current status: IN_PROGRESS. No live Supabase environment configured; all 20 acceptance gates remain open.

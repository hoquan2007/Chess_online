# Active task

**CH-01/02/03/08/12:** Verified keyboard coordinate gameplay, local clock-accurate Undo, stale online HTTP snapshot guards, and analysis promotion/PGN export; prepare secure hosted chess games between two authenticated users.

Local lint/typecheck, 39/39 unit tests and 20/20 Playwright passed during checkpoint 4 (39.3 s); a later board-click promotion E2E assertion passed in a focused 1/1 rerun. Final Webpack build passed (17/17 static pages). Private create/join/move/resign/claim routes, server replay, locked-row RPC drafts and room UI exist but are **not** verified against live Supabase. Next: commit verified slice, then stage SQL migrations, RLS and concurrent two-user end-to-end game with clocks/draw claims. Until staging exists, continue independent analysis/security/accessibility work.

Current status: IN_PROGRESS. No live Supabase environment configured; all 20 acceptance gates remain open.

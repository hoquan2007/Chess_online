# Active task

**CH-05/06/07/08 — checkpoint 22:** All eight migrations remain applied to dedicated Supabase `chessonline`. Reusable `supabase/tests/structural-acceptance.sql` **executed successfully against the hosted database**: checks seven RLS-enabled tables, table/column/function grants, Realtime publication, three foreign-key indexes and actual timeout-winner helper cases. The three-identity hosted Playwright test now also checks opponent polling/live convergence and reconnect after a missed update; **it has not executed against real Auth** because the Next.js runtime lacks staging credentials.

Checkpoint 22 native `npm run check` **PASS** (exit 0): lint, strict TypeScript, **52/52 Vitest**, Webpack **17/17** pages. First default-sandbox run failed only at `.next` write with `EPERM`; native-permission complete rerun passed. Native Playwright **40 PASS / 1 guarded staging test SKIP**, exit 0. These local and database structural results cannot establish authenticated hosted multiplayer correctness.

Current status: IN_PROGRESS. Database migrations are deployed; Next.js runtime credentials and verified two-account hosted tests remain outstanding. All 20 acceptance gates remain open.

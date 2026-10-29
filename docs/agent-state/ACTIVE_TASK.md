# Active task

**CH-05/06/07/08 — checkpoint 21:** Eight migrations have been applied to dedicated Supabase `chessonline`; structural RLS/grant/advisor checks passed. Added a guarded three-identity, independent-browser hosted acceptance test in `e2e/staging-online.spec.ts`. It is **not yet executed** because local Supabase runtime credentials are absent. Next prove real authenticated hosted moves, RLS, locks, clocks, reconnect and result settlement.

Checkpoint 21 native `npm run check` **PASS**: lint, strict TypeScript, **52/52 Vitest**, Webpack **17/17** pages. Native Playwright **40 PASS / 1 guarded staging test SKIP**. A default-sandbox build still produces `.next` `EPERM`; native-permission build passed. These local results cannot establish hosted correctness.

Current status: IN_PROGRESS. Database migrations are deployed; Next.js runtime credentials and verified two-account hosted tests remain outstanding. All 20 acceptance gates remain open.

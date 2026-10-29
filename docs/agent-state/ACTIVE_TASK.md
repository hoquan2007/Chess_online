# Active task

**CH-05/06/07/08:** Eight migrations have been applied to Supabase `chessonline`, including profile grant hardening, restricted RLS event-trigger execution and foreign-key indexes. Database structural/grant/advisor checks passed. Prior local chess and accessibility regressions remain covered. Next prove real authenticated hosted moves, locks, clocks, reconnect and result settlement.

Latest checkpoint 19 independent stages all pass on the current checkout: ESLint, strict TypeScript, **52/52 Vitest**, native Webpack **17/17** generated pages and native **40/40** local/mocked Playwright (1.3m). The composite check encountered a concurrent build lock, and a default-sandbox build hit `.next` `EPERM` before the native build passed. Server routes and RPC code still need end-to-end proof with real test accounts; hosted migration installation alone cannot establish it.

Current status: IN_PROGRESS. Database migrations are deployed; Next.js runtime credentials and verified two-account hosted tests remain outstanding. All 20 acceptance gates remain open.

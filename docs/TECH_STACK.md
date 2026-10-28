# Technical stack and status

| Layer | Selection | State |
| --- | --- | --- |
| UI | Next.js 16.4.3 App Router, React 19.2.4, TypeScript strict | Installed; build verification pending |
| Styles | Tailwind v4, CSS variables, original Rookline layout, Gabarito/Manrope fonts | Initial UI |
| Chess rules | `chess.js` 1.4.0 (BSD-2-Clause) | Local validation |
| Board | `react-chessboard` 5.12.1 (MIT) | Interactive local board |
| Computer | Original minimax-based worker | Prototype; not Stockfish or master-level |
| Authentication | Supabase Auth via `@supabase/ssr` | Awaiting live configuration |
| Persistence | Supabase PostgreSQL + RLS | Schema planned |
| Event delivery | Supabase Realtime | Planned |
| Test | Vitest, Playwright, ESLint, TypeScript | Partial |
| Hosting | Vercel | Deployment unverified |

Dependencies and security advisories are tracked in `docs/THIRD_PARTY_LICENSES.md` and `docs/TEST_RESULTS.md`.

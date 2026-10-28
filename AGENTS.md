# Rookline agent guide

Build the original Rookline chess product. The user-approved project goal lives in `docs/PROJECT_VISION.md`; the authoritative backlog lives in `docs/agent-state/BACKLOG.md`. Continue small vertical slices through discover → plan → code → test → review → fix → record evidence. Update the progress ledger after each completed slice.

Read `docs/ARCHITECTURE.md` and `docs/SECURITY_MODEL.md` before touching multiplayer or database access. Never accept client-provided move outcomes or clock values for rated games. Never mark a feature complete without passing real tests. When Supabase credentials are absent, report multiplayer blocked; mocked data does not validate hosted multiplayer. Do not merge into `main` or deploy to production without explicit authorization.

Use Next.js App Router, TypeScript strict, Tailwind v4, original UI design, chess.js for validation, and Supabase for hosted persistence. Prefer a clean Next.js layout derived from the MIT-licensed JCodesMore template, with original text and assets. Never scrape Chess.com or copy its proprietary design/assets. Browser reference inspection is restricted to owned or otherwise authorized sites.

For any Next.js API change, check `node_modules/next/dist/docs` first. Keep reusable components in `src/components`, domain code in `src/lib`, routes in `src/app`, and tests beside domain modules or `tests/`. Run `npm run check` and applicable browser tests. Preserve unrelated edits and make small reviewable commits on the development branch.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

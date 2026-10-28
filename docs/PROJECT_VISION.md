# Rookline | Product vision

Rookline is an independently designed chess platform for learning, local play, computer practice, and eventually authenticated online competition. Its reference point is the usability and scope of established chess sites; its branding, assets, implementation, writing, and visual identity must be original.

## Definition of done

The project goal has twenty acceptance gates. The product is **IN_PROGRESS** until every gate is evidenced in `docs/FINAL_AUDIT.md`. A successful build or a working local board does not prove multiplayer, data integrity, accessibility, or production readiness. When hosted Supabase credentials are missing, classify tested local slices separately and mark hosted tests **BLOCKED_EXTERNAL**.

## Initial audience and value

- Players can practice on a board, review moves, and learn fundamental tactics.
- Two authenticated people can later play securely using trusted server game state, matchmaking, challenges, and reconnection.
- Community and tournament services follow validated online gameplay.

## Hard constraints

Vercel frontend; Next.js App Router; chess.js for rules; Supabase Postgres/Auth/Realtime for hosted play; responsibly licensed dependencies and data. No Chess.com scraping, mirrored assets, copied branding, paid infrastructure provisioning, unauthorized production deploy, or automatic `main` merge.

## Launch readiness

This repository currently contains an unverified local prototype and foundations. The production milestone requires independent two-client browser tests, transactional move ordering and clocks, RLS tests, real persistent results, ratings settlement, verified deployment configuration, security and visual audits.

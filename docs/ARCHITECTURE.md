# Rookline architecture

## Current implementation

Browser: Next.js App Router + React 19 + TypeScript + CSS design tokens, `react-chessboard` presentation, `chess.js` rule engine. Local and computer sessions are currently device-local. Computer moves are calculated by an original browser Web Worker (`src/workers/chess-bot.worker.ts`). Analysis and original puzzles currently use client memory/localStorage. They provide **no authenticated hosted game persistence**.

## Target service boundaries

```text
Browser (session cookie, UI, spectator/players)
      | authenticated requests
Next.js server routes (auth session, input schema, rate limit)
      | privileged RPC with verified user ID
Supabase PostgreSQL (transactions, locked game row, ordered moves,
                      version CAS, server clock, result, rating ledger)
      | committed row-change / authorized Broadcast
Supabase Realtime -> Browser (notification only; reload authoritative snapshot)
```

Server must replay/check legality with `chess.js` before attempting committed move. The database function must lock game rows, verify actor/turn/version/idempotency and server time; apply an atomic canonical FEN/PGN/move/clock update. Stale concurrent requests reject or reload. Moves use one durable sequence counter per game. Push messages are only hints; snapshots are fetched after reconnect. Browser sends a move (`from`,`to`,`promotion`), expected sequence and client-generated idempotency key; never authority for FEN, result, rating or clocks.

## Data flows and rules

- Anonymous local play: browser holds PGN and clock, optional local history. It is explicitly unranked.
- Hosted play: Supabase Auth session verified on server; player IDs from session only; privileged database mutations executed from trusted server code.
- Game lifecycle: `waiting` -> `active` -> `completed` or `cancelled`. Completed states are immutable; one rating settlement per game, by transactional unique ledger entries.
- Timed game: server computes elapsed time from database UTC timestamp with increment applied after a legal accepted move. Client clocks only render an approximation.
- Challenges, matchmaking, ratings, notifications, tournaments and moderation remain planned until independently validated.

## Verification boundaries

Unit: chess rules, clock arithmetic, ratings and serialization. Integration (live database): RPC permissions, concurrent/duplicate moves, RLS, timeout/rating transactions. E2E: two distinct authenticated browser contexts, legal and forged moves, reload, disconnect, persistence, checkmate, resignation and timeout. See `docs/TEST_RESULTS.md`.

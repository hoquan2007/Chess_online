# Planned authoritative database

`supabase/migrations` must hold versioned, reproducible SQL. Public data exposure follows RLS; authoritative tables require server-only mutation functions.

| Table | Purpose | Constraint |
| --- | --- | --- |
| profiles | Auth-linked public handle and avatar | user ID FK; unique lowercased handle |
| preferences | User theme, sound, notifications | unique user ID |
| games | Two-side game, FEN/PGN, clock, result, version | immutable result; active timestamps |
| game_participants | Player roles and seat history | unique `(game_id, user_id)` |
| moves | Accepted server-verified plies | unique `(game_id, ply)` and request key |
| matchmaking | One active queue ticket per time control | transactional match selection |
| challenges | Expiring friend links and invited ID | token hashing and acceptance constraint |
| ratings | User rating per category | unique `(user_id, category)` |
| rating_history | Settled changes per game and user | unique `(game_id, user_id)` |
| puzzles / puzzle_attempts | Licensed puzzle positions and progress | original / licensed source proof |
| friend_relationships | Accepted relationship state | canonical pair uniqueness |
| notifications | Account inbox | recipient-only RLS |
| tournaments / tournament_participants | Event and standings | deduped participation |
| moderation_reports | Abuse review | reporter private, admin review |

## Transaction API contract

Move request: game ID, expected version, from, to, optional promotion, idempotency key. The route checks session, obtains a fresh DB snapshot, verifies the move with `chess.js`, and requests one DB RPC atomic commit. RPC checks membership, side to move, expected version, timeout against trusted database timestamp and durable duplicate key. RLS denies direct writes; a service server credential must never reach the browser. Ratings settle exactly once at completed result using a unique ledger, with Glicko-2 or Elo selected and documented before rollout.

See `docs/SECURITY_MODEL.md` for the threat model. This file is a **design contract** until migrations and live tests verify it.

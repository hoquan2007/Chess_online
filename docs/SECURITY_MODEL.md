# Rookline security model

## Trust boundaries

Browser, localStorage, user-input PGN/FEN, realtime events and client clocks are untrusted. Supabase Auth verifies identity. The server derives `player_id` from the verified session, never from request JSON. Privileged mutation credentials, if provisioned, are **server-only**; never name a secret with `NEXT_PUBLIC_`.

## Threats and mitigations

| Threat | Required mitigation | Verification |
| --- | --- | --- |
| Forged or out-of-turn move | Server replays legal move, database locked row and turn/participant/version assertion | Two clients + unauthorized integration test |
| Simultaneous accepted moves | Transaction lock, compare-and-swap sequence, unique `(game_id, ply)` | Racing requests test |
| Replayed request | Durable unique `(game_id, actor_id, idempotency_key)` and deterministic retry behavior | Duplicate request test |
| Tampered clock | Clock computed exclusively from DB server time | Delayed move/timeout test |
| Repeated rating settlement | Unique result/ledger identifiers and one transaction | Retry settlement test |
| Direct table writes or IDOR | RLS on exposed tables; deny client writes to authoritative games, moves, ratings | Authenticated cross-user tests |
| Service secret exposure | Server env only, scrubbed logs, no accidental client import | Bundle scan/CI |
| Resource exhaustion | API payload limits, per-account/IP rate limits, DB indexes | Abuse tests |
| Injection and malicious content | Parameterized queries, server schemas, React escaping, message size caps | Security tests |

## Current status

Hosted Auth, DB RPC authorization, private Realtime channel policies and rate limiting are **not yet verified**. Do not enable real rated matchmaking until these are tested with real Supabase identities. Local chess mode is unranked and cannot update authoritative ratings.

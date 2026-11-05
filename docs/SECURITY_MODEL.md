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
| Cross-origin cookie-authenticated mutation (CSRF) | Game POST routes require an exact `Origin` match against the received Host and request scheme, or affirmative `Sec-Fetch-Site: same-origin` when `Origin` is absent. Explicit `cross-site` metadata always denies. Missing evidence and sibling-site requests fail closed. | `request-origin.test.ts`, browser 403 cases; validate public proxy/TLS Host and scheme with real staging before launch |
| Injection and malicious content | Parameterized queries, server schemas, React escaping, message size caps | Security tests |

## Current status

Checkpoint 142 independently verified hosted **Auth/JWT, user-specific RLS and owner isolation, protected server RPC boundaries, private Realtime participant delivery and outsider denial, and browser Host/Origin mutation checks** with three real Supabase identities on a protected HTTPS Preview. The opt-in staging E2E passed 1/1 at source SHA `c48970bbd9486949c7b595dba9c0bcd67f8e5cd0` and was not rerun at checkpoint 143. Independent two-session PostgreSQL row-lock, clock-expiry precedence, rated exactly-once settlement and production-scale abuse/rate-limit validation remain **unverified**. Do not enable rated matchmaking until these pass. Local chess mode is unranked and cannot update authoritative ratings.

**Reverse-proxy assumption:** The CSRF validator uses the incoming `Host` because Next.js may normalize `request.url` to `localhost` in development. It uses the scheme of `request.url` and deliberately ignores user-supplied `X-Forwarded-Host` and `X-Forwarded-Proto`. The real protected HTTPS staging routes passed Host/Origin cases at checkpoint 142, establishing behavior for that specific Vercel Preview configuration. Any different proxy or production domain must independently preserve the public HTTPS scheme in `request.url` and browser-facing hostname in `Host`, or same-origin mutations will fail closed. Do not loosen the check by trusting arbitrary forwarded headers.

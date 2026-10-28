# Decisions

| ID | Decision | Rationale | Revisit |
| --- | --- | --- | --- |
| D001 | Product named **Rookline**, independent branding | Avoid proprietary impersonation, create distinct identity | Never copy reference site assets |
| D002 | Next.js 16 App Router + React 19 | Vercel compatibility, repo template | After build verification |
| D003 | chess.js for game rules | Widely used licensed chess notation/rules | FIDE claim differences must be explicit |
| D004 | React Chessboard for interaction | Permissive license, supplied drag/drop interface | Verify mobile / keyboard interactions |
| D005 | Original lightweight bot worker first | No unverified third-party engine bundle/license | Licensed full analysis engine needed |
| D006 | Supabase transactional authority + Realtime notification | Separate committed state from delivery; allow stateless Vercel routes | Verify lock/clock/race tests before release |
| D007 | Dedicated `codex/chess-platform-foundation` branch | Protect main; review before merge | Merge only with owner approval |
| D008 | LocalStorage records are local practice only | Cannot be authoritative rated game archive | Replace with hosted DB for profiles |
| D009 | Never mark external tests passed without credentials | Honest acceptance status | Verify with two accounts |

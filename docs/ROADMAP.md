# Rookline delivery roadmap

1. Discovery: architecture, product scope, initial tool/license assessment, evidence ledger. **In progress.**
2. Foundation: App Router design system, working board, tests, shared components and CI. **In progress.**
3. Local gameplay: rules, special moves, robust clocks, computer opponent, persistence and browser E2E. **In progress.**
4. Hosted multiplayer: Auth, PostgreSQL/RLS, locked atomic server-authoritative moves/clocks, two users, reconnect, matching and challenges. **Not verified.**
5. Player system: profiles, ratings settlement, archives, leaderboards. **Not verified.**
6. Training: puzzles, analysis, engine evaluations, opening database and original lessons. **Partial.**
7. Community: friends, chat, spectator permissions, notifications, tournament lobby, moderation. **Planned.**
8. Hardening: regression, security, accessibility, load, performance, licenses, audit. **Planned.**
9. Release: staging verification, owner-approved production deployment only after gates. **Planned.**

Each new slice begins from `docs/agent-state/ACTIVE_TASK.md`, ends with real tests and an updated ledger. Blocked external work must not stall independent implementation.

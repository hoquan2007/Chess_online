# Rookline delivery roadmap

1. Discovery: architecture, product scope, initial tool/license assessment, evidence ledger. **In progress.**
2. Foundation: App Router design system, working board, tests, shared components and CI. **In progress.**
3. Local gameplay: rules, special moves, robust clocks, computer opponent, persistence and browser E2E. **In progress.**
4. Hosted multiplayer: Auth, PostgreSQL/RLS, server-authoritative moves/clocks, two users, reconnect, matching and challenges. **S0/S1 verified on checkpoint 142 protected Preview with three real identities; S2 direct PostgreSQL transaction/clock proof outstanding.** Matchmaking remains unfinished.
5. Player system: profiles, ratings settlement, archives, leaderboards. **Authenticated profile ownership and archive privacy verified at checkpoint 142; rated ledger/settlement and competitive rankings remain unverified (S3).**
6. Training: original puzzles, selective local analysis, opening lessons, full engine evaluations and hosted progress. **Partial: 23 puzzles and bounded local analysis exist; licensed full engine and hosted learning progress pending (S4).**
7. Community: friends, chat, spectator permissions, notifications, tournament lobby, moderation. **Planned.**
8. Hardening: regression, security, accessibility, load, performance, licenses, audit. **Planned.**
9. Release: staging verification, owner-approved production deployment only after gates. **Planned.**

Each new slice begins from `docs/agent-state/ACTIVE_TASK.md`, ends with real tests and an updated ledger. Blocked external work must not stall independent implementation.

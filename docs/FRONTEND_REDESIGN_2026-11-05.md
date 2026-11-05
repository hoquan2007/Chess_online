# Rookline Studio — Frontend redesign / 2026-11-05

## Intent

Turn Rookline into a distinctive, polished, chess-first workspace across desktop, tablet and mobile. Preserve every existing chess rule, data boundary, authentication flow, community capability and live-game contract. This is an original Rookline visual identity, with no proprietary references or scraped material.

## Design direction

**Studio after dark.** Dark blue-black mineral surfaces, soft ivory type, sharp citrus-green interactions, restrained rounded geometry, editorial display typography (Gabarito), and readable interface text (Manrope). A coherent visual language for both dark and light themes. The actual chessboard remains the central image. No fake activity counters, ratings or unsupported hosted-multiplayer promises.

### Shared system

- **Shell:** group routes into Workspace and The Club; show current section in the topbar; promote quick Online play; maintain theme/account controls. Compact rail on smaller desktops, fixed five-action dock on mobile, accessible More drawer for all secondary routes.
- **Primitives:** buttons, pills, forms, status messages, cards, modals, game clocks, board surrounds, study selections and tables share tokens for color, radius, borders, focus, and spacing.
- **Typography:** editorial titles, compact uppercase chapter markers and clear supporting copy; preserve semantic heading order and stable accessible names needed by functional tests.
- **Responsive:** desktop 258px navigation; compact 74px rail; tablet single-column hero; mobile bottom dock and two-column More panel. Protect a square chessboard, prevent horizontal overflow and preserve touch targets.
- **Accessibility:** keyboard navigation, visible focus, labeled controls, reduced-motion support, explicit current-page state, and skip-to-content link. Mobile More opens an accessible dialog with an Escape/close action.

### Surface coverage

| Surface | Redesign |
| --- | --- |
| Home | Editorial entry, real board preview, game pathways, academy/archive discovery. |
| Play selector | Four clear modes with honest local/computer/online/friend descriptions. |
| Local/computer/online game and spectator | Consistent board stage, player strips, clocks, controls, result and status panels via shared styling. |
| Puzzles, analysis, learn, openings | Unified study workbench, board and panels, high-contrast selections and input states. |
| Games, leaderboard, friends, tournaments, planner | Consistent club content cards, list and table formatting, navigation and empty states. |
| Auth, profile, settings, moderation and reports | Unified fields, headings, buttons, alerts, panels and responsive page layout. |

## Implementation slices and acceptance

1. **Navigation and tokens.** Update shared AppShell, add mobile More access, create `studio.css` as an app-wide extension. Preserve auth, remote preference sync and theme behavior.
2. **First impression.** Rebuild home and Play discovery in original layout. Keep the accessible home heading “Make every move count.” and “Play chess” CTA used by the existing browser flow.
3. **Workbenches and club.** Extend tokens to game board/panel, study explorer, forms, buttons, status blocks and shared cards, so all existing routes adopt the redesign without changing domain code.
4. **Verification and finish.** Check lint, typecheck, unit tests, production build, desktop/mobile browser flows, theme and navigation; inspect real screenshots and correct defects. Log evidence in `docs/AUTONOMOUS_PROGRESS.md`.

## Release boundaries

Redesign applies to development branch `codex/frontend-redesign-2026-11-05`. There is no authorization for main merge or production deployment from this request. Live Supabase multiplayer, OAuth and rated-play release gates require separate real hosted evidence; a local UI test cannot close them.

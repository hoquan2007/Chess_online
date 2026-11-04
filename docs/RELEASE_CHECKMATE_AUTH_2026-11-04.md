# Rookline — focused check/checkmate/email-auth release (2026-11-04)

## Release scope

- Local, computer and hosted chess boards highlight a checked king and announce check to assistive technology.
- Completed chess games show a keyboard-accessible winner/draw dialog. Hosted results use the authoritative game result from the server, and users can inspect the board afterward.
- Registration, resend confirmation and sign-in expose clearer email status. The callback handles PKCE codes, supported email token hashes and browser-fragment confirmation flows, with safe relative return paths.
- The shared navigation's initial Auth session lookup is ordered against Auth events to avoid showing an outdated account after a rapid sign-in or sign-out.

This release is based on the existing production main baseline and intentionally excludes S4/S5 engine, community and tournament work and all new SQL migrations.

## Verification and limitations

- The isolated release passed SQL snapshot fingerprint verification (9/9), lint, strict TypeScript, Vitest 213/213 in 31 files, and a Next.js 16.4.3 production Webpack build after retrying a restricted-file-system EPERM under approved local permissions.
- The focused real Chromium UI/auth regression passed 7/7; auth email delivery and redirect tests use controlled HTTP fixtures.
- The final full Chromium suite with the repository's default serial runner and Supabase credentials absent passed: 106 passed, 5 skipped, 0 failed (111 discovered). The configured-Supabase browser fixtures passed in the separate focused run; the five skips are cases requiring configured public browser credentials. Earlier broad-suite attempts with mixed environment settings or two workers exposed environment-dependent assertions and timing issues, which were resolved by using the intended test setup.
- Production signup -> actual inbox delivery -> confirmation click -> durable session -> sign-out and sign-in has **not** been verified with an authorized mailbox. Supabase email provider, redirect allow list and template configuration still require live validation.
- This targeted deploy does not assert full-product readiness. The independent 20 release gates remain OPEN, and rated play remains OFF.

## Post-deploy acceptance

Verify the production deployment's exact source SHA and READY state; inspect public routes /play/local, /login, /register, /auth/complete and /auth/callback with safe fallback; then perform a fresh authorized email verification loop on the canonical HTTPS domain. If the live email flow fails, inspect the Supabase Authentication URL Configuration, email template and sender logs before changing settings.

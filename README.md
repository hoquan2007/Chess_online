# Rookline Chess

An original, responsive chess platform built with Next.js 16, React 19, TypeScript, chess.js, and the `react-chessboard` interface. Local play, computer practice, analysis, and training are the initial verified slices; hosted features are tracked in the [feature matrix](docs/FEATURE_MATRIX.md).

## Run locally

Install Node.js 24+, run `npm ci`, then `npm run dev` and open http://localhost:3000. Use `npm run check` for lint, types, unit tests and the production build. Run `npm run test:e2e` for browser tests after installing Playwright Chromium.

Online functionality requires a Supabase project. Copy `.env.example` to `.env.local` and configure the requested values. See [deployment guide](docs/DEPLOYMENT_GUIDE.md) and [architecture](docs/ARCHITECTURE.md) before production use.

## Licensing

Application code is MIT licensed. The initial scaffold derives from the MIT-licensed [AI Website Cloner Template](https://github.com/JCodesMore/ai-website-cloner-template). Library and font credits are listed in [third-party licenses](docs/THIRD_PARTY_LICENSES.md). Rookline is not affiliated with Chess.com.

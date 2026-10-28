# Dependency and content license review

| Component | License (known) | Action |
| --- | --- | --- |
| JCodesMore/ai-website-cloner-template | MIT (repository LICENSE copied with scaffold) | Preserve copyright and license |
| chess.js | BSD-2-Clause | Preserve license notices |
| react-chessboard | MIT | Preserve license notices |
| Next.js, React, Supabase JS/SSR, Playwright, Vitest | License checks pending against installed manifests | Record actual lockfile license inventory |
| Gabarito, Manrope fontsource packages | Open font licenses to verify | Retain attribution and font licenses |
| Original minimax bot | In-house project code | No external chess engine distributed |
| Rookline learning content / puzzle examples | Independently authored | Store provenance for every future imported set |

Do not import Chess.com icons, CSS, pieces, prose, internal code or puzzle datasets. Before Stockfish or other GPL engine integration, determine full distribution/license obligations. `npm audit` initially reported 11 advisories (1 low, 4 moderate, 5 high, 1 critical); validate fix pathways and record fresh audit before release.

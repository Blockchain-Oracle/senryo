# Provenance — Trading area (Markets, market detail, ticket, position, TP/SL, orders, pool)

Brief: `docs/product/ui-agent-brief.md` ("21st.dev first"). Each component below was searched on 21st.dev with
`npx -y @21st-dev/cli search "<what>" --type c`; the best match was read with `get <id>` and its behaviour or visuals
ported to React Native (Reanimated / SVG), or the search is recorded as "none fit". No web libraries were added.

| Surface / component | 21st.dev search → source | What was ported | Deviations (why) |
|---|---|---|---|
| Market row grammar — `features/markets/RowShell.tsx` (Markets, Watchlist, Tokens, Search) | "crypto market list row price change" → **Market Watchlist**, ssychui, id 20110 | The right-aligned tabular price-over-change cell and per-row trend tint (up / down ink) | Its bordered table, sort header, accent rail and sparkline column are dropped: Fomo F11 rows are borderless with a 40 pt mark and a leverage badge; ▲▼ and a sign are kept so change never relies on colour alone |
| "Go long or short" card — `features/markets/PerpsIntro.tsx` | "dismissible promo card" → Promo Card (ravikatiyar162, 7941), Promo Banner (shadcndesign, 26560) | — searched, none fit: both are marketing banners with CTAs and imagery | Kept the existing one-plate card (F11) with the long/short SVG and a persistent ×; copy cut to one line |
| State banners — `features/markets/MarketBanners.tsx` | covered by the same promo/banner search | — none fit | One-line borderless washes with a status dot (F43/F45); no paragraphs |

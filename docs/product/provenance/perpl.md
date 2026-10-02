# Provenance — Perpl in the app (flow book C4; C1/C2/C5 for Perpl markets)

Brief: `docs/product/ui-agent-brief.md` ("21st.dev first"). Searches run with `npx -y @21st-dev/cli search "<what>" --type c`
on 2 Oct 2026; nothing from the web was added. Most of this area is the engine's own trading grammar reused in Perpl's
units, so the foundation components carry it.

| Surface / component | 21st.dev search → result | What was used | Deviations (why) |
|---|---|---|---|
| Perpl ticket — `features/perpl/PerplTicketScreen.tsx`, `PerplTicketHeader.tsx`, `PerplTicketEntry.tsx`, `PerplTicketFooter.tsx` | "perpetual futures order ticket leverage slider" → Swap Ticket (ssychui, 27122 — already the source of the engine ticket's Details pattern), argent-loop-infinite-slider (9975), Seat-Based Pricing Slider (28378), book slider (5163) — none fit beyond what the engine ticket already ported | The engine ticket's anatomy and foundation pieces: `TransactionSheet`, `SideToggle` (exported from `TicketHeader`), `LeverageRuler`, `Keypad`, `Preset`, `ModeToggle` (exported from `Ticket`), `SlideToConfirm` (side tone, busy), `ChildSheet` + `DetailRow` | Venue chip is Perpl's with "Mainnet" as plain words (never tappable); the ruler's maximum is Perpl's live `getMarginFractions`; the TP/SL cell reads "On Perpl soon" (no API-key path); amounts are always real dollars (never P$) |
| Order / close outcome — `features/perpl/PerplOutcome.tsx`, `PerplCloseOutcome.tsx` | "order status success failed result" → Status (diceui, 25395), Order Status Card (ravikatiyar162, 8597), Alert (serafimcloud, 334), Order Confirmation Toast (bundui, 19943) — none fit | The foundation `TradeTrace`, extended with a `verdict` (`reading` while the receipt is decoded; `nothing` for an IOC that matched nobody — `Ban` glyph in warn, no success sound claimed by the screen) | Success is never read from the receipt status: the facts come from `decodePerplOrder` on the finalized receipt |
| Perpl position page — `features/perpl/PerplPositionDetail.tsx`, `PerplPositionRow.tsx` | "trading position card pnl close" → Trade Journal Table (ssychui, 27124), Swap Ticket (27122), Interactive Broker Card (kavikatiyar, 8414), Market Snapshot (ssychui, 22249 — read with `get`: a bordered card with its own SVG chart) — none fit | `AmountHero` (21st number-ticker port, 21513) for the P&L, `Facts` strip, `HistoryChart` (now with an `entry` line → `CandleChart.reference`), `ChipRow`, `CloseBar` / `SlideToConfirm`, `PositionRow` anatomy for Home | Rows, not boxes; P&L coloured by profit (C3a); size in the base asset; leverage shown because Perpl margin is isolated per position |
| Move funds back — `features/perpl/PerplWithdraw.tsx`, `app/perpl/withdraw.tsx` | "withdraw amount keypad" → PIN Keypad Unlock (22111), OTP Pin Input (29994), Input (originui, 180), Number Pad (bankkroll, 3711 — already the foundation `Keypad`) | The money area's `AmountPad` + `useAmountInput` (Max = exactly what's free), `ReviewRows`, `TradeTrace` | — |
| Perpl market page — `features/perpl/PerplDetail.tsx`, `PerplAbout.tsx`, `PerplLinks.tsx`; list row `PerplMarketRow.tsx` | covered by the Market Snapshot / market-watchlist searches recorded in `trading.md` (ssychui 20110, 22249) | The engine detail's pieces: `PageHeader`, `MarketIdentity` (venue badge), `MarketActions` (Watch · Share), `HistoryChart`, `UnderlineTabs`, `MarketFeed` (now takes another venue's market id and units), `Disclosure`, `SideBar` (now takes venue banners) / `LockedBar`, `LinkRow` (exported from `MarketLinks`), `Wash` (exported from `MarketBanners`), `RowShell` + `LeverageBadge` / `LockTag` | No Holders tab: the holders API reads our engine's positions only. No Alert circle: the keeper has no Perpl price source yet (C9 gap) |

## Marks
No new art: every Perpl market uses its registry mark (`ids.perplMarket(143, perpId)`) with Perpl's venue mark as the
badge (`ids.venue("perpl")`); "Own BTC / ETH / MON" uses the spot token's own mark (WBTC, WETH, MON from the token list).

## Formulas
- Liquidation price: dex-sdk `crates/sdk/src/state/position.rs` `liquidation_price` (MIT) and Perpl docs
  `exchange/liquidation` "Calculating Liquidation Price" → `packages/chain/src/perpl/math.ts` `perplLiquidationPrice`;
  checked against the docs' worked example and a simulated mainnet open in `scripts/drive/src/perpl-plan-check.ts`.

# Metropolis · four design directions

Mobile-first trading app on Monad (iOS, Android, web): one balance split into **Free to trade / Free to spend / Locked**, Face ID (passkey) sign-in and confirmation, fund from any chain by QR, spend with a virtual card (Apple Pay). Journey and risk rules: `context/07-decision/codex-evaluation.md` §C.

Everything here is built from **real 21st.dev components** (installed with `21st add`, or written from `21st get` output where the registry item was broken), re-tokenized per direction. Nothing is a custom component except layout glue (headers, ledger rows, an asset-initials disc, a status bar).

- **Preview app:** `design/preview` (Next.js 16 + Tailwind 4 + shadcn, pnpm). Run `pnpm dev --port 3457`, then open `/d1/home` … `/d4/states`. Add `?mode=alt` for the other theme. Screens: `home, markets, trade, confirm, card, fund, states`.
- **Candidate gallery:** `/gallery/{home,markets,trade,confirm,card,fund,nav,states}` (`?theme=dark`), 72 components rendered at 390 px. Screens: `screens/gallery-*-light.png` / `-dark.png`.
- **Screenshots:** `design/screens/` — 390 px wide at 2×, full-page, captured with the Chrome DevTools MCP CLI.
- **Tokens:** `design/preview/app/directions.css` (one scoped block per direction, light + dark). Palettes start from 21st themes, pulled with `21st theme <id>`.

## How the shortlist was made

1. `21st search` across ~130 queries (wallet, balance, portfolio, trading, order ticket, price/candle/depth chart, sparkline, number ticker, credit/virtual card, card flip, QR, onboarding, stepper, bottom sheet, tabs, toast, skeleton, shimmer, empty/error, success/confetti, face id, passkey, pricing, market list, watchlist, leverage, hold/slide to confirm, dark mode, themes, templates) → **1,367 unique components**.
2. Install and like counts scraped from each 21st page (`downloads_count` / `likes_count`; the CLI's `--sort` flag is ignored in this version).
3. **~700 previews reviewed visually** as labelled contact sheets, then the **74** strongest installed into the preview app and **rendered at 390 px in light and dark** (gallery screenshots) before composing.
4. Themes checked: Neon Clover, stocks and finance, Neo Brutalism, 432 Editorial, Amber Minimal, Nubank, Graphite Mono, Darkmatter, Modern Minimal. Templates noted but not used (paid): ssychui *Trading Terminal* (#943), shadcnblocks *Zippay* (#441), cruip *FinTech* (#503).

Most-installed pieces used: Liquid Glass Button (2,911), Text Shimmer (2,807), Number Ticker (1,295), Skeleton (1,097), Slider (805), Empty State (793), Confetti (663), Vercel Tabs (556), Sonner (374), Number Flow (297), Bottom menu (286). The trading-specific pieces (ssychui's Market Watchlist / Balance Chart / Candle Chart / Market Heatmap, BeUI swap) are new and low-install but were clearly the best rendered.

---

## D1 · Pocket — calm consumer (light default)

**Concept.** A friendly money app first, a trading app second (Revolut / Cash App feel). The one balance is the hero: total on top, then three soft tiles for Free to trade / Free to spend / Locked, then a proportion bar. Trading is one screen with one decision at a time; Face ID confirmation is a bottom sheet that restates what happens to the other buckets.

**Palette** (from *Neon Clover*, serafimcloud): background `hsl(100 30% 98%)`, ink `hsl(220 45% 10%)`, primary green `hsl(145 85% 38%)`, spend tile amber `hsl(45 95% 55%)` at 22%, locked `muted`. Dark: navy `hsl(220 45% 6%)`, green `hsl(145 85% 45%)`. Up `hsl(145 70% 36%)`, down `hsl(0 72% 52%)`.
**Type.** DM Sans throughout (700 for numbers and headers, 26 px titles, 36–48 px balance), Geist Mono only for addresses.
**Shape.** 20 px radius cards, pill buttons, soft shadows, floating pill nav.
**Motion.** Number Flow digit roll on every balance and amount change (spring, ~500 ms); leverage value rides above the thumb; sheet slides up (vaul); toasts from the top. No flashing prices.

| # | Component | Author | 21st URL | Installs | Used for |
|---|---|---|---|---|---|
| 1 | Bottom menu (#574) | yadwinder | https://21st.dev/@yadwinder/components/bottom-menu | 286 | Bottom nav (floating pill, 5 tabs) |
| 2 | Wallet Card 2 (#5214) | beratberkayg | https://21st.dev/@beratberkayg/components/wallet-card-2 | 23 | Home balance card: total + 3 bucket tiles + actions (adapted) |
| 3 | Partition Bar (#26545) | 8starlabs | https://21st.dev/@8starlabs/components/partition-bar | 8 | Trade / Spend / Locked proportion bar |
| 4 | Number Flow (#1444) | barvian | https://21st.dev/@barvian/components/number-flow | 297 | Rolling balance + ticket amount digits |
| 5 | Segmented Control (#23552) | ddoemonn | https://21st.dev/@ddoemonn/components/segmented-control | 69 | Market filter, Long/Short, chain picker |
| 6 | Market Watchlist (#20110) | ssychui | https://21st.dev/@ssychui/components/market-watchlist | 19 | Markets list with sparklines (fed real data) |
| 7 | Market Snapshot (#22249) | ssychui | https://21st.dev/@ssychui/components/market-snapshot | 8 | Gold price card on the ticket |
| 8 | Slider Number Flow (#1294) | barvian | https://21st.dev/@barvian/components/slider-number-flow | 125 | Leverage slider with rolling value |
| 9 | Drawer (#1245) | shadcn | https://21st.dev/@shadcn/components/drawer | 173 | Face ID confirm bottom sheet |
| 10 | Wallet Card (#29187) | educalvolpz | https://21st.dev/@educalvolpz/components/wallet-card | 0 | Stacked virtual cards + hide balance |
| 11 | Upstash Ratelimit (#29280) | elements- | https://21st.dev/@elements-/components/upstash-ratelimit | 4 | Daily spending limit meter (relabelled) |
| 12 | QR Code Generator (#6838) | user_xn1cklas | https://21st.dev/@user_xn1cklas/components/qr-code-generator | 25 | Deposit QR card |
| 13 | Copy Code Button (#9552) | minhxthanh | https://21st.dev/@minhxthanh/components/copy-code-button | 37 | Copy address button |
| 14 | Skeleton (#1588) | shadcn | https://21st.dev/@shadcn/components/skeleton | 1097 | Loading skeleton |
| 15 | Text Shimmer (#1641) | ibelick | https://21st.dev/@ibelick/components/text-shimmer | 2807 | "Syncing…" shimmer text |
| 16 | Empty State (#1435) | serafimcloud | https://21st.dev/@serafimcloud/components/empty-state | 793 | Empty state |
| 17 | 500 Server Error Page (#29348) | olewandowski1 | https://21st.dev/@olewandowski1/components/error-3 | 4 | Error block (stale feed) |
| 18 | Sonner (#886) | shadcn | https://21st.dev/@shadcn/components/sonner | 374 | Card-declined toast |

| Screen | Light | Dark |
|---|---|---|
| Home (balance split) | `screens/d1-home-light.png` | `screens/d1-home-dark.png` |
| Markets list | `screens/d1-markets-light.png` | `screens/d1-markets-dark.png` |
| Trade ticket | `screens/d1-trade-light.png` | `screens/d1-trade-dark.png` |
| Face ID confirm | `screens/d1-confirm-light.png` | `screens/d1-confirm-dark.png` |
| Card | `screens/d1-card-light.png` | `screens/d1-card-dark.png` |
| Fund (QR / any chain) | `screens/d1-fund-light.png` | `screens/d1-fund-dark.png` |
| Loading · empty · error | `screens/d1-states-light.png` | `screens/d1-states-dark.png` |

## D2 · Desk — pro terminal (dark default)

**Concept.** For the active trader: dense, monospaced, everything on one scroll. Top tabs instead of a bottom bar, equity chart first, buckets as a three-cell register, positions as a table with liquidation and P&L. The ticket sits under a candle chart with a margin-use gauge; after Face ID the order shows an **execution trace** (signed → risk check → sent to Perpl → fill), which maps directly onto the one-vault risk engine.

**Palette** (from *stocks and finance*, hihridayshah): black `#000`, surface `#0c0c0d`, hairline `#26272d`, signal green `#2fe92b` (primary, up), yellow `#fbfb0f` (spend, gauge), down `#ff4d4d`, destructive orange `#ff5102`. Light alt: paper `#f4f4f2`, ink `#0a0a0a`, green `#0f9d0c`.
**Type.** Inter for labels, JetBrains Mono tabular for every number, 10–11 px uppercase tracked labels.
**Shape.** 4 px radius, 1 px hairlines, no shadows.
**Motion.** Fast and functional: 120–200 ms, path draw on charts, spinner on the active execution step, heat-tile stagger. Nothing bounces.

| # | Component | Author | 21st URL | Installs | Used for |
|---|---|---|---|---|---|
| 1 | Vercel Tabs (#1597) | yadwinder | https://21st.dev/@yadwinder/components/vercel-tabs | 556 | Top tab navigation |
| 2 | Balance Chart (#30538) | ssychui | https://21st.dev/@ssychui/components/balance-chart | 0 | Equity chart with timeframe pill |
| 3 | Partition Bar (#26545) | 8starlabs | https://21st.dev/@8starlabs/components/partition-bar | 8 | Bucket proportion bar |
| 4 | Segmented Control (#23552) | ddoemonn | https://21st.dev/@ddoemonn/components/segmented-control | 69 | Asset class filter, Long/Short |
| 5 | Market Watchlist (#20110) | ssychui | https://21st.dev/@ssychui/components/market-watchlist | 19 | Dense perps watchlist |
| 6 | Market Heatmap (#30551) | ssychui | https://21st.dev/@ssychui/components/market-heatmap | 0 | Open-interest heatmap |
| 7 | Candle Chart (#22250) | ssychui | https://21st.dev/@ssychui/components/candle-chart | 4 | Candles + volume on the ticket |
| 8 | Slider (#304) | originui | https://21st.dev/@originui/components/slider | 805 | Leverage slider |
| 9 | Gauge (#3719) | designali-in | https://21st.dev/@designali-in/components/gauge-1 | 54 | Margin-use half gauge |
| 10 | Task Steps (#23569) | ddoemonn | https://21st.dev/@ddoemonn/components/task-steps | 16 | Execution trace after Face ID (signed → risk → sent → fill) |
| 11 | Credit  or Debit Card (#5276) | ravikatiyar162 | https://21st.dev/@ravikatiyar162/components/credit-debit-card | 34 | Flippable virtual card |
| 12 | Upstash Ratelimit (#29280) | elements- | https://21st.dev/@elements-/components/upstash-ratelimit | 4 | Spend limit meter |
| 13 | BeUI Multi-chain Swap  (#16251) | starc007 | https://21st.dev/@starc007/components/be-ui-multi-chain-swap | 6 | Bridge + deposit any chain → AUSD |
| 14 | QR Code Generator (#6838) | user_xn1cklas | https://21st.dev/@user_xn1cklas/components/qr-code-generator | 25 | Direct deposit QR |
| 15 | Copy Code Button (#9552) | minhxthanh | https://21st.dev/@minhxthanh/components/copy-code-button | 37 | Copy address |
| 16 | Loading State (#23591) | theshanelevine | https://21st.dev/@theshanelevine/components/loading-state | 10 | Terminal-style loader with elapsed time |
| 17 | Skeleton (#1588) | shadcn | https://21st.dev/@shadcn/components/skeleton | 1097 | Row skeletons |
| 18 | Interactive Empty State (#22302) | remcostoeten | https://21st.dev/@remcostoeten/components/interactive-empty-state | 215 | Empty + outage states |
| 19 | Alert Toast (#8863) | lavikatiyar | https://21st.dev/@lavikatiyar/components/alert-toast | 83 | Risk events (stale feed, margin, decline) |

| Screen | Dark | Light |
|---|---|---|
| Home (balance split) | `screens/d2-home-dark.png` | `screens/d2-home-light.png` |
| Markets list | `screens/d2-markets-dark.png` | `screens/d2-markets-light.png` |
| Trade ticket | `screens/d2-trade-dark.png` | `screens/d2-trade-light.png` |
| Face ID confirm | `screens/d2-confirm-dark.png` | `screens/d2-confirm-light.png` |
| Card | `screens/d2-card-dark.png` | `screens/d2-card-light.png` |
| Fund (QR / any chain) | `screens/d2-fund-dark.png` | `screens/d2-fund-light.png` |
| Loading · empty · error | `screens/d2-states-dark.png` | `screens/d2-states-light.png` |

## D3 · Loud — bold expressive (light default)

**Concept.** Gen-Z, Robinhood-meets-Gumroad. Cream paper, 2 px black borders, hard 4 px offset shadows, red / electric blue / yellow. Positions are big gradient tiles with a leverage chip; the balance split is three rings. Markets opens with a **crowd long/short card**. The ticket uses presets instead of sliders and **hold-to-confirm** (1.2 s) before Face ID, so no accidental trades; a fill ends in confetti and a torn-ticket receipt.

**Palette** (from *Neo Brutalism*, serafimcloud): cream `#fff9e8`, ink `#000`, red `#ff3333` (primary), yellow `#ffff00` (secondary, card), blue `#0066ff` (accent), up `#00b84a`. Dark: `#111` with white borders and white hard shadows.
**Type.** Space Grotesk 700 display (40–64 px, tight tracking), Space Mono for data and labels.
**Shape.** 0 radius, 2 px borders, `4px 4px 0 #000` shadows, press-down retro buttons.
**Motion.** Tactile: button press depth, count-up balance, ring sweep, hold-fill bar, confetti burst on fill.

| # | Component | Author | 21st URL | Installs | Used for |
|---|---|---|---|---|---|
| 1 | Retro Button (#845) | serafimcloud | https://21st.dev/@serafimcloud/components/retro-button | 62 | Press-down tab bar and buttons |
| 2 | Number Ticker (#1282) | dillionverma | https://21st.dev/@dillionverma/components/number-ticker | 1295 | Counting-up balance |
| 3 | Apple Activity Ring (#3223) | kokonutd | https://21st.dev/@kokonutd/components/apple-activity-ring | 51 | Balance split as three rings |
| 4 | Asset Card (#7945) | ravikatiyar162 | https://21st.dev/@ravikatiyar162/components/asset-card | 44 | Positions as loud gradient tiles with leverage chip |
| 5 | Stock Card (#8034) | ravikatiyar162 | https://21st.dev/@ravikatiyar162/components/stock-card | 29 | Market rows with Buy |
| 6 | Prediction Market Card (#2537) | isaiahbjork | https://21st.dev/@isaiahbjork/components/prediction-market-card | 32 | Crowd long/short sentiment card (relabelled) |
| 7 | Segmented Button Group (#7961) | ruixen.ui | https://21st.dev/@ruixen.ui/components/segmented-button-group | 30 | Long/Short + leverage presets |
| 8 | Sliding Number (#1666) | ibelick | https://21st.dev/@ibelick/components/sliding-number | 221 | Rolling leverage digits |
| 9 | Hold and Release Button (#8) | kokonutd | https://21st.dev/@kokonutd/components/hold-and-release-button | 81 | Hold-to-confirm, then Face ID |
| 10 | Ticket Confirmation Card (#6492) | ravikatiyar162 | https://21st.dev/@ravikatiyar162/components/ticket-confirmation-card | 111 | Fill receipt ticket |
| 11 | Confetti (#843) | dillionverma | https://21st.dev/@dillionverma/components/confetti | 663 | Confetti on fill |
| 12 | Credit Card (#1172) | rynkovski | https://21st.dev/@rynkovski/components/credit-card | 41 | Yellow virtual card with reveal |
| 13 | Progress Bar (#9659) | jatin-yadav05 | https://21st.dev/@jatin-yadav05/components/progress-bar | 47 | Segmented spend-limit bar |
| 14 | QR Code Generator (#6838) | user_xn1cklas | https://21st.dev/@user_xn1cklas/components/qr-code-generator | 25 | Deposit QR (yellow) |
| 15 | Copy Code Button (#9552) | minhxthanh | https://21st.dev/@minhxthanh/components/copy-code-button | 37 | Copy address |
| 16 | Loading State (#23591) | theshanelevine | https://21st.dev/@theshanelevine/components/loading-state | 10 | Dots loader |
| 17 | Skeleton (#1588) | shadcn | https://21st.dev/@shadcn/components/skeleton | 1097 | Skeleton blocks |
| 18 | Empty State (#1435) | serafimcloud | https://21st.dev/@serafimcloud/components/empty-state | 793 | Empty state |
| 19 | Alert Toast (#8863) | lavikatiyar | https://21st.dev/@lavikatiyar/components/alert-toast | 83 | Filled alert toasts |

| Screen | Light | Dark |
|---|---|---|
| Home (balance split) | `screens/d3-home-light.png` | `screens/d3-home-dark.png` |
| Markets list | `screens/d3-markets-light.png` | `screens/d3-markets-dark.png` |
| Trade ticket | `screens/d3-trade-light.png` | `screens/d3-trade-dark.png` |
| Face ID confirm | `screens/d3-confirm-light.png` | `screens/d3-confirm-dark.png` |
| Card | `screens/d3-card-light.png` | `screens/d3-card-dark.png` |
| Fund (QR / any chain) | `screens/d3-fund-light.png` | `screens/d3-fund-dark.png` |
| Loading · empty · error | `screens/d3-states-light.png` | `screens/d3-states-dark.png` |

## D4 · Bullion — premium minimal / editorial (light default)

**Concept.** A private bank for people who hold gold. Paper, ink and a thread of gold; serif headlines that read like a newspaper ("Own gold, *not the vault.*"); ledger rows with hairlines instead of cards. The ticket talks in ounces and exposure, leverage is a quiet 1×/2×/5×/10× choice, and the primary action is a gold metal button. The card is a gold *Reserve* card; topping it up moves money from Free to trade with the trade-off spelled out.

**Palette** (from *432 Editorial*, ben_92bae8ec, plus gold from *Amber Minimal*): paper `#f7f5f0`, card `#fffdf8`, ink navy `#031a29`, hairline `#d9d6ce`, gold `#b8892b`, up `#1a7a47`, down `#b03a2e`. Dark: navy `#031a29`, gold `#e3c27a`.
**Type.** Instrument Serif display (44–64 px, italic for emphasis), Inter UI, Geist Mono figures in ledgers.
**Shape.** 2 px radii, 1 px hairlines, a heavy rule above each ledger, floating morph-pill nav.
**Motion.** Slow and quiet: sliding digits, 240 ms fades, a morphing pill indicator, metal button press, Face ID ring pulse.

| # | Component | Author | 21st URL | Installs | Used for |
|---|---|---|---|---|---|
| 1 | Pill Morph Tabs (#7878) | ruixen.ui | https://21st.dev/@ruixen.ui/components/pill-morph-tabs | 63 | Morphing pill bottom nav (gold gradient) |
| 2 | Sliding Number (#1666) | ibelick | https://21st.dev/@ibelick/components/sliding-number | 221 | Sliding wealth digits |
| 3 | Line Charts 9 (#4728) | sean0205 | https://21st.dev/@sean0205/components/line-charts-9 | 125 | Gold line chart (adapted from the demo) |
| 4 | Stock Portfolio Card (#8704) | kavikatiyar | https://21st.dev/@kavikatiyar/components/stock-portfolio-card | 27 | Markets brief: watchlist + news |
| 5 | Segmented Button Group (#7961) | ruixen.ui | https://21st.dev/@ruixen.ui/components/segmented-button-group | 30 | Leverage selector |
| 6 | Liquid Glass Button (#3166) | designali-in | https://21st.dev/@designali-in/components/liquid-glass-button | 2911 | Gold MetalButton "Buy with Face ID" |
| 7 | Finger Scan Button (#5107) | designali-in | https://21st.dev/@designali-in/components/finger-scan-button | 12 | Face ID scan button |
| 8 | Order Confirmation Card (#9038) | kavikatiyar | https://21st.dev/@kavikatiyar/components/order-confirmation-card | 39 | Order receipt |
| 9 | Glass Card  (#2696) | Smit-Prajapati | https://21st.dev/@Smit-Prajapati/components/glass-card | 181 | Metal Reserve card (parametrized) |
| 10 | Card (#7633) | kavikatiyar | https://21st.dev/@kavikatiyar/components/card-5 | 12 | Top up Free to spend from Free to trade |
| 11 | Express Wallets (#25102) | felipemenezes098 | https://21st.dev/@felipemenezes098/components/payment-3 | 2 | Apple Pay / Google Pay add |
| 12 | QR Code Generator (#6838) | user_xn1cklas | https://21st.dev/@user_xn1cklas/components/qr-code-generator | 25 | Deposit QR |
| 13 | Copy Code Button (#9552) | minhxthanh | https://21st.dev/@minhxthanh/components/copy-code-button | 37 | Copy address |
| 14 | Skeleton Swap (#23557) | ddoemonn | https://21st.dev/@ddoemonn/components/skeleton-swap | 12 | Skeleton swap loader |
| 15 | Offline Empty State (#21518) | bundui | https://21st.dev/@bundui/components/empty8 | 6 | Empty (shadcn Empty primitives from this item) |
| 16 | 500 Server Error Page (#29348) | olewandowski1 | https://21st.dev/@olewandowski1/components/error-3 | 4 | Error block (session closed) |
| 17 | Sonner (#886) | shadcn | https://21st.dev/@shadcn/components/sonner | 374 | Card payment toast |

| Screen | Light | Dark |
|---|---|---|
| Home (balance split) | `screens/d4-home-light.png` | `screens/d4-home-dark.png` |
| Markets list | `screens/d4-markets-light.png` | `screens/d4-markets-dark.png` |
| Trade ticket | `screens/d4-trade-light.png` | `screens/d4-trade-dark.png` |
| Face ID confirm | `screens/d4-confirm-light.png` | `screens/d4-confirm-dark.png` |
| Card | `screens/d4-card-light.png` | `screens/d4-card-dark.png` |
| Fund (QR / any chain) | `screens/d4-fund-light.png` | `screens/d4-fund-dark.png` |
| Loading · empty · error | `screens/d4-states-light.png` | `screens/d4-states-dark.png` |

---

## Comparison

| | D1 Pocket | D2 Desk | D3 Loud | D4 Bullion |
|---|---|---|---|---|
| Audience | first-time investors | active traders | young, social | wealth, gold holders |
| Navigation | floating pill bottom bar | top tabs | press-down button bar | morphing pill bottom bar |
| Density | low | high | low, huge numbers | low, typographic |
| Balance split | tiles + proportion bar | 3-cell register + bar | three rings | ledger + hairline bar |
| Confirm | bottom sheet + Face ID | Face ID + execution trace | hold-to-confirm → Face ID → confetti | Face ID scan + receipt |
| Leverage input | slider with rolling value | slider + margin gauge | preset buttons | quiet segmented choice |

## Native (React Native / Expo) equivalents needed

All 21st components are web React (DOM + Tailwind + framer-motion/recharts). For the iOS/Android app each needs a native build; the tokens, layouts and motion specs carry over. (Expo DOM components, `'use dom'`, could host some web pieces as a stopgap, at a performance cost.)

| 21st piece(s) | Native approach |
|---|---|
| Number Flow, Number Ticker, Sliding Number | Reanimated-driven digit columns (or Skia text) |
| Balance Chart, Market Snapshot, Line Charts 9, Candle Chart, Market Heatmap, Gauge, Activity Rings | Skia-based charts (e.g. victory-native, react-native-wagmi-charts for candles); rings and gauge as Skia arcs |
| Drawer (vaul) | a native bottom sheet (e.g. @gorhom/bottom-sheet) |
| Sonner, Alert Toast | a native toaster (e.g. sonner-native) |
| Segmented Control, Vercel Tabs, Pill Morph Tabs, Bottom menu, Retro Button | native segmented control / custom tab bar with Reanimated layout transitions |
| Slider, Slider Number Flow | a native slider with haptics on detents |
| Hold and Release Button | Pressable + long-press progress + haptics |
| Finger Scan Button, Face ID confirm | expo-local-authentication / platform passkeys (via Mera's RN SDK) |
| Wallet Card, Credit Card, Glass Card, Credit or Debit Card | Views + Reanimated 3D flip; Apple Pay via native PassKit in-app provisioning (mobile only) |
| QR Code Generator | react-native-qrcode-svg; copy via expo-clipboard |
| Confetti | a native confetti (e.g. react-native-fast-confetti) |
| Skeleton, Skeleton Swap, Text Shimmer, Loading State | Reanimated shimmer / Moti skeleton |
| BeUI Multi-chain Swap, Swap Ticket | rebuild as native form; same quote rows |

## Caveats found while building

- `beratberkayg/wallet-card-2` ships formatter-mangled JSX (`< /div>`); repaired mechanically, then adapted (`components/adapted/wallet-split.tsx`).
- `makviesainte/progress-metric-card` (#15024) is incomplete in the registry (missing `metric-chart`, `metric-controls`); dropped.
- `dhileepkumargm/holographic-card` ships without its CSS; not used.
- `felipemenezes098/sign-in-4`, `verify-identity-3`, `payment-3`, `bundui/empty8`, `olewandowski1/error-3` fail `21st add` (bad `shadcn/button` registry dependency); written from `21st get` output.
- Several items overwrite `components/ui/button.tsx` / `card.tsx` on install; the preview accepts the overwrite.
- `arihantcodes/depth-chart` rendered in the gallery but not inside the D2 ticket; left out of D2.
- Hard-coded demo data/labels were turned into props (default = original) in: market-watchlist, market-snapshot, qr-code-generator, copy-code-button, upstash-ratelimit, error-3, hold-and-release-button, finger-scan-button, prediction-market-card, apple-activity-ring, ticket-confirmation-card, card-5, glass-card, stock-portfolio-card; colour re-tokenized in slider-number-flow, retro-button, credit-card, pill-morph-tabs, apple-activity-ring. Locale fixed to en-US in wallet-card and stock-card.
- Numbers are illustrative mock data (`preview/lib/mock.ts`).

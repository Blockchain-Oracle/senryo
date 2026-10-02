# C — Trading

Capability cards C1–C12. Source: plan §0.4 (Markets × verbs), §0.5, §0.6 C, §0.7 and §0.9 (Markets / Market detail / Ticket / Order status / Position). Method: `product-how-tree`.

**Conventions.**
- Line references are at HEAD `924bd93`. That commit landed defects 1–3 (keeper side) while this book was written.
- `UNDEFINED` = nothing settles it; each one is a research task.
- **Decision** = settled here, with its rationale.
- (P) = Practice (10143, P$). (M) = Mainnet (143).

## Shared trading facts

**Engine markets.** Seven markets, all listed on both chains (`packages/config/src/markets.ts:45,68-98`).
- Max leverage = 10 000 ÷ IM bps (`packages/chain/src/market-reads.ts:74`).
- Fee: 5 bps on open and on close (`contracts/script/SeedConstants.sol:117`). 10 % of every fee goes to insurance (`contracts/src/libraries/Constants.sol:49`).

| Market (id) | Hours, UTC | IM / MM | Max | Spread base / dev | OI cap per side, abs / % pool | Profit cap | Size unit |
|---|---|---|---|---|---|---|---|
| XAU Gold (0), XAG Silver (1) | Sun 23:00–Fri 21:00; daily break 21:00–23:00 | 10 % / 5 % | 10× | 5 / 5 bps | $150 / 60 % | 50 % of entry notional | oz |
| EUR (2), GBP (3), CAD (6) | 24/5, Sun 23:00–Fri 21:00 | 5 % / 2.5 % | 20× | 5 / 15 | EUR $37.5 / 15 %; GBP $25 / 10 %; CAD $18.75 / 7.5 % | 10 % | EUR, GBP, CAD |
| JPY (4), CHF (5) | 24/5 | 10 % / 5 % | 10× | 5 / 15 | JPY $25 / 10 %; CHF $18.75 / 7.5 % | 10 % | JPY, CHF |

Sources: metals `SeedConstants.sol:114-124`; FX `:80-107,193-215`; calendars `:164-191`.

**Caps.**
- **Per trade:** 20 % of the pool for metals. FX: ≤ 10 % and ≤ the market's OI cap (`SeedConstants.sol:91-97,123`).
- **Skew:** 60 % for metals. FX: equal to the OI cap (`:122,206`).
- **They scale with the pool.** At the $250 Mainnet seed (`:137`), one XAU trade is ≤ $50 notional (`packages/core/src/risk/preview.ts:98-106`).

**Price.**
- **Fill:** oracle ± s, where s = max(base, dev) + age spread (6 bps/h, capped at 10) + impact (`docs/plan/specs/risk-math.md:9-12`; `Constants.sol:52-60`).
- **Impact:** 10 bps × skew growth ÷ pool. Refused above 50 bps (`preview.ts:138-141`).
- **CLOSED exits:** 25 bps + 5 bps/h, capped at 300 bps (`Constants.sol:54-56`).
- **Feeds:** metals have a 3,600 s heartbeat. FX has a 240 s heartbeat with a 0.15 % deviation trigger (`markets.ts:3-5`).
- **Stale:** a price goes STALE after its heartbeat + 600 s (`Constants.sol:82`). Testnet FX mirrors use a 10,800 s heartbeat (`SeedConstants.sol:63`).
- **Reopening:** the first 300 s after an open are REOPENING (`Constants.sol:88`).

**Funding.** 0.01 %/h × skew ÷ max(L+S, $100), capped at 0.1 %/h. The heavier side pays and the lighter side receives, both through the pool. It accrues only while the market is OPEN (`PerpMath.sol:99-104`; `SeedConstants.sol:125-126`; `MarketAccounting.sol:60-63`).

**Borrow.** About 5 % APR, plus 15 % APR × utilisation. Both sides pay, always (`SeedConstants.sol:127-129`; `MarketAccounting.sol:57-58`).

**Position limits.**
- One net position per market, ≤ 32 markets (`Constants.sol:42-43`).
- Minimum $5 notional (`:44`).
- Cross margin (`risk-math.md:19-26`).

**Perpl, Mainnet only** (`packages/config/src/perpl.ts:13`). Live context read 29 Sep (`context/08-integrations/agora-ausd-and-perpl.md:135-160`).
- **Max leverage** (inferred from `initial_margin`): BTC 15×, ETH / SOL 12×, MON / HYPE / ZEC 10×, PUMP 5×, LIT / VVV 3×, NEAR UNDEFINED.
- **Fees:** taker 3.45 bps, maker 0.45 bps.
- **Order rules:**
  - Slippage ≤ 100 bps; order TTL 20 blocks.
  - Account open ≥ 10 AUSD (testnet: 100). Deposit ≥ 10. Withdraw ≥ 0.01.
  - ≤ 16 triggers.
  - An IOC fill costs ≈ 590k gas (≈ 0.06 MON) (`:120,265`).
- **Geo-block:** BY, CU, GB, IR, KP, RU, SY, UA, US.
- **Always read live:** these values come from `/v1/pub/context` (`:335`).

**Confirmation policy** (`packages/account/src/policy/evaluate.ts:44-81,142-144`; `packages/account/src/constants.ts:27-45`; `policy/types.ts:82-85`).

| | Practice | Mainnet |
|---|---|---|
| Slide | every open, add, reduce and close | same |
| Face ID | off by default | open notional ≥ $50, or every trade if chosen. Prompt: "Confirm long $250.00 Gold" |
| Passkey step-up | open notional > $250 · session total > $1,000 · notional > 10× equity · > 20 signed tx/min | same, plus any swap leg (rule 11) |
| Never capped | reduce, close, place/cancel trigger (`evaluate.ts:95-98`) | same |

Session defaults: 30 min TTL, 5 min idle (`constants.ts:27-28`).

---

### C1 Discover markets
- **Promise:** Every market (engine, Perpl, read-only) in one list, filtered by kind, searchable, and clear about which ones you can trade.
- **Entry points:** the Markets tab · search (Home, Markets) · Home Positions empty state (featured carousel) · Asset detail cross-link (B2) · a push or deep link to `/markets/{SYM}`.
- **Steps:**
  1. **Markets opens on Perps.** Tabs: Watchlist · Tokens · Perps. Chips: All · Commodities · FX · Crypto · Equities. Search sits in the header. One dismissible "Go long or short" card.
  2. **Perps rows:** 40 pt mark · ticker + leverage badge ("10×") · short name · price + 24h. A venue mark appears when the venue isn't Senryo.
  3. **Locked rows** show a lock glyph and one word: "Mainnet", "Soon", "No feed" or "Read-only". A tap opens C2, which carries the reason.
  4. **Tokens:** every verified Monad token (token list, §0.8), with Trending and Gainers chips. A row opens Asset detail (B2).
  5. **Search:** a bottom field with Paste. Tabs: All · Tokens · Perps · Traders. Recent searches are kept.
  6. **Per mode:**
     - (P): engine rows are tradeable; Perpl rows are locked "Mainnet"; equities are "Read-only".
     - (M), before the engine deploy: engine rows stay listed with live Chainlink prices and an "Opening soon" tag.
- **Rules:**
  - **Categories:**
    - Commodities = XAU, XAG, Oil.
    - FX = EUR, GBP, JPY, CHF, CAD.
    - Crypto = 10 Perpl markets.
    - Equities = SPY, QQQ, NVDA, TSLA, SPCX, EWY.
  - **Decision:** Oil sits in Commodities with the lock "No feed". Today it renders as an equity (`apps/mobile/src/features/markets/MarketsList.tsx:97-106` vs `packages/config/src/discovery.ts:84,310`).
  - **Gates:**
    - SPY and QQQ are listable after a timelock.
    - NVDA, TSLA, SPCX and EWY are blocked (B2) because one update can jump 0.77–1.49 %.
    - Perpl (M): "opens when Senryo connects". Perpl (P): blocked (B10) (`discovery.ts:109-120,160-173`).
  - **Leverage badge:** the market's max (`features/markets/LeverageBadge.tsx:26-33`).
  - **Discovery prices:** read from Monad mainnet in both modes, refetched every 10 s (`packages/query/src/discovery.ts:3-5`; `packages/query/src/constants.ts:49-50`).
  - **Search trigger:** ≥ 2 characters, 250 ms debounce (`features/search/SearchScreen.tsx:33`).
- **States:** skeleton rows · "Price unavailable" + Retry (`MarketRow.tsx:82`) · "Nothing here yet" · "Star a market" · an offline banner with stale values marked · "Trading paused · 3h 12m" / "Closing only" (shortened from `MarketBanners.tsx:29-52`).
- **After:** A row opens C2 (engine or Perpl) or B2 (token) · Star → C10. Bell → C9.
- **Today → gap:**
  - On Mainnet the whole Perps / Watchlist list is replaced by `PrelaunchMainnet` (`app/(tabs)/markets/index.tsx:65-66`). "Opening soon" doesn't exist.
  - Rows carry words instead of a lock: "No practice venue", "Price too jumpy" (`discovery-words.ts:4-13`).
  - The "Arriving" rows are built but filtered out (`universe.ts:47-77`; `MarketsList.tsx:60`).
  - Search covers engine markets only (`SearchScreen.tsx:25-29,109-111`).
  - `capabilitiesOf` is unused by markets (`packages/query/src/capabilities.ts`; its only caller is `app/withdraw/send.tsx:23`).
- **Acceptance:**
  - [ ] (P) All lists: 7 priced engine rows; 10 Perpl rows locked "Mainnet"; equities "Read-only"; Oil "No feed"; no sentences on any row.
  - [ ] (M) The engine rows show live prices and "Opening soon". There's no full-screen prelaunch page.
  - [ ] Oil sits under Commodities. Each chip filters correctly.
  - [ ] Searching "btc" finds the Perpl perp and the BTC token. Searching "@kai" finds the trader.
  - [ ] The dismissed intro card stays gone after a relaunch.

### C2 Market detail
- **Promise:** One page per market: price, chart, holders, feed and rules, with Short and Long one tap away.
- **Entry points:** a Markets row or search · a position header · a feed market chip · an alert push · Asset detail "Trade XAU with leverage ›" · `/markets/{SYM}?chainId=`.
- **Steps:**
  1. **Header:** mark, ticker + badge, venue mark. Alert · Watch · Share · History circles (`MarketActions.tsx:25-48`).
  2. **Price + 24h · OI.** Chart timeframes 1D / 3D / 2W / 8W / 1Y, default 3D (`features/markets/periods.ts:25-34`).
  3. **Tabs:**
     - Holders (with a "Following" chip).
     - Feed.
     - About: 2–3 sentences; a stats grid (Max leverage · Fee · Spread now · Funding now · Hours · OI long / short); a "Technical details" disclosure (feed, mirror, precision, IM / MM).
  4. **Cross-links:**
     - XAU → "Own real gold ›" (XAUt0, B2).
     - Perpl MON / BTC / ETH → "Own MON ›".
  5. **Sticky Short (red, left) / Long (green, right).**
     - When the market isn't open, a banner sits above them: "Closed · opens Sun 23:00 UTC", "Price paused" or "Holiday · reopens …".
     - The buttons stay live; the ticket names the blocker.
  6. **Read-only instrument:** same layout. The bar becomes one disabled row (lock word + ⓘ). (M) engine before the deploy: "Opening soon".
- **Rules:**
  - **JPY quotes JPY / USD** (USD per yen; `markets.ts:5,23-25`). **Long JPY means the yen rises.** About states this in one line.
  - **Times** use `utcSlotLabel` / `durationUntil` (`packages/core/src/blockers.ts:108-124`).
  - **Eligibility:** the first Mainnet ticket per account passes eligibility first (`features/trade/TradeScreen.tsx:212-214`; `features/legal/eligibility.ts:11`).
  - **Symmetry:** every instrument gets watch, alert and share (§0.4).
- **States:** skeleton · "No rounds yet" · "Not listed here" + "See all markets" · the dot line "Open · 2m ago" (`TradeHeader.tsx:115-127`) · Holders: "Sign in to see" / "No holders yet".
- **After:** Short / Long → C3 or C4 · Bell → C9. Star → C10 · Share `${WEB_ORIGIN}/markets/{SYM}` · History → Activity filtered to this market.
- **Today → gap:**
  - The Holders filter is an RN `Switch` labelled "Following" (`MarketHolders.tsx:34-53`). It should be a chip (Part A6).
  - About is a 15-row table (`MarketAbout.tsx:73-94`).
  - There's no "Own real gold" link.
  - There's no closed or stale banner.
  - `/markets/BTC` dead-ends with "isn't tradeable here yet" (`TradeScreen.tsx:72-74`).
  - The discovery page has no star, alert or share (`DiscoveryDetail.tsx`).
- **Acceptance:**
  - [ ] On a Saturday, XAU shows its reopen banner. Long opens the ticket with the "Market closed" blocker.
  - [ ] JPY's About carries the orientation line. Its price shows 7 decimals (`markets.ts:43`).
  - [ ] XAU → "Own real gold ›" opens XAUt0.
  - [ ] BTC detail has Alert, Watch and Share, and the Perpl mark.
  - [ ] The Following chip is hidden for guests.

### C3 Open long or short (engine)
- **Promise:** Pick a side, a margin and a leverage; pay with anything you hold; slide once; see the position.
- **Entry points:** C2 sticky buttons (`TradeScreen.tsx:202-224`) · Position → Add (C5) · "Trade this" (C11) · the Home featured carousel · `/markets/{SYM}/ticket?side=` (`lib/constants/routes.ts:90`).
- **Steps:**
  1. **The ticket opens on the tapped side** (`TicketScreen.tsx:92-97`). A small header toggle flips it, and locks while a trade is in flight (`TicketHeader.tsx:81-90`).
  2. **Header (Fomo F37):** mark, ticker, OI; price + "Market" + status + age; the "Senryo" venue chip and the mode label. Venue, mode and the "not live" warning are kept (`TicketHeader.tsx:54,66-77,91`; Part F2).
  3. **Entry area:**
     - "Margin · leveraged size $50" above the centred margin hero (`Ticket.tsx:85-118`).
     - Ruler from 1× to the market max, default min(5, max) (`useTicket.ts:53,64,266`).
     - "Liquidation price $3,412.10 · 9.8% away" ⓘ · "Add SL/TP" (`Ticket.tsx:133-199`).
     - Keypad / chart switch.
     - Presets $10 / $50 / $100 / Max (`features/trade/constants.ts:4`).
  4. **"Buying power P$212 · Pay with AUSD ⌄" (new).**
     - The picker lists every holding with its mark and value (rule 1).
     - Buying power = Free to trade + the chosen asset's swappable value.
     - (P): P$ plus wallet test AUSD / USDC, by direct deposit (no testnet aggregator, §0.8).
     - (M): any verified holding.
  5. **Details (collapsed):**
     - Fee 5 bps · spread now · impact · est. fill.
     - Funding now ("You pay 0.004%/h" / "You receive …") · Borrow now ("5.1% APR").
     - Acceptable price ±0.5 % · locked margin · buying power after.
     - Steps when composed: Swap → Deposit → Open (+ SL/TP).
  6. **First trade (either mode):** the risk explainer (`app/(sheets)/risk-explainer.tsx:14-27`). When the side is short it adds a 4th card: "Short: you profit if the price falls; losses grow if it rises."
  7. **Slide.** The rail is in the side colour and reads "Slide to long" / "Slide to short". Above the session limits it reads "… · passkey"; one passkey signs every leg (`ticket-commit.ts:70-73,99`; `useTicket.ts:121,233-235`). (M) ≥ $50 notional: Face ID.
  8. **`OperationStatus` (Part A8).**
     - Pending: verb + spinner on the rail.
     - Success: check + sound, "Long XAU opened", then Size · Entry · Liq., View position · Share, and Details (fee, fill, tx).
     - SL/TP legs follow the fill (`useTicket.ts:215`; `ProtectAfterOpen.tsx:67-71`).
- **Rules:**
  - **Sizing:**
    - Notional = margin × leverage (`useTicket.ts:78`).
    - Max = what fits in Free to trade, minus 1¢, within caps and impact (`preview.ts:195,201-222`).
    - Revalidated before signing: market OPEN, leverage ≤ max, fill moved ≤ 50 bps. Otherwise "Market or quote changed. Review this order again." (`useTicket.ts:173-207`).
  - **Price protection:** acceptable price = fill ± 0.5 %, deadline 120 s (`packages/query/src/orders.ts:11-20`).
  - **Paying with another asset (rule 4):**
    - Steps: swap X → AUSD (Monorail / Kyber, §0.8) → `SenryoCore.deposit` (own funds, uncapped, `evaluate.ts:99-101`) → `increase`.
    - A swap leg forces a step-up (rule 11), which signs all legs.
    - Impact over 1 % warns; over 5 % blocks (D-5). The MON reserve is kept (B11).
  - **Session leverage cap:** notional ≤ 10× account equity (`constants.ts:42-43`; `evaluate.ts:75`). A 20× EUR trade on all equity asks for a passkey.
  - **Region (M):**
    - Blocked when the IP is sanctioned or in a Perpl-listed country (`services/api/src/geo.ts:36-45`); an unknown country is allowed (`packages/query/src/geo.ts:2-3`).
    - Self-attestation is asked once per account.
  - **Guardian pause:** stops opens for ≤ 72 h. Settle-only stops them for good (`AdminModule.sol:20-31`; `CoreStorage.sol:86-89`).

**Blockers.** The first one wins. Each shows one line and one fix.

| # | Blocker | Copy (title · fix) | Today |
|---|---|---|---|
| 1 | Offline | "You're offline" | ✓ `blockers.ts:63,137` |
| 2 | Region (M) | "Not available in your region" · "Practice is open" | ✓ `:64,139` |
| 3 | No account | "Create an account to trade" (resumes) | ✓ `:65,141` |
| 4 | Terms | "Accept the terms ›" | ✗ `hasAcknowledgedTerms` is never called (`features/legal/acknowledged.ts:18`) |
| 5 | Opposite side open | "You're long · close it first" · Close it | ✓ `924bd93` (`blockers.ts:67-68,143`; `ticket-commit.ts:42-43`). Defect 3. Add the amount: "You're long P$300" |
| 6 | Buying power short | "Add P$12 to trade" · Add money / Pay with ⌄ | ✓ `:70,147` (Pay with is new) |
| 7 | Closed / reopening | "XAU opens Sun 23:00 UTC · in 14h 02m" | ✓ `:71-72,149-157` |
| 8 | Price paused | "XAU price paused" | ✓ `:73,158` |
| 9 | Engine paused / settle-only | "Trading paused · 3h 12m" / "Closing only" | ✗ falls through to the raw `SIMULATION_REVERTED` text (`:89,168`) |
| 10 | Leverage over max | "Max 10×" · Set 10× | ✓ `:76,160` |
| 11 | Market full / impact | "Max P$48 now" · Use max | ✓ `:78-79,162-165`; impact gives no max |
| 12 | Below minimum | "Minimum P$5" | ✓ `:81,166` |
| 13 | Network fee unavailable | "Add MON for network fees" | ✓ `:82,145,176-195` (the word "gas" was removed in `924bd93`) |
| 14 | Quote moved (after the slide) | "Price updated. Review and slide again." | ✓ `TicketScreen.tsx:31` |
| 15 | Unknown outcome | "Checking…" and no new slide | ✓ `send-outcome.ts:1-43` |

- **Decision:** the opposite-side check sits at #5, before money. It doesn't depend on the amount, and asking for money first would be a dead end. `924bd93` implements this order.
- **Being over the session cap is not a blocker.** It raises the confirmation level to a passkey (defect 1, ✓ `924bd93`: `features/trade/confirm-level.ts:1-40`).
- **States:** "Enter an amount" · "Preparing order…" · "Slide to long" / "Slide to short · passkey" · one blocker label · "Opening…" · "Not opened · Review again" (never resubmits, Part F1) · "Checking…".
- **After:** The position appears in Home → Positions · Activity → Trades: "Opened long XAU" · A feed post if public (F4) · The receipt can be shared or opened on the explorer. No push (the trade is synchronous).
- **Today → gap:**
  - "Pay with" is missing. The footer shows "$x available ⊕", which leads to Add money (`TicketFooter.tsx:65-83`).
  - The rail is always `color.primary` (`components/trade/HoldToConfirm.tsx:142`), with no `tone` or `busy` (Part F2).
  - Funding and borrow rates are never shown before a trade; only the liquidation child mentions them (`TicketChildren.tsx:50`).
  - There's no risk card specific to shorts. The accept control reads "Hold · I understand" on a slide (`risk-explainer.tsx:55`).
  - Review is a KeyValue table (`TicketChildren.tsx:89-111`).
  - Terms aren't gated.
  - Engine pause isn't a blocker.
- **Acceptance:**
  - [ ] (P) XAU, P$100 at 5×: the slide reads "Slide to long · passkey"; one passkey prompt; "Long XAU opened" (defect 1).
  - [ ] (P) XAU, P$20 at 5×: slide only, no Face ID.
  - [ ] (M, after deploy) $10 at 5× asks for Face ID with "Confirm long $50.00 Gold".
  - [ ] Long held → tap Short. "You're long · close it first" shows before any slide; "Close it" opens the position (defect 3).
  - [ ] (M) Pay with MON: Details show Swap → Deposit → Open; one passkey prompt; a single operation appears in Activity.
  - [ ] Saturday XAU: "XAU opens Sun 23:00 UTC · in …", and the slide is disabled.
  - [ ] EUR ruler reaches 20×. Using all equity at that leverage asks for a passkey.
  - [ ] Kill the app during "Opening…". On reopen the outcome is shown and there's no second open.

### C3a Long vs short (binding definitions)

| | Long | Short | Evidence |
|---|---|---|---|
| Profits when | the price rises | the price falls | `risk-math.md:15` |
| Open fill | buys at ask, P × (1+s) | sells at bid, P × (1−s) | `risk-math.md:9` |
| Exit / PnL price | bid | ask | `risk-math.md:15`; `preview.ts:156-158` |
| Acceptable price, open | ≤ fill × 1.005 | ≥ fill × 0.995 | `orders.ts:17-20,31` |
| Acceptable price, reduce / close | ≥ fill × 0.995 (sells) | ≤ fill × 1.005 (buys) | `orders.ts:45-73` |
| Liquidation price | **below** entry | **above** entry | `preview.ts:119-128` |
| Distance to liquidation | (price − liq) ÷ price | (liq − price) ÷ price | `preview.ts:124,128` |
| Take profit | **above** the mark | **below** the mark | `features/trade/tpsl.ts:5`; `TriggerOrders.sol:52-53` |
| Stop loss | **below** the mark, above liq | **above** the mark, below liq | `tpsl.ts:5,49-69` |
| Funding, longs heavier (rate > 0) | **pays** | **receives** | `PerpMath.sol:103`; `risk-math.md:33` |
| Funding, shorts heavier (rate < 0) | receives | pays | same |
| Borrow | pays | pays | `MarketAccounting.sol:57-58` |
| OI cap, skew, impact | counts on the long side | counts on the short side | `preview.ts:98-106,138-140` |
| Colour | `color.up` (green) | `color.down` (red) | `TicketHeader.tsx:41`; `TradeScreen.tsx:242` |
| Sticky button | right | left | `TradeScreen.tsx:220-221` |
| Slide label | "Slide to long" | "Slide to short" | `ticket-commit.ts:70-73` |
| Row tag / status | "Long 5×" / "Long XAU opened" | "Short 5×" / "Short XAU opened" | `TicketReceipt.tsx:107` (`{side} {SYM} opened`) |
| Face ID prompt | "Confirm long $250.00 Gold" | "Confirm short …" | `evaluate.ts:44-47` |
| JPY meaning | the yen rises vs USD | the yen falls vs USD | `markets.ts:5` |

**Colour rule.** PnL is coloured by **profit** (≥ 0 green, < 0 red), never by side (`features/positions/PnlHero.tsx:38`). Side colours belong only to side tags, the slide rail and the sticky buttons.

**One side per market.** A market never holds both sides at once (C3 #5).

### C4 Open on Perpl (crypto, Mainnet)
- **Promise:** Long or short BTC, ETH, SOL, MON and more from the same ticket, with real money, paid with any asset.
- **Entry points:** C1 Crypto chip · Perpl detail (C2) · the Asset detail cross-link for MON / BTC / ETH (rule 6) · "Trade this" on a Perpl post.
- **Steps:**
  1. **The C3 ticket with the venue chip "Perpl".** The ruler goes from 1× to the Perpl max, read live.
  2. **First time.**
     - There's no account yet: `getAccountByAddr` reverts `AccountDoesNotExist` (`agora-ausd-and-perpl.md:184-185`).
     - Details: [Swap → AUSD] → Approve → "Open Perpl account · 10 AUSD" → Order.
     - One slide; a step-up covers every leg.
     - **Decision:** deposit = max(10 AUSD, margin + taker fee + 1 % buffer).
  3. **Later trades:** prepend `depositCollateral` (≥ 10 AUSD) only when the Perpl balance is short.
  4. **Order:** `execOrder` IOC at mark ± 0.5 % (≤ 100 bps), `leverageHdths` = leverage × 100, `lastExecutionBlock` = 0 (`agora-ausd-and-perpl.md:241-263,500-513`).
  5. **Fill:** decode `TakerOrderFilledV2` / `PositionOpenedV2` from the receipt at the **finalized** block (events already indexed, `indexer/config.yaml:135-152`). No fill → "Price moved — nothing opened." The deposit stays in Perpl, with a "Withdraw ›" link.
  6. **Status:** "Long BTC opened · Perpl" · Size · Entry · Liq.
  7. **(P):** lock "Mainnet only". The named reason: Perpl testnet needs 100 AUSD and its faucet is empty (`agora-ausd-and-perpl.md:13,135`).
- **Rules:**
  - **Region:** `perplAllowed` is false in BY, CU, GB, IR, KP, RU, SY, UA and US (`services/api/src/geo.ts:39-43`), so the market is read-only there.
  - **No price-0 market order on-chain:** IOC with a bounded limit only (`agora-ausd-and-perpl.md:262`).
  - **Funding:** charged per Perpl interval, `fundingRatePct100k` in units of 1e-5 (`perpl.ts:38,60-61`). Detail shows "0.010% per 8 h · longs pay" (`DiscoveryDetail.tsx:174-182`).
  - **Withdraw:** `withdrawCollateral`, ≥ 0.01 AUSD, rate-limited (`agora-ausd-and-perpl.md:183,188`).
  - **Funding source:** the wallet funds Perpl directly; there's no vault dependency (Part F9).
  - **Session policy:**
    - It must decode Perpl `approve`, `createAccount`, `depositCollateral` and `execOrder` (Part D1).
    - Today these are `unknown` → `out-of-scope`, so the session never signs them (`evaluate.ts:125-128`; Perpl approve "joins in S7", `docs/plan/specs/session-policy.md:48`).
- **States:** "Opens a Perpl account · 10 AUSD" · "Opening…" · "Price moved — nothing opened." · "Perpl unavailable" (banner) · "Not available in your region" · "Mainnet only".
- **After:** The position appears in Positions with the Perpl mark (`getPositionV2` → snapshot) · Activity: "Moved to Perpl" (`features/portfolio/activity-copy.ts` `PERPL_DEPOSIT`) plus the trade · The TP/SL row reads "TP/SL on Perpl soon" (Path A, `agora-ausd-and-perpl.md:15`).
- **Today → gap (D1, not built):**
  - Only the unused capability "Perpl account funding and execution acceptance are pending" exists (`capabilities.ts:43-46`).
  - There's no `execOrder` code.
  - `perplAllowed` is only declared in the API schema (`packages/api-client/src/routes/info.ts:32`).
- **Acceptance:**
  - [ ] (M) First BTC long, $10 at 2×, paid with USDC: one slide + passkey runs approve → account → order; the status shows the fill decoded from events.
  - [ ] Second trade: no account step; a deposit appears only when needed.
  - [ ] A forced IOC miss shows "Price moved — nothing opened.", and the balance stays in Perpl.
  - [ ] From a geo-blocked IP, Perpl is read-only.
  - [ ] (P) The BTC ticket reads "Mainnet only" with ⓘ.

### C5 Manage a position
- **Promise:** See how a position is doing, then add, reduce or close with one slide.
- **Entry points:** Home Positions row · "Your position" on C2 (new) · "View position" on the status screen · fill, TP/SL or liquidation pushes · an Orders row.
- **Steps:**
  1. **PnL hero, coloured by profit:** "+P$12.40 · +6.2%". ⓘ shows the parts: Price · Funding · Borrow (`PnlHero.tsx:24-48`).
  2. **Chart** with entry and liquidation lines.
  3. **Stat strip:** Size · Entry · Mark · Liq. Size units:
     - **oz** for XAU and XAG;
     - **base currency** for FX ("1,250 EUR", "158,000 JPY");
     - **base asset** for Perpl ("0.0012 BTC").
  4. **Line:** "Funding −P$0.12 · Borrow −P$0.04 so far".
  5. **TP/SL row** → C6.
  6. **Actions:**
     - **Add:** the C3 ticket, side locked.
     - **Reduce:** 25 / 50 / 75 / 100 %, with Exit · Realised · Fee · To balance. Slide: "Slide to reduce 25%".
     - **Close:** "Slide to close".
     - **Share.**
  7. **Status:** "XAU long closed" / "Reduced by 25%" with Realised · Fee · To balance.
  8. **(P) and (M) are identical.** A Perpl close is an IOC on the opposite side (`orderType` 2/3, Part D1).
- **Rules:**
  - **Closing:** reduce and close work in every market status, at the status-matrix exit price. CLOSED adds 25 bps + 5 bps/h, capped at 300 (`preview.ts:270-278`; `risk-math.md:37-45`).
  - **Profit wait:** a profitable reduce waits 20 blocks after the last increase, and every Add re-arms the wait (`Constants.sol:45-46`; `PerpModule.sol:125,207-209`).
  - **Profit cap:** realised profit is capped at 50 % (metals) or 10 % (FX) of entry notional. The row reads "Realised · capped" (`PerpModule.sol:210-211`; `CloseTicket.tsx:52-58`).
  - **Funding and borrow:** any reduce settles **all** of them accrued so far (`PerpModule.sol:201,228`). Details say "Settles funding and borrow so far".
  - **Uncovered loss:** a loss the account can't cover with other positions open reverts `LossExceedsBalance` (`PerpModule.sol:232`). Copy: "Close the profitable one first, or add money".
  - **Confirmation:** reduce and close are never session-capped (`evaluate.ts:95-98`). Face ID applies only in every-trade mode (`:57-59`).
  - **Price protection:** ±0.5 % and 120 s (`orders.ts:45-73`).
- **States:** skeleton · "No open position" + "See market" · "Market closed · closing works" · "Profit close in ~6s" · "Closing…" · "Closed" · "Checking…".
- **After:** Activity → Trades: "Closed long XAU · +P$12.40" · A feed post if public · Leftover TP/SL orders are cancelled (C6).
- **Today → gap:**
  - **Defect 9:** "oz" is hard-coded for every market (`features/positions/PositionStats.tsx:34`).
  - The close slide reads "Slide to hold · Close XAU long" (`PositionDetail.tsx:70`; `HoldToConfirm.tsx:48`), and its hint is dead (`CloseTicket.tsx:89`).
  - There's no Add.
  - Previews leave out funding and borrow (`preview.ts:291-297`).
  - Borrow uses the stored index (`usePosition.ts:69`).
  - Spelling mixes "Realised" and "Realized".
- **Acceptance:**
  - [ ] EUR shows "Size 1,250.0000 EUR"; XAU shows oz (defect 9).
  - [ ] A profitable 25 % reduce right after opening shows "Profit close in ~Ns", then works.
  - [ ] A Saturday XAU close works, and Details show the closed spread.
  - [ ] Add opens the ticket locked to the same side. The averaged entry updates.
  - [ ] A losing short whose price fell by less than its fees shows a red hero.

### C6 TP / SL (bound to the position instance)
- **Promise:** A take profit and a stop loss that close **this** position, and only this one.
- **Entry points:** ticket "Add SL/TP" (planned) · the position's TP/SL row · Orders (C8) · a fill push.
- **Steps:**
  1. **The Fomo F44 sheet.**
     - Take profit and Stop loss, each with a price **or** a % field.
     - Chips: 10 / 15 / 25 / 50 % (`features/trade/constants.ts:21-22`).
     - Potential P/L: "Potential profit P$18.20".
     - Clear · Save.
  2. **Placement:** nothing is signed at the ticket. Levels are placed right after the fill, SL first (`planned-triggers.ts:1-5`; `trigger-legs.ts:190-213`).
  3. **Editing:** Save **replaces** the level of the same kind in one operation (cancel + place, in session).
  4. **Result:** "Stop loss set · $3,350.00". If a leg fails, the position shows "Unfinished: add SL" (`ProtectAfterOpen.tsx:37`).
- **Rules:**
  - **Sides** follow C3a. Copy: "Must be above $3,400.10", "Past liquidation ($3,212.00)" (`tpsl.ts:49-69`).
  - **Instance binding (decision 8).**
    - On-chain, a trigger is keyed only by (user, market, isLong) (`TriggerOrders.sol:14-16,48-49`).
    - **Rule a:** the keeper runs only triggers placed at or after the position's `openedAt`. ✓ `924bd93` (`services/keeper/src/sources.ts:120-125`).
    - **Rule b:** a close also cancels leftover triggers (`cancelTrigger` is reduce-class, in session).
    - **Rule c:** a contract-level epoch before the Mainnet deploy (commit note `924bd93`).
  - **Size follows the position (decision).** Sign `sizeDelta` = 2²⁵⁶−1; the contract fills `min(sizeDelta, size)` (`TriggerOrders.sol:55`).
  - **Fill tolerance:** TP may fill ≤ 1 % worse, SL ≤ 3 % worse.
  - **Expiry:** 30 days (`packages/query/src/triggers.ts:23-27`).
  - **Keeper:** checks every 2 s, only while the market is OPEN. A crossing while closed fills at the reopen (`services/keeper/src/jobs/maintenance.ts:78-85`; `services/keeper/src/constants.ts:12`).
  - **Exact touch:** the contract fires on an exact touch (`TriggerOrders.sol:53`). The keeper's strict `<` misses it for a long SL or a short TP (`maintenance.ts:82-84`). Fix: use `<=`.
  - **20-block wait:** a TP inside the profit wait reverts and is retried (`PerpModule.sol:207-209`).
- **States:** "Add" · "SL $3,350 · TP $3,600" · "Saving…" · "Set" · "Not saved · Try again" · "Checking…" (no re-save, `TpSlChild.tsx:169-173`) · "Unfinished: add SL".
- **After:** Push: "Stop loss closed your Gold long" / "It filled at $X." (`services/keeper/src/push-messages.ts:92-107`) · Inbox entry · Activity → Orders: "Stop loss filled".
- **Today → gap:**
  - **Defect 2:** the keeper guard has landed; the cancel-on-close and contract epoch have not. The only `cancelTrigger` call is the manual remove (`useTriggerLegs.ts:178`).
  - **Edit:** Save adds a level instead of replacing it, so two SLs can coexist (`trigger-legs.ts:170-176`).
  - **Size:** fixed at save (`useTriggerLegs.ts:128`).
  - **Two UIs disagree:**
    - TriggerPanel: ±1 / 2 / 5 / 10 %, "Cancel", "Placing is paused" (`positions/constants.ts:10-11`; `TriggerPanel.tsx:58-118`).
    - TpSlChild: 10 / 15 / 25 / 50 %, "Remove".
  - **Orphan triggers can't be cancelled:** the panel is missing on "No open position" (`PositionDetail.tsx:55-59`).
- **Acceptance:**
  - [ ] (P) Open a short with SL + TP. Both show, with SL above the mark.
  - [ ] A manual close removes both from Orders (cancelled on-chain).
  - [ ] Re-opening a short in the same market: no old trigger fires (defect 2).
  - [ ] Editing the SL leaves exactly one SL.
  - [ ] After an Add, the TP closes the **whole** new size.

### C7 Liquidation risk and event
- **Promise:** Warned early, told what to do, and told exactly what happened.
- **Entry points:** warning push · Home banner · "liq x% away" on a row · liquidation push · post-mortem sheet.
- **Steps:**
  1. **Warning.** Fires when liquidation equity < 1.5 × MM. Checked every 10 s, with a 30 min cooldown (`services/keeper/src/constants.ts:81-84`; `services/keeper/src/jobs/watch.ts:50-59`).
     - Push and banner both say "Close to liquidation" · "Add money or reduce".
     - Reduce opens the position **nearest** liquidation.
  2. **Rows:** Home rows show "liq 4% away" only under 25 % (§0.9 Home).
  3. **Liquidation event.**
     - Push (`push-messages.ts:110-128`).
     - On the next open, a post-mortem sheet: market(s), liquidation price, penalty, realised result, "What remains P$41.20", tx.
     - A 7-day Activity row (`features/portfolio/RiskBanner.tsx:97-113`).
- **Rules:**
  - **When:** an account is liquidatable when E_liq < Σ MM. Every held market must be OPEN; liquidations pause while a price is paused (`LiquidationModule.sol:17,27,79,84-93`).
  - **MM per market:** see the table above. IM doubles while a market is not OPEN (`risk-math.md:17`).
  - **The card counts.** Card holds **and** card debt reduce liquidation equity (`RiskModule.sol:82`; `risk-math.md:22`). The card intro must say so (defect 8).
  - **Penalty:** 1 % of exit notional. The liquidator gets min(50 % of it, $5); the rest goes to insurance (`Constants.sol:71-73`).
  - **What closes:** every position closes. Card debt is repaid first (`risk-math.md:47-48`).
  - **One threshold (decision).** The push, the banner and the gauge's danger band all use 1.5 × MM (margin use ≥ 6,667 bps). Today they disagree: push 1.5×, gauge 50 %, banner 80 % (`RiskBanner.tsx:50-51`; `components/trade/MarginGauge.tsx:15-16`).
- **States:** "Liquidation risk · 72% used" · "Add money" · "Reduce" · "Liquidated · 2 positions" · "Prices paused · liquidations paused" (`RiskBanner.tsx:88-91`).
- **After:** inbox; Activity → Trades "Liquidated"; feed "was liquidated on" (`MarketFeed.tsx:30-39`).
- **Today → gap:**
  - No post-mortem sheet. The banner holds a sentence and a tx hash (`RiskBanner.tsx:97-113`).
  - "Reduce" opens `held[0]` (`:61`).
  - The push says "Add margin"; the banner says "Add money".
- **Acceptance:**
  - [ ] (P) XAU at max leverage, then a mirror push below 1.5 × MM: push and banner within 10 s, with the same words.
  - [ ] Liquidate: push; the post-mortem shows penalty and what remains; the positions are gone.
  - [ ] An active card hold moves the liquidation price shown.

### C8 Orders and history
- **Promise:** Every live TP/SL and the fate of every past one, in one place.
- **Entry points:** Home Positions footer "Orders (n) ›" · Activity → Orders chip · the position's TP/SL row → "All orders".
- **Steps:**
  1. **Orders:** Active · History.
  2. **Active row:** mark, "Stop loss · XAU short", price, "whole position", "expires 30 Oct". A tap opens the C6 sheet.
  3. **History:** Filled (fill price) · Cancelled · Expired · Ended with position. A tap opens the receipt.
- **Rules:**
  - **No limit orders:** the engine takes market orders only (`orders.ts:1-12`).
  - **Expired** = PLACED with expiry < now. It's derived because the indexer has no EXPIRED status (`indexer/schema.graphql:54-58`).
  - **Ended with position** = PLACED, with the position since closed or re-opened (C6).
- **States:** "No open orders" + "Browse markets"; skeleton; "Updating…" while the indexer lags.
- **After:** Activity rows TRIGGER_PLACED / CANCELLED / EXECUTED (`activity-copy.ts:17,46`).
- **Today → gap:**
  - `app/orders.tsx` has no entry point: `ROUTES.orders` (`routes.ts:28`) is unused.
  - It lists active orders only (`packages/indexer-client/src/documents/triggers.ts:31`).
  - Expired rows read "expires in 0m" (`OrderRow.tsx:46`).
  - The copy promises "replaced" (`OrderRow.tsx:24`), which doesn't exist.
- **Acceptance:**
  - [ ] Home "Orders (2) ›" lists both levels.
  - [ ] After a TP fills, History shows "Filled · $3,600.00", and the SL shows "Ended with position".
  - [ ] A level older than 30 days shows as Expired.

### C9 Price alerts
- **Promise:** Be told when any market or token crosses your price.
- **Entry points:** the bell on C2, B2 and Perpl / equity detail · Notifications → Alerts "+" (G1).
- **Steps:**
  1. **Sheet:** "Rises above" / "Falls below". Price field. Chips ±1 / 2 / 5 % from the current price (`features/markets/constants.ts:4`; `AlertEditor.tsx:33-36,125-134`). Save.
  2. **Saved:** a row under "Your Gold alerts" (`AlertEditor.tsx:173`).
  3. **Fired:**
     - Push: "Gold crossed $3,600" / "It's now $3,604." On testnet the title starts with "Practice · " (`push-messages.ts:32-39,53-66`).
     - An inbox entry.
     - The row reads "Triggered 2 Oct 14:02" (`AlertRow.tsx:14-24`).
  4. **Edit:** tap the row → same sheet → Save replaces it. Delete with ×.
- **Rules:**
  - **Cap: 50 active alerts per mode.** Today the cap counts every chain together (`services/api/src/routes/engagement.ts:18,66-70`).
  - **Validation:** "Gold is already at $x. Set a higher price." (`AlertEditor.tsx:87-91`).
  - **Keeper:** every 10 s, on the **finalized** oracle (`watch.ts:13-41`; `services/keeper/src/constants.ts:14`). "Above" fires when price ≥ level; "below" when price ≤ level.
  - **Price sources:**
    - Engine: SessionOracle (`packages/chain/src/reads.ts:136`).
    - New sources needed: Perpl `getPerpetualInfo` mark (`perpl.ts:55-62`), Chainlink equity feeds, and token prices (§0.8).
  - **Guests:** the account sheet, then the alert resumes.
  - **Mute:** the "Price alerts" channel (`app/account/notifications.tsx:37`).
- **States:** "No alerts yet" + Set alert; "Unlock to see your alerts"; "50 alerts max · remove one"; "Active"; "Triggered …".
- **After:** inbox (G1). A tap opens the market.
- **Today → gap:**
  - No edit, only delete + create (`AlertsScreen.tsx:35-36`).
  - The cap is shared across modes (defect 11).
  - Engine markets only (`AlertsScreen.tsx:167`).
  - The Home bell opens alerts, not an inbox (`components/shell/Utilities.tsx:52-58`).
  - The list always claims push isn't set up (`AlertsScreen.tsx:143-145`).
- **Acceptance:**
  - [ ] XAU +1 % above, crossed via the mirror: push within 10 s, an inbox entry, and the row reads "Triggered".
  - [ ] Editing leaves one alert.
  - [ ] 50 Practice alerts don't block a Mainnet alert.
  - [ ] Alerts can be set on Perpl BTC and on the MON token.

### C10 Watchlist
- **Promise:** Star anything; find it in one tab on every device.
- **Entry points:** the star on C2, Perpl / equity detail and B2; long-press a Markets row.
- **Steps:**
  1. Star: haptic, filled star.
  2. Markets → Watchlist, newest first, in C1 row grammar. Engine, Perpl, equities and tokens are mixed.
  3. Unstar from the detail page or by swiping the row.
- **Rules:**
  - **Per mode** (`features/markets/useWatchlist.ts:16-33`).
  - **Sync:** through the encrypted prefs blob; last writer on `at` wins. Pulled at unlock, pushed 2 s after a change (D-232, `docs/plan/decisions.md:294`; `WatchlistSync.tsx:15,26-56`).
  - **Guests:** a guest's local list merges in at sign-up (decision).
  - **Recent searches stay on the device.**
- **States:** "Star a market"; skeleton rows; "Nothing starred in FX".
- **After:** —
- **Today → gap:** only engine markets can be starred or listed (`MarketsList.tsx:38-39`). Discovery, Perpl and tokens have no star.
- **Acceptance:**
  - [ ] Star XAU, Perpl BTC and MON: all three appear in Watchlist.
  - [ ] The same list appears on the web after sign-in.
  - [ ] A Practice star doesn't show on Mainnet.

### C11 Copy a trade
- **Promise:** See a trade you like and open the same side in two taps, with your own amount.
- **Entry points:** feed trade post → "Trade this"; another trader's position row → "Trade this"; Home Top Trades.
- **Steps:**
  1. "Trade this" opens the C3 / C4 ticket. **Side** and **leverage** are prefilled; the amount is empty (always the user's).
  2. The header line reads "Copying @kai · Long 5×". The rest is C3.
- **Rules:**
  - **Leverage source.**
    - Engine positions are cross-margin, so leverage isn't on-chain (`features/social/MarketLine.tsx:5`).
    - **Decision:** Senryo trade posts carry `lev` from `reviewedIntent.leverage` (`useTicket.ts:221`). Without it, min(5, max). Always clamped to the market max (`useTicket.ts:266`).
  - **The ticket route gains `lev`** (`routes.ts:90`; `app/(tabs)/markets/[market]/ticket.tsx:7-11`).
  - **C3 blockers apply**, including closed markets.
  - **No auto-mirroring.** Following moves no money (`features/social/FollowButton.tsx:3`).
- **States:** "Copying @kai · Long 5×", then the C3 states.
- **After:** an optional feed post "opened long XAU" (F4).
- **Today → gap:**
  - "Trade this" doesn't exist.
  - Feed rows open the trader (`MarketFeed.tsx:94`).
  - The ticket takes `side` only.
- **Acceptance:**
  - [ ] From "opened short EUR 10×", "Trade this" opens the ticket with Short, 10×, an empty amount and "Copying @…".
  - [ ] On a closed market, the ticket shows the closed blocker.

### C12 Performance periods
- **Promise:** One honest number per period, the same on your profile, others' profiles and the leaderboard.
- **Entry points:** own profile hero; another trader's profile; Leaderboard (F1).
- **Steps:**
  1. Chips: 24h · 7d · 30d · All (decision 14).
  2. Hero: realized PnL for the period ("+P$84.20"), coloured by sign.
  3. On your own profile only, the value chart below it, with the same periods.
  4. Below the ranking floor: "Not ranked · 3 more trades".
- **Rules:**
  - **What's counted:** realized PnL after fees, funding and borrow (`features/social/leaderboard-copy.ts:10-18`).
  - **Windows:** 24h is rolling; 7d and 30d are UTC-day buckets that include today; All is lifetime (`services/api/src/social/leaderboard-math.ts:78-81`).
  - **Ranking floors:**

    | Period | Min trades | Min volume |
    |---|---|---|
    | 24h | 3 | $100 |
    | 7d | 5 | $500 |
    | 30d | 10 | $1,000 |
    | All | 10 | $1,000 |

    (`services/api/src/social/constants.ts:207-212`)
  - **Modes:** Practice and Mainnet are ranked separately.
- **States:** skeleton; "No trades yet"; "Not ranked".
- **After:** Share profile link (F7).
- **Today → gap (defect 12):**
  - The own profile uses 1H / 24H / 1W / 1M / All on an equity curve, where "All" is 365 days (`features/portfolio/TradingPerformance.tsx:13-24,48`; `portfolio/constants.ts:2`).
  - Others' profiles and the leaderboard use 24h / 7d / 30d / All realized (`TraderStanding.tsx:25-32`).
  - There are two `PeriodChips` components (`features/markets/PeriodChips.tsx:15`; `components/kit/PeriodChips.tsx:22`).
- **Acceptance:**
  - [ ] Own 7d equals the leaderboard 7d.
  - [ ] Only your own profile shows the value chart.
  - [ ] Every period set reads 24h · 7d · 30d · All.

## UNDEFINED (C), each a research task
1. **Perpl market data.** NEAR's max leverage, and each market's lot or min-order size. Read `/v1/pub/context`; the listed maxima are inferred (`agora-ausd-and-perpl.md:158`).
2. **Perpl geo enforcement.** Whether Perpl enforces its geo-block at the API or on-chain (`:160`).
3. **Perpl liquidation price.** No formula is in the repo.
4. **CHF / CAD trade caps.** The exact values as listed: `tradeCapPoolBps` comes from `AddMarkets.s.sol`, and the comment says "≤ OI cap" (`SeedConstants.sol:93`).
5. **Practice pool size today.** It sets every Practice cap (`LpVault.totalAssets`).
6. **Holiday calendar.** No `MarketCalendar` holiday entries are recorded (`MAX_HOLIDAYS` 32).
7. **Mainnet alerts before the engine deploy.** The keeper reads SessionOracle (`packages/chain/src/reads.ts:136`).
8. **Trade-post leverage.** The C11 decision needs a leverage field on the social API.
9. **Contract-level trigger epoch.** Design not written (commit note `924bd93`).

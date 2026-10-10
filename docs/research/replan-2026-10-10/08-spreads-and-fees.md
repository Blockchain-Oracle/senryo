# 08 · Spreads and fees: prediction calls and the "ride the price" mode (10 Oct 2026)

Read-only research for the 10 Oct replan. The owner wants the live PnL to feel like Tradash's (it starts near zero and
moves with the price), and asked for the spread to be decided properly. I changed nothing in any repo. This is the only
file I wrote. The scratch scripts and the market data they read live in this session's scratchpad (`…/scratchpad/spreads/`),
not in the repo.

Prefixes: **M** = `/Users/abu/dev/hackathon/metropolis`, **O** = `…/owarine`, **C** = `…/crypto-world-fair` (Mitoshi),
**T** = `…/canton-season3/context/13-revamp/tradash`.

## What I could not check (read this first)

- **No sub-second Pyth history.** Hermes needs the key, and Pythnet is gone (04 §5.1). Every microstructure number below
  (momentum after the fill, the value of a price lead, refusal rates, knock-out rates) uses **Binance 1-second bars as a
  proxy**: BTC for 4 days, ETH and SOL for 2 days, 6–10 Oct 2026. Window outcomes use 90 days of Binance 1-minute bars
  (12 Jul–10 Oct). Pyth averages many venues. Its own lag behind the exchanges (called δ below) and its short-term
  autocorrelation are **unmeasured**.
- **The 1-second sample is a calm week.** BTC's 7-day realised volatility was 0.29, against 0.345 over 90 days. Refusal
  and knock-out rates are for that week.
- **No production flow data.** I don't know which bands people actually pick, so the pool's edge under a flow mix is
  modelled, not measured.
- **Kalshi.** The fee-schedule PDF returned 429. I used Kalshi's own series API instead (`fee_type: quadratic`,
  `fee_multiplier: 1`) plus a secondary source for the formula. My Kalshi order-book depth parse was wrong, so I quote
  only the top-of-book spread.
- **Tradash and Bulk fees** come from the 7 Oct bundle study (T), not from a live fill. Hyperliquid was not checked.
- **Ostium's crypto opening fee is inconsistent.** Its docs table says 10 bps. The live subgraph behind the same page
  returned 6 bps on 10 Oct. Both are reported.
- **Veranta is Avantis renamed** (`docs.avantisfi.com` now redirects to `docs.veranta.xyz`). Its leverage pages disagree
  (Upside Perps up to 250× on one page and 500× on another).
- **Gas figures for σ updates are estimates** at the 10 Oct broadcast's 103 gwei (05). I did not simulate them.
- **Tests.** I ran no repo tests. The quote numbers come from the repo's own `quoteOpen` and `quoteClose`
  (`M/packages/core/src/market/band-quote.ts`, bit-exact with `BandBook`), run under
  `services/keeper/node_modules/.bin/tsx`. The proposals in §5 use a float model of the same maths.

## 0. Short answer

1. **The spread is not where Senryo's economics are decided today. σ is.** The pool prices every band with a normal
   model at a fixed σ that is 1.45× the 90-day realised volatility, and about 2× the volatility of a typical hour.
   Measured over 90 days of real windows:
   - **Range** is priced as a 34–40% chance but wins **66–73%** of the time. A caller makes **+70% to +88% per call** at
     any half-spread from 0.5 to 2 points.
   - **Moonshot and Crash** are priced at 15–16% but win **4–6%**. A caller loses **about 70%**.
   - **Up and Down** at the window's start are fair (50%). Bought mid-window when one side leads at 60–70%, they
     return **+18% to +23%** to the caller.

   No spread fixes errors of this size. On mainnet's caps, one bot buying Range could expect to take about $100 a minute
   from the pool (§1.3).
2. **Fixing σ fixes most of it.**
   - A σ that follows the last 30 minutes (refreshed each minute) cuts Range's leak to +2% to +9%.
   - Adding a fat-tailed probability table brings Up/Down and Range within about ±5% of fair out of sample. Moonshot
     and Crash stay 5–30% against the caller.
   - Both are contract changes. Today `setSigma` bumps the global config version, so every update refuses all calls in
     flight.
   - **Mainnet is not deployed yet**, so these cost engineering time but no wasted MON.
3. **Until then, mainnet should list Up and Down only.** `contracts/script/catalog/143.json` lists all five bands, and a
   menu entry can never be removed.
4. **Don't cut the spread to 1 point.** Two things sit under it:
   - **Short-term momentum.** It survives the 1-second fill delay. It is worth **2.5–4.5 points per share on 1-minute
     calls** and about 0–2 points on 5-minute calls (Binance proxy).
   - **Model error left after calibration.** It is about 1 point on 5-minute calls.

   At 1 point, a simple "follow the last 3 seconds" bot earns +2% to +4% per call on 1-minute BTC.
5. **The market agrees with 2 points.** Polymarket's and Kalshi's 5- and 15-minute crypto Up/Down markets cost a taker
   about **2.25 points per side at 50¢**: a 1¢ book plus a 0.07·p(1−p) fee. Senryo's 2 points is at the market. Owarine
   and Mitoshi quoted 3¢ a side.
6. **What makes Tradash "start at zero" is mostly how it shows PnL, not its cost.**
   - Tradash shows (mark − entry) × size and keeps fees in a separate row and in the break-even line.
   - A 40× Tradash round trip costs 9 bps of notional, which is **3.6% of margin**.
   - Senryo can show its PnL the same way: counted from the fair price at the fill, starting at $0.00, with the spread
     as a "Fees" row and a break-even tag. The Cash out button keeps the exact amount.
   - This needs no contract change, but it partly reverses 05's advice (§3.2).
7. **Recommended prediction spread** (with the mainnet deploy):
   - **Shape:** h(p) = max(0.25 pt, 4·h50·p(1−p)) per series, the Polymarket/Kalshi curve. Longshots pay less.
   - **h50 by lane:** 5m 2.0, 15m 1.5, 1h 1.0 points. 1m stays in Practice at 3.0 until momentum is measured on Pyth
     prints.
   - **Effect:** Up opens at −7.7% / −5.8% / −3.9% (5m / 15m / 1h). Moonshot opens at −13% to −7% instead of −22%.
   - Keep flat 2.0 on the current testnet reserve.
8. **Latency arbitrage is mostly closed by design, but not completely.**
   - **Stale-quote picking is gone:** fills are priced at a future print.
   - **What remains:** (a) momentum (above); (b) any lag δ of Pyth behind the exchanges beyond the ~0.3–0.5 s a bot can
     shave off the commit. Each second of such lead is worth about 8 points a share on a 1-minute call.
   - **A faster display feed** does not reach the contract. It helps everyone, not just bots, to see the move Pyth will
     print. Use it for the line and the on-screen quote, never for fills. Measure δ before cutting any spread.
9. **The 3% slippage limit** refuses 10–15% of taps on 1m, 7–12% on 5m and 1–4% on 1h, measured in a calm week. The
   pool doesn't care where the limit sits. Set it in price terms instead, about the 99th percentile of a 2-second move
   (BTC 3 bp, ETH 4.5 bp, SOL 5.5 bp), and refusals fall to about 1%.
10. **Ride the price (linear mode).** Recommended:
    - **Fees:** 5 bps a side on BTC/ETH/SOL; 8 bps on other Pyth crypto; 10 bps on RedStone markets and equities. A
      2 bps "maker" rate when a trade reduces the pool's skew. An early-close fee on profitable closes inside 15 s
      (20 → 0 bps), as Ostium and gTrade do.
    - **Holding:** no funding while positions end at a set time (≤ 4 h). A heavy-side borrow fee only if positions
      become open-ended.
    - **Caps:** leverage ≤ 20× BTC/ETH, ≤ 10× other crypto, ≤ 5× RedStone and equities on mainnet; Tradash's 40/25/20/10
      on testnet. Profit capped at 2× margin. Net exposure per market ≤ 0.5× the pool on mainnet.
    - **Edge:** the measured adverse selection is ≤ 0.3 bp per round trip, so the pool keeps about 9.7 bps of notional
      per round trip, about 1.9% of margin at 20×.

---

## 1. Today's economics, in the repo's own numbers

### 1.1 The terms

| Term | Value | Source | What it does |
|---|---|---|---|
| Half-spread h | 20,000 E6 = **2.0 points** | `M/packages/config/src/pool-terms.ts:95`; `BandBook.sol:247-261, 280-286` | ask = p + h + s; bid = p − h |
| Load surcharge s | ≤ 10,000 E6 = **1.0 point** | `pool-terms.ts:96`; `BandBook.sol:253` | s = 1 pt × reservedByExpiry ÷ maxExpiryReserved (opens only) |
| Probability bounds | 3% – 97% | `pool-terms.ts:97-98` | opens **and closes** are refused outside them |
| Exposure | 60% of the pool reserved | `pool-terms.ts:99`; `BandPool.sol:113-118` | capacity check on every fill |
| Per-expiry cap | testnet 500,000 TUSD; **mainnet $250** | `pool-terms.ts:111, 119` | shared by every market whose window ends that second |
| Stake | testnet $1–1,000; **mainnet $1–25** | `pool-terms.ts:112-113, 120-121` | per call |
| One-tap session | mainnet $25 / $100 / 15 min | `pool-terms.ts:122` | binds session keys only; an owner-signed intent sent straight to `commit` is bound only by the stake range |
| Bounds an admin can't exceed | h ≤ 5 pt; s ≤ 5 pt; min prob ≥ 1%; max ≤ 99%; exposure ≤ 80%; min prob > h | `MarketTypes.sol:112-117`; `BandPool.sol:94-103` | |
| σ | catalogue `annualVol`: BTC 0.50, ETH 0.65, SOL 0.85, i.e. measured × ~1.5 | `M/packages/config/src/markets/pyth.ts:1-3, 15` | one σ per series |
| Changing σ | `setSigma` bumps the **global** `configVersion` | `BandBook.sol:50-55`; `:76` (`WrongConfig`) | every open signed before the change reverts at commit or refuses at fill |
| Band menu | Range ±0.5σ√T; Moonshot and Crash at 1σ√T; entries never change | `catalog.ts:122-158`; `BandBook.sol:40-47` | widths are frozen in bps at listing |
| Mainnet listing | 136 series × 5 bands (Up, Down, Range, Moonshot, Crash) | `M/contracts/script/catalog/143.json` | not deployed yet (`poolSeed: 0`) |
| Fill timing | target = commit block time + 1 s; no trading in the last 20 s; 3 s minimum hold | `MarketTypes.sol:52-56` | |
| Client tolerance | limit = quote × 0.97 (opens on payout, closes on proceeds) | `M/packages/calls/src/constants.ts:4`; `use-call.ts:99, 116` | `REFUSE_SLIPPAGE` below it |
| Practice seed | 10,000,000 TUSD | `pool-terms.ts:127` | |

### 1.2 What a call costs as designed

These are BTC figures, from the repo's quote code: a $10 stake, filled at K at the window's start (τ = cadence − 3 s),
and the earliest close 4 s later. "Pool edge" is the pool's take for a *fairly priced* call, as a share of stake: h ÷
(p + h) if held to settlement, 2h ÷ (p + h) for a round trip.

| Band | Lane | p at K | Start PnL at h = 2.0 / 1.5 / 1.0 / 0.5 pt | Break-even (catalogue σ) | Break-even (realised σ 0.345) | Pool edge held / round trip at h = 2 |
|---|---|---|---|---|---|---|
| Up/Down | any | 50% | −7.7 / −5.8 / −3.9 / −2.0% | 1m 0.7 / 0.5 / 0.4 / 0.2 bp · 5m 1.6 / 1.2 / 0.8 / 0.4 · 15m 2.7 / 2.1 / 1.4 / 0.7 · 1h 5.4 / 4.1 / 2.7 / 1.4 | 1m 0.5 / 0.4 / 0.3 / 0.2 · 5m 1.1 / 0.8 / 0.6 / 0.3 · 15m 1.9 / 1.4 / 1.0 / 0.5 · 1h 3.8 / 2.8 / 1.9 / 1.0 | 3.8% / 7.7% |
| Range | 1m / 5m / 15m / 1h | 34.5 / 39.8 / 37.4 / 38.7% | −11.0 / −9.6 / −10.2 / −9.8% at h = 2; about −2.7% at h = 0.5 | **time at K**, not a move: 13 s / 57 s / 179 s / 702 s at h = 2 | 10 s / 48 s / 147 s / 579 s | 4.8–5.5% / 9.6–11.0% |
| Moonshot | 1m / 5m / 15m / 1h | 14.9 / 16.4 / 15.6 / 16.1% | −23.7 / −21.7 / −22.7 / −22.1% at h = 2; about −17%, −12% and −6% at h = 1.5, 1.0 and 0.5 | 1.3 / 2.4 / 4.2 / 8.2 bp at h = 2 | 1.5 / 2.6 / 4.6 / 8.8 bp | 10.8–11.9% / 21.7–23.7% |

- These reproduce 05's −7.7% (Up/Down) and about −22% (Moonshot).
- A calibrated σ makes Up/Down's break-even *smaller* in bps, because the probability becomes more sensitive.
- Because the band widths are frozen at listing, a calibrated σ also turns Moonshot into a 6.5–7.8% longshot. A flat
  2-point spread then costs it **−41% to −47%** at the start. That is the first argument for a spread that shrinks with p
  (§5).

### 1.3 What the pool actually earns: the model, not the spread

**Realised volatility versus the model** (annualised; Binance; 90 days unless stated; scripts `vol.mts`):

| | Model σ | 90-day realised (1m → 1h horizons) | 7-day | Median hour | Daily p10 / p50 / p90 / max | Hours above the model |
|---|---|---|---|---|---|---|
| BTC | 0.50 | 0.340–0.345 | 0.28–0.31 | 0.256 | 0.18 / 0.32 / 0.45 / 0.80 | 10.1% |
| ETH | 0.65 | 0.463–0.468 | 0.36–0.42 | 0.338 | 0.24 / 0.42 / 0.62 / 1.22 | 10.7% |
| SOL | 0.85 | 0.525–0.560 | 0.45–0.48 | 0.404 | 0.28 / 0.47 / 0.74 / 1.84 | 7.1% |

- Volatility clusters: the median hour is about half the model σ.
- At 1–60 s horizons BTC's realised σ rises from 0.259 to 0.329. The returns are positively autocorrelated (lag-1
  autocorrelation of 1-second returns: BTC 0.13, ETH 0.085, SOL 0.03). This is the momentum in §3.3.
- Standardised moves, ln(close ÷ spot) ÷ (σ_EWMA √τ), have a kurtosis of **12.7**:
  - the middle 68% lies within ±0.8σ (a normal curve says ±1.0σ);
  - the 1st and 99th percentiles sit at −2.55σ and +2.83σ (a normal curve says ±2.33σ).

**Real win rates against the model at the window's start** (entry at K; 90 days of BTC windows; `start.mts`):

| Lane (windows) | Up / Down: model → real | Range: model → real | Moonshot / Crash: model → real | Caller's return per $ at h = 2 / 1.5 / 1 / 0.5 pt |
|---|---|---|---|---|
| 1m (129,600) | 50 → 50.1 / 49.9% | 34.5 → **65.8%** | 14.9 → **4.9 / 4.7%** | Up/Down −3.8 / −2.9 / −2.0 / −1.0% · Range **+80 / +83 / +85 / +88%** · Moonshot −71 / −70 / −69 / −68% |
| 5m (25,920) | 50 → 49.8 / 50.2% | 39.8 → **71.1%** | 16.4 → **5.6 / 5.0%** | Up/Down −3.9 / −2.9 / −2.0 / −1.0% · Range **+70 / +72 / +74 / +77%** · Moonshot −70 / −69 / −68 / −67% |
| 15m (8,640) | 50 → 49.8 / 50.2% | 37.4 → **69.9%** | 15.6 → **4.9 / 4.3%** | Up/Down −3.9 / −3.0 / −2.0 / −1.0% · Range **+77 / +80 / +82 / +84%** · Moonshot −72 / −71 / −70 / −70% |
| 1h (2,159) | 50 → 50.6 / 49.4% | 38.7 → **71.8%** | 16.1 → **5.2 / 4.3%** | Up/Down −3.9 / −2.9 / −2.0 / −1.0% · Range **+77 / +79 / +81 / +83%** · Moonshot −71 / −71 / −70 / −69% |

- ETH and SOL look the same: Range wins 65.6–72.9% against a model 35–40%; Moonshot and Crash win 3.9–5.2% against
  15–16%.
- Standard errors are 0.1–1.1 points (n above).
- A Range call at K therefore pays **2.39×** (5m) for a 71% chance; a fair price would pay about 1.4×. Moonshot pays
  **5.4×** for a 5.6% chance; a fair price would pay about 18×.

**Mid-window Up/Down** (entries each minute inside 5m, 15m and 1h windows, and at 3/10/20/30/39 s inside 1m windows;
`calib.mts`). With today's σ, the deciles the model calls 50–70% (one side leading) **return +18% to +23% to the caller
at h = 1** (BTC and ETH, every lane). The underdog deciles lose more than that, so "all entries" averages −8% to −12%.
A strategic caller only buys the leader.

**In dollars, on mainnet's caps.** This is an expected-value estimate, not a measurement.
- A $25 Range call at K on a 1m lane buys $68.5 of payout, reserves $43.5 of the pool's money and is worth about +$20 to
  the caller.
- The $250 per-expiry cap admits about 5 such calls per minute boundary.
- That is about **$100 a minute** to one bot.
- The cap, the session caps and the 60% exposure rule slow the drain, but don't stop it. A bot signs its own intents and
  sends them straight to the permissionless `commit` (`BandBook.sol:63-72`; `SessionGrants.sol:135-162`), so the session
  caps don't apply to it.

**What fixes it**, tested out of sample (BTC 5m shown; other lanes and assets are similar; `calib.mts`, `calib2.mts`).
Columns are the caller's return per $ at h = 2 / 1 / 0.5 points.

| Pricing σ and curve | Up/Down, all entries | Range, all entries | Moonshot, all entries | Most generous Up/Down decile (h = 1) |
|---|---|---|---|---|
| Today: static σ 0.50, normal | −10.3 / −8.4 / −7.4 | **+43.5 / +46.7 / +48.3** (start +70 / +74 / +76) | −73 / −71 / −70 | **+18.9%** |
| Static realised σ 0.344, normal | −7.7 / −5.3 / −4.1 | +15.3 / +17.5 / +18.7 | −47 / −42 / −38 | +9.5% |
| 30-min EWMA σ ×1.0, refreshed each minute, normal | −5.7 / −3.0 / −1.5 | **+1.7 / +3.7 / +4.8** | −28 / −22 / −17 | +6.7% |
| EWMA ×1.2, refreshed every 15 min, normal | −8.2 / −5.9 / −4.7 | +10.3 / +12.6 / +13.7 | −47 / −43 / −40 | +7.1% |
| EWMA ×1.0 with a fat-tailed empirical curve (fitted on the first 45 days, tested on the last 45) | Up −1.2 / +2.2 / +4.0; Down −3.4 / −0.2 / +1.5 (mean −2.3 / +1.0 / +2.8) | **−4.1 / −2.1 / −1.0** | −20 / −10.5 / −4.8 | within noise |

- **The ×1.5 "margin" is not conservative.** It overcharges longshots and undercharges the middle (Range) and the
  favourites. A static σ is wrong in one direction or the other almost every hour, and a caller can see which.
- **After calibration, Up/Down at h = 1 still gives the caller about +1%** (5m). So h = 1 has no room left for the
  momentum in §3.3. h = 2 leaves the pool about +2.3%.
- **Moonshot and Crash stay the hardest to price.** One pooled curve misprices the tails by τ, so they need per-lane
  tables or should wait.

**Why this needs contract changes** (all can go into the mainnet deploy, which hasn't happened):

1. **σ that moves without refusing everything.**
   - Today each `setSigma` bumps the global version (`BandBook.sol:54`). Updating 54–136 series every minute would refuse
     every call in flight, and as separate transactions it would cost far more than one batched update (about 0.03 MON
     per update for 54 series — the next bullet; estimate).
   - **Option A (cheapest):** a keeper-signed "σ mark" (series, σ, minute) carried in `finalize`'s calldata. The
     contract checks the signer, freshness (≤ 2 min) and an admin-set floor and cap per series. The marginal cost is one
     signature check per batch.
   - **Option B:** a batched `setSigmas` with a version per series, so opens pin only `Params`. Opens are already
     protected by their payout limit. Cost: about 0.3M gas per update for 54 series, about 0.03 MON at 103 gwei; about
     3 MON a day at a 15-minute refresh (estimate).
2. **A fat-tailed curve.** Replace the 81-point Φ table (`BandMath.sol:21-55`) with a calibrated one fitted on Pyth
   history, per lane if needed.
3. **Band widths from realised σ** (drop the ×1.5) for any new listing.
4. **Until then:** mainnet lists Up/Down only. On testnet, setting σ to realised as a stopgap cuts Range from about +75%
   to about +25% (still a gift, but in practice money).

## 2. What the references charge

### 2.1 Short-dated prediction markets and the two sibling projects

| Venue | Product | A taker's cost per side at 50¢ | Shape | Notes | Source |
|---|---|---|---|---|---|
| **Polymarket** | BTC Up/Down 5m and 15m (order book) | **0.5¢ half-spread** (a 1¢ book in all 52 samples, 10 Oct 07:47–07:55 UTC) + fee **0.07 × p(1−p)** = 1.75¢ → **≈ 2.25 pt** | fee ∝ p(1−p); makers pay nothing; 20% of crypto fees go back to makers | $100 fills at the touch; $1,000 walks a median of about 2¢ (0–7.7¢). Fees on crypto began 5 Jan 2026 on 15m markets, then on all crypto timeframes | [fees](https://docs.polymarket.com/polymarket-learn/trading/fees), [maker rebates](https://docs.polymarket.com/developers/market-makers/maker-rebates-program), [The Block](https://www.theblock.co/post/384461/polymarket-adds-taker-fees-to-15-minute-crypto-markets-to-fund-liquidity-rebates), [Pine Analytics](https://pineanalytics.substack.com/p/polymarket-fee-rollout); live Gamma and CLOB API |
| **Kalshi** | KXBTC15M, KXETH15M | **0.5¢ half-spread** (BTC 1¢ in 29 of 29 samples; ETH 0.1–2¢) + **0.07 × C × P(1−P)** rounded up to the cent → **≈ 2.25 pt** | quadratic, multiplier 1 (series API) | settles on CF Benchmarks; 15-minute markets made about 80% of Kalshi's non-sports fees in the week to 5 Oct | [series API](https://api.elections.kalshi.com/trade-api/v2/series/KXBTC15M), [Allium (3 Sep 2026)](https://allium.so/blog/kalshi-fees-why-the-cost-peaks-near-50-cents/), [Bitcoin.com](https://news.bitcoin.com/kalshis-15-minute-gold-bets-top-ether-fast-markets-drive-fees/); PDF *unverified* (429) |
| **Owarine** (Canton S3) | binary windows, house quotes on a 1–999 tick grid | **3¢ half-spread** (30 ticks of 0.1¢) + ladder levels every 0.5¢ + a **1% fee charged on top of the stake** (refunded on a void) | flat in cents; the fee sits outside the stake | events and gap lanes 15¢; range reserve 12% over fair; parlay 15%; Boost premium 2% | `O/services/ops/src/actors/market-maker/seat/env.ts:68`; `pricer.ts:60`; `O/daml/abu-pm-main/daml/PM/Grant.daml:76`; `Leg.daml:3-9`; `O/packages/markets/src/tickets/params.ts:39-75`; `O/packages/core/src/market/committee-event.ts:67-68` |
| **Mitoshi** (CWF) | order-book windows with a house seed maker | **3¢ half-spread** (seed maker); 1.5¢ (earn quoter); **widened by the gap between the fast display price and the signed price**; maker vault minimum 2¢ | flat, plus a divergence cushion | a measured round trip at a 5m line was **−31%** (a book 17¢ wide). Range 12% over fair; parlay 12%; leverage premium 8% | `C/services/ops/src/actors/seed-maker/env.ts:56`; `earn-quoter/index.ts:31`; `guard.ts:52-80`; `C/contracts/deployments/42431/{range,parlay,leverage,maker}.json`; `C/docs/plan/acceptance/S23.md:38-41` |
| **Senryo today** | pool quote | **2 pt** + up to 1 pt of load | flat in points | | `pool-terms.ts:94-100` |

The short-dated markets with real volume cost a taker almost exactly what Senryo charges at 50%. They charge less away
from 50%, because the fee follows p(1−p).

### 2.2 Oracle-priced perps (the models for "ride the price")

| Venue | Open | Close | Spread | Holding cost | Against very short round trips | BTC max leverage | Source |
|---|---|---|---|---|---|---|---|
| **Tradash on Bulk** | 3.5 bps Bulk + 2 bps Tradash | 3.5 bps (no Tradash fee) | order book; the market order is capped at 10% slippage | Bulk's funding *(unverified)* | none seen | 40× (ETH 25×, SOL 20×, others 10×) | `T/SPEC-flow.md:120-125, 149, 166, 449, 481` |
| **gTrade** | 3.5 bps BTC/ETH; 5 core; 6 non-core | the same | 0.5 bp fixed per side on BTC/ETH, plus price impact from open interest and skew | funding (per second) + a borrow fee on the dominant side, `base × (effectiveOi/maxOi)^exp` | **closing fee ×30, decaying to ×1 over about 10 s**, "against round trips … on the short delay before a price move settles on chain" | up to 150× crypto (table) | [docs](https://docs.gains.trade/gtrade-leveraged-trading/fees-and-spread) |
| **Veranta** (ex-Avantis) | 4.5 bps taker / 1 bps maker, decided by whether the trade worsens or improves skew | the same | by notional and liquidity | net rate (funding + borrow) | **Upside Perps:** no open or close fee, **5–25% of profit** (you keep 75–95%, more at higher ROI); funding only, no borrow | 50× with fixed fees; Upside 250× (schedule) or 500× (assets page) | [fee schedule](https://docs.veranta.xyz/trading/fees/fee-schedule-by-asset-class.md), [Upside](https://docs.veranta.xyz/trading/upside-perps/mechanics.md), [profit share](https://docs.veranta.xyz/trading/upside-perps/profit-sharing.md), [net rate](https://docs.veranta.xyz/trading/fees/net-rate-funding-+-borrow.md) |
| **Ostium** | **10 bps** (docs) / **6 bps** (live subgraph) on BTC/ETH/SOL; stocks 3–6, indices 1–3, FX and gold 2–3 | none | bid/ask pricing | rollover = the underlying's carry + a 1–2%/yr premium | **early-close fee: 40 bps falling to 0 over 15 s, profitable closes only, capped at the profit**; $0.10 oracle fee per request | 200× | [fees](https://docs.ostium.com/traders/reference/fees), [markets](https://docs.ostium.com/traders/reference/markets), [liquidation](https://docs.ostium.com/traders/trading/liquidation) |

**Round-trip cost in bps of notional:** Tradash 9 · gTrade BTC 8 · Veranta 9 (taker) or 2 (maker) · Ostium 6–10. At 40×,
Tradash's 9 bps is 3.6% of margin.

## 3. Pool edge against the user's experience

### 3.1 The four flat half-spreads across the lanes (as built)

- **Up/Down at K**, every lane:
  - starting PnL −7.7 / −5.8 / −3.9 / −2.0% at h = 2.0 / 1.5 / 1.0 / 0.5;
  - pool edge 3.8 / 2.9 / 2.0 / 1.0% held, and 7.7 / 5.8 / 3.9 / 2.0% per round trip;
  - the real 90-day result matches that, because Up/Down at K is calibrated (§1.3);
  - break-even moves are in §1.2.
- **Range:** −11% to −10% at h = 2, falling to about −2.6% at 0.5. As built it **loses the pool 70–88%** at every h.
- **Moonshot:** −22% to −24% at h = 2, falling to about −6% at 0.5. As built it **wins the pool about 70%** at every h.

**Adverse selection, from §3.3:**

| Lane | Edge a 3-second momentum follower has after the fill (points a share) | h needed to cover it | Is h = 2 enough? |
|---|---|---|---|
| 1m | 2.5–4.5 (BTC strongest) | ≥ 3–4.5 | borderline |
| 5m | 0–2 (BTC ≈ 1 ± 1; ETH ≈ 2 ± 1.2) | ≥ 1.5–2 | yes |
| 15m | ≈ 0.6–0.9 (estimate: drift in bp × sensitivity) | ≥ 1–1.5 | yes |
| 1h | ≈ 0.3–0.45 (estimate) | ≥ 0.5–1 | yes |

### 3.2 The symmetric alternatives

Example: BTC 5m Up at K, $10, calibrated σ. "Shown" is the PnL the screen shows; "cash-out" is the real money today.

| Option | Starting PnL shown | Starting cash-out | Break-even | Pool edge held / 30-s round trip | Against a momentum bot | Contract change |
|---|---|---|---|---|---|---|
| Flat 2.0 pt (today) | −7.7% | −7.7% | 1.1 bp | 3.8% / 7.7% | 1m about even; 5m pool ahead | none |
| Flat 1.0 pt | −3.9% | −3.9% | 0.6 bp | 2.0% / 3.9% | 1m bot +2% to +4% a call; 5m about even | `setParams` only |
| **Fee on profit only** (φ = 8%, entry and exit at fair; Veranta Upside) | **0%** | **0%** | 0 bp (the fee comes only out of gains) | 4.0% / **≈ 0.8%** | the bot keeps 92% of its edge → the pool loses on 1m and probably on 5m | yes |
| **Entry fee on top of the stake + a tight exit** (2 pt a share as a fee, Owarine-style `charge = stake + fee`; exit at fair − 0.5 pt) | −1.0% (fee shown apart) | −1.0% vs stake | ≈ 0.7 bp including the fee | 4.0% / 5.0% | exits by informed callers are under-priced on 1m and 5m | yes |
| **Today's economics shown Tradash-style** | **$0.00** (PnL = shares × (p now − fair p at the fill); Fees row "$0.38 in · $0.38 out"; B/E tag) | −7.7% on the Cash out button | 1.1 bp (the B/E tag) | 3.8% / 7.7% | as today | **none** (fair p at the fill is in the `Filled` event, `BandBook.sol:274`) |
| **Recommended:** h(p) = max(0.25, 4·h50·p(1−p)) by lane, shown Tradash-style | $0.00 | 1m −11.3% · 5m −7.7% · 15m −5.8% · 1h −3.9% | 0.7 / 1.1 / 1.4 / 1.9 bp | 5.7 / 3.8 / 2.9 / 2.0% held | covers the measured momentum on 5m and longer; 1m borderline (Practice only) | yes (mainnet deploy) |

- **A fee on profit only** gives the cleanest "starts at zero". But it hands informed flow almost all of its edge, so
  Veranta pairs it with spreads and funding. Alone, it is unsafe on 1m and 5m.
- **An entry fee with a tight exit** helps scalpers. But momentum works on the way out too: a caller who sees the turn
  exits cheaply.
- **The display change gives most of the Tradash feeling at no economic or contract cost.**
  - It is what Tradash does: PnL at the mark, fees separate, B/E in the line (`T/SPEC-flow.md:166, 364, 449`).
  - It reverses part of 05's advice ("do not switch to a mid-price PnL"). That is acceptable only if the Cash out button
    always shows the exact amount and the pill says "PnL", not "cash out". **This is the owner's call.**

### 3.3 Adverse selection: what latency and fast feeds can still take

**Stale-quote picking: closed by design.**
- A commit fills at the unique print of the next second, priced at that print (`BandBook.sol:93, 247-262`). The quote on
  screen is only a limit.
- Knowing the current price is worth nothing unless you know something about the price *after* the fill print.

**Momentum through the fill: open, and measured** (Binance 1-second proxy; `momentum.mts`). The test:
- observe the last 1 s or 3 s of movement at second e;
- fill at the price d seconds later;
- take the momentum side of Up/Down;
- hold to the close.

| Lane, signal, delay | Wins vs model | Edge | Caller's return at h = 2 / 1 / 0.5 | Near K only (±0.3 bp), model-free |
|---|---|---|---|---|
| BTC 1m, 3 s, +1 s | 60.8% vs 56.3% | **+4.5 pt** | +2.2 / +4.4 / +5.5% | 53.7% (n = 3,597, SE 0.8) |
| BTC 1m, 3 s, +3 s | 60.7% vs 56.9% | **+3.8 pt** | +0.2 / +2.2 / +3.3% | 53.1% |
| BTC 1m, 1 s, +2 s | 56.7% vs 54.1% | +2.6 pt | −1.6 / +0.7 / +1.9% | 51.7% |
| ETH 1m, 3 s, +2 s | 59.5% vs 56.4% | +3.1 pt | −0.4 / +1.7 / +2.8% | 51.0% |
| SOL 1m, 3 s, +2 s | 59.9% vs 57.3% | +2.6 pt | −0.6 / +1.6 / +2.7% | 48.2% |
| BTC 5m, 3 s, +2 s | 54.7% vs 53.7% | +1.0 pt | −3.8 / −1.3 / +0.1% | 49.5% (n = 469, noise) |
| ETH 5m, 3 s, +2 s | 54.6% vs 52.6% | +2.0 pt (SE ≈ 1.2) | −0.9 / +1.8 / +3.3% | 50.3% |

- Delaying the fill by 1–3 s barely helps. After a move, BTC keeps drifting the same way by about 0.27–0.36 bp over
  the following minute (`latency.mts`).
- On a 1m call that drift is worth 2–4 points, because the price is about 8 points per bp near K with a calibrated σ.
- **Unverified:** Pyth's average of venues may show *more* autocorrelation than one exchange. Measure the same statistic
  on a week of archived 1 Hz Pyth prints before changing any spread.

**Lead over the fill print: unmeasured, and it would be costly if it existed.**
- If Pyth's print stamped t reflects the exchanges' price at t − δ, a bot that lands its commit late in a second knows
  up to δ − (submission time) of the fill print's future.
- A direct `commit` (permissionless) can land about 0.3–0.4 s after the bot sees a price (one Monad block).
- Value of a full 1-second lead, BTC (`latency.mts`):
  - **1m, τ 57 s:** usable on 14% of seconds, worth +8.2 points a share each time at h = 2;
  - **1m, τ 21 s** (just before the lockout): +13.4 points;
  - **5m:** +3.6 points;
  - **15m:** +2.0 points.
- **So δ must stay below about 0.5 s on 1m.**
- **Remedies if it doesn't:**
  - `FILL_DELAY_SEC` 2 instead of 1: one more second of wait. Easy, but a contract constant.
  - Pyth Pro's 200 ms channel ($2,500/month, 04).
  - Mitoshi's guard: widen or pull quotes when the fast price and the signed price diverge by more than kσ
    (`C/services/ops/src/actors/seed-maker/guard.ts:52-80`). For Senryo that means the relay declining to relay, which
    does not stop a bot committing directly. Only the contract can enforce it.

**A faster display feed** (Coinbase/Kraken trades, 04 decision 4):
- **Doesn't reach the contract.** Fills still price at a future Pyth print, so it creates **no stale-quote arbitrage**.
- **Does let humans see the move Pyth will print a fraction of a second later.** That makes the momentum above easier to
  follow by hand, which the spread has to cover anyway.
- **Use it** for the line and for the on-screen quote. Adjust it by its measured basis to Pyth, so the quote predicts
  the fill and refusals fall. Label it as display, like Mitoshi's "Signed" marker (03).
- **Never use it** for fills or settlement.

**The 3% tolerance** (`tol.mts`). This is how often an Up at K is refused, from adverse BTC moves between the quote and
the fill print (2 s / 3 s; calm week):

| Lane | Move the 3% absorbs (catalogue σ / realised σ) | Refused at 2 s / 3 s (catalogue σ) | Refused (realised σ) |
|---|---|---|---|
| 1m | 0.27 / 0.19 bp | 10% / 14% | 12% / 15% |
| 5m | 0.62 / 0.43 bp | 7% / 10% | 9% / 12% |
| 15m | 1.08 / 0.75 bp | 4% / 6% | 6% / 8% |
| 1h | 2.16 / 1.49 bp | 1% / 2% | 2% / 4% |

- This is lower than 05's estimate (¼ to ⅓), because BTC's 2-second moves were small this week. A 2-second adverse move
  is 0.31 bp at p90 and 2.2 bp at p99.
- The fill price doesn't depend on the limit, so the pool is indifferent to it.
- Set the limit as the quote at a spot worse by about the p99 2-second move. Refusals become about 1%, and the slip
  shows honestly on the receipt, like Tradash's 10% market cap (`T/SPEC-flow.md:149`).

## 4. Ride the price (linear mode)

### 4.1 What the data says about adverse selection in a linear product

From `linear.mts` (1-second bars; BTC 4 days, ETH and SOL 2 days):

| | BTC | ETH | SOL |
|---|---|---|---|
| Momentum follower (top 10% of 3-second moves; fill at the next print; hold 5 / 15 / 60 s) | 0.21 / 0.29 / 0.11 bp gross per round trip | 0.01 / 0.09 / −0.16 | 0.13 / 0.23 / 0.06 |
| E\|1-second move\| (the most a 1-second lead is worth) | 0.13 bp | 0.25 bp | 0.50 bp |
| Largest 2-second move: p99 / p99.99 / max | 2.9 / 11.8 / 27.7 bp | 4.3 / 19.8 / 38.6 bp | 5.5 / 19.2 / 33.9 bp |
| Knocked out within 1 h, no fees: 40× / 100× / 250× | 0.0 / 2.2 / 15.6% | 1.1 / 5.0 / 22.4% | 1.4 / 11.5 / 37.6% |
| Best 1-hour / 4-hour excursion over 90 days, p99.9 (max) | 2.6% (5.4) / 5.1% (6.8) | 4.0% (9.1) / 8.7% (11.1) | 4.0% (11.1) / 7.0% (11.1) |

**The same ~0.3 bp of drift scales very differently:**
- on a 1-minute binary, about 1,000× geared, it costs the pool 2–4 points a share;
- in a 20× linear position it is 0.3 × 20 = **6 bp of margin**.

So a fee of a few bps a side dwarfs every measured form of adverse selection. **The linear mode is much more robust to
fast feeds than the binary.** What's left is jumps and oracle staleness (RedStone's 10 s grid; equities at the open and
close).

### 4.2 Recommendation for the linear mode

**Fees** (on notional, at fill):
- **5 bps a side** on BTC, ETH and SOL. That is about Tradash's 5.5 / 3.5, gTrade's 3.5 + 0.5, Veranta's 4.5 and
  Ostium's 6–10.
- **8 bps** on other Pyth crypto.
- **10 bps** on RedStone markets and equities (the 10 s grid; session gaps).
- **Maker rate 2 bps** when the trade *reduces* the pool's net skew in that market (Veranta's skew-based maker/taker).
- **Early-close fee:** 20 bps of notional at the open, falling linearly to 0 at 15 s. Profitable closes only, never more
  than the profit (Ostium's rule at half its rate; gTrade's ×30 decay is the same idea).
- Keep the 3-second minimum hold.
- **No extra spread:** the fill at the next print is the spread.

**Showing it:**
- PnL = (mark − entry) × size, starting at $0.00. Fees go in a Fees row and in the balance, as Tradash does.
- B/E = entry × (1 ± 10 bps).
- Round trip at 20×: 2% of margin. The value written into the receipt is exact.

**Holding cost:**
- **Phase 1:** positions end at a set time (the next 4-hour boundary, or a stock's session close) and settle at that
  print, as 05 option (c) proposed. **No funding needed.** Rolling means re-opening, and paying the fee again.
- **Phase 2**, only if positions become open-ended: a **borrow fee paid to the pool by the heavy side only**. For
  example 0.01%/h × (net OI ÷ net cap)², zero when the market is balanced. That is gTrade's formula shape. It is not a
  trader-to-trader funding rate, because the pool is the counterparty.

**Leverage and caps** (each position fully reserved, D-264):

| Market | Mainnet | Testnet | Reference |
|---|---|---|---|
| BTC, ETH | ≤ 20× | 40× BTC, 25× ETH | Tradash 40/25; gTrade 150; Ostium 200; Veranta 50 (fixed fee) |
| SOL and other Pyth crypto | ≤ 10× | 20× SOL, 10× others | Tradash 20/10 |
| RedStone markets, equities | ≤ 5× | 10× | 10 s grid; gaps at the open |

- **Value** = clamp(m + m·L·r − fees, 0, m·(1 + c)), with **c = 2**: profit capped at 2× margin, a 10% move at 20×.
  - BTC's best 4-hour excursion in 90 days was 6.8%; ETH's 11.1%.
  - The cap almost never binds, and it reserves only 2m per position.
- **Knock-out** at a recorded print where the value reaches 0. Gaps cost the pool nothing: the value floors at 0 and
  the caller loses the margin. 1 Hz prints make the knock-out slightly kinder than a continuous one.
- **Capacity:** Σ m·c ≤ 60% of the pool (today's `maxExposureBps`). So total margin ≤ 30% of the pool, and notional
  ≤ 6× the pool at 20×.
- **Net open interest per market:**
  - mainnet ≤ 0.5× the pool's value in notional. A p99.9 1-hour BTC move (2.6%) then costs ≤ 1.3% of the pool;
  - ≤ 2× the pool across all markets;
  - testnet 2× per market.

**Expected edge:** 2 × 5 bps − ~0.3 bp ≈ **9.7 bps of notional per round trip**, about 1.9% of margin at 20×. Before
any skew drift, which has an expected value of zero and is bounded by the net cap.

## 5. Recommendation

### 5.1 Prediction calls

1. **Price the bands correctly before tuning the spread.** Mainnet deploy work, no wasted MON:
   - a per-series σ that follows a 30-minute EWMA of 1-minute Pyth returns (×1.0–1.1, with a floor and cap per series),
     delivered without a global version bump (Option A in §1.3);
   - a calibrated fat-tailed probability table;
   - band widths from realised σ.

   **Until that ships, mainnet lists Up and Down only.** Edit `143.json` before S9: menu entries can't be removed later.
2. **The spread curve:** h(p) = max(0.25 pt, 4·h50·p(1−p)) per series, the same on open and on close. Keep the 1-point
   load surcharge.

   | Lane | h50 | Up/Down at K: start · B/E · pool held / round trip | Range at K: start · B/E | Moonshot: start · B/E |
   |---|---|---|---|---|
   | 1m (Practice only) | 3.0 pt | −11.3% · 0.7 bp · 5.7 / 11.3% | −14.8% · 17 s at K | −18.7% · 0.8 bp |
   | 5m | 2.0 pt | −7.7% · 1.1 bp · 3.8 / 7.7% | −9.7% · 58 s | −12.7% · 1.1 bp |
   | 15m | 1.5 pt | −5.8% · 1.4 bp · 2.9 / 5.8% | −7.2% · 133 s | −9.6% · 1.3 bp |
   | 1h | 1.0 pt | −3.9% · 1.9 bp · 2.0 / 3.9% | −4.9% · 366 s | −6.5% · 1.7 bp |

   - These are BTC figures with calibrated σ 0.345 and bands re-derived from it (`proposal.mts`).
   - "Start" is the real cash-out. The screen shows $0.00 (item 3).
   - **If the contracts can't change, keep the flat 2.0 points.** Don't cut to 1.0: §1.3 shows about +1% of model error
     already in the caller's favour at 1 point, and §3.3 shows momentum on top of that.
3. **Show PnL Tradash-style:**
   - PnL is counted from the fair price at the fill (from `Filled.probE6`), so it starts at $0.00 and moves with the
     price;
   - a Fees row shows the spread paid in and the spread due out;
   - a B/E tag on the chart;
   - the exact cash-out on the Cash out button.

   This partly reverses 05's advice and is the owner's call. It works with the current contracts at any spread.
4. **Set the slippage limit in price terms** (BTC 3, ETH 4.5, SOL 5.5 bp), not 3% of the quote.
5. **Feeds:** the fast display feed for the line and the quote (basis-adjusted); Pyth for fills. **Measure δ (Pyth vs
   the exchanges) and Pyth's own 1–3 s autocorrelation** on a week of archived prints before lowering any h50. If δ is
   above about 0.5 s, raise `FILL_DELAY_SEC` to 2 in the same contract change.

### 5.2 Ride the price

| | Recommendation |
|---|---|
| Fees | 5 / 8 / 10 bps a side by class; 2 bps maker when reducing skew; early-close fee 20 → 0 bps over 15 s (profits only, capped at profit); 3 s minimum hold; no extra spread |
| Holding | Fixed end time (≤ 4 h, or session close): no funding. Later, a heavy-side borrow fee to the pool |
| Leverage | Mainnet 20× BTC/ETH, 10× other crypto, 5× RedStone and equities; testnet 40 / 25 / 20 / 10 |
| Solvency | Profit cap 2× margin, fully reserved; Σ reserve ≤ 60% of the pool; net OI ≤ 0.5× the pool per market and 2× in total (mainnet) |
| Display | PnL = (mark − entry) × size from $0.00; fees apart; B/E at entry × (1 ± 10 bps) |
| Expected edge | ≈ 9.7 bps of notional per round trip (≈ 1.9% of margin at 20×) |

## 6. What to keep configurable per network

Pricing should be **the same on both networks**, so Practice rehearses the real game. Only sizes, lanes and limits
differ.

| Setting | Where today | Testnet | Mainnet |
|---|---|---|---|
| σ source, refresh, multiplier, floor and cap per series | catalogue `annualVol` (static) | EWMA 30 min ×1.0, refreshed each minute | the same; floor about 0.6× the 90-day RV |
| Probability table | `BandMath.CDF` constant | calibrated table | the same |
| h50 per series (or a flat h until the redeploy) | `PRICING.halfSpreadE6` (global) | flat 2.0 now; then 3.0 / 2.0 / 1.5 / 1.0 by lane | 2.0 / 1.5 / 1.0 (no 1m at launch) |
| Load surcharge max | `maxSurchargeE6` | 1 pt | 1 pt |
| Probability bounds | 3–97% | the same | the same |
| Band menu per series | `bandMenu` → catalogue JSON | all five (practice) | **Up/Down only** until calibrated |
| Lanes | catalogue `cadences` | 1m, 5m, 15m, 1h | 5m, 15m, 1h at launch |
| Stake, per-expiry cap, exposure | `pool-terms.ts` | $1–1,000; 500k; 60% | $1–25; $250 (resize with the seed); 60% |
| Session caps | `pool-terms.ts` | $1,000 / $10,000 / 60 min | $25 / $100 / 15 min |
| Client slippage | `TOLERANCE_BPS` (3%) | price-space p99 of a 2 s move | the same |
| `FILL_DELAY_SEC` | contract constant (1 s) | 1 (2 if δ > 0.5 s) | the same |
| Linear fees, maker rate, early-close schedule | new | 5 / 8 / 10 bps; 2; 20 → 0 over 15 s | the same |
| Linear leverage, profit cap, net-OI caps, end time | new | 40 / 25 / 20 / 10×; 2×; 2× pool; 4 h | 20 / 10 / 5×; 2×; 0.5× per market; 4 h |
| Pool seed | `TESTNET_POOL_SEED`; `143.json poolSeed` | 10M TUSD | sized at S9; every cap above scales with it |

## 7. Questions for the owner, in plain words

1. **Launch real money with Up and Down only, and add Range, Moonshot and Crash once the pricing is fixed?** Today Range
   pays as if it wins 40% of the time and actually wins about 70%. Moonshot pays as if it wins 16% and wins about 5%.
2. **Show PnL the way Tradash does?** It would start at $0.00 and count from the fair price when your call filled. The
   spread would show as a fee, and the Cash out button would always show the exact amount you'd get.
3. **Instead of one flat 2-point spread, charge by lane?** 2 points for 5-minute calls, 1.5 for 15-minute, 1 for hourly.
   Longshots would pay less. 1-minute calls would stay in Practice until we've measured them on Pyth's own prices.
4. **For "ride the price" with real money:** 5 bps a side on BTC/ETH, at most 20× (40× in Practice), positions closing
   at a set time (4 hours or less), and profit capped at twice the margin. Is that the shape you want?

## Sources

- **Repo:** `M/packages/config/src/pool-terms.ts`, `M/packages/calls/src/constants.ts`, `M/packages/calls/src/use-call.ts`,
  `M/contracts/src/markets/{MarketTypes,BandBook,BandPool,SessionGrants}.sol`, `M/packages/core/src/market/{band-math,band-quote}.ts`,
  `M/packages/config/src/{catalog.ts,markets/pyth.ts}`, `M/contracts/script/catalog/{143,10143}.json`, `M/docs/plan/decisions.md`
  (D-261–D-264), and replan studies 00, 04 and 05.
- **Siblings:** `O/…/seat/{env,pricer}.ts`, `O/daml/abu-pm-main/daml/PM/{Grant,Leg,Quote}.daml`, `O/packages/markets/src/tickets/params.ts`;
  `C/services/ops/src/actors/{seed-maker,earn-quoter}/*`, `C/contracts/deployments/42431/*.json`, `C/docs/plan/acceptance/S23.md`;
  `T/SPEC-flow.md`.
- **Prediction markets:** [Polymarket fees](https://docs.polymarket.com/polymarket-learn/trading/fees) ·
  [Polymarket maker rebates](https://docs.polymarket.com/developers/market-makers/maker-rebates-program) ·
  [The Block on Polymarket's 15m fees](https://www.theblock.co/post/384461/polymarket-adds-taker-fees-to-15-minute-crypto-markets-to-fund-liquidity-rebates) ·
  [Pine Analytics fee rollout](https://pineanalytics.substack.com/p/polymarket-fee-rollout) ·
  [Kalshi KXBTC15M series API](https://api.elections.kalshi.com/trade-api/v2/series/KXBTC15M) ·
  [Allium on Kalshi fees](https://allium.so/blog/kalshi-fees-why-the-cost-peaks-near-50-cents/) ·
  [Bitcoin.com on Kalshi 15-minute fees](https://news.bitcoin.com/kalshis-15-minute-gold-bets-top-ether-fast-markets-drive-fees/) ·
  live books sampled 10 Oct 07:47–07:55 UTC from `gamma-api.polymarket.com`, `clob.polymarket.com` and
  `api.elections.kalshi.com`.
- **Perps:** [gTrade fees and spread](https://docs.gains.trade/gtrade-leveraged-trading/fees-and-spread) ·
  [Veranta fee schedule](https://docs.veranta.xyz/trading/fees/fee-schedule-by-asset-class.md) ·
  [Veranta Upside mechanics](https://docs.veranta.xyz/trading/upside-perps/mechanics.md) ·
  [Veranta profit sharing](https://docs.veranta.xyz/trading/upside-perps/profit-sharing.md) ·
  [Veranta Upside assets and leverage](https://docs.veranta.xyz/trading/upside-perps/assets-leverage.md) ·
  [Veranta net rate](https://docs.veranta.xyz/trading/fees/net-rate-funding-+-borrow.md) ·
  [Ostium fees](https://docs.ostium.com/traders/reference/fees) · [Ostium markets](https://docs.ostium.com/traders/reference/markets) ·
  [Ostium liquidation](https://docs.ostium.com/traders/trading/liquidation) · the Ostium subgraph (`builder.prod.bedrock.ostium.io`, read 10 Oct).
- **Market data:** Binance public klines (`data-api.binance.vision/api/v3/klines`): BTC/ETH/SOL 1m bars for 90 days;
  1s bars, BTC 4 days, ETH and SOL 2 days. Scratch scripts (not committed): `vol`, `start`, `calib`, `calib2`, `momentum`,
  `latency`, `tol`, `ux`, `pricespace`, `proposal`, `linear`, `horizon`, `sampler` (`.mts`).

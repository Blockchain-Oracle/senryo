# Contracts and live PnL: can Senryo give the Tradash experience? (10 Oct 2026)

Read-only research for the 10 Oct replan. The owner asked: "even the way the contract was designed, maybe you have to
replan — it was supposed to go through the [Tradash] aspect so that you'll be able to see your live PnL as it's going
in real time." The reference products are Tradash (https://www.tradash.xyz) and how Owarine followed it.

## What I could not check (read this first)

- **Tradash.** I had no live session this turn and placed no orders. Tradash facts come from the 7 Oct sibling study
  (`canton-season3/context/13-revamp/TRADASH-FIDELITY.md`, `tradash/SPEC-flow.md`, `tradash/LIVE-observations.md`)
  and from Senryo's `docs/design/reference-study-2026-10-07-uglycash/tradash.md`. Both studies say they took no
  latency or live-fill measurements (`tradash.md:11`).
- **Production data.** I did not query the relay's refused intents or any cash-out timings.
  - Close latency below is inferred from the measured *open* path. Both go through the same commit → `finalize` path
    (`services/api/src/relay/fills.ts:9-13`).
  - The slippage-refusal rates in §4.6 are a model estimate, not a measurement.
- **Chain state.** I did not read the deployed v2 `BandReserve` (`0x72E4…9D04`). I assume its params equal
  `contracts/script/catalog/10143.json` (`halfSpreadE6: 20000`, line 113), which the deploy reads
  (`contracts/script/DeployMarkets.s.sol:106-121`).
- **Tests.** I ran none.
- **How the numbers in §4 were made.** I ran the repo's own quote pass (`packages/calls/src/quote.ts` `quoteTick`,
  bit-exact with `BandMath`) under Node from a scratch script that is not committed.
  - Inputs: BTC (annual σ 0.5, `packages/config/src/markets/pyth.ts:15`), K = 100,000, $10 stake, testnet terms.
  - Percentages do not depend on K.
- **Estimates.** Effort and gas figures for the options are estimates. Gas uses the gas actually charged per
  transaction in the 10 Oct broadcast (`contracts/broadcast/DeployMarkets.s.sol/10143/run-latest.json`) at 103 gwei.

## Short answer

1. **The contracts already support a live, executable PnL that moves tick by tick.**
   - A call's cash-out value depends only on spot, time left and K, through `BandMath.probE6`. Both apps recompute it on
     every price tick with the contract's own maths and show it.
   - The value is `shares × (probability − half-spread) − stake`, shown in the chart pill and on the Cash out button.
   - This is what Owarine did for "the Tradash aspect" (live exit value against cost). Senryo does it natively and
     faster: about 2 s to close against Owarine's 11–14 s. Its take-profit, stop and trail are on chain.
2. **It still doesn't feel like Tradash**, for five reasons. The first two are inherent to a prediction; the rest are
   fixable.
   1. A binary's PnL is non-linear and moves with time even when the price stands still. Near the line it is about
      500–1,100× as sensitive as the stake (Tradash BTC: 40×). It is capped and it saturates.
   2. Positions end with their window. Nothing trades in the last 20 s. The default 1m lane is locked 33% of the time,
      and a position lives at most about 39 s.
   3. PnL opens at −7.7% (Up/Down) to about −22% (Moonshot), because the user crosses the 2 pp half-spread on the way
      in and again on the way out.
   4. A 3% slippage limit set against that sensitivity likely bounces about a quarter (5m) to a third (1m) of taps near
      the line. This is an estimate.
   5. Display bugs and gaps:
      - a deep winner shows **−$stake**;
      - the colour follows "would win", not the PnL sign;
      - there is no break-even tag, ROI, equity or one-tap Trail;
      - the held call disappears from the terminal when its window rolls.
3. **Recommendation**
   - Keep the band contracts and finish the v2 deploy as it is.
   - Do the presentation fixes (a) on both apps, plus the config-only spread change (b1).
   - Change contract code only if a `BandReserve` redeploy happens anyway.
   - A linear, Tradash-literal instrument (c) is a new product line and reverses D-256. If the owner wants it, build it
     *beside* `BandReserve`, not instead of it. The question for the owner is at the end.

---

## 1. How Senryo's contracts work today

### 1.1 What a call is

- **A window.** Each series (market × cadence of 1m, 5m, 15m or 1h) has clock-aligned windows `[start, expiry)`
  (`Windows.sol:111-132`).
  - Each window opens on the unique print at `start`, which is **K**, and closes on the unique print at `expiry`.
  - Prints are stored once per `(verifier, feed, instant)`, and anyone may record one (`Windows.sol:152-190`).
- **A band.** A call is a band around K, taken from the series' fixed menu (`MarketTypes.sol:62-66`;
  `packages/config/src/catalog.ts:147-158`):

  | Band | Wins when the close print is… |
  |---|---|
  | Up | above K |
  | Down | below K |
  | Range | within K ± ½σ√T |
  | Moonshot | above K + 1σ√T |
  | Crash | below K − 1σ√T |

- **A ticket** (`MarketTypes.sol:185-200`) holds:
  - `stake`: the remaining basis;
  - `payout`: the remaining $1 shares, each paying $1 if the band wins;
  - `entryE8`: the fill print;
  - `entryProbE6`: the price paid per share.
- **Settlement rules** (`BandMath.sol:127-141`): Up and Down refund on a tie at exactly K. Range is inclusive.
  Moonshot and Crash exclude their strike.

### 1.2 How it is priced

- **Probability.** `probE6 = P(close in band | spot now, τ)` uses a log-normal Φ with σ√τ (`BandMath.sol:107-123`).
  - Φ comes from an 81-point table (`BandMath.sol:21-55`).
  - σ√τ is floored at 5 s (`BandMath.sol:69-72`; `MIN_SECONDS_LEFT`, `MarketTypes.sol:58`).
  - σ per series is set on chain (`BandBook.sol:50-56`). It comes from the catalogue's `annualVol`
    (`catalog.ts:137-139`), which is measured volatility × 1.5 (`pyth.ts:2-3`).
- **The price paid on open** (`BandBook.sol:250-261`), with h = half-spread and s = surcharge:
  - price per share = **probability + h + s**;
  - payout = ⌊stake ÷ price⌋ shares (`BandMath.sol:146-148`);
  - refused if:
    - the probability is outside 3–97%;
    - the price is $1 or more;
    - the pool would front nothing (`payout ≤ stake`);
    - the payout is below the signed limit;
    - or the pool lacks capacity.
- **The surcharge** = `maxSurchargeE6 × reservedByExpiry[expiry] ÷ maxExpiryReserved` (`BandBook.sol:253`). It reaches
  1 pp when that expiry's cap is full.
- **The bounds** an admin can never exceed are compile-time (`MarketTypes.sol:112-117`). The live values are config
  (`packages/config/src/pool-terms.ts:94-124`):
  - h = 2 pp;
  - surcharge ≤ 1 pp;
  - probability 3–97%;
  - exposure ≤ 60% of the pool;
  - per-expiry reserve cap: 500,000 Test USD on testnet, $250 on mainnet;
  - stake $1–$1,000 on testnet, $1–$25 on mainnet.

### 1.3 Commit, then fill at the next print (D-261)

1. **Commit.** A signed intent commits on chain (`BandBook.sol:63-131`).
   - Opens escrow the stake now.
   - The target is the commit block's timestamp + `FILL_DELAY_SEC` = 1 s (`BandBook.sol:93`, `MarketTypes.sol:54`).
2. **Finalize.** Anyone may call `finalize(target, ids, proof)`. It records the unique print for `target` and fills
   every pending open or close at that print (`BandBook.sol:203-216`).
   - For Pyth, the unique print is the first update in `[t, t+5 s]` (`PythPrintVerifier.sol:51-89`;
     `pool-terms.ts:19-24`).
   - For RedStone, it is the next point on a 10 s grid (`pool-terms.ts:31-44`).
3. **Refund.** With no print within admission (300 s Pyth, 900 s RedStone), the commit is refunded (`BandBook.sol:220-244`).
4. **Relay batching.** The relay batches fills per feed and instant and sends `finalize` the moment the print streams
   in (`services/api/src/relay/fills.ts:9-13, 54-80`).
5. **Measured tap → fill:**
   - one-tap 1.26 s (`docs/plan/STATUS.md:76`);
   - 2.0–2.55 s on production journeys (`STATUS.md:129`; `docs/plan/ids-and-txs.md:127`);
   - 4.5 s once, through a session key (`ids-and-txs.md:127`).
   - Monad blocks are about 300 ms (`docs/research/pivot/monad-stack.md:8`).

### 1.4 Cash-out at the bid

- **Conditions** (`BandBook.sol:116-148`): the ticket is filled, no close is pending, the window is still trading, and
  `block.timestamp ≥ filledAt + MIN_HOLD_SEC` (3 s; `BandBook.sol:134-141`, `MarketTypes.sol:56`).
- **The fill** (`BandBook.sol:280-319`):
  - bid = **probability − h**, with the probability bounds checked as for opens (`:284-286`);
  - proceeds = ⌊shares × bid⌋ (`BandMath.sol:151-153`);
  - the basis leaving is rounded up (`BandMath.sol:157-160`);
  - the pool keeps `shares − proceeds` of the escrow (`:298`).
- **Partial cash-outs** are linear in shares.
- **The limit** is the minimum proceeds. A miss gives `REFUSE_SLIPPAGE` and the position stays open (`:292-293`).

### 1.5 Exits on chain (D-292)

- `setExit` stores take-profit, stop-loss, a floor and a trail, all as a share's bid (`ExitOrders.sol:61-80`;
  `MarketTypes.sol:222-229`).
- `fireExit` is permissionless and `fireTrail` needs the EXIT role (`BandBook.sol:153-184`). Both pend a full close at
  the next print, and the fill re-checks the exit against that print's bid (`BandBook.sol:289-294`).
- The api watcher prices every armed exit each second (`services/api/src/relay/constants.ts:21`;
  `packages/core/src/market/exits.ts:24-31`).

### 1.6 Lockout, settlement and payouts

- **Lockout.** Opens and closes stop when `now + 20 s ≥ expiry` (`BandBook.sol:186-196`; `LOCKOUT_SEC`,
  `MarketTypes.sol:52`). A window cannot be opened inside that span either (`Windows.sol:115`). A pending fill is also
  refused once `now ≥ expiry` (`BandBook.sol:321-330`).
- **Resolution.** `Windows.resolve` needs both boundary prints and the cross-check, when the policy has one
  (`Windows.sol:197-219`). `voidExpired` voids the window when a print never lands (`:223-231`).
- **Settlement.** `BandReserve.settleWindow` decides every used band at once (`BandReserve.sol:63-97`):
  - a win makes its payout payable;
  - a loss returns the escrow to the pool;
  - a tie or void refunds the basis.
- **Payouts.** `claimFor` pays in batches of 32, and anyone may crank it (`BandReserve.sol:102-127`).

### 1.7 The pool ledger

- `balance ≥ liquid + reserved + escrowedStakes + committedStakes + payableTotal + totalOwed`. This is rechecked after
  every money path (`BandPool.sol:17-23, 147-157`).
- A fill reserves `payout − stake` (`BandPool.sol:121-127`). Capacity is the free liquidity, then exposure ≤ 60%, then
  the per-expiry cap (`BandPool.sol:113-118`).
- `reservedByExpiry` is keyed by the expiry *second*, so every market and cadence ending on that boundary shares one
  cap (`BandPool.sol:41, 117`).

### 1.8 Parlays, duels, events: no live executable value

- **Parlays** have no cash-out (`ParlayBook.sol:20-27`).
- **Duel picks** are opens the arena owns, with no close path (`DuelArena.sol:208-224`).
- **Events** are parimutuel and have no cash-out (`EventBook.sol:4-7`).
- Only single calls have a mark-to-bid value.

### 1.9 Constants that shape live PnL

| Constant | Value | Source | Effect |
|---|---|---|---|
| `LOCKOUT_SEC` | 20 s | `MarketTypes.sol:52` | no open or close in the last 20 s |
| `FILL_DELAY_SEC` | 1 s | `MarketTypes.sol:54` | fills at the print of commit + 1 s |
| `MIN_HOLD_SEC` | 3 s | `MarketTypes.sol:56` | no cash-out for 3 s after the fill print |
| Pyth grace / admission | 5 s / 300 s | `pool-terms.ts:19-24` | the fill print falls in `[t, t+5 s]` |
| RedStone grid / admission | 10 s / 900 s | `pool-terms.ts:31-44` | the next print may be up to 10 s away |
| `halfSpreadE6` | 20,000 (2 pp); bound 50,000 | `pool-terms.ts:95`; `MarketTypes.sol:112` | entry ask and exit bid |
| `maxSurchargeE6` | 10,000 (1 pp); bound 50,000 | `pool-terms.ts:96`; `MarketTypes.sol:113` | up to +1 pp on a loaded expiry |
| min / max probability | 3% / 97% | `pool-terms.ts:97-98` | refused outside, for opens **and closes** |
| `maxExposureBps` | 6,000 | `pool-terms.ts:99` | at most 60% of the pool reserved |
| `maxExpiryReserved` | 500,000 Test USD / $250 | `pool-terms.ts:111, 119` | room per expiry second |
| stake | $1–1,000 / $1–25 | `pool-terms.ts:112-113, 120-121` | |
| Client slippage | 3% of the quote | `packages/calls/src/constants.ts:4`; `use-call.ts:99, 116` | open and close limits |
| Stream frame gap | 125 ms (≤ 8 Hz per feed) | `services/api/src/prices/constants.ts:20` | tick rate the apps see |

## 2. How the apps show a position's value today

- **One pass per tick, shared by both apps.** `quoteTick` (`packages/calls/src/quote.ts:201-272`) runs on every tick of
  the market. Both apps subscribe to the price book and write the result into live values, with no React render per
  tick:
  - web: `apps/web/src/features/terminal/useLiveQuote.ts:67-107`;
  - phone: `apps/mobile/src/features/terminal/useLiveQuote.ts:57-98`.
- **The formula** (`quote.ts:236-238`):
  - `close = quoteClose(band, {K, σ, τ = expiry − (now + 1)}, spot, payout)`;
  - `pnl = close.proceeds − stake`, where `proceeds = ⌊payout × (prob − h) ⌋` (`packages/core/src/market/band-quote.ts:55-60`).
  - **So yes: the PnL is the bid × shares minus the stake, recomputed tick by tick and bit-exact with the fill rule.**
    τ uses `now + FILL_DELAY_SEC` to match the fill (`quote.ts:203`; `BandBook.sol:332-335`).
  - `stake` and `payout` are the ticket's *remaining* basis and shares, so realised partial cash-outs are not included.
- **Where the PnL shows:**
  - the chart pill's second row (`overlay.pnlText`, `quote.ts:254-257`), drawn with rolling digits
    (web `chart/chart-engine.ts:116-119, 169-196`; phone `chart/LiveChart.tsx:125`, `chart/draw.ts:180-241`);
  - the Cash out button's live value (web `CallPanel.tsx:174-186`; phone `CallPanel.tsx:244-259`);
  - the reaction engine reads ROI as `pnl ÷ stake` (`quote.ts:238-252`).
- **Colour.** The chart is coloured by "would this band win if it closed now" (`bandOutcome` vs K, `quote.ts:255`;
  `chart-engine.ts:169`; `draw.ts:180`), not by the PnL sign.
- **Which position.** The terminal shows only the caller's ticket in the *current* window (`use-call-window.ts:31-36`).
  When the window rolls, a settling call leaves the terminal.
  - The default lane is 1m (`use-call-window.ts:15`).
- **Exits** are set in a sheet or modal, in dollars of cash-out value (`packages/calls/src/exits.ts:1-6, 51-58`). The
  trail is set in cents per share. There is no one-tap Trail button.

**Display bug, reproduced with the shared pass.** `quoteClose` returns `proceeds 0` with refusal `price` when the
probability is above 97% (`band-quote.ts:57`). `quoteTick` still computes `pnl = 0 − stake` (`quote.ts:236-237`).

| 5m Up, $10 (19.23 shares), BTC | probability | screen shows |
|---|---|---|
| 40 s left, spot +8 bp | 92.2% | **+$7.35** (correct) |
| 40 s left, spot +15 bp | 99.6% (close refused) | **"−$10.00" in the win colour**, Cash out $0.00 |
| 25 s left, spot +10 bp | 98.8% | the same bug |

So a call that is all but won reads as a total loss in its last minute. Cash-out is impossible on chain at that point
(`BandBook.sol:285`). A tap returns silently (`use-call-flow.ts:163`).

## 3. How Owarine and Tradash work

### 3.1 Tradash: a perps front end (from the 7 Oct study)

- **The instrument.** UP goes long and DOWN goes short. There is one position per market, with margin, leverage and a
  liquidation price.
  - Maximum leverage: BTC 40×, ETH 25×, SOL 20×, the rest 10× (`SPEC-flow.md:120-125, 157`).
  - **PnL = (price − entry) × size × direction** (`SPEC-flow.md:163`).
  - ROI = PnL ÷ margin (`:167`).
  - Demo liquidation is at entry ∓ entry ÷ leverage (`:164`).
- **Fees.** Live fees are 3.5 + 2 bps per side, and the break-even line includes them (`:166`;
  `TRADASH-FIDELITY.md:74`).
- **Live PnL.**
  - Price commits are throttled to 5 Hz (`SPEC-flow.md:362`).
  - Live PnL = the exchange's last unrealised PnL + (chart price − anchor) × size (`:364`).
  - Colour follows the PnL sign (`TRADASH-FIDELITY.md:61`).
  - Tags: Entry, B/E, TP/SL, Liq and Trail (`:62`).
- **CLOSE** takes one tap with no confirmation and closes the full position (`SPEC-flow.md:251-262`). The live order
  carries a 10% price slippage cap (`:149`).
- **TRAIL** is "% behind price". It arms once the move passes the trail % beyond break-even, and its stop
  `max(p(1−pct), ref)` ratchets (`SPEC-flow.md:232-248`).
- Positions are **open-ended**: there is no window or expiry.

### 3.2 Owarine: binary Up/Down windows on Canton

- **Translation from Tradash.** Owarine kept binary windows and mapped the Tradash pieces onto them
  (`TRADASH-FIDELITY.md:22-33`):
  - leverage → a payout multiple (and "Boost");
  - liquidation → the open-print Line;
  - position per market → position per window.
- **Opens** are firm per-user quotes on a 1–999 tick grid (`daml/abu-pm-main/daml/PM/Quote.daml:1-15`).
- **Closes** are a venue buy-back (`Desk_IssueBuyQuote` / `BuyQuote`, `Quote.daml:129-135, 236-243`).
- **Live PnL** = the exit walk over the published ladder, re-priced between ladder events by the change in the fair
  value, minus cost (`packages/markets/src/runtime/live-exit.ts:1-12, 104-115`).
  - The fair value is `P = Φ(ln(S/K) ÷ σ√(t/yr))` (`packages/core/src/market/fair.ts:45-53`).
  - It is committed at 5 Hz (`web/src/features/terminal/live.ts:25, 70`).
- **Break-even spot.** Owarine finds it by bisection and draws a B/E tag (`web/.../live.ts:123-157`).
- **Colour** follows the PnL sign while the position can be exited. Once locked, the pill reads "locked" and the colour
  follows the settlement side (`web/.../useChartFeedback.ts:31-48`).
- **Trail** ran in the browser tab, with its reference at the break-even spot. It later became a ledger resting exit
  (`TRADASH-FIDELITY.md:80, 85`; `web/.../exits/plan.ts:1-12`).
- **"Boost"** is a leveraged *binary*: the reserve fronts up to (L−1) × stake, and a knock-out barrier sits on the
  underlying (`daml/abu-pm-tickets/daml/PM/Tickets/Boost.daml:1-33`). It is not a linear perp.
- **Measured on DevNet:**
  - open about 10 s; close 11–14 s (`TRADASH-FIDELITY.md:144-154`);
  - 1m windows quoted for only 29% of the minute, 5m for 68% (`AVAILABILITY-LATENCY-2026-10-07.md:7-17`).

### 3.3 Side by side

| | Tradash | Owarine | Senryo today |
|---|---|---|---|
| Instrument | linear perp, up to 40× | binary window and a firm quote | binary band and a pool quote |
| Live value | (mark − entry) × size | exit walk − cost | bid × shares − stake |
| Value moves with time at a flat price | no | yes | yes (§4.3) |
| Close | one tap, market order (10% cap) | buy-back quote, 11–14 s | commit → next print, about 1.3–2.5 s |
| Position life | open-ended | until the window's quote cutoff | until expiry − 20 s, then settles |
| TP/SL/Trail | exchange orders, % of price | tab, then ledger resting exit | on chain, in bid ¢ |
| B/E tag | yes (fees) | yes (bisection) | **no** |
| Colour | PnL sign | PnL sign, then settle side | **would-win vs K** |

## 4. Gap analysis, quantified

### 4.1 PnL starts negative (the spread is crossed twice)

- Right after the fill, PnL ÷ stake = bid ÷ ask − 1 = −(2h + s) ÷ (p + h + s).
- Measured with `quoteTick`, $10 stake, h = 2 pp, s = 0:

| Band (BTC) | Probability at fill | Price per share | PnL at entry |
|---|---|---|---|
| Up/Down at K, any cadence | 50.0% | 52.0¢ | **−$0.77 (−7.7%)** |
| Range, 5m | 39.7% | 41.7¢ | −$0.96 (−9.6%) |
| Moonshot, 5m | 16.5% | 18.5¢ | −$2.16 (−21.6%) |
| Moonshot, 1m | 15.3% | 17.3¢ | −$2.31 (−23.1%) |

- With a full per-expiry surcharge (s = 1 pp), Up at K opens at −9.4%.
- In price terms the hurdle is small. Up at K breaks even after a **0.7 bp** move on 1m and **1.6 bp** on 5m. Halving
  h to 1 pp gives −3.9% at entry and break-even at 0.4 / 0.8 bp; h = 0.5 pp gives −2.0% and 0.2 / 0.4 bp.
- Tradash live breaks even only after about 11 bps (two 5.5 bp fees; inferred from `SPEC-flow.md:166`). Its displayed
  PnL starts near $0 because fees sit in the break-even line and the balance, not in the PnL (`SPEC-flow.md:364`;
  inferred).

### 4.2 Sensitivity ("equivalent leverage")

Change in a $10 Up's PnL for a +1 bp move at K, at the window's start:

| Lane | $ per bp | % of stake per 1% move |
|---|---|---|
| 1m | $1.12 | ≈ 1,100× |
| 5m | $0.50 | ≈ 500× |
| 15m | $0.29 | ≈ 290× |
| 1h | $0.14 | ≈ 140× |

- Sensitivity grows as 1 ÷ √(time left) and fades away from K.
- Tradash BTC at 40× is 0.4% per bp.
- So Senryo's PnL **already breathes far harder than Tradash's** on every tick. It also saturates: an Up can make at
  most +92% (a 52¢ share pays $1). The reaction milestones (+10/25/50/100/200%, `packages/calls/src/reactions.ts:83-88`)
  will fire on 1–2 bp moves, and "Tripled!" can never fire on an Up.

### 4.3 Non-linear and time-dependent (inherent to a prediction)

A 5m Up bought at K with $10, with the price held still:

| Spot held at | 0 s | 60 s | 120 s | 180 s | 240 s | 279 s |
|---|---|---|---|---|---|---|
| +3 bp | +$0.72 | +$0.89 | +$1.14 | +$1.56 | +$2.49 | +$4.51 |
| −3 bp | −$2.25 | −$2.43 | −$2.68 | −$3.10 | −$4.03 | −$6.05 |
| at K | −$0.77 | −$0.77 | −$0.77 | −$0.77 | −$0.77 | −$0.77 |

- In Tradash a flat price means a flat PnL. Here the PnL drifts towards the settlement value, and near expiry it jumps
  sharply with each tick.
- That is honest for a prediction, but it is not "my PnL follows the price".

### 4.4 Capped upside and refusals at the extremes

- The cash-out bid is at most 97% − 2 pp = **95¢ per share**. A $10 Up bought at 52¢ cashes out for at most $18.27
  (+82.7%) against $19.23 if held to settlement.
- Above a 97% probability the close is **refused** (`BandBook.sol:285`). The winner then has to wait for settlement,
  and the screen shows −$stake (§2 bug).
- Below 3% it is refused too, so a deep loser cannot be cut. Its true value is under 3¢ a share.

### 4.5 Lockout and window life

- Share of each lane's time with no trading (20 s ÷ cadence), not counting the 1–2 s spent waiting for K:

| Lane | Locked | Longest live PnL for a call opened at the start |
|---|---|---|
| 1m | **33.3%** | about 39 s |
| 5m | 6.7% | about 4 min 39 s |
| 15m | 2.2% | about 14 min 39 s |
| 1h | 0.56% | about 59 min 39 s |

- The terminal defaults to 1m (`use-call-window.ts:15`).
- Windows cannot overlap: `start % cadence == 0` (`Windows.sol:113`), and a series id is `(market, cadence)`
  (`Windows.sol:253-255`). So there is no always-open lane within one cadence.
- A held call stops being "closable any time" 20 s before its end. It then pays all or nothing at the close print.

### 4.6 Close latency and slippage refusals

- **Latency.** Commit-then-fill costs about 1.3–2.5 s from tap to fill (§1.3). Closes follow the same path but were not
  separately measured. On RedStone-sourced markets the next print may be up to 10 s away (`pool-terms.ts:42-43`).
  - The delay is security-critical: it is what stops stale-print picking (D-261, `docs/plan/decisions.md:344-347`).
- **The limit.** A close is signed with a limit of 97% of the quote seen (`use-call.ts:116`; `constants.ts:4`).
- **The sensitivity.** Near K at a window's start, cash-out value moves about 5.4% per bp on 5m and about 12% per bp on
  1m. So an adverse move of only about 0.55 bp (5m) or 0.25 bp (1m) between the tick on screen and the fill print
  bounces the close with `REFUSE_SLIPPAGE`. Opens behave the same way through the payout limit.
- **Estimate.** With BTC's measured σ (0.35 a year, `pyth.ts:2-3`) over about 1.5 s, that is roughly **1 in 4 (5m) and
  1 in 3 (1m)** near-the-line taps. *Model estimate, unverified: check the relay's refused intents by reason.*
- **Comparison.** Tradash's market close caps slippage at 10% of *price* (`SPEC-flow.md:149`), so it effectively never
  bounces.
- **Copy bug.** A refused close also shows "Your stake was not taken." (`use-call-flow.ts:82-86`), which is wrong for a
  close.

### 4.7 Minimum hold

You cannot cash out for 3 s after the fill print (`BandBook.sol:138-140`). Tradash has no minimum hold. In practice
this is small next to the fill latency.

### 4.8 Pool capacity

- A $10 Up at K reserves $9.23. The per-expiry cap is shared across every market ending that second (§1.7).
- **Mainnet:** $250 per expiry and a $25 maximum stake. That is about ten maximum-size Up calls across all markets per
  boundary, each adding about 0.09 pp of surcharge.
- **Testnet:** 500,000 Test USD per expiry against a 10M seed (`pool-terms.ts:127`), which is ample.

### 4.9 Exits compared with Tradash's trail

- Senryo's TP/SL/trail are stronger than Owarine's: they are on chain, work with the app closed, and are checked at
  the fill print.
- They are expressed in **cents of share value**, not "% behind price".
- There is no one-tap TRAIL control on the terminal, and no "Need +x% to trail" state.

### 4.10 Rounding

- Payouts and proceeds round down and basis rounds up (`BandMath.sol:146-160`). That costs at most 1e-6 USD per
  operation and needs no change.

## 5. Options

### (a) Keep the contracts and fix the presentation (both apps, mostly in `@senryo/calls`)

1. **Fix the deep-winner bug** (`quote.ts:236-238`).
   - When the close is refused for price above 97%, say so instead of pricing it: "Too sure to price · pays $19.23 at
     12:05".
   - Keep the would-win colour, and never derive PnL from refused proceeds.
2. **Colour by PnL sign while cash-out is open, and by settlement side once locked.** This is Owarine's rule
   (`useChartFeedback.ts:31-48`).
3. **Add a B/E tag.** It marks the spot where cash-out equals the stake, found by bisection over `quoteClose` as Owarine
   does (`live.ts:123-157`). It moves with time.
4. **Add ROI % next to the dollar PnL**, an "Unrealized" figure, and equity = balance + Σ cash-out values. Add the
   phone's "View position" pill (Tradash `SPEC-flow.md:224-230`).
5. **Add Tradash's TRAIL / CLOSE morph.** One tap arms the on-chain trail (D-292). Translate a "% behind price" into bid
   cents with the model when it arms, and show a "Need +x% to trail" state.
6. **Default to the 5m lane.** When a lane locks, offer the next longer lane's Up/Down. Keep the settling call on
   screen ("Settling · pays $x if BTC ≥ K at 12:05") instead of letting it vanish (`use-call-window.ts:31-36`).
   Owarine did this with auto-advance (`TRADASH-FIDELITY.md:120-121`).
7. **Make "close now" really close.** Loosen the close limit: for example, 15–20% of the quote, or 0 for "close at
   market". Freeze the pill at the tapped quote while "Closing…", then reconcile to the `Closed` event and show
   "Realized". The limit is client-only (`use-call.ts:116`). Fix the refused-close copy.
8. **Keep the PnL money-true** (cash-out based, as D-261 says: "Live PnL is labelled 'cash-out ≈ $x'",
   `docs/plan/pivot-2026-10-08.md:98`).
   - Do not switch to a mid-price PnL that starts at $0. That would show money the user can't take.
   - Explain the opening gap with the B/E tag.

| | |
|---|---|
| **Cost** | about 2–3 dev-days across both apps (estimate); no chain cost, no redeploy. |
| **Risk** | low. A looser close limit means a user can get noticeably less than the tapped quote on a fast tick. Show the realised figure honestly. |
| **Doesn't fix** | non-linearity (§4.3), window end and lockout (§4.5), the capped upside (§4.4). |

### (b) Contract changes inside the current design

**b1. Config only: cut the half-spread with `setParams`.** Example: 2 pp → 1 pp.
- **Mechanics.** The bounds allow it (`BandPool.sol:94-103`: h ≤ 5 pp and h < the minimum probability). It is one admin
  transaction that bumps `configVersion` (`BandPool.sol:84-107`). Also update `PRICING` (`pool-terms.ts:94-100`) and
  the catalogue export so the apps price the same.
- **Effect.** Up opens at −3.9% instead of −7.7%, and breaks even at 0.8 bp on 5m.
- **Cost.** About 0.02 MON plus a config edit. No redeploy.
- **Risk.** The pool's edge halves, which lowers Earn's yield. There is less cushion against σ error and fast-tick flow
  (σ is already measured × 1.5). Commits signed on the old version refuse once (`REFUSE_CONFIG`). It amends D-262
  ("half-spread 2 pp", `decisions.md:348-351`), so it is the owner's call.

**b2. `BandBook` code changes. Each needs a new `BandReserve` and `DuelArena`.**
- **Changes worth folding in if a redeploy happens anyway:**
  - clamp the close bid at `maxProb − h` instead of refusing above 97% (pool-safe: it pays under fair), so winners can
    cash out until the lockout;
  - separate open and close spreads (a `Params` change), for example 2 pp in and 0.5 pp out, so a round trip is
    cheaper;
  - a shorter `LOCKOUT_SEC`.
- **Lockout floor.** Opens and closes need fill delay + grace + inclusion, about 6–8 s minimum (unverified). The 20 s
  also limits late-window latency arbitrage, because a CEX leads Pyth by fractions of a second. Shortening it raises
  that risk to the pool.
- **Redeploy now (54 of 136 series listed on the current reserve):**

  | Item | Cost |
  |---|---|
  | `BandReserve` create | 11.46M gas, 1.18 MON |
  | `DuelArena` create | 0.57 MON |
  | Re-list 54 series (`setSigma` + 5 × `addBand`, about 0.107 MON each) | 5.76 MON |
  | **Total** | **≈ 7.6 MON**, on top of the ≈ 13.3 MON the resume already needs (`ids-and-txs.md:129`) |

  - `Windows`, the verifiers and the calendar stay. `PoolShares` and `EventBook` are not deployed yet.
  - Also: the 101 contract tests, the TypeScript mirror (`packages/core/src/market/band-quote.ts`) and the gates.
- **Risk.** Moderate: a solvency-path change, more MON, and a deploy that is already blocked on MON.

**b3. Continuous lanes: overlapping or staggered windows**, for example a 5m window starting every minute, like
Owarine's staggered lanes.
- **Mechanics.** Needs `Windows` to separate the start step from the cadence (`Windows.sol:111-132`). That means
  `Windows` and `BandReserve` (and everything wired to them) are redeployed, which restarts the v2 deploy.
- **Cost.** About 24 MON in all, and the 10.93 MON already spent is wasted.
- **Fixes** the lockout gap. **Doesn't fix** non-linearity.

**b4. Per-call windows ("Up from your entry, settles in 60 s").**
- **Mechanics.** K = your fill print and expiry = fill + N, so every Up/Down starts at the line and there is no
  market-wide lockout.
- **Cost.** A rewrite of settlement: per-ticket expiry prints batched by second, a new reservation keying, and rework of
  parlays, duels and the indexer. High cost.
- **Fixes** the start state and the lockout. It is still binary and non-linear.

### (c) A different instrument closer to Tradash: a capped linear Up/Down against a pool

**Shape**, kept inside Senryo's solvency rule (D-264, full reservation):
- **Entry.** Margin m, leverage L (for example ≤ 20× crypto), direction. Entry is at the fill print P₀ ± a spread in bp,
  using the same commit → next-print fill.
- **Value at a print P** = clamp(m + m·L·dir·(P/P₀ − 1) − fee, 0, m·(1 + c)).
  - It floors at 0, which is the knock-out at P₀(1 − dir/L).
  - It caps at a profit multiple c, so the pool reserves m·c.
  - The user can never lose more than m, and the pool never more than m·c.
- **Close** any time (after a short hold) at the next print.
- **Knock-out.** Anyone proves a recorded print that crossed the knock-out level, checked at that print like
  `fireExit` (`BandBook.sol:161-167`).
- **Horizon.** A fixed horizon (for example the hour boundary or the stock session close) settles at that print. This
  bounds the reserve per expiry and removes the need for funding.

**What Senryo already has for it:**
- the print store with any-second Pyth prints (`Windows.ensurePrint`, `Windows.sol:164-176`; `PythPrintVerifier.sol`);
- the fill batcher (`relay/fills.ts`);
- the exit watcher, which becomes a knock-out watcher (`relay/exits.ts`, 1 s tick);
- session grants and EIP-712 intents;
- the `BandPool` ledger pattern and its `_hasCapacity` caps;
- the calendar, which keeps stocks inside sessions.
- **The client PnL would be trivially linear**, matching Tradash's formula (`SPEC-flow.md:163`).

**What the references offer to port:**
- **Senryo's own deleted perps engine** (removed in S1, commit `cd37e193`), the only linear perp code in any reference:
  - `cd37e193^:contracts/src/core/PerpModule.sol` (lines 13-16: "one net position per (user, market) against the LP
    pool at the oracle price", a minimum hold before a profitable reduce);
  - `RiskModule`, `LiquidationModule`, `TriggerOrders`, `LpVault`;
  - `libraries/PerpMath.sol` (PnL rounded against the account, spread, average entry, age spread).
  - It was live on testnet as SenryoCore `0x36cF…8cAA` (`ids-and-txs.md:52`).
  - It priced off a Chainlink push adapter (`oracle/SessionOracle.sol`), so it must be re-based on unique prints and
    commit-then-fill.
- **Mitoshi's `LeverageReserve`** (`crypto-world-fair/contracts/src/products/leverage/LeverageReserve.sol:25-31`,
  `LeverageMath.sol:67-104`) and **Owarine's Boost**: both are *leveraged binaries* (front, premium, knock-out barrier),
  not linear. Useful for the front/premium and knock-out arithmetic and its tests; they do not give linear PnL.

**Cost and risk:**
- **Cost (estimate).** A new contract of about 400–700 lines plus about 30–40 tests; branches in the relay, keeper and
  indexer; a new mode on both apps (size, leverage, Liq tag, linear pass); a separate pool or a new pool hook.
  - `BandPool`'s `fund` and `defund` are role-gated, and `PoolShares` only values `BandReserve`.
  - Deploy about 2–4 MON (estimate). Multi-day work on both apps.
- **Risk:**
  - **Product.** It reverses D-256 ("too much stuff… go through the prediction market route", `decisions.md:322-326`)
    and the copy rule "No 'options', 'leverage' or 'trading' wording" (`pivot-2026-10-08.md:146`). It is a CFD-like
    product on mainnet USDC.
  - **Pool.** The pool holds directional exposure to net flow and is exposed to adverse selection. Fees have to beat
    one-second momentum. Equities and RedStone markets are slower.
  - **Engineering.** A new audit surface and a second position model in every surface (calls, receipts, Earn, social).
  - **Deploy.** It does not disturb the current deploy if it lives beside `BandReserve`.

### Option comparison

| | Live PnL tick by tick | Starts near $0 | Moves 1:1 with price | Close any time | No window end | Chain cost | Effort |
|---|---|---|---|---|---|---|---|
| Today | yes | no (−7.7%) | no | until −20 s; ~¼–⅓ bounce (est.) | no | — | — |
| (a) | yes, fixed | B/E tag explains it | no | yes, until −20 s | no | 0 | ~2–3 d |
| (a)+(b1) | yes | −3.9% | no | yes, until −20 s | no | ~0 | +config |
| (b2) | yes | ≈ −4.8% (2 pp in, 0.5 pp out) | no | until −8 to −20 s; winners too | no | ≈ 7.6 MON | ~1–2 d + redeploy |
| (b3)/(b4) | yes | yes for (b4) | no | yes | lanes always open | ≈ 24 MON / redeploy | high |
| (c) | yes | ≈ −fee | **yes** | yes | **yes** (to a horizon) | ≈ 2–4 MON + seed | multi-day |

## 6. Recommendation

**Keep the band contracts and finish the markets v2 deploy unchanged. Do (a) completely and (b1) now. Fold the (b2)
close-bid clamp in only if a `BandReserve` redeploy happens for another reason. Do not replace the instrument.**

Reasoning:
1. **The capability already exists.** "See your live PnL as it's going" is a closed-form, executable value that the
   apps already recompute per tick, bit-exact with the fill (§2). The contract is not what blocks the experience.
2. **It matches the owner's own precedent.** Owarine followed Tradash by keeping binary windows and showing exit value
   against cost (`TRADASH-FIDELITY.md:22-33`; `live-exit.ts:104-115`). Senryo's contracts do the same thing natively,
   with faster closes (≈ 2 s against 11–14 s), longer tradable windows (1m: 65% against 29%) and on-chain exits.
3. **What makes it not feel like Tradash is mostly fixable off chain:** the −$stake bug, the colour rule, the missing
   B/E, ROI, equity and Trail, the vanishing settling call, the 1m default and the 3% close limit. The opening gap
   shrinks by half with one config transaction.
4. **What stays is inherent to a prediction:** non-linear, time-dependent PnL and an end to every call. Removing it
   means a different instrument (c). That is a product choice, not a fix.
5. **The cost case.** Any code change to `BandReserve` now costs about 7.6 MON on a deploy already waiting for MON, and
   delivers less than (a).

**Questions for the owner, in plain words:**
- Do you want Up/Down to stay a prediction (pays a fixed amount if you're right when the window ends; cash out any time
  before), with a Tradash-style live screen? That is a few days of app work on the contracts being deployed now.
- Or do you also want a second "ride the price" mode, whose profit moves one-for-one with the price, has leverage and
  a knock-out, and no window? That is a new contract beside the current one, and it undoes the 8 Oct "no perps,
  prediction market only" decision.
- Separately: may the pool's spread drop from 2 to 1 percentage point? A new call then starts at −3.9% instead of
  −7.7%, and the pool earns about half as much per call.

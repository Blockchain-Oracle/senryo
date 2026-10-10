# Ride the price: a linear Up/Down mode beside the prediction calls (10 Oct 2026)

Read-only research for the 10 Oct replan. The owner wants Senryo to keep its Up/Down **prediction calls** and **also** offer
a Tradash-style linear mode:

- UP is a long and DOWN is a short, with leverage;
- PnL moves one-for-one with the price, live;
- TRAIL and CLOSE work at any time.

This file covers four things:

1. the references;
2. a design that reuses what Senryo already has;
3. the deploy path and its MON cost;
4. the tests that matter.

It ends with a recommendation. In this file a linear position is called a **ride**, and the contract module is `LinearBook`.

## What I could not check (read this first)

- **Nothing was run.**
  - No contract was compiled and no test was run.
  - No chain state was read. Deployed facts come from `docs/plan/ids-and-txs.md:129` and from the 10 Oct broadcast file
    `contracts/broadcast/DeployMarkets.s.sol/10143/run-latest.json`, which I parsed for gas per transaction type.
- **MON figures are extrapolations.**
  - They come from the gas actually charged per call type in that broadcast, at 103 gwei.
  - The cost of a batched series listing (§3) is **UNVERIFIED**: no such function exists yet, and Monad's estimate for it was
    not measured.
  - Contract sizes for the new code are estimates.
- **External protocols.** Facts come from a web pass over the current official docs, with URLs in §1.
  - Not confirmed: gTrade's `MAX_PNL_P` value, Avantis/Veranta's share-price formula, Ostium's OI caps.
  - The Ostium July 2026 incident is as reported by The Block; I did not verify it independently.
  - Bulk's live leverage table was read from its public `exchangeInfo` API on 10 Oct.
- **Tradash was not traded.** Its numbers come from the 7 Oct study, as cited in `01-tradash.md` and `05-contract-live-pnl.md`.
- **Adverse selection is unmeasured.**
  - Unknown: whether a one-second fill delay is enough to neutralise exchange-leads-Pyth latency for a linear product.
  - Unknown: how 1-second momentum behaves in Pyth prints.
  - Both are **UNVERIFIED** (§5 says how to measure them).
- **Legal and store rules were not assessed** beyond quoting Apple's guideline (§5). None of this is legal advice.

## Short answer

1. **Nothing in any reference gives Senryo linear PnL for free.**
   - **Mitoshi's `LeverageReserve` and Owarine's Boost are leveraged *binaries*.** A reserve fronts a binary position, with a
     knock-out barrier; neither is linear (confirmed in §1.4).
   - **Bulk, behind Tradash, is an order book.** Market makers take the other side, not a pool.
   - **The pool-against-trader models to copy are gTrade, Avantis/Veranta, Ostium and GMX v2.**
   - **Senryo's own removed engine was linear but cross-margined.** It priced off a push oracle and lost money to three bugs
     (D-161, D-181, D-182).
2. **Design: one more book in the same reserve, against the same pool.**
   - A `LinearBook` is composed into `BandReserve` beside `BandBook` and `ParlayBook`. It reuses:
     - the unique print store (`Windows.ensurePrint`);
     - commit-then-fill at the next second's print;
     - `SessionGrants`, so one Face ID session covers calls and rides;
     - the exits pattern;
     - pay-or-owe;
     - the `balance ≥ liabilities` check after every money path.
   - **Each ride is isolated:**
     - margin m, leverage L ≤ the market's cap (BTC 40×, ETH 25×, SOL 20×, the rest 10×, as on Bulk);
     - PnL linear in the print;
     - knock-out at 90% of margin lost;
     - the most a ride can lose is its margin plus the opening fee.
   - **Full reservation (D-264 kept).** The pool reserves the ride's maximum profit at the fill, so it can never owe more than
     it holds, on any price path. That maximum is margin × min(900%, L × max move).
   - **No funding.** Instead, a small hourly hold fee, per-market reserve and skew caps, and a cap on the linear book's share
     of the pool.
3. **Earn can value rides exactly.** Open-ended rides break Earn's "settled hour" rule, so the roll:
   - marks rides to a fresh unique print, using O(1) per-market sums;
   - proves on chain that no ride is past its knock-out or cap at that print (a conservative "bound frontier" per market and
     side);
   - only takes requests made before the hour.

   The last point also fixes a small leak that exists for calls today (§2.10).
4. **Deploy.** `BandReserve` and `DuelArena` must be replaced. Windows, the five verifiers, the calendar, TestUSD and the
   AccessManager all survive.
   - With a batched series listing added in the same change, the remaining testnet deploy costs **≈ 10.6–12.9 MON**, against
     **≈ 12.0 MON** (13.3 MON recorded, with margin) to finish today's plan unchanged.
   - Without batching it costs **≈ 20.3 MON**.
   - The decision has to come **before** the deploy resumes: every series listed on the current reserve is spent again on the
     new one.
5. **Effort:** about 21–29 developer-days across contracts, services and both apps. **Main risks:**
   - a product reversal of D-256 and D-270;
   - Apple's derivatives rule 3.2.2(viii);
   - adverse selection against the pool;
   - more surface in the core money contract.

---

## 1. References

### 1.1 Senryo's removed linear engine (`cd37e193^`, deleted in S1 by D-256)

It lived in `contracts/src/core/`: `PerpModule` 286 lines, `MarketAccounting` 140, `LiquidationModule` 133,
`RiskModule` 176, `TriggerOrders` 82, plus `libraries/PerpMath.sol` 119 and `lp/LpVault.sol` 136. It was live on testnet as
SenryoCore `0x36cF…8cAA` (`ids-and-txs.md:52`).

| Piece | What it did | Keep / drop for rides |
|---|---|---|
| Positions | One net position per (user, market) against the LP pool, cross-margined over all markets. Increases average the entry (`PerpModule.sol:13-16, 121-123`) | **Drop.** Rides are isolated, one ride per open, with no averaging. Averaging plus cross-margin produced D-181 |
| Pricing | Push oracle (`SessionOracle`) observed at the call; entry = P ± (max(base, deviation) + age + impact) (`RiskModule.sol:130-139`) | **Replace** with the unique print at commit + 1 s (D-261), so nobody picks the price |
| Caps | Trade cap, OI cap = min(absolute, pool bps), skew cap (`PerpModule.sol:141-161`) | **Keep the shape**, sized on reserve rather than notional (§2.8) |
| Impact | `IMPACT_K × Δ\|skew\| / depth`, only when \|skew\| grows; max 50 bp (`PerpMath.sol:73-81`, `Constants.sol:57-60`) | Optional later. v1 uses a skew cap that always lets the skew-reducing side trade |
| Funding and borrow | Lazy indexes with per-position snapshots summed into market aggregates (`MarketAccounting.sol:50-106`) | **Drop.** This is where D-161/D-182 lived (§1.1.1). Rides use a flat hold fee settled at the exit |
| Profit cap | `maxProfitBps` of entry notional, clamped at close (`PerpModule.sol:207-212`); Σ reserved max profit as an invariant (`MarketAccounting.sol:129-135`) | **Keep and strengthen:** the cap is reserved per ride at the fill (D-264) |
| Minimum hold | 20 blocks before a *profitable* reduce (`Constants.sol:45-46`) | Keep as `MIN_HOLD_SEC` = 3 s (already in `MarketTypes.sol:56`) |
| Liquidation | Account-level E_liq < MM, a 1% penalty, half to the liquidator capped at $5, shortfall to insurance then the pool (`LiquidationModule.sol:13-17, 111`; `Constants.sol:71-73`) | **Replace:** a per-ride knock-out at a recorded print; a shortfall is impossible (max loss = margin) |
| LP value | Two prices: mint at cash + receivables − trader PnL, redeem at cash − max(trader PnL, 0) (`MarketAccounting.sol:30-42`). A 1-day redeem delay; redeem blocked unless every market is open (`LpVault.sol:15-20, 93-104`) | Inspires §2.10, made exact with the bound frontier |
| Rounding | PnL floors gains and ceils losses; longs' entry rounds up, shorts' down (`PerpMath.sol:23-47`) | **Keep verbatim** in `LinearMath` |

#### 1.1.1 The bugs and what they teach

- **D-161 / D-182** (`decisions.md:97, 102`). `_settleFees` re-snapped funding and borrow *before* the aggregate was removed.
  - So `borrowSnapSum` underflowed: the only holder in a market **could not close** (Panic 0x11).
  - With other holders, the LP price drifted silently.
  - It was hidden because the invariant suites ran `fail_on_revert = false` without recording panics.
  - **Lesson:** aggregates must be updated with exactly the stored per-position values, added on fill and subtracted on exit,
    with no snapshot that changes in between. The suite must record panics and check aggregates == Σ positions.
- **D-181** (`decisions.md:101`). Cross-margin let a user close the loser first, so the house lost 3.20 USD on a 12 USD account.
  - **Lesson:** isolated rides with a hard max loss = margin remove the whole class.

### 1.2 Pool-counterparty perps (current docs, 10 Oct 2026)

| | gTrade (Gains) | Avantis → **Veranta** (Base) | Ostium (Arbitrum) | GMX v2 |
|---|---|---|---|---|
| Open flow | Request → Chainlink DON median callback; ~60 s timeout; nothing while a market is closed | Signed intent → operator prices with Pyth Pro and submits; expires after 15–30 s (docs conflict) | Keeper fetches the oracle and opens in ~1–2 s | `createOrder` → keeper executes with prices from **after** the order |
| Fee per side | BTC/ETH 3.5 bp; core crypto 5; others 6 | Taker 4.5 bp / maker 0.1 bp, by whether the trade worsens skew | Open 3–10 bp (crypto 10), no close fee | 4 bp if it reduces imbalance, 6 bp if it adds |
| Spread / impact | Fixed 0.5 bp + depth impact + skew impact; **close fee ×30 decaying over ~10 s** | Size vs depth, capped per market | Bid/ask; **40 bp fee on profitable closes within 15 s** | Skew impact, +40 / −50…1000 bp caps |
| Max leverage | Crypto 500×, FX 1000× | Crypto 50× (Upside 500×) | 200× | 100× |
| Liquidation | ~90% loss at 2×, falling to ~63% at 150×; collateral goes to the vault | 85% loss | 100% − 25%·L/Lmax | Collateral < 0.25–1% of size; fee 0.20–0.45% of notional |
| Profit cap | TP up to 900% (`MAX_PNL_P` value unverified) | 2500% (500% on some markets) | 900% | None per trade; auto-deleveraging (ADL) at 85% PnL / pool |
| Holding cost | Borrow (OI-utilisation curve) + funding (v10) | Borrow + funding, accrued hourly | Rollover (carry + 1–2%) | Borrow (larger side) + adaptive funding |
| Vault marks open PnL? | Yes: `price = 1 + accRewards − max(0, accPnlUsed)`, snapshotted per 3-day epoch; withdrawals wait 1–3 epochs by collateral ratio | A buffer ratio includes open PnL; the share price formula is unverified; withdrawals immediate, with a fee by buffer ratio | Now a junior buffer takes PnL; the senior token updates daily | Yes, in real time: GM price = (pool + capped net pending PnL) / supply |
| Closed markets | Positions held but frozen; stop-losses not guaranteed | Held; triggers fire at reopen through the gap | Market orders rejected; stocks above the overnight cap auto-close at 15:45 ET | TradFi 24/7 with off-hours risk parameters |

What Senryo takes:

- **(a) Fill at a price from after the request.** Senryo's next-print fill is that rule, made exact (GMX's "prices after
  timestamp n").
- **(b) Validate exit levels at execution.** The Gains forks that didn't paid 900% on every trade (Zellic).
- **(c) A profit cap tied to a reserve.** Senryo reserves it in full.
- **(d) Mark open PnL into the LP price** (gTrade, GMX), with a delay so LPs can't time it.
- **(e) Cap OI per market and per side, scaled to the vault.**
- **(f) An anti-round-trip guard** (gTrade's decaying close fee, Ostium's 15 s fee). Senryo has the 1 s fill delay and a 3 s
  hold. Whether more is needed is unmeasured (§5).

### 1.3 Bulk, the venue behind Tradash

- **What it is.** A central limit order book: an execution layer beside Solana validators, with a 25 ms taker speed bump.
  Market makers are the counterparty; a risk vault and auto-deleveraging (ADL) cover only shortfalls.
- **Leverage (live `exchangeInfo`, 10 Oct).** BTC 40×, ETH 25×, SOL 20×, XRP 20×, PAXG 20×, HYPE / ZEC / PUMP 10×. This
  matches Tradash's table (`05-contract-live-pnl.md` §3.1).
- **Fees.** Taker 3.5 → 2.2 bp.
- **Margin and funding.** Cross margin with risk tables. Funding is hourly between traders.
- **Mark price.** The median of (Pyth − EMA premium, book mid, book EMA).
- **What carries over.** Tradash's *experience* translates (leverage chips, Liq tag, TRAIL, one-tap CLOSE). Its *risk
  model* does not: Senryo has no market makers, so its pool must price and cap like gTrade, Avantis or GMX.

### 1.4 Mitoshi and Owarine: leveraged binaries, not linear (confirmed)

- **Mitoshi `LeverageReserve`** (`crypto-world-fair/contracts/src/products/leverage/LeverageReserve.sol:24-31`,
  `LeverageMath.sol:67-104`).
  - The reserve fronts `(L−1)·stake` for a premium and buys *binary contracts* off the venue's book. A win pays the quantity
    less the front.
  - It knocks out when the book mark falls under a maintenance line.
  - The supplier pool values positions **at cost** (`totalValue = liquid + outstanding`, `:207-209`), and withdrawal is
    refused while an expired position is unsettled (`:246-251`).
- **Owarine Boost** (`owarine/daml/abu-pm-tickets/daml/PM/Tickets/Boost.daml:1-33`).
  - The same arithmetic (`stake + fronted − premium == C`), with leverage ≤ 10×.
  - A barrier on the underlying, knocked out by an oracle quorum.
- **Reuse.**
  - Their knock-out-at-a-proven-print idea and the "owner never owes" split.
  - Mitoshi's bounded open-position set (`maxOpenPositions`) for keeper scans.
  - Not their payoff.

### 1.5 Incidents worth designing against

- **GMX v1 AVAX (Sep 2022).** Size opened at zero impact while spot was pumped on exchanges. → Caps must match real depth.
- **GMX v1 (Jul 2025, $42M).** Reentrancy during a keeper decrease moved the pool price. → Pool value must never read state a
  callback can re-enter.
- **Ostium (Jul 2026, reported $23.75M).** Compromised signer/keeper keys pushed false BTC prices, and a 900% per-trade cap was
  farmed repeatedly. → A per-trade cap doesn't bound repeated trades. Prices must be verified on chain, and losses capped per
  hour.
- **Gains forks.** TP/SL not checked at the close price. → Re-check every exit at the fill print.

---

## 2. Design for Senryo

### 2.1 Inside the reserve, or a separate contract?

| | **A. `LinearBook` inside `BandReserve` (recommended)** | B. Separate `LinearReserve` with its own pool |
|---|---|---|
| Pool | One pool for calls, parlays, rides and event fees: D-260, D-293 ("no separate parlay pool"), D-296 | Two pools: the seed splits, and capacity is not shared |
| Session / allowance | One Face ID grant and one permit cover both modes; the per-call and per-session caps (D-267) bound the total | A second grant and permit, or reading `BandReserve.sessionOf` with a separate spend counter (2× the cap in total) |
| Solvency | One `liabilities()` and one `_assertSolvent` | Two ledgers; `PoolLedger` would have to be extracted from `BandPool` to avoid duplication |
| Earn | Values rides by an exact mark (§2.10) | v1: house-only (Earn excludes rides); later, an umbrella `PoolShares` needs the same mark anyway |
| Deploy | New `BandReserve` + `DuelArena`; ≈ 10.6–12.9 MON with batched listing (§3) | ≈ 12.9–13.2 MON, nothing replaced |
| Code size | ~39.7 KB today (measured) → ~55–60 KB (estimate), under Monad's 128 KB (`foundry.toml:10`) | ~25–32 KB (estimate) |
| Risk | A larger diff in the core money contract | Additive; ring-fenced |

**Choose A.** The owner's own pattern is one shared pool behind every product. Option B also needs the Earn mark the day
Earn backs rides. With batched listing, A costs about the same MON as B. Route B is the fallback if the owner wants zero
change to `BandReserve` (§5).

### 2.2 The instrument, with a worked example

Rules (all prices are prints × 1e-8; money is 6-decimal base units):

- **Entry.** Long x = ⌈P·(1 + h)⌉; short x = ⌊P·(1 − h)⌋. P is the unique print at commit + 1 s; h is the spread (§2.7).
- **Size and notional.** N = m·L; size s = ⌊N · `RIDE_SCALE` / x⌋, with `RIDE_SCALE` = 1e20. With this scale, pnl₆ =
  s·ΔP₈ / 1e20.
- **PnL at an exit price X.** pnl = dir · s · (X − x) / `RIDE_SCALE`; gains floor, losses ceil (as `PerpMath.pnl`).
- **Reserve** (the pool's maximum loss): r = m · min(`maxProfitBps`, L · `maxMoveBps`) / BPS.
- **Equity.** e = clamp(m + pnl, 0, m + r).
- **Knock-out (KO)** when 90% of margin is lost (`KO_LOSS_BPS` = 9,000, gTrade's legacy 90%).
  - Long: ko = x − 0.9·m·`RIDE_SCALE`/s, rounded towards the entry.
  - **Cap-out** when pnl ≥ r: cap = x + r·`RIDE_SCALE`/s.
  - Both prices are fixed at the fill. The Liq tag never drifts.

Worked example, BTC at a print of $100,000, $10 margin, h = 2 bp, fees 4 bp per side (`node` calculation, these parameters):

| Leverage | Notional | Reserve (testnet: 900% / 25%) | KO | Cap | Break-even | PnL just after the fill |
|---|---|---|---|---|---|---|
| 40× | $400 | $90 (9× margin) | −2.23% | +22.5% | +12 bp | −3.2% of margin (−4.8% with the open fee) |
| 10× | $100 | $25 | −8.98% | +25.0% | +12 bp | −0.8% (−1.2%) |
| 2× | $20 | $5 | −45.0% | +25.0% | +12 bp | −0.16% (−0.24%) |
| 40×, mainnet terms 400% / 10% | $400 | $40 | −2.23% | +10.0% | +12 bp | as above |

Compared with today's call:

- **Start.** A call starts at −7.7% (`05-contract-live-pnl.md` §4.1). Tradash live breaks even at about 11 bp.
- **Sensitivity.** A 40× ride moves 0.4% of margin per bp: Tradash's number, not the 500–1,100× of a binary.
- **Time.** PnL does not move with time at a flat price, apart from the hold fee.

### 2.3 Storage

Rides live in an array, like tickets.

- **Why an array.** Under Monad's MIP-8, storage is priced per 128-slot page: the first touch costs 8,100 and later slots in
  the page 100 (docs.monad.xyz opcode pricing). A five-slot ride packs about 25 rides per page, so keeper scans are cheap.
- **`Ride`, in about five slots:**
  - `owner`, `status`, `isLong`, `market` (index), `target`, `leverageBps`;
  - `recipient`, `filledAt`, `updatedAt`, `configVersion`;
  - `margin`, `reserve`, `openFee`, `closing` (size in a pending close);
  - `size` (uint128), `entryE8`, `limitE8` (worst acceptable price for the pending action);
  - `koE8`, `capE8`.
- **Status values:** `RIDE_COMMITTED`, `RIDE_OPEN`, `RIDE_CLOSED`, `RIDE_KNOCKED_OUT`, `RIDE_CAPPED`, `RIDE_REFUNDED`.
- **`RideSide` per (market, side):**
  - `size` Σs, `cost` Σ(s·x), `margin` Σm, `reserve` Σr, `count`;
  - the frontier: `koEdgeE8` (the highest long KO / lowest short KO) and `capEdgeE8` (the lowest long cap / highest short cap).
  - The aggregates are updated only with the ride's stored values: the D-182 lesson.
- **`RideMarket` per market** (set by `PARAMS`, bounded by compile-time constants): `PrintSource` (verifier and feed; the
  verifier must be `windows.knownVerifier`), `calendarId`, `enabled`, `maxLeverageBps`, `baseSpreadBps`, `openFeeBps`,
  `closeFeeBps`, `holdFeeE6PerHour`, `maxProfitBps`, `maxMoveBps`, `marketReserveBps`, `marketReserveCap`, `skewCapBps`,
  `minMargin`, `maxMargin`.
- **`RideIntent`** (EIP-712; its own typehash): `action` (OPEN/CLOSE), `owner`, `market`, `isLong`, `rideId`, `margin`,
  `leverageBps`, `size` (for a close), `worstPriceE8`, `recipient`, `configVersion`, `deadline`, `nonce`, `epoch`.
  - It authorises through the existing `_authorizeSigned` (`SessionGrants.sol:142-162`).
  - An open spends margin + open fee from the session's caps.
  - A delegate can only pay the owner.

### 2.4 Lifecycle

**1. Commit an open**

- Checks: not paused; the config version matches; the market is enabled and its calendar open; m is in `[minMargin,
  maxMargin]`; 1× ≤ L ≤ `maxLeverageBps`; the signature (owner or session).
- Pull m + openFee (permit optional, as `BandBook.sol:84-91`) into `committedStakes`. Target = now + `FILL_DELAY_SEC`.

**2. Fill at the print of the target**

- `finalizeRides(target, ids, proof)`, permissionless, one feed per batch. Like `BandBook.finalize` (`:203-216`), it calls
  `windows.ensurePrint` (`Windows.sol:164-176`).
- Steps: entry; refuse if beyond `worstPriceE8` (`REFUSE_SLIPPAGE`); size; reserve; capacity (§2.8); KO and cap; book (§2.9);
  update `RideSide`, widening the frontier.
- Any refusal refunds m + openFee: `REFUSE_PRICE`, `REFUSE_CAPACITY`, `REFUSE_CONFIG`, `REFUSE_SLIPPAGE`, `REFUSE_CLOSED`.
- A missing print past admission is refunded by `expireRides` (`REFUSE_NO_PRINT`, the D-261 rule).

**3. Close (CLOSE or Reduce)**

- The owner or session signs `size` and `worstPriceE8` (≥ `MIN_HOLD_SEC` after the fill).
- It fills at the next print at X: Tradash's "close at market with a price cap", kept honest by the next-print rule.
- A partial close takes a fraction f = size_out / s:
  - margin and reserve leave pro rata, rounded up;
  - KO and cap are unchanged, so the frontier is untouched.
- No increase or averaging. "+ Add" opens another ride; the apps group rides by market.

**4. One position per tap.** The apps can show net exposure per market. On chain, each ride is independent: simpler,
auditable, and no D-161 class bugs.

### 2.5 Knock-out and cap-out at a recorded print

`settleBounds(ids, t)` is permissionless. For each ride it reads the recorded print at t of the ride's market:

- t must be ≥ `updatedAt` (the fill or the last partial close);
- long: `P_t ≤ koE8` → **knocked out**; `P_t ≥ capE8` → **capped**; short mirrored;
- otherwise skipped.

**Why a past print is safe here, unlike an open.**

- A knock-out pays the trader 0 whichever crossing print is used. A cap-out pays exactly m + r − fees. So the prover's choice
  of print moves no money.
- The print store accepts any second's unique print within the verifier's admission (300 s for Pyth crypto,
  `pool-terms.ts:19-24`). So the barrier is effectively watched every second, as long as a keeper looks within five minutes.

**Without barrier semantics, a ride would be a capped option.** A ride that dipped through its KO and recovered would come
back to life: free optionality the pool would give away.

**The remaining race.** A close that fills at a later print before anyone proves an earlier crossing escapes the knock-out
(the first valid transaction wins). The relay checks the crossing first, since it holds the stream. This is documented, not
contract-enforced.

**Keeper fee.** On a knock-out the keeper gets min(`KO_KEEPER_BPS` × m, `KO_KEEPER_CAP`), paid out of the forfeited margin.
The pool gets the rest of m + r.

### 2.6 TP / SL / TRAIL (the D-292 pattern)

`ExitOrders` becomes generic: a key per (book, id), and `uint64` levels (bands store a bid × 1e6, rides a price × 1e8).
For rides:

| Exit | Who fires | The fill at the next print requires |
|---|---|---|
| Take-profit level | Anyone (`fireRideExit`) | X ≥ TP (long) / X ≤ TP (short) |
| Stop-loss level | Anyone | X ≤ SL (long) / X ≥ SL (short): a stop-market, bounded by the KO |
| Trail | The `EXIT` role (the relay's sponsor lane, as `fireTrail`) | X ≥ the owner's floor (e.g. break-even) |

- **Trail mechanics.** The keeper ratchets the stop off chain, as Tradash does: it arms once the move passes trail % beyond
  break-even, and stop = max(p·(1 − pct), ref) (`05` §3.1).
- **Refusals.** A miss refuses the fill (`REFUSE_EXIT`) and leaves the exit standing; an epoch bump revokes it.
- **Optional upgrade:** a permissionless trail. The keeper proves a recorded peak print and a later print ≥ trail % below it.
  The peak must be recorded within its 300 s admission.

### 2.7 Fees and spread (no funding in v1)

**Spread**

- h = min(`MAX_SPREAD_BPS`, max(`baseSpreadBps`, ⌈conf/P × `CONF_SPREAD_MULT`⌉)).
- So it widens with Pyth's own confidence: the verifier already refuses a crypto print wider than 25 bp
  (`PythPrintVerifier.sol:82`).
- Suggested base: BTC/ETH 2 bp; SOL/XRP/BNB 3 bp; DOGE/HYPE 5 bp.

**Fees**

- **Open:** `openFeeBps` of N, paid on top of the margin, so the KO stays a pure function of the entry.
- **Close:** `closeFeeBps` of the exit notional.
- **Suggested:** 4 bp each (gTrade BTC 3.5, Bulk taker 3.5, GMX 4–6).

**Hold fee**

- `holdFeeE6PerHour` × N × hours. Suggested 50 (0.005%/h ≈ 44%/year of notional, inside GMX's 45–55% borrow band).
- It is taken from equity at the exit (never more than the equity).
- It prices the reserve the pool locks for an open-ended ride.
- The KO and cap stay fee-free, so the Liq price never drifts. Earn counts the fee only once realised.

**Why no funding**

- Funding needs a per-market index and per-position snapshots: exactly where D-161/D-182 were.
- The pool is the counterparty and is fully reserved. Skew is bounded by `skewCapBps` with the reducing side always allowed
  (§2.8). The hold fee pays for the capital.
- Funding can come later behind the same tests.

### 2.8 Capacity: the pool never owes more than it holds

At the fill, in order:

1. `liquid ≥ r`.
2. `(reserved + r) ≤ maxExposureBps × (liquid + reserved)`. This is the existing 60% cap, shared with calls
   (`BandPool.sol:113-118`).
3. `linearReserved + r ≤ maxLinearBps × (liquid + reserved)`, so rides can't starve calls or the reverse.
4. `marketReserve + r ≤ min(marketReserveCap, marketReserveBps × (liquid + reserved))`.
5. \|long − short notional\| after the trade ≤ max(before, `skewCapBps` × pool). A trade that reduces skew always passes.
6. `count < MAX_OPEN_PER_SIDE`, which keeps the frontier refresh (§2.10) to one transaction.
7. **Hourly loss brake.** If the pool's realised ride loss this hour exceeds `maxHourlyLossBps` of the pool, new opens are
   refused until the next hour. Closes, exits and bounds keep working. This is the Ostium lesson: a cap per trade is not a
   cap per hour.

Because every ride's maximum loss is reserved, capacity checks need no mark. On mainnet the most the pool can lose is Σr,
which by (2)–(4) is a fraction of the seed: the owner's "losses capped to the seed" rule, by construction.

Capacity examples:

- **Testnet** (10M Test USD, `maxLinearBps` 30%): rides can reserve 3M Test USD, i.e. about 333k margin at 40×, or 13.3M
  notional.
- **Mainnet** with a seed S (unknown; illustrated at $5,000), BTC `marketReserveBps` 10%, terms 400% / 10%:
  - BTC rides can reserve $500 at once;
  - that's $125 of 40× margin (five $25 rides), or $500 at 10×.
  - That is the honest price of full reservation.

### 2.9 Ledger entries

The `BandPool` invariant gains one bucket:

`balance ≥ liquid + reserved + escrowedStakes + margins + committedStakes + payableTotal + totalOwed`

Here `reserved` includes `linearReserved`. It is rechecked after every path.

| Event | Entries |
|---|---|
| Commit open | pull m + fee; `committed += m + fee` |
| Fill | `committed −= m + fee`; `margins += m`; `liquid += fee`; `liquid −= r`; `reserved += r`; `linearReserved += r`; side aggregates `+=` |
| Refuse or expire open | `committed −= m + fee`; pay-or-owe m + fee to the owner |
| Close / exit at X (fraction f) | e = clamp(m_f + pnl_f, 0, m_f + r_f); fees = min(close + hold, e); `margins −= m_f`; `reserved −= r_f`; `linearReserved −= r_f`; `liquid += m_f + r_f − (e − fees)`; pay-or-owe e − fees to the recipient |
| Knock-out at P_t | `margins −= m`; `reserved −= r`; `liquid += m + r − keeperFee`; pay-or-owe keeperFee to the caller |
| Cap-out at P_t | as a close with e = m + r |

Per-ride conservation, an exact test: m + r = payout + pool's take + keeper fee. Over a ride's whole life the trader loses
at most m + openFee, and the pool at most r.

### 2.10 Earn with rides: an exact mark, and fair rolls

**Today.** `PoolShares` values the pool at `liquid + reserved` (`PoolShares.sol:290-292`), and rolls an hour only once every
window ending in it is settled (`:230-243`). That is fair for calls, which always settle. Rides never settle on a schedule,
so the roll must mark them.

**1. The mark.**

- The roll records (or reads) the unique print at one instant m, for every market with open rides:
  - H ≤ m ≤ now;
  - now − m ≤ `MARK_MAX_AGE_SEC` (5 s).
- The value: V = liquid + reserved − Σ_markets [P_long·Σs_long − Σ(s·x)_long + Σ(s·x)_short − P_short·Σs_short] /
  `RIDE_SCALE`.
  - Here P_long = P_m(1 − h_base) and P_short = P_m(1 + h_base): the exit prices.
  - That's O(markets), from the side aggregates.

**2. Why it's exact: the bound frontier.**

- The unclamped sum equals the true clamped value only if no ride is past its KO or cap at P_m. (Between the KO at 90% and
  zero equity there's a ≥ 0.1/L price gap, ≫ h, so the lower clamp never binds before a KO.)
- Each `RideSide` keeps `koEdgeE8` and `capEdgeE8`:
  - widened on every fill;
  - never narrowed on exits (a stale edge is only ever *more* extreme, so the check stays conservative);
  - reset when the side's count hits 0.
- **The roll requires** the long KO edge < P_m < the long cap edge, and the short cap edge < P_m < the short KO edge. If any
  check fails, the roll reverts: keepers knock out or cap the offenders *at P_m*, then retry.
- **A false alarm** (the edge belonged to a ride that already left) is cleared by `refreshFrontier(market, side, ids)`. It
  takes the full id list of the side and checks: strictly increasing ids, each open, count equal. Then it recomputes the
  edges. That's O(n ≤ `MAX_OPEN_PER_SIDE`), cheap under MIP-8.
- No sorted list, no hints at fill time.
  - The alternative is a Liquity-style sorted list (`liquity/dev` `SortedTroves.sol`): O(1) per operation, but every fill
    needs a hint.
  - It's only worth it if `MAX_OPEN_PER_SIDE` bites.

**3. Request cutoff.**

- A supply or withdrawal made after H joins the batch for H + 1h.
- Today `_supply` / `_withdraw` join whatever batch is open (`PoolShares.sol:186-207`). So a request at H + 30 s, before the
  keeper's roll, is valued with calls opened at H still "at cost" while their price has moved. That's a small leak for calls
  that exists **today**.
- With the cutoff, no requester knows anything past H. `PoolShares` isn't deployed yet, so this costs nothing.

**4. A deferred withdrawal holds liquidity.**

- A withdrawal batch the pool's liquid can't cover waits (`:256-265`).
- Add a `withdrawHold` that `PoolShares` sets on the pool. `_hasCapacity` then counts `liquid − withdrawHold` before new
  calls or rides.
- So open-ended rides can't keep leavers waiting forever. GMX caps withdrawals by reserve for the same reason.

**What's left.**

- The roll caller can pick m within the 5 s window: optionality of about 5 s of price × the net ride exposure.
- Rides closed after H realise at their own print, not P_H. That's a value mix between cohorts nobody can trade on, because
  requests close at H.
- Both are documented and bounded.

### 2.11 Closed markets, halts and stale prices

- **v1 lists 24/7 Pyth crypto only:** BTC, ETH, SOL, XRP, BNB, DOGE, HYPE. That is Tradash's and Bulk's universe, and it keeps
  Earn's mark available every hour.
- **Calendar markets come later** (TSLA, QQQ, gold, silver, the euro, RedStone). Rides stop opening `SESSION_LOCKOUT_SEC`
  (300 s) before the session close, and anyone may close them at the last session print (`closeAtSession`). So no ride, and
  no Earn mark, sits across a weekend gap.
  - This is Ostium's stock auto-close made universal.
  - The MarketCalendar check reuses `Windows._requireSession` logic.
  - RedStone's 10 s grid would mean fills up to 10 s late (`pool-terms.ts:31-44`). Keep RedStone markets for calls.
- **Halts and staleness.**
  - With no Pyth print in `[t, t + 5 s]`, nothing fills: opens refund, closes refuse and the ride stays open, and no bound can
    be proven.
  - Prints wider than 25 bp are refused on chain and widen the spread below that.
  - The api's halt rule (D-289) stops quoting only.
  - Earn's roll waits until every market with open rides has a print. Requests stay queued and cancellable.

### 2.12 Named constants and starting parameters

| Constant (compile-time bound) | Value | Per-market setting | Testnet | Mainnet |
|---|---|---|---|---|
| `RIDE_SCALE` | 1e20 | `maxLeverageBps` | BTC 400k, ETH 250k, SOL/XRP 200k, others 100k | same |
| `MAX_LEVERAGE_BPS` | 500,000 (50×) | `maxProfitBps` | 90,000 (900%) | 40,000 (400%) |
| `MAX_PROFIT_BPS` | 90,000 | `maxMoveBps` | 2,500 (25%) | 1,000 (10%) |
| `MAX_MOVE_BPS` | 5,000 | `baseSpreadBps` | 2–5 | 2–5 |
| `KO_LOSS_BPS` | 9,000 | `openFeeBps` / `closeFeeBps` | 4 / 4 | 4 / 4 |
| `KO_KEEPER_BPS` / `KO_KEEPER_CAP` | 200 / $5 | `holdFeeE6PerHour` | 50 | 50 |
| `MAX_SPREAD_BPS`, `CONF_SPREAD_MULT` | 50, 1 | `marketReserveBps` / cap | 1,500 / 1.5M | 1,000 / sized at S9 |
| `MAX_FEE_BPS` | 20 | `skewCapBps` | 5,000 | 3,000 |
| `MAX_OPEN_PER_SIDE` | 400 | `minMargin` / `maxMargin` | $1 / $1,000 | $1 / $25 (= stake caps) |
| `MARK_MAX_AGE_SEC`, `SESSION_LOCKOUT_SEC` | 5, 300 | `maxLinearBps` (pool) | 3,000 | 3,000 |
| `MIN_HOLD_SEC`, `FILL_DELAY_SEC` | 3, 1 (existing) | `maxHourlyLossBps` (pool) | 1,000 | 1,000 |

### 2.13 Files (each ≤ 400 lines) and what else changes

**Contracts**

- **New:**
  - `RideTypes.sol` (~150: constants, structs);
  - `LinearMath.sol` (~150: entry/exit, size, pnl, clamp, KO/cap, fees, side PnL — pure, mirrored);
  - `RideLedger.sol` (~180: side aggregates, frontier, capacity, book/release, the loss brake);
  - `LinearBook.sol` (~380: commit, finalize, expire, close, exits, `settleBounds`, `refreshFrontier`, `markAt`, views);
  - `IRideBook.sol` (events and errors).
- **Changed:**
  - `BandPool` (`margins` bucket, `linearReserved`, `withdrawHold`);
  - `ExitOrders` (generic key and `uint64` levels);
  - `BandBook` (adds `listSeries` — σ plus the menu in one call);
  - `BandReserve` (composes `LinearBook`);
  - `PoolShares` (hour-keyed batches, the mark, `withdrawHold`).

**Off chain**

- **TS mirror:** `packages/core` ride maths, bit-exact vectors shared with `LinearMath` (the D-262 pattern).
- **Config:** ride terms per network in `pool-terms.ts`; ride markets in the catalogue (D-268); gas limits.
- **Relay:**
  - `POST` ride commits;
  - `FillBatcher` keyed by (book, feed, target) (`fills.ts`);
  - a **BoundWatcher** beside the exit watcher (1 s tick, `constants.ts:21`): on a crossing it records the print and calls
    `settleBounds` before any pending close at a later print;
  - ride exits.
- **Keeper:**
  - fills backup;
  - a bounds sweep from the `pyth_prints` archive inside the 300 s admission;
  - `refreshFrontier` plus the mark before `roll` (`jobs/earn.ts`).
- **Indexer:** ride entities.
- **Apps** (`@senryo/calls`, D-282): a Ride mode with Size, Leverage, Fees and Trailing; the Liq / B/E / TP / SL / Trail tags;
  the linear live pass; the positions book; the CLOSE/TRAIL morph.

---

## 3. Deploy path and MON

### 3.1 What survives a `BandReserve` change

- **Survives:** AccessManager `0x2da4…`, MarketCalendar `0x4681…` (weeks and holidays set), the five verifiers, `Windows`
  `0x4a97…` with its 54 registered series and policies, and TestUSD `0xABb0…` (`ids-and-txs.md:129`).
- **Lost:** `BandReserve` `0x72E4…9D04`, with the σ and five-band menus of 54 series. Also `DuelArena` `0xeCe2…` (its reserve
  is immutable, `DuelLedger.sol:33`) and its tiers, and the AccessManager wiring for those two targets.
- **Not yet on chain:** `PoolShares` and `EventBook` (`EventLedger.sol:33` binds to the reserve), so they simply deploy
  against the new one.
- **History.** The v2 reserve was never seeded, so it holds no user history. Practice history stays on the v1 reserve, which
  the indexer keeps reading (D-291).

### 3.2 Cost per route

At 103 gwei (1M gas = 0.103 MON), from the gas charged per call type on 10 Oct:

| Call | Charged gas each |
|---|---|
| `registerSeries` | 270,835 |
| `setSigma` | 157,261 |
| `addBand` | 175,936 |
| `BandReserve` create | 11,464,160 |
| `DuelArena` create | 5,564,826 |

Monad bills the gas limit; small calls were charged 5–8× forge's simulation (`addBand` 30,753 simulated).

| Item | Finish today's plan | A: one reserve, batched listing | A without batching | B: separate `LinearReserve` |
|---|---|---|---|---|
| Remaining `registerSeries` (82) | 2.29 | 2.29 | 2.29 | 2.29 |
| σ + menus on the reserve | 82 series: 8.76 | 136 series: **4.9–7.0 (UNVERIFIED, 350–500k each)** | 136 series: 14.52 | 82 series: 8.76 |
| New reserve create (~55–60 KB est.) | — | 1.65–1.85 | 1.75 | — |
| `DuelArena` + tiers + roles | — | 0.70 | 0.70 | — |
| `LinearReserve` create (~25–32 KB est.) + roles + fund | — | — | — | 0.85–1.05 |
| Ride markets (7 × ~200k) | — | 0.14 | 0.14 | 0.14 |
| `PoolShares`, `EventBook`, seed, roles | 0.90 | 0.90 | 0.90 | 0.90 |
| **Total from now** | **≈ 12.0** (13.3 recorded with margin) | **≈ 10.6–12.9** | **≈ 20.3** | **≈ 12.9–13.2** |

- **Already spent and lost under A:** about 7.6 MON (the 54-series listing at 5.77 MON, plus the reserve, arena and tiers). It
  is gone either way. Every series listed on the old reserve *before* deciding adds about 0.107 MON of waste.
- **Measure before choosing.** Run one `eth_estimateGas` on testnet for a five-band `listSeries` against a fork of the new
  reserve. If it comes in above about 700k, A costs more than B.
- **Script changes.**
  - `AddMarkets.s.sol` gains a "replace reserve" step (deploy, wire roles, re-tier the arena) and calls `listSeries`.
  - Before resuming, copy the partial address book (`~/.config/senryo/deploy/10143.partial-book.json`).
  - The indexer config drops the v2 reserve.

---

## 4. Tests that matter (money correctness only)

**Suite setup.** Handler-based invariants with `fail_on_revert = false`. They **record panics** (`invariant_noPanics`, the
D-182 lesson) and interleave calls, parlays, rides, exits, bounds, Earn requests and rolls over a random-walk print path with
gaps.

### Invariants

1. **Solvency.** `balance ≥ liabilities()` after every action. With no donations: `balance == liabilities()`.
2. **Every unit has a home.**
   - `margins == Σ open m`; `linearReserved == Σ open r`.
   - Each side's `size`, `cost`, `margin`, `reserve` and `count` equal the sums over its open rides (D-182).
3. **Conservation per ride.** m + r = payout + pool take + keeper fee, exactly. Trader loss ≤ m + openFee. Pool loss ≤ r.
4. **Bounds.**
   - Payout ≤ m + r − fees.
   - No knock-out unless P_t ≤ ko (long), at a print with t ≥ `updatedAt`.
   - No cap-out unless P_t ≥ cap.
   - A ride can't be settled twice. A close against a knock-out race pays exactly once.
5. **Caps hold at every fill.** Exposure; the linear share; per market; skew (the reducing side always allowed); the hourly
   loss brake; `MAX_OPEN_PER_SIDE`.
6. **The frontier is conservative.** Every open long has ko ≤ `koEdge` and cap ≥ `capEdge`, and the mirror for shorts.
7. **Exits are re-checked at the fill.** A fired TP or SL whose fill print misses its level refuses and stays armed (the
   Gains-fork bug).
8. **Session.** A ride open spends m + fee from the session caps. A delegate's payouts only go to the owner. An epoch bump
   revokes ride exits and intents.

### Fuzz and differential tests

1. **`markAt(P)` against brute force.** With the frontier clean, it equals Σ clamp(pnl_i(X), −m_i, r_i) over the open rides.
   It reverts when any ride is past a bound.
2. **Earn fairness.**
   - Supplying then withdrawing across one roll never returns more than went in.
   - A request after H settles at H + 1h.
   - A deferred withdrawal blocks new risk beyond `liquid − withdrawHold`.
   - The roll refuses a mark older than 5 s or before H.
3. **Rounding against the account.** Gains floor, losses ceil; the entry rounds against the trader; size floors; the basis
   leaving a partial close ceils.
4. **TS mirror bit-exact.** Shared vectors for entry, size, pnl, equity, KO, cap, break-even and fees (the `BandMath` /
   `band-quote.ts` pattern).
5. **Timing.**
   - A fill only at the unique print of commit + 1 s.
   - A config change refuses opens.
   - No print within admission → refund.
   - A close can't fill before `MIN_HOLD_SEC`.
   - Calendar markets refuse opens inside the lockout.
6. **A fork test on 10143** with real Hermes payloads through `ensurePrint` (the S2 smoke pattern).

---

## 5. Recommendation, effort and risks

### Recommendation

1. **Build rides as `LinearBook` inside a new `BandReserve`,** on the one shared pool. Decide **before the v2 deploy resumes**:
   - add `listSeries` in the same change;
   - measure its gas first (§3.2);
   - redeploy the reserve and `DuelArena`;
   - deploy `PoolShares` with the cutoff, mark and `withdrawHold`, and `EventBook` on the new reserve.
2. **Ship rides on testnet first, with Pyth crypto only.** Calendar markets follow once `closeAtSession` lands.
3. **Mainnet follows S9's fresh deploy,** so there's no extra cost there. Use tighter terms (400% / 10%), small per-market
   reserves and the hourly loss brake. The owner's seed is the hard ceiling on what the pool can lose.
4. **Fallback (route B):** a separate `LinearReserve`, house-funded and outside Earn. Use it if the owner wants zero change to
   `BandReserve`, or if a batched listing measures above about 700k gas.

### Effort (estimate)

| Area | Developer-days |
|---|---|
| Contracts and tests | 7–9 |
| TS mirror and config | 1.5–2 |
| Relay, keeper, indexer | 4–5 |
| Both apps (Ride mode, tags, positions book) | 6–9 |
| Deploy and gates | 1.5–2 |
| **Total** | **≈ 21–29** |

Some app work overlaps the replan's positions book (`00-synthesis.md` §1).

### Risks

- **Product and policy.**
  - It reverses D-256 ("prediction market route") and D-270's copy rule ("No 'options', 'leverage' or 'trading' wording",
    `pivot-2026-10-08.md:146`).
  - Apple **3.2.2(viii)**: "Apps that facilitate trading in contracts for difference ('CFDs') or other derivatives (e.g.
    FOREX) must be properly licensed in all jurisdictions where the service is available."
  - Real-money rides on the phone may not pass review. Keep real-money rides on the web, or Practice-only on the phone, until
    the owner decides.
  - Region blocks (D-273) apply as they do to calls.
- **Adverse selection (UNVERIFIED).** The 1 s fill delay should neutralise exchange-leads-Pyth latency, and the 3 s hold blocks
  instant round trips. Neither is measured.
  - How to check: replay the `pyth_prints` archive against an exchange tape, and test whether the last second's exchange
    return predicts the next print. If it does, widen h or add gTrade/Ostium's decaying early-close fee.
- **Keeper liveness.** If no knock-out is proven within 300 s of a crossing, a ride that recovers keeps living: optionality the
  pool gives away. Mitigations: the relay's BoundWatcher plus the keeper's archive sweep, and an alert on missed crossings.
- **Earn residuals.** Optionality of about 5 s in the mark instant, and the cohort mix (§2.10). A long Pyth outage also blocks
  rolls.
- **Engineering.**
  - A larger core contract (≈ 55–60 KB) and a redeploy.
  - Bugs in O(1) aggregates are the historical failure mode. The aggregates == Σ positions invariant and panic recording are
    mandatory.
- **Capacity on mainnet is small by design.** About $125 of 40× BTC margin per $5,000 of seed at 10% per market. Rides show
  "pool busy" often until Earn grows.
- **Correlated crypto moves.** All of BTC, ETH, SOL and the rest move together. The per-market caps don't net that. The
  `maxLinearBps` share and the hourly loss brake are the backstop.

### Questions for the owner, in plain words

1. Rides make Senryo a leveraged long/short app as well as a prediction app. That reverses the 8 Oct "predictions only"
   decision and its no-"leverage" wording rule. Go ahead?
2. Real-money rides on iPhone risk App Store rejection (Apple's licensing rule for derivatives). Keep real-money rides on the
   web only, and Practice rides on the phone?
3. One pool behind calls and rides means Earn suppliers share ride risk, with a cap on the rides' share. Agreed? The
   alternative is a separate house-only ride pool.
4. Pause the deploy resume until the new reserve is ready. Resuming now spends about 0.107 MON per series on a reserve that
   would be replaced.

## Sources

**Senryo**

- Contracts: `contracts/src/markets/*.sol`.
- The removed engine: `git show cd37e193^:contracts/src/{core,libraries,lp}/…`.
- Decisions: `docs/plan/decisions.md` D-161, D-181, D-182, D-256, D-260, D-261, D-264, D-276, D-287, D-289, D-291, D-292,
  D-293, D-296.
- Deploy: `docs/plan/ids-and-txs.md:52, 129`; `contracts/broadcast/DeployMarkets.s.sol/10143/run-latest.json`.
- Earlier studies: `docs/research/replan-2026-10-10/01-tradash.md`, `05-contract-live-pnl.md`.

**Mitoshi and Owarine**

- `crypto-world-fair/contracts/src/products/leverage/{LeverageReserve,LeverageMath}.sol`.
- `owarine/daml/abu-pm-tickets/daml/PM/Tickets/Boost.daml`.

**gTrade**

- https://docs.gains.trade/gtrade-leveraged-trading/fees-and-spread
- https://docs.gains.trade/developer/technical-reference/contracts/changelogs/v10-update
- https://docs.gains.trade/liquidity-farming-pools/gtoken-vaults
- https://github.com/GainsNetwork-org/sdk/blob/main/src/trade/liquidation/index.ts
- https://docs.gains.trade/changelog

**Avantis / Veranta**

- https://docs.veranta.xyz/trading/liquidations
- https://docs.veranta.xyz/trading/limitations-and-safeguards
- https://docs.veranta.xyz/trading/fees/net-rate-funding-+-borrow
- https://docs.veranta.xyz/liquidity-providers/veranta-lp-vault-avusdc
- https://docs.veranta.xyz/trading/execution-and-pricing/accurate-oracle-execution

**Ostium**

- https://docs.ostium.com/traders/reference/fees
- https://docs.ostium.com/traders/trading/liquidation
- https://docs.ostium.com/traders/trading/stocks-day-trading
- https://docs.ostium.com/vault/overview

**GMX v2**

- https://github.com/gmx-io/gmx-synthetics (README; `config/markets.ts`)
- https://docs.gmx.io/docs/trading/fees
- https://docs.gmx.io/docs/trading/liquidations
- https://docs.gmx.io/docs/providing-liquidity

**Bulk**

- https://docs.bulk.trade/architecture/overview
- https://docs.bulk.trade/bulk-exchange/fees
- https://docs.bulk.trade/bulk-exchange/Margin
- https://mainnet-api1.bulk.trade/api/v1/exchangeInfo

**Incidents**

- https://crypto.news/gmx-dex-suffers-565000-exploit-on-avalanche-avax/
- https://www.halborn.com/blog/post/explained-the-gmx-hack-july-2025
- https://theblock.co/post/410122/ostium-post-mortem-exploit (not independently verified)
- https://www.zellic.io/blog/issues-in-forks-of-gains

**Platform**

- Monad: https://docs.monad.xyz/developer-essentials/opcode-pricing
- Apple: https://developer.apple.com/app-store/review/guidelines/ (3.2.2(viii))

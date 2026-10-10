# R3 — Contracts v3: rides, calibrated calls, fair Earn (replan stage 3)

**Goal:** one new `BandReserve` carries:
- the linear "ride the price" book;
- call pricing that follows the market;
- a batched listing;
- Earn that values open rides exactly.

Tested to the money invariants. Not deployed until R4.

**Authority:**
- `replan-2026-10-10.md` R3; D-299, D-300, D-301, D-306, D-307, D-309;
- research `07-ride-the-price.md` (§2 design, §2.12 constants, §4 tests) and `08-spreads-and-fees.md` (§1.3, §5, §6);
- the removed linear engine (`git show cd37e193^:contracts/src/{core,libraries}/…`) for rounding (`PerpMath`) and
  as the record of the D-161, D-181 and D-182 bugs.

**Gate:**
- `pnpm gate` 0;
- `forge test` 0 failing, including the existing 101 tests;
- invariant runs record panics (`invariant_noPanics`), and aggregates == Σ positions;
- TS mirror vectors bit-exact;
- a fork test on 10143 with real Hermes payloads;
- `listSeries` gas estimated on testnet and recorded;
- contract size under Monad's limit.

## Steps

### Measure first
- [ ] R3.1 `listSeries` prototype on a fork of 10143: `eth_estimateGas` for a five-band listing. Above ~700k, switch
  rides to route B (a separate `LinearReserve`) and record why.
- [ ] R3.2 Calibration fit:
  - fit the fat-tailed probability table (per lane if needed) from archived `pyth_prints`, plus Binance 90-day 1-minute
    bars as the proxy (`scripts/calibrate/`; data in the scratchpad, the table committed);
  - a held-out check of Up/Down and Range within ±5 % of fair.

### Calls
- [ ] R3.3 `BandMath`: the calibrated table replaces the 81-point Φ table; the TS mirror (`packages/core/src/market/band-math.ts`) moves with it.
- [ ] R3.4 σ marks (D-300):
  - a keeper-signed `(series, sigma, minute)` carried in `finalize`'s calldata;
  - checks on the signer role, freshness (≤ 2 min) and the per-series floor and cap;
  - `setSigma` keeps the admin floor and cap only, with no global version bump.
- [ ] R3.5 The spread curve: h(p) = max(0.25 pt, 4·h50·p(1−p)), with h50 per series. Bounds checked against
  `MarketTypes` limits.
- [ ] R3.6 `FILL_DELAY_SEC` becomes a bounded parameter (1–3 s).
- [ ] R3.7 `listSeries(series, sigma, menu)`: one call per series. Band widths come from realised σ at listing.

### Rides
- [ ] R3.8 `RideTypes.sol`, `LinearMath.sol` (pure: entry, size, pnl, equity clamp, KO, cap, fees, side PnL; rounding
  against the account as in `PerpMath`) and `IRideBook.sol`.
- [ ] R3.9 `RideLedger.sol`:
  - side aggregates updated only with stored values (the D-182 rule);
  - the bound frontier (`koEdge`, `capEdge`);
  - the capacity checks (07 §2.8: liquid, the 60 % exposure cap, the 30 % linear share, a per-market reserve, skew with
    the reducing side allowed, `MAX_OPEN_PER_SIDE`, the hourly loss brake).
- [ ] R3.10 `LinearBook.sol`:
  - `commitRide` (owner or session; margin + fee within the session caps);
  - `finalizeRides` and `expireRides`;
  - close/reduce at the next print;
  - `settleBounds` at a recorded print;
  - end-of-life settle at fill + 4 h;
  - `refreshFrontier`;
  - `markAt`;
  - views.
- [ ] R3.11 Ride fees (D-301):
  - by class, with the maker rate when skew falls;
  - the early-close fee (profits only, capped at the profit);
  - the keeper fee on a knock-out.
- [ ] R3.12 `ExitOrders` becomes generic: a key per (book, id) and `uint64` levels. Ride TP and SL can be fired by
  anyone, the trail by the `EXIT` role; each is re-checked at the fill print.

### Pool and Earn
- [ ] R3.13 `BandPool`:
  - a `margins` bucket, `linearReserved` and `withdrawHold`;
  - the liabilities sum gains margins;
  - `_hasCapacity` counts `liquid − withdrawHold`.
- [ ] R3.14 `BandReserve` composes `LinearBook`; size checked against the limit.
- [ ] R3.15 `PoolShares` (D-307):
  - hour-keyed request batches (a request after H joins H + 1h);
  - the roll marks open rides at a print ≤ 5 s old with H ≤ m ≤ now, after the frontier checks;
  - `withdrawHold` set while a batch waits.

### Tests (money only)
- [ ] R3.16 07 §4 handler-based invariants:
  - solvency, and every unit has a home;
  - per-ride conservation;
  - bounds; caps at every fill;
  - the frontier is conservative;
  - exits re-checked at the fill;
  - session limits.

  Calls, parlays, rides, exits, bounds and Earn are interleaved over a random-walk print path with gaps.
- [ ] R3.17 Fuzz and differential tests:
  - `markAt` against brute force;
  - Earn fairness (no gain from supplying and withdrawing across a roll; the cutoff; `withdrawHold`; mark age);
  - rounding;
  - timing (fill only at commit + delay, config refusals, no print → refund, minimum hold);
  - σ marks (stale, wrong signer, outside floor/cap → refused);
  - the spread curve at the probability bounds.
- [ ] R3.18 A fork test on 10143 through `ensurePrint` with real Hermes payloads.

### TypeScript and config
- [ ] R3.19 TS mirror:
  - `packages/core` ride maths, curve and σ, with shared vectors generated from Foundry (the `band-quote.ts` pattern);
  - `packages/chain` ride intents (EIP-712), decoders and `listSeries` data;
  - ABIs exported.
- [ ] R3.20 Config:
  - ride terms per network in `packages/config/src/pool-terms.ts`;
  - ride markets in the catalogue (7 Pyth crypto);
  - h50 per lane;
  - σ floor and cap per series;
  - `contracts/script/catalog/143.json` cut to Up and Down (D-306);
  - gas limits for the new calls.
- [ ] R3.21 Deploy scripts:
  - `MarketsBase.s.sol`/`AddMarkets.s.sol` get a "fresh v3 reserve" route that reuses the surviving contracts from
    the partial book, lists through `listSeries` and wires the roles (σ signer, rides, bounds, FUND, EVENTS, DUEL,
    EXIT);
  - a simulated run on a fork, with the MON estimate recorded.

## Handoff
(written at the end of the stage)

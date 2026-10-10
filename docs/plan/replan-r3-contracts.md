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
- [x] R3.1 `listSeries` prototype on a fork of 10143: `eth_estimateGas` for a five-band listing. Above ~700k, switch
  rides to route B (a separate `LinearReserve`) and record why.
  - **Built in its final storage shape:** one `SeriesBook` per series — terms (σ, σ floor and cap, h50) and the band
    count in slot 0, the menu packed 40 bits a band (`BandMath.pack`) in the next two, so a listing writes two slots of
    one MIP-8 page. `listSeries` lists once; `addBand` appends (D-306); `setSigma` stays inside the series' bounds
    (R3.4 turns it into the floor and cap only). Off chain nothing read `sigmaOf`/`menuOf` (the apps use the catalogue).
  - **Measured 10 Oct 21:15 UTC: 162,881 gas** on the live testnet RPC (`eth_estimateGas` from the AccessManager admin
    `0x52d2…0e6a`, the v3 reserve's runtime code and its four constructor slots supplied as a state override, BTC 5m
    on the live `Windows` `0x4a97…`, five bands); 160,440 on an anvil fork at block 69,929,601 with `--network monad`.
    The old route charged ≈ 1.04M per series (`setSigma` 157k + five `addBand` at 176k).
  - **Route A stands** (rides inside the reserve). At 103 gwei and forge's 1.3× limit multiplier a listing costs
    ≈ 0.022 MON, so 136 series ≈ 3.0 MON (07 §3.2 guessed 4.9–7.0). Monad bills the limit, so R3.21 sets the script's
    multiplier lower.
  - The deploy script still lists through `setSigma` + `addBand`; R3.20/R3.21 move it to `listSeries` with the
    catalogue's floors, caps and h50s.
- [x] R3.2 Calibration fit:
  - fit the fat-tailed probability table (per lane if needed) from archived `pyth_prints`, plus Binance 90-day 1-minute
    bars as the proxy (`scripts/calibrate/`; data in the scratchpad, the table committed);
  - a held-out check of Up/Down and Range within ±5 % of fair.
  - **Built** (D-313): `fetch-binance.sh` (checksummed data.binance.vision bars), `fetch-archive.mjs` (Pyth minutes from
    Senryo's own candles route — bulk Benchmarks pulls share the production key's quota and were refused after 30 min),
    `record-recent.mjs` (Pyth per second from `/v1/prices/recent`), `series.py`/`samples.py`/`model.py`/`bands.py`,
    `fit.py` (σ model and table tuned on real windows' band returns, two-fold cross-validation, prices mirrored),
    `subminute.py`, `codegen.mjs`. The table is `scripts/calibrate/table.json`.
  - **Result:** Up/Down within ±2.5 % of fair everywhere; Range within ±3.7 % on 5m/15m; **1h Range +7.7 % in one fold
    (fails the bar)**; Moonshot/Crash over-priced 4–19 % (pool-safe). Found on the way: the plain 30-min EWMA is
    conditionally biased (quiet minutes under-predict the next move by 55–90 %), and mid-window entries see narrower
    moves than random-time samples, so the table is tuned on window outcomes, not on the move distribution alone.
  - **On Pyth's own prints** (`check.py` on Senryo's archive, 52 h to 10 Oct 22:30 UTC, mostly a weekend): Up/Down
    +1.1 % / −2.1 % / −5.1 % (5m / 15m / 1h, about 50 hourly windows a market, so noisy); **Range +10.2 % on 5m**,
    +4.1 % on 15m, +1.1 % on 1h; Moonshot/Crash −30 % on 5m/15m. Pyth's aggregated minutes move less over short
    horizons than Binance's trades, so the Binance-fitted table is too wide for Pyth there.
  - **Open:** (1) refit the table on Pyth itself once the archive holds about two weeks (`fit.py` on archive minutes)
    and swap it in with `setTailTable` before R9 — until then testnet's 5m Range favours the caller by about 10 % in
    Practice money; (2) rows below a minute equal the 1-minute row until 12 h of the Pyth per-second record are in
    (λ(τ) by `subminute.py`); (3) 1h Range rechecked on Pyth history before any mainnet Range listing (D-306).

### Calls
- [x] R3.3 `BandMath`: the calibrated table replaces the 81-point Φ table; the TS mirror (`packages/core/src/market/band-math.ts`) moves with it.
  - The table (8 horizons × 101 points to z = 5, linear in z and in τ) and the σ model's weight and fade are a data
    contract (`TailTableData.BLOB`, SSTORE2) the reserve names (`tailTable`, `setTailTable` checks every row, bumps the
    version). `BandMath` reads only the bytes it needs. The mirror decodes the same blob (`decodeTailShape`) and ports
    Solady's `expWad`. `BandMathVectors.t.sol` pins 600 vectors to `packages/core/vectors/band-math.json`;
    `scripts/drive/src/band-math-vectors.ts` checks the mirror against them (600/600 bit-exact); the invariant
    `tail-table-sync` keeps both blobs equal to `table.json`.
- [x] R3.4 σ marks (D-300):
  - a keeper-signed `(series, sigma, minute)` carried in `finalize`'s calldata;
  - checks on the signer role, freshness (≤ 2 min) and the per-series floor and cap;
  - `setSigma` keeps the admin floor and cap only, with no global version bump.
  - Built as `SigmaMarks.sol` + `SeriesListing.sol` (D-313): a fast and a slow σ per feed, exactly the mark of the last
    minute boundary ≥ 5 s before the fill (not "≤ 2 min"), each σ clamped into the series' bounds, an allow-list of
    signers; `setSigmaBounds` moves the bounds with no bump. `finalize` and `finalizeParlay` carry the marks;
    `quoteOpen` takes one. Tests: `SigmaMarks.t.sol` (wrong minute either way, other feed, zero σ, forged and revoked
    signers, the clamp).
- [x] R3.5 The spread curve: h(p) = max(0.25 pt, 4·h50·p(1−p)), with h50 per series. Bounds checked against
  `MarketTypes` limits. (`BandMath.halfSpreadE6`; `Params.minHalfSpreadE6` is the floor; parlays use the widest leg's
  h50 on the joint chance.)
- [x] R3.6 `FILL_DELAY_SEC` becomes a bounded parameter (1–3 s). (`Params.fillDelaySec`, checked in `_setParams`.)
- [x] R3.7 `listSeries(series, sigma, menu)`: one call per series. Band widths come from realised σ at listing.
  (Terms are the σ floor and cap and h50 — σ itself comes with each fill's mark. The widths are the catalogue's, R3.20;
  `DeployMarkets`/`MarketsBase.s.sol` list through it.)

### Rides
- [x] R3.8 `RideTypes.sol`, `LinearMath.sol` (pure: entry, size, pnl, equity clamp, KO, cap, fees, side PnL; rounding
  against the account as in `PerpMath`) and `IRideBook.sol`.
- [x] R3.9 `RideLedger.sol`:
  - side aggregates updated only with stored values (the D-182 rule);
  - the bound frontier (`koEdge`, `capEdge`);
  - the capacity checks (07 §2.8: liquid, the 60 % exposure cap, the 30 % linear share, a per-market reserve, skew with
    the reducing side allowed, `MAX_OPEN_PER_SIDE`, the hourly loss brake).
- [x] R3.10 `LinearBook.sol`:
  - `commitRide` (owner or session; margin + fee within the session caps);
  - `finalizeRides` and `expireRides`;
  - close/reduce at the next print;
  - `settleBounds` at a recorded print;
  - end-of-life settle at fill + 4 h;
  - `refreshFrontier`;
  - `markAt`;
  - views.
  - Built as `LinearBook` (commit, fill, close/reduce, expire, the exit maths) and `RideBounds` (`settleBounds`,
    `settleEnds`, `refreshFrontier`, `markRides`, rides' exits). D-301 over 07: no spread (the entry is the print), no
    hold fee. A close whose own print is past the knock-out or cap settles as that. `markRides(t)` is Earn's mark: the
    side sums at the recorded prints of t, reverting if a frontier edge reaches a bound.
- [x] R3.11 Ride fees (D-301):
  - by class, with the maker rate when skew falls;
  - the early-close fee (profits only, capped at the profit);
  - the keeper fee on a knock-out.
  - The maker rate applies to a close too (closing the heavy side reduces skew); the taker fee is escrowed at commit
    and the difference refunded when the fill earns the maker rate.
- [x] R3.12 `ExitOrders` becomes generic: a key per (book, id) and `uint64` levels. Ride TP and SL can be fired by
  anyone, the trail by the `EXIT` role; each is re-checked at the fill print.

### Pool and Earn
- [x] R3.13 `BandPool`:
  - a `margins` bucket, `linearReserved` and `withdrawHold`;
  - the liabilities sum gains margins;
  - `_hasCapacity` counts `liquid − withdrawHold`.
- [x] R3.14 `BandReserve` composes `LinearBook`; size checked against the limit. (75,166 B runtime against Monad's
  131,072; the arena and events are unchanged.)
- [x] R3.15 `PoolShares` (D-307):
  - hour-keyed request batches (a request after H joins H + 1h);
  - the roll marks open rides at a print ≤ 5 s old with H ≤ m ≤ now, after the frontier checks;
  - `withdrawHold` set while a batch waits.
  - Built: requests keyed by the hour they settle at (`nextHour()`; an earlier unsettled request moves with a new
    one), rolls in order (`roll(H, markAt)`: a missed hour is rolled next, never stranded), `markRides(markAt)` off
    the value with `StaleMark` for a mark before H or older than 5 s, a deferred withdrawal batch `movedTo` the next
    hour whole with `setWithdrawHold`. Tests: `Earn.t.sol` (13, including the cutoff, the order, the mark and the
    hold refusing a new call).

### Tests (money only)
- [x] R3.16 07 §4 handler-based invariants:
  - **Rides done** (`RidesInvariant.t.sol`, 256 runs × 128 calls): opens filled like the relay, full and partial
    closes, lapses and expiry, knock-outs and cap-outs (a ±26 % shock action), ends, frontier refreshes, over a random
    walk with gaps — solvency to the unit with side sums == Σ rides, a conservative frontier, no rider paid past margin
    + reserve, **zero panics recorded**. The run's end states are logged so a green run can't be an idle one.
  - **Across books** (`PoolInvariant.t.sol`, 256 × 128): calls through the real window lifecycle (open with its print,
    fill on a signed mark, settle, claim), rides opened and closed, Earn supplies and withdrawals, and the keeper's
    hourly roll (bounds proved at the mark, frontiers refreshed) — the balance is every unit's home exactly, ride sums
    == rides, Earn holds what it owes, zero panics; logged reach: tickets settled and refunded, rides open and closed,
    16 rolls with rides marked. Parlays and call exits stay covered by their own suites (`Parlay.t.sol`,
    `Exits.t.sol`).
  - solvency, and every unit has a home;
  - per-ride conservation;
  - bounds; caps at every fill;
  - the frontier is conservative;
  - exits re-checked at the fill;
  - session limits.

  Calls, parlays, rides, exits, bounds and Earn are interleaved over a random-walk print path with gaps.
- [x] R3.17 Fuzz and differential tests:
  - `markAt` against brute force;
  - Earn fairness (no gain from supplying and withdrawing across a roll; the cutoff; `withdrawHold`; mark age);
  - rounding;
  - timing (fill only at commit + delay, config refusals, no print → refund, minimum hold);
  - σ marks (stale, wrong signer, outside floor/cap → refused);
  - the spread curve at the probability bounds.
  - `RideFuzz.t.sol`: the mark against brute force over random books (within a unit a ride, never under), rounding
    (a long and a short on one move never net a gain; size floors; parts leaving ceil), the curve's bid > 0 and ask
    < $1 at every quoted probability, a ride filling only at its own instant, the minimum hold, a session spending
    margin + fee; Earn fairness and the mark's age in `Earn.t.sol`; σ marks in `SigmaMarks.t.sol`.
- [x] R3.18 A fork test on 10143 through `ensurePrint` with real Hermes payloads.
  - `test/fork/Fork10143.t.sol` (`FORK_TESTS=true forge test --match-contract Fork10143Test`; skipped otherwise): the v3
    reserve against the live AccessManager, `Windows`, Pyth verifier and Test USD that v3 reuses, with two real Hermes
    BTC updates (`fixtures/btc-hermes.json`, 10 Oct 22:30 and 22:31 UTC): a window opened on the first, a call filled
    on a signed σ mark and a ride filled at the second, its bounds checked there, every unit at home. Passed at block
    69,947,517.

### TypeScript and config
- [x] R3.19 TS mirror:
  - `packages/core` ride maths, curve and σ, with shared vectors generated from Foundry (the `band-quote.ts` pattern);
  - `packages/chain` ride intents (EIP-712), decoders and `listSeries` data;
  - ABIs exported.
  - Built: `packages/core/src/market/ride-math.ts` (LinearMath, bit for bit) and `halfSpreadE6`;
    `packages/chain/src/ride-typed-data.ts` (`RideIntent`, `SigmaMark`); `RideMathVectors.t.sol` pins `LinearMath`,
    the curve and the reserve's EIP-712 digests to `packages/core/vectors/{ride-math,typed-data}.json`;
    `scripts/drive/src/mirror-vectors.ts` (`pnpm mirror`, now part of `pnpm gate`) checks 5,802 values bit-exact.
  - **Moved to R4, on purpose:** the ABI export, the exit order's TS shape (`(book, id)`, `uint64` levels) and the
    services' switch. The exported ABI is what HEAD's relay, keeper and indexer type against, and v3 changes core
    signatures (`finalize` carries a mark, `quoteOpen` takes one, `Params`, exits); exporting before the v3 deploy
    would leave HEAD unable to serve the live v1 reserve. They land together in R4. Note that the apps' quote mirror
    has priced the v3 way since R3.3, so until R4 a production hotfix branches from `b0a455e3` (R2's deploy).
- [x] R3.20 Config:
  - ride terms per network in `packages/config/src/pool-terms.ts`;
  - ride markets in the catalogue (7 Pyth crypto);
  - h50 per lane;
  - σ floor and cap per series;
  - `contracts/script/catalog/143.json` cut to Up and Down (D-306);
  - gas limits for the new calls.
  - Built: every market's `realisedVol` (the seven crypto from the 90-day fit, the rest S7's five-day σ without its
    ×1.5) sizes the bands and bounds the marks (¼× to 4×, `SIGMA_FLOOR_RATIO`/`SIGMA_CAP_RATIO`); `H50_E6` by lane;
    `PoolTerms.minHalfSpreadE6` and `fillDelaySec`; `quoteCurve` is the one builder of a quote's curve for the apps'
    hooks, the exit sheet's bid bounds, parlays (the widest leg's lane) and the api's Lucky and exit watcher;
    `ride-terms.ts` (`RIDE_MARKETS` in on-chain order, `RIDE_TERMS` per network, D-301); the catalogue export lists
    each series' bounds and h50 and the rides, and cuts mainnet to 5m/15m/1h with Up and Down (102 series; testnet
    136); ride gas budgets from the gas report. The api's catalogue `terms` renames `halfSpreadE6` →
    `minHalfSpreadE6`, so R4 deploys the api before the phone's OTA.
- [x] R3.21 Deploy scripts:
  - `MarketsBase.s.sol`/`AddMarkets.s.sol` get a "fresh v3 reserve" route that reuses the surviving contracts from
    the partial book, lists through `listSeries` and wires the roles (σ signer, rides, bounds, FUND, EVENTS, DUEL,
    EXIT);
  - a simulated run on a fork, with the MON estimate recorded.
  - Built: `MarketsV3Base.s.sol` (the table and reserve, the arena, σ signers for the keeper and the relay, the ride
    terms and markets — decoded once, since each JSON cheatcode copies the catalogue into memory and Monad caps a
    script at 8 MB), `ReplaceReserve.s.sol` (the route: survivors from the book; a v3 reserve in the book is kept on a
    rerun, recognised by `tailTable()`; arena, Earn and the event book on it; `listSeries` for every series; roles —
    EXIT on both trails, POOL on `defund` and `setWithdrawHold`), `DeployMarkets` on the same base, and `BOOK=` so a
    rehearsal writes its own book.
  - **Rehearsed 11 Oct on an anvil fork of 10143 (block 69,951,136), deployer unlocked:** 257 transactions, all
    successful — the v3 reserve, 136 series listed, 7 ride markets, Practice's 10M seeded, Earn, the arena and the
    event book, σ signers and roles. **Monad-model gas 70.1M → ≈ 7.6 MON** at 103 gwei with 1.05× limits (7.4–8.1
    across base fees): creates 3.0, listings 2.3, registering the 82 new series 1.8, the rest 0.4. `listSeries`
    averaged 159k, matching the live estimate (162,881). anvil estimates without Monad's rules and executes with them
    (a `setSigmaSigner` estimated 23k, used 97k), so R4 broadcasts against the live RPC, whose estimates are Monad's.
    The deployer holds 0.01 MON: R4 needs about 8 MON (9 with margin), not 13.

## Handoff

**Built and gated (11 Oct); not deployed — that is R4.** Commits `33dbf6b9` (R3.1) … this one.

- **Calls, pricing v3** (D-300, D-313): signed σ marks (a fast 30-min EWMA and a one-day anchor per feed and minute,
  exactly one valid mark per fill, clamped to the series' bounds), the calibrated fat-tailed table in a swappable
  data contract (`setTailTable`), the spread curve h(p) = max(0.25 pt, 4·h50·p(1−p)) by lane, a bounded fill delay,
  `listSeries` (162,881 gas live). Calibration: Up/Down within ±2.5 % of fair out of sample on every lane; Range
  within ±3.7 % on 5m/15m; **open:** 1h Range (+7.7 % in one fold) and 5m Range on Pyth's own prints (+10 %, a
  weekend sample) — refit on the Pyth archive once it holds about two weeks, before R9; sub-minute rows refit from
  the Pyth per-second record.
- **Rides** (D-299, D-301): `LinearBook` + `RideBounds` + `RideLedger` + `LinearMath` in the reserve on the shared
  pool — commit/fill at the next print, close/reduce, knock-outs and cap-outs at recorded prints, ends of life, TP/SL
  and the trail, maker/taker and early-close fees, the frontier and `markRides`; generic `ExitOrders`.
- **Earn v3** (D-307): hour-keyed requests, rolls in order with rides marked exactly, the withdrawal hold.
- **Tests:** 136 (+ the fork test, `FORK_TESTS=true`), handler invariants across calls, rides and Earn (zero panics,
  sums == rides, solvency to the unit), fuzz against brute force; `pnpm mirror` (in the gate) checks 5,802 mirror
  values bit-exact. BandReserve 75,166 B of 131,072.
- **Config:** realised σ per market, h50 by lane, σ bounds, ride terms per network, mainnet cut to 5m/15m/1h Up/Down.

**For R4:**
1. Fund the deployer (`0x52d2…0e6a`) with about 9 MON.
2. Copy `~/.config/senryo/deploy/10143.partial-book.json` over `packages/contracts/src/addresses/10143.json`, run
   `node scripts/catalog-export.mjs`, then `ReplaceReserve` against the live RPC (`--gas-estimate-multiplier 105`).
3. `pnpm contracts:export` — and in the same change move the services to v3: the relay's fills carry σ marks (the
   σ-mark signer: keeper and relay keys are already allowed signers), exits move to `(book, id)`, the keeper's roll
   passes a mark, ride routes; the indexer reads the v1 and v3 reserves. Deploy the api before the phone OTA (the
   catalogue's `terms` field is renamed).
4. Until R4 ships, HEAD's apps and services price the v3 way: a production hotfix branches from `b0a455e3`.

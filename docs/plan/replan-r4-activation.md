# R4 — Activation: v3 on chain, every product live (replan stage 4; was S8.9)

**Goal:** the v3 reserve and everything that waited on it are on Monad testnet:
- every S7 market;
- Earn, Parlays, Duel and Events;
- rides.

Services, indexer and both apps run against it. Every "next deploy" state disappears.

**Authority:**
- `replan-2026-10-10.md` R4; D-309 (supersedes D-291's route; v1 + v3 are both indexed);
- the R3 handoff;
- `docs/plan/ids-and-txs.md` (the partial book).

**Needs:** about 9 MON on the deployer `0x52d205731e97c90aab738ae66371449f585c0e6a` (R3.21: ≈ 7.6 MON rehearsed).
The owner tops it up; testnet transactions and deploys proceed without asking. Our own wallets hold ≈ 3.6 MON, the
keeper's 2.3 of it burning ≈ 1.3 a day on Practice prices, so they can't fund it (11 Oct).

**Order (11 Oct):** R4.1 waits on the MON. R4.2–R4.6 are built first against an anvil fork running the rehearsed v3
route (`ReplaceReserve` with `BOOK=`), then R4.1 runs and everything switches to the real addresses.

**Gate:**
- every money path once on chain, with tx hashes in `ids-and-txs.md`:
  - call open, close and exit;
  - ride open, close, knock-out, cap-out and end of life;
  - Earn supply, roll and withdraw;
  - a two-leg parlay;
  - a duel to its pot;
  - an event decided by its committee;
- `pnpm gate` 0 with the new address book;
- api, keeper, indexer and web deployed; phone OTA after a simulator pass.

## Steps
- [ ] R4.1 Deploy:
  - copy the partial book;
  - run the v3 route: v3 reserve, `DuelArena` and tiers, `PoolShares`, `EventBook` and committee, 136 series via
    `listSeries`, the ride markets, the seed, roles;
  - `pnpm contracts:export`;
  - `ids-and-txs.md` row with first and last tx, MON spent and addresses.
- [ ] R4.2 Keeper:
  - env gets `EVENT_SIGNER_{1,2,3}_PK` and `KEEPER_JOBS`: sync, settle, fills, parlays, duels, events, calendars,
    earn, retention, receipts, pushes, **sigma**, **rides**, **bounds**;
  - the σ-mark signer key is held by the keeper and given its role.
- [ ] R4.3 Keeper jobs:
  - `sigma`: an EWMA from `pyth_prints`, signed each minute. One shared definition in `@senryo/service-common`
    (`sigma-marks.ts`), the same as `scripts/calibrate/series.py` `SigmaMarks`:
    - fast: span 30 over 1-minute log returns between boundary prints; slow: span 1,440 (a day); both seeded with the
      plain mean of their first 30 returns; σ per √second × 1e8;
    - a boundary print more than 5 s old is no price (a closed market), and its return is skipped;
    - the running state (last price, both variances, counts) is stored with each mark in `sigma_marks` (one row per
      feed and minute, first writer wins), so a mark is the previous one plus one minute; a missing previous state is
      rebuilt from up to three days of `pyth_prints`.
    - The keeper signs every feed's mark about 2 s after each minute. A fill that finds no mark has the relay compute
      and sign it (its key is an allowed signer too), and the stored row always wins, so the relay and the keeper never
      disagree about a minute.
    - The api streams each new mark (`sigma` on the `markets` topic, plus `GET /v1/markets/sigma` for the last two per
      feed). The apps quote with the mark the fill will carry (`markMinuteOf(now + fill delay)`), clamped to the
      series' bounds, and the relay's exits, Lucky, Duel and Parlay prices use the same marks;
  - `rides`: backup fills, end-of-life settles;
  - `bounds`: an archive sweep within the 300 s admission;
  - `earn`: `refreshFrontier` and the mark before `roll`.
  - **Built (11 Oct):** `sigma-marks.ts` + `sigma_marks` (0023), the keeper's `sigma` job, the api's `SigmaDesk`
    (minute publisher at +4.5 s, `GET /v1/markets/sigma`, `sigma` frames on `prints`, signed fill marks), the apps'
    `SigmaBook` + `fillMark` in every quote (terminal, Duel, Parlay, Lucky), the relay's exits and Lucky on the live
    mark, `sigmaBoundsOf` / `lanesOn` / `menuOn` in config (the api's catalogue now lists exactly what the chain
    lists). Each return is `lnWad` of the integer prints, so every service computes the same bits: stepped and rebuilt
    marks agree on Postgres 16, and the TS EWMA matches `series.py` to the mark's integer rounding (7e-5).
  - **Earn (built):** rolls in order (`lastRoll + 1 h`); with rides open, one Multicall3 transaction just after a
    minute boundary records each ride market's print, refreshes every side's frontier from `market_rides` and rolls
    (`roll(hour, minute)` inside the 5 s rule); deliveries follow a deferred withdrawal's `movedTo`.
- [ ] R4.4 Relay:
  - ride routes (commit, close, exits);
  - `FillBatcher` keyed by (book, feed, target);
  - a `BoundWatcher` beside the exits watcher that settles a crossing before any later close;
  - σ marks attached to `finalize`;
  - `@senryo/api-client` ride routes and zod contracts.
  - **Built (11 Oct):** `RideRelay` (`POST /v1/rides/intents`: gates on the network's ride terms, queued by digest
    in `market_intents` book `ride`, committed on the owner's lane), `GET /v1/rides` and `/v1/rides/catalog`; the
    `FillBatcher` keyed by (book, feed, target) — `finalizeRides` in 32s, no mark; the `BoundWatcher` scans every
    second's print from the ring against each open ride's knock-out and cap, settles the first crossing with
    `settleBounds` (archiving the print), and the fill batcher sweeps a market through a ride close's second first;
    the `RideExitWatcher` (take-profit, stop-loss, the trail in bps of the price, `rideExitDecision` in core) fires
    on the EXIT lane and hands the close to the batcher; ride exits go through `/v1/markets/exits` (book 2); ride
    notices on `market_ride` reach the owner's stream as `ride`. Keeper: `rides` (sync with `rideOf`, backup fills,
    expiries, `settleEnds`) and `bounds` (the archive's crossings inside admission); the print watch archives every
    ride's fill target and end of life.
- [ ] R4.5 Indexer:
  - reads the v1 and v3 reserves;
  - ride entities (Ride, RideSide, records);
  - `PoolShares` v3;
  - codegen and tsc gate.
- [ ] R4.6 Common:
  - **Built (11 Oct):** 0023 `sigma_marks`, 0024 `market_rides` + `ride_exits` (+ `market_intents.book`, `ride_id`);
    `rides.ts` applies ride changes in order (a part close takes margin and reserve out ceiled, as `LinearMath.share`)
    and announces them on `market_ride`. All 24 migrations apply on a fresh Postgres 16.
  - The v1 → v3 event diff (for the indexer): `ExitSet`/`ExitFired` keyed `(book, id)`; rides add `RideCommitted`,
    `RideFilled`, `RideRefused`, `RideCloseCommitted`, `RideCloseRefused`, `RideExited`, `FrontierRefreshed`,
    `RideMarketSet`, `RideTermsSet`; listing adds `SeriesListed`, `SigmaBoundsSet`, `SigmaSignerSet`, `TailTableSet`,
    `WithdrawHoldSet`; `SigmaSet` is gone; Earn's `SupplyRequested`/`WithdrawRequested` are keyed by hour and
    `EpochRolled` adds `ridesOwed`. migrations for rides (`market_rides`, `ride_exits`) and pg_notify channels onto the `markets` and
  `user:` topics.
- [ ] R4.7 Apps: the Duel, Events, Earn, Parlay and stocks/baskets screens switch from read-only to live. Their R2
  interim states are deleted.
- [ ] R4.8 Deploy the api, keeper, indexer and web; phone OTA after one simulator pass; acceptance rows (S7, S8, rides).

## Handoff
(written at the end of the stage)

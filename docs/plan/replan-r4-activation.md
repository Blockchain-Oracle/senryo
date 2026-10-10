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

**Needs:** about 13 MON on the deployer `0x52d205731e97c90aab738ae66371449f585c0e6a` (R3.21 states the exact estimate).
The owner tops it up; testnet transactions and deploys proceed without asking.

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
  - `sigma`: an EWMA from `pyth_prints`, signed each minute;
  - `rides`: backup fills, end-of-life settles;
  - `bounds`: an archive sweep within the 300 s admission;
  - `earn`: `refreshFrontier` and the mark before `roll`.
- [ ] R4.4 Relay:
  - ride routes (commit, close, exits);
  - `FillBatcher` keyed by (book, feed, target);
  - a `BoundWatcher` beside the exits watcher that settles a crossing before any later close;
  - σ marks attached to `finalize`;
  - `@senryo/api-client` ride routes and zod contracts.
- [ ] R4.5 Indexer:
  - reads the v1 and v3 reserves;
  - ride entities (Ride, RideSide, records);
  - `PoolShares` v3;
  - codegen and tsc gate.
- [ ] R4.6 Common: migrations for rides (`market_rides`, `ride_exits`) and pg_notify channels onto the `markets` and
  `user:` topics.
- [ ] R4.7 Apps: the Duel, Events, Earn, Parlay and stocks/baskets screens switch from read-only to live. Their R2
  interim states are deleted.
- [ ] R4.8 Deploy the api, keeper, indexer and web; phone OTA after one simulator pass; acceptance rows (S7, S8, rides).

## Handoff
(written at the end of the stage)

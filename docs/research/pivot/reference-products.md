# Reference products for the pivot: what we take from each (8 Oct 2026)

All of these are the user's own builds except **Yosuku**, which is upstream by an external author with no licence. For Yosuku we reimplement behaviour only and never copy code or styles; this includes `web/src/styles/yosuku/*` in Masayume, Agari and CWF.

## crypto-world-fair: "Mitoshi" on Tempo (`../crypto-world-fair` @ `d7b576b`)

An EVM Solidity prediction market made of Masayume and Agari parts. It has about 794 test functions. Measured on Tempo testnet: tap → card p50 **824 ms**; **855/855** crypto 5-minute windows settled in 24 h. Deadline 12 Oct.

### Engine (`contracts/src/engine/`)

An order book in Solidity, rewritten from Agari's Anchor programs.
- **Grid:** YES/NO prices on a 1–999 tick grid.
- **Pricing and lifecycle:** policy versions, each bound to an immutable `IPrintVerifier`; `openWindow`; permissionless `recordPrint` (first valid print wins); `copyOpenFromPrev`; takers refused until the open print exists.
- **Settlement:** a tie settles Up; a cross-check gap above 25 bp voids; a void pays **half face**.
- **Prices:** RedStone is primary (all 5 signers within 300 s, then 3). Pyth's source id 1 is reserved and refused.

### Products and who takes the other side

- **`RangeReserve`/`ParlayReserve`:** house reserve with full reservation, exposure ≤ 60%, a per-expiry cap, and refusal outside 2–97%. Two weaknesses:
  - suppliers withdraw at `liquid + locked` and can leave between the close print and settle;
  - price comes from a caller-chosen RedStone "latest" up to 120 s old.
- **`EventVault`:** grants (SESSION/EXECUTOR/STRATEGY) with caps per trade, per day, on open positions, a price cap, market scope, budget and expiry. `placeFor` requires `msg.sender == actor`.
- **`MarketMakerVault`:** Earn as a maker.
- **Maths in two languages:** Solidity `FairValue`/`RangeMath` (Φ table, `lnWad`, `bandProbE6`, `floorStake`) is mirrored bit for bit by TypeScript in `packages/core/src/{fair,range}`, with shared test vectors.

### Ops (`services/ops/src`)

- **Actors:** window-roller (pure plan), price-relay, settler (pure decide; `redeemFor` 300 s after settle), seed-maker (`P = Φ(ln(S/K)/(σ√(τ/yr)))`, half-spread 30 ticks, stops at lock − 75 s), halt-watch, and its own `eth_getLogs` indexer.
- **Stream:** one multiplexed `/v1/stream`, with an HMAC ticket for user topics, a 15 s ping and `Last-Event-ID` replay.
- **Relay** (`packages/markets/src/relay/engine.ts`): a Tempo fee-payer co-signer. Its checks:
  - chain id;
  - no self-sponsoring;
  - ≤ 8 calls, value 0;
  - target allow-list;
  - selector lists;
  - approve amount must not be max;
  - gas cap per area;
  - deadline;
  - per-device budgets.

### Tempo-only (not portable)

- pathUSD and TIP-20;
- the TIP-403 receive policy;
- 0x76 transactions;
- WebAuthn P-256 accounts and TIP-1011 access keys;
- `tempo-std` fixtures.

### Shell (S22, commit `d7b576b`)

- **Layout:** rail 248/88 px, inset 16, stage radius 24, drawer 384/560, ease `cubic-bezier(.32,.72,0,1)`, 380/240 ms.
- **Everything drawer:** lives in the URL (`?d=`), with inline search.
- **Shared libraries:** `lib/{drawer-param,feedback,idle,haptics,sound/trade,privacy}.ts`, and app-wide Sound & Vibration.
- **Navigation:** `nav-items.ts`, with a route-coverage test.
- **Rule:** no bottom sheets (D-190).
- **Screenshots** (temporary): `/private/tmp/claude-501/-Users-abu-dev-hackathon-crypto-world-fair/f959de4a-…/scratchpad/shell-out/`.
- **Slush reference:** `../roy-chain/docs/build/research/inspo/slush/`.

### Status and server load

- **Not built:** the mobile app (planned as a WebView, SM1–SM5 not started); the `/trade` terminal (S23); exits (S24, design D-193: a signed trigger, the keeper decides when to sell, the contract enforces a RedStone-proved floor).
- **Server:** `agari-box` (Contabo, 4 vCPU, 7.755 GiB, 8 GiB swap, one concurrent build) runs about 21 apps. Load restarted CWF ops and voided windows (F-S10-01).

### Port map

See the pivot plan: Architecture → Contracts, Services, Shared client runtime, Web.

## Owarine (Canton S3: `../owarine`, plan `../canton-season3/context/13-revamp/`)

- **Capability registry:** `docs/plan/capabilities.json`, 219 rows (1 live, 104 local, 114 not-live).
- **Markets:** crypto windows (2m/5m/15m/1h/4h/1d; staggered 2m/5m lanes), stocks and ETFs (regular, Monday Gap, 24/7 xStock), pre-IPO (PreStocks), baskets, yes/no events.
- **Actions:** UP/DOWN, close, Trail, TP/SL, Boost, Range, Parlay, Moonshot, Short, private mode, scheduled calls, demo mode.
- **Games:** Practice, Duel (arena with escrowed pot, commit-reveal, Elo, seasons), Lucky, Range, Moonshot, Line Rider, Candle Hop.
- **Agents and desks:** strategies, agent builder, copy/fade, an hourly LLM desk.
- **Social:** leaderboard, profiles, follows, rooms, reels, share charm and PNG.
- **Tradash loop** (`13-revamp/TRADASH-FIDELITY.md`):
  - UP/DOWN cross-fade into TRAIL/CLOSE;
  - a PnL pill with rolling digits on the price line; colour follows the PnL sign, not the tick;
  - Entry, Line (the open print) and Trail tags, plus a profit band;
  - risk in words ("Up loses it all if BTC closes below $X at 11:15");
  - CLOSE takes one tap, no confirmation;
  - sound and haptic reactions.
- **Real-time pieces that don't depend on Canton:**
  - `packages/core/src/market/{fair,book-math,windows,lanes,stagger,crypto,realised-vol,drift}.ts`;
  - `services/ops/src/http/{coalesce,spot-sse,ladder-sse}.ts`, `prices/{crypto-spot,crypto-rest,recent-ring,candle-history,chart-candles}.ts`;
  - `packages/markets/src/runtime/{spot-stream,live-series,live-exit,event-source,page}.ts`;
  - `web/src/features/terminal/**` (canvas `LiveChart`, `engine.ts`: 600 samples at 60 Hz, ease 0.18; `canvas-odometer.ts`);
  - `web/src/lib/sound/*`, `web/src/components/kit/*`, `web/src/components/shell/*` (one nav source `nav.ts` with digit keys and `MORE` sections; `MoreSheet.tsx`; `HealthChip`; `BalanceChip`; `CommandPalette.tsx`).
- **Mobile:** Expo 57, shares about 382 of 647 files with the web through `@/*`; no terminal and no Skia chart on the phone.
- **Measured latency** on Canton DevNet: open ≈ 10 s, close 11–14 s; locally, close 0.9–1.6 s.
- **"Side battle"** = the floating side-menu layout Owarine took from RYO-CHAN/Baku (`../roy-chain/apps/web/src/components/shell/*`), confirmed by the user 8 Oct. It is not a battle game.

## Masayume (Somnia: `../sommina-events`, docs `../masayume-docs`)

- **No Up/Down contract of its own:** DreamDEX (Somnia's closed-source exchange) ran those markets and the oracle.
- **Reusable original pieces:**
  - `contracts/src/range/RangeMath.sol` (81-entry Φ table, probit, `floorStake`);
  - `RangeReserve` capacity checks (`_requireCapacity`: liquidity, exposure 60%, per-expiry).
- **Yosuku-derived, behaviour only:** `EventVault`, `ParlayReserve`, `LeverageReserve`, `PrivateDesk`, `StrategyRegistry` (ported from Move/TypeScript).
- **"Thinkex"** in the user's voice note = **DreamDEX**. Agari's `agari-events` is "DreamDEX Event Contracts rebuilt as an Anchor CLOB".

## Agari (Solana: `../stocklana`)

- **Settlement rules:**
  - exact-T Pyth print: `prev < T ≤ publish ≤ T+grace`, confidence check;
  - RedStone cross-check; a gap above 25 bps voids; a missing check prints settles single-source with a flag;
  - ties settle Up; a void pays 0.5.
- **Stock sessions:**
  - session calendar = Alpaca ∩ Pyth schedule (`services/ops/src/calendar/session-service.ts`);
  - halt-watch: confidence > 50 bps or older than 15 s;
  - Gap lane priced off xStocks.
- **Pricer:** `seat/fair.ts` `P(up) = Φ(ln(S/K)/(σ√(t/yr)))` (equity year = 252 × 23,400 s), from DreamDEX's MIT bot-kit.
- **Spot feed:** `services/ops/src/prices/spot-feed.ts` (Hermes SSE with a Bearer key, plus RedStone every 5 s) → `http/spot-sse.ts`.
- **Agari production** (Coolify, reached through `ssh -f -N -L 8001:localhost:8000 agari-box`, context `agari-new`): `agari-ops` `3emcr4zi33ndacrcmgtbkngz`, `agari-web` `kcwqrvdgskhyhlcly5tlhlzi`.

## Senryo's existing prediction work (superseded)

- `contracts/src/predictions/SenryoBinaryV1.sol` + `BinaryMath.sol`:
  - never deployed;
  - native MON, testnet-only constructor, BTC/ETH only;
  - constant-product odds ignore spot, so the seed can be drained.
- **Kept:** `PythBoundaryOracle.sol` (the unique-boundary parser).
- **Evidence:** real public proofs passed at 900 s boundaries (`docs/design/reviews/2026-10-08-public-boundary-proofs.md`). Those payloads become dev fixtures.

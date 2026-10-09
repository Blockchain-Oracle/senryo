# S7 research — price sources: Pyth today, RedStone, stock sessions (9 Oct 2026, read-only agent)

I finished the research. I changed nothing in any repo, sent no transaction, and `git status` in metropolis matches the start (one temp script briefly landed in `packages/chain` and was deleted at once).

Repo prefixes: **M**=/Users/abu/dev/hackathon/metropolis, **C**=…/crypto-world-fair (Mitoshi), **A**=…/stocklana (Agari), **O**=…/owarine.

**Gaps first**
- **RedStone's keyless gateways are being shut down.** Since 2026-10-08 they refuse requests in daily windows that grow until 2026-10-29, when they stop. The replacement is a keyed gateway: `x-api-key`, one request a second per key (C/docs/plan/decisions.md:1798-1814; C/packages/markets/src/prices/redstone-gateways.ts:1-10,31-32). My fetches today returned 200.
- **"Notify me" does not exist** in Mitoshi, Agari or Owarine (searched the source, case-insensitive, builds excluded).
- **Signature recovery was checked only locally** (viem). I did not test recovery on Monad.

## 1. Senryo today
**How a print travels**
- **Stream:** the api's `PythGateway` runs one Hermes SSE for all catalogue feeds, with the key in the auth header (M/services/api/src/prices/hermes.ts:14-18,93-131; gateway.ts:57-69).
- **Per update:**
  - it goes into a 300 s ring and folds into a 1-minute candle;
  - every minute boundary it proves (`prev < t ≤ publish`) is written to `pyth_prints` with its proof and emitted on the `prints` topic (gateway.ts:119-136; archive.ts:22-44; ring.ts:22-24; constants.ts:17-18);
  - ticks go out on `prices` as `[catalogue index, priceE8, ms]`, at most one per 125 ms (gateway.ts:138-158; constants.ts:20).
- **Looking up a print:** ring wait, then archive, then Hermes REST (gateway.ts:95-107; hermes.ts:80-91). Topics are listed at stream/route.ts:8-14.
- **Opening windows (the relay, not the keeper):** the first open call into a window sends one Multicall3 of openWindow → ensurePrint(PythPrintVerifier, feed, start) → commit (relay.ts:116-133; packages/chain/src/markets.ts:104-133). Windows nobody calls into are never opened.
- **Fills:** target is `block.timestamp + 1` (BandBook.sol:91). `finalize` proves it through the window's own primary source (BandBook.sol:151-161). The keeper backs this up from the archive after 10 s, otherwise it runs `expire` (keeper/jobs/fills.ts:18-64).
- **Settlement:** the keeper runs every 2 s: archived close print → [ensurePrint, resolve, settleWindow, claimFor], or void-and-refund after admission (settle.ts:20-75). `PythPrintVerifier` and `pythFeedId` are hard-coded there (settle.ts:53-63; fills.ts:53).

**Contract**
- `recordPrint`/`ensurePrint(verifier, feedId, t, proof)` accept any verifier a policy names (Windows.sol:29-30,71-72,154-190).
- Prints are keyed by (verifier, feed, t) (:261-263). An optional cross-check verifier voids the window on divergence (:87-98,197-219). Policy versions are dated, at most 8 (:57-62; MarketTypes.sol:32,101-121).
- Interface: `admissionSec()`, `fee(proof)`, and a payable `verifyPrint(proof, feedId, t)` returning (int64 priceE8, uint64 confE8, uint40 publishTime) (IPrintVerifier.sol:9-22).
- Cadences must be ≥60 s and divide 3600 (Windows.sol:44-47).

**Calendar**
- A weekly bitmap of 672 15-minute slots plus at most 32 holiday windows. Daylight saving is handled as a union: a slot counts as closed if it is closed under either EST or EDT (MarketCalendar.sol:10-13,64-75; Constants.sol:14-20).
- `openWindow` needs every slot open (Windows.sol:120,134-140).
- Deploy configures **no calendars** (DeployMarkets.s.sol:52-54), so any stock series would revert with `UnknownCalendar` (MarketCalendar.sol:65).
- My inference: the union rule costs one hour of the session — 09:30–10:30 ET in summer time, 15:00–16:00 ET in winter.

**Catalogue**
- Only BTC, ETH and SOL, each with a `pythFeedId` (catalog.ts:44-96). Print classes: crypto 25 bps, equity 50 bps, admission 300 s (:128-138).
- The export and deploy produce **one** verifier, the crypto class, and register every series with no cross-check (scripts/catalog-export.mjs:46,84; DeployMarkets.s.sol:62,81-90,141-170). There is no script to add a series after deploy.
- Logo/identity rows already exist for XAU and the nine stocks, including SPY and QQQ (packages/identity/src/entities.ts:19-27,209-225). The entitled list is decision D-281 (docs/plan/STATUS.md:67-69).

**How pluggable is it?** The chain side doesn't care about the source (series → policy → {verifier, feed}). Everything off-chain is Pyth-shaped. A new source needs:
- **Contract:**
  - A verifier with Senryo's interface. Mitoshi's takes a `PrintQuery` and returns int256/int8, so it needs adapting (C/contracts/src/engine/verifiers/RedStonePrintVerifier.sol:61-75).
  - **The main conflict:** fills land at "now + 1 s", but RedStone prices only every 10 s. Mitoshi's verifier accepts only exact times (:68-69), so it would refuse almost every fill.
  - My inference for the fix: snap to the next 10 s point with a grace of at least 10 s, which makes fills wait up to about 10 s.
  - Plus calendar setup (`setWeek`/`addHoliday`) and admin calls per market (`registerSeries`/`setSigma`/`addBand`).
- **Keeper:** choose verifier and feed per series, and build RedStone's proof bytes.
- **api stream:**
  - A RedStone poller: one "latest" fetch is about 1.98 MB, so polling every 10 s is about 17 GB a day.
  - Archive every boundary and fill time within RedStone's ~24 h history.
  - A display source to move the line between 10 s prints.
- **Catalogue:** a source, feed and calendar per market. Add markets only at the end of the list, because ticks carry the catalogue index (packages/live/src/prices.ts:21-38).
- **App:** trade pages come from `marketsOn` (apps/web/src/app/app/trade/[symbol]/page.tsx:7-14); stocks also need a session badge.

## 2. Mitoshi's RedStone route
- **Verifier:**
  - Its own MIT code using OpenZeppelin `tryRecover`. It does not use RedStone's BUSL-1.1 Solidity (RedStonePrintVerifier.sol:1-12).
  - Order of checks: feed pinned → every timestamp equals T·1000 → all 5 signers needed before T+strictSec, the threshold after → distinct configured signers → value range check → median (even count = floored average), at 1e-8 (:59-75,104-119).
  - A separate `verifySpot` handles "latest" (:77-96).
- **Wire format:**
  - Each package is 142 bytes: feedId(32) ‖ value×1e8(32) ‖ ts_ms(6) ‖ 32(4) ‖ 1(3) ‖ r ‖ s ‖ v.
  - Packages are followed by N(2) ‖ 0(3) ‖ marker `0x000002ed57011e0000`.
  - The signed digest is keccak of the first 77 bytes (lib/RedStonePayload.sol:9-54).
- **Signers:** 5, threshold 3, strictSec 300, admission 900 (C/packages/core/src/market/venue-spec.json:13-23). They are the same five Agari uses and the same as RedStone's own consumer contract (context/tempo/15-equity-prices-on-tempo.md:273-286).
- **TS code:**
  - Main parser (C/packages/markets/src/prices/redstone.ts):
    - `parseGatewayJson` keeps each value's exact source text (:31-36);
    - `decimalToE8` refuses more than 8 decimals (:38-50);
    - payload builder (:72-108), `feedAt`/`latestMedian` (:153-173).
  - Gateways (redstone-gateways.ts):
    - `redstoneGatewaysFromEnv` (:36-50);
    - 403/429 back-off from 60 s up to 600 s (:64-105);
    - `fetchRedstoneLatest` is shared for 1 s (:110-127).
  - Spot proofs: `latestSpot` (packages/core/src/prices/redstonePayload.ts:118-139), served to the browser through a proxy (web/src/app/api/prices/redstone-payload/route.ts:6-13).
- **Archive:** every 20 s it stores each 5-minute boundary, plus a 10 s grid from 09:29 to 09:31 ET, staying inside 23 h, into `print_archive` (services/ops/src/actors/archive/redstone.ts:1-41; index.ts:6-35).
- **Doc 15 notes:**
  - History reaches 86,400 s back; 90,000 s returns 513 (:64,327-329).
  - Only 3 signers at 09:30:00 on one day (:330).
  - When the market is closed, the regular feed holds the last value, which is not the official close (:318-325).
  - The licence is unresolved (:66,341-344).
- **The moving line:** a display feed kept apart from settlement (services/ops/src/display/feed.ts:1-21,44-58).
  - Crypto: Coinbase websocket, with a five-venue median as fallback (crypto-spot.ts:1-5).
  - Stocks: Alpaca's latest IEX trade every 1.5 s from 04:00 to 20:00 ET (alpaca-trades.ts:1-7,21-23).
  - RedStone's signed value takes over after 15 s of silence.
  - Settlement itself polls RedStone every 10 s (prices/spot.ts:45).

## 3. Stock sessions
- **Agari:**
  - Calendar = Alpaca ∩ Pyth's public Hermes schedule. Disputed dates list nothing; refreshed hourly (A/services/ops/src/calendar/session-service.ts:1-40; pyth-schedule.ts:5-16).
  - Badge text: "Closes 16:00 ET", "Closes 13:00 ET today" (early close), "Trading halted", "Opens Wed 09:30 ET" (A/packages/core/src/market/session.ts:73-90).
  - Halts:
    - triggers: Pyth stale >15 s or confidence >50 bps, RedStone stale >60 s, or the issuer's halt flag;
    - two observations in a row to flip (one for the issuer flag);
    - checked in regular hours only (A/packages/core/src/market/halts.ts:19-47,74-98; actors/halt-watch/decide.ts:36-70).
  - Earnings: Finnhub (calendar/earnings.ts:1-20).
  - Lanes: regular, gap and token (24/7 tokenised stocks) (types/market.ts:22,29). Cadences 5m/15m/60m (windows.ts:16-17).
- **Mitoshi:**
  - Calendar = Alpaca ∩ RedStone's signed `NY_MARKET_NEXT_CHANGE_TIME` (C/packages/core/src/market/redstone-schedule.ts:59-83).
  - RedStone never signs a 24/7 package at exactly 04:00:00 ET (:7-21).
  - Halts only stop listing and quoting; they never touch the chain (halts.ts:9-35).
  - Lanes: regular, gap, stock24 and crypto24.
  - The 60-minute lane starts at 10:00, so nothing expires after 16:00. Gap windows lock Sunday 20:00 ET (windows.ts:20-45,84-95).
  - 66 series in total: BTC/ETH/SOL at 5m, plus nine stocks × {5/15/60m, Gap, 24/7 at 5/15/60m}.

## 4. Owarine
- **Stocks:** TSLA, NVDA, AAPL, MSFT, META, AMZN, GOOGL, QQQ, VOO and SPY (not launched), with Pyth ids for all and RedStone ids for the single names (O/packages/core/src/market/tickers.ts:18-21,142-189). Also 8 pre-IPO names, 5 baskets and 2 valuation markets.
- **Crypto:** BTC, ETH, SOL and CC. Cadences 2m to 1d, with two staggered series per lane (crypto.ts:13-41).
- **Multi-source:** every source becomes a print attested by its oracle parties that names the original source — 3-exchange 1-minute candle, RedStone, Pyth, Alpaca and others — each with its own timing (print-source.ts:1-17,76-88). Policies have a primary and a check (packages/markets/src/deploy/policies.ts:29-34).

## 5. Live check (2026-10-09)
**Latest** (fetched 13:45:40Z): HTTP 200, 1,982,172 bytes, 1,010 feeds, one timestamp **1791553530000** (09:45:30 ET, 10 s behind).

| Feed | Values (5 packages) | Signature |
|---|---|---|
| TSLA | 386.4703–386.5706 | 65 bytes (88 base64 chars) |
| NVDA | 231.2141–231.2229 | 65 bytes |
| AVAX | 10.19393 / 10.19468 | 65 bytes |

- **Signers:** 0x8BB8F32Df04c8b654987DAaeD53D6B6091e3B774, 0xdEB22f54738d54976C4c0fe5ce6d408E40d88499, 0x51Ce04Be4b3E32572C4Ec9135221d0691Ba7d202, 0xDD682daEC5A90dD295d14DA4b0bec9281017b5bE, 0x9c5AE89C4Af6aA32cE58588DBaF90d18a855B6de.
- **Signatures:** every TSLA, NVDA, AVAX and PEPE signature recovers locally to its stated signer, using the format above.
- **History:** `/historical/…/1791549960000` (08:46 ET) returned HTTP 200 with 1,010 feeds. TSLA ≈375.00, NVDA ≈230.55, AVAX ≈10.320, all from 5 signers at exactly that time.
- **Coverage:**
  - TSLA, NVDA, AAPL have the three variants; MSFT, META, GOOGL, AMZN have `---PRE_AFTER` and `---24_7`.
  - **PLTR and AMD are regular only.**
  - XAU, XAG, all 20 extra coins and DOGE/XRP/BNB/HYPE are present; **QQQ and SPY are absent**.
- **Before the open:** TSLA's regular feed held 375.0 while `---24_7` read 379.95. Market-status values: `NY_MARKET_CURRENT_STATUS` was 1.01 at 08:46 ET and 1 at 09:45; next-change time was 09:30 ET, then 16:00 ET.
- **Precision problem:** PEPE is signed as 388e-8 and SHIB as 535e-8, so one step is about 0.26% and 0.19%. For 1-minute Up/Down windows, ties (which refund) would be common.

## UNDEFINED / contradictory / dead-end
1. "Notify me" was not found anywhere, so there is nothing to port.
2. Mitoshi's venue-spec lists PLTR-24 and AMD-24 series, but its tickers.ts:87-89 says those feeds don't exist, and they are absent live.
3. The market-status codes (1 / 1.01 / 1.02) and the difference between `---PRE_AFTER`, `---EXTENDED` and `---24_7` are inferred only (doc 15:333-334).
4. Whether Senryo has a RedStone key is unknown. M/docs/research/pivot/monad-stack.md:68 says "now keyed (1 rps)", and the keyless gateways end 2026-10-29.
5. The licence for mainnet (BUSL-1.1 plus the gateway's terms) is unresolved.
6. No design exists anywhere for fill-time vs the 10 s grid; Mitoshi used an order book, so it never faced this.
7. RedStone gives no confidence value; what Senryo's `confE8` should hold is open.
8. The calendar's daylight-saving gap is my inference, and no stock calendar or add-series path exists yet.
9. I did not run signature recovery on Monad, and did not re-probe whether history holds for the full 24 h.

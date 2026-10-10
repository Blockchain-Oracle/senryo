# R1 — Prices that can't fail silently (replan stage 1)

**Goal:** the price path never fails silently, and the line moves like Tradash's. The settlement plane (Pyth, RedStone)
is complete, back-filled and honest about its state. The display plane (exchange trades) drives the line, the pill and
live PnL at about 8 Hz. No contract change.

**Authority:**
- `replan-2026-10-10.md` R1; D-302, D-310;
- research `docs/research/replan-2026-10-10/04-pricing.md` (§3 findings F1–F21, §6 target, §7 R1–R18, §8 G1–G6);
- port sources `../owarine/services/ops/src/prices/{crypto-spot,crypto-rest,day-stats}.ts` and
  `../crypto-world-fair/services/ops/src/display/*`;
- every library read through its docs (Context7) before use.

**Gate:**
- `pnpm gate` 0;
- G3 chaos (a)–(d) passes;
- G6 abuse passes;
- the display line measured at ≥ 6 Hz for BTC in a browser;
- δ and autocorrelation numbers in `acceptance.md`;
- api and keeper deployed;
- web deployed; phone OTA after a simulator pass.

## Steps

### Settlement plane
- [x] R1.1 Process guards and RedStone body validation (04 R1):
  - `services/common/src/process-guards.ts`, called from the api and keeper `main.ts`;
  - a non-JSON 2xx counts as that gateway's failure;
  - `try/catch` around `poll()` and `historical()`.
  - *As built (10 Oct):* `installProcessGuards(log)` logs and counts `unhandledRejection` (kept running) and exits on
    `uncaughtException`; the count shows on `/v1/status` `process` and `/v1/keeper/status`. `RedStoneReader.read(path,
    decode)` trusts a 2xx only when it is `application/json`, starts with `{` and decodes; otherwise the next gateway
    is tried. The scheduled poll catches. Probed live: gateway-1 answers `historical` with 200 `text/html` "Hello! I am
    working correctly". Scratch check against a fake gateway (placeholder 200, truncated JSON, 429, a real payload, a
    throwing ingest, a stray rejection): all pass, exit 0.
- [x] R1.2 `PrintFetcher` (R2):
  - single-flight per (feed, t) and a token bucket per source (Hermes 1/s with a burst of 5; RedStone ≤ 0.5 rps);
  - never asks for t > now − grace;
  - one RedStone `historical` per grid point, cached 60 s;
  - its own backoff, separate from the live poll.
  - *As built (10 Oct):* `prices/print-fetcher.ts` is the only upstream REST path (`gateway.printAt`'s last step).
    Hermes asks for one instant share **one call per entitlement class** (crypto · tradfi, `hermesClassOf`) with
    `ignore_invalid_price_ids=true` (confirmed on the live OpenAPI), so single-flight per (feed, t) falls out of the
    batch. `prices/upstream.ts` holds the reservation `TokenBucket` (a caller waits ≤ 3 s, else refused) and `Backoff`
    (the RedStone poll now uses its own). 404 is "missing", never a rest; 401/403/429/5xx and network errors rest the
    source 5 s → 120 s. `archivePending` asks only for `target ≤ now − 2 s`. Counters per source in
    `gateway.status().rest` (wired to `/status` in R1.9). HermesStream is stream-only now. Scratch check: early asks
    make no call; 7 asks at one t → 2 calls; 404 doesn't rest, 429 does; 12 instants at once → 8 calls in 3.0 s and 4
    refused; 4 RedStone asks → 1 history read; and **one real Hermes call** returned BTC/ETH/SOL prints with
    prev < t ≤ publish. Exit 0.
- [x] R1.3 `PrintWatch` (R3):
  - every 2 s, back-fills any window start or expiry that has tickets and no archived print by t + 2 s;
  - on a Hermes reconnect, back-fills each minute boundary in the gap;
  - misses and back-fills counted on `/status`.
  - *As built (10 Oct):* `prices/print-watch.ts` **replaces `archivePending`** (one implementation): every 2 s,
    `instantsAwaitingPrints` (services/common `prints.ts`) lists fill/close targets, window starts and expiries of
    non-final tickets and parlays (legs too); `archivedKeys` drops what the archive holds (one PK lookup); the rest go
    through `gateway.printAt` (ring → archive → `PrintFetcher`) within each market's admission. `HermesStream` calls
    `onResume(lastPublish, firstPublish)` on each connection's first frame; the watch back-fills every minute boundary
    in the gap for every Pyth market, one boundary at a time (after a restart: the 900 s horizon). An instant still
    missing at half its admission is logged as an error once. Stats in `gateway.status().watch` (R1.9 wires
    `/status`). Scratch check on a throwaway Postgres (repo migrations): exactly the 9 needed instants asked; settled,
    archived and past-admission ones skipped; a second pass asks nothing; an unservable expiry re-asked, counted once,
    flagged near admission; a 3-boundary gap × 12 Pyth markets asked only the 29 unarchived; a restart back-fills
    ≤ 900 s. Exit 0. Baskets and RedStone ride the ticket-driven pass (no gap pass of their own).
- [x] R1.4 `/v1/prices/print` is archive-only for anonymous callers, with a rate limit and a short-cached 404; `/recent`
  caps its symbols and is rate-limited (R4).
  - *As built (10 Oct):* archive-only for **every** caller (the route has no signed-in callers, and `PrintWatch`
    back-fills what positions need): `gateway.knownPrintAt` reads the ring then the archive, never waits, never goes
    upstream. A miss is a 404 with `max-age=1` — not longer, because `use-window-open` retries K every second. Both
    `print` and `recent` take 120 a minute per IP; `recent` splits at most the catalogue's 34 symbols. Scratch check
    (Fastify inject on the real routes): 200 immutable / 404 `max-age=1`, 0 upstream calls, 429 from request 121 on
    both (a 20 KB symbol list included). Exit 0.
- [x] R1.5 Hermes hardening (R5):
  - a timeout until the headers arrive;
  - `ignore_invalid_price_ids`, with one stream per entitlement class;
  - rotation that aborts the old stream only after the new one's first frame;
  - backoff that resets only after 30 s healthy;
  - a per-feed silence watchdog;
  - `HERMES_ORIGIN` from env;
  - an explicit `channel=fixed_rate@1000ms`;
  - 401/403 counted and alerted.
  - *As built (10 Oct):* one `HermesStream` per class (crypto · tradfi, `HERMES_CLASSES`), options object, URL with
    `ignore_invalid_price_ids=true&channel=fixed_rate@1000ms`; a 5 s headers timer; `rotate()` keeps the old
    connection until the successor's **first frame** (`retiring`); `attempt` resets only after 30 s streaming;
    `restart(reason)` debounced to one per watchdog span; 401/403 → `authRefusals` + an error log. REST moved to
    `hermes-rest.ts` (`hermesPrintsAt`, `hermesLatest`). `silence-watch.ts`: an open market (its calendar) whose
    **publish time** hasn't moved for 5 s is silent — probed once on REST `latest` (through the fetcher's budget):
    newer there → that class's stream restarts; else "stale upstream". The gap back-fill is per class and only for
    markets open at each boundary. `HERMES_ORIGIN` env (empty = unset), default `https://pyth.dourolabs.app/hermes`.
    Finding (keyed probe, Saturday): Hermes keeps a 1 Hz frame for closed feeds with `publish_time` frozen at the
    close, so frames never prove freshness (recorded in 04 §5.1). Scratch check against a fake Hermes: no headers →
    abandoned at 5 s; 401 counted; params sent; rotation held the old connection 3,001 ms and closed it 5 ms after
    the successor's first frame; 200-then-close kept backing off; BTC frozen-but-newer-upstream → restart, ETH
    frozen-upstream → stale. Real Hermes, both streams 8 s: crypto 7 publish times, tradfi frozen, 0 false
    silences. Exit 0.
- [x] R1.6 RedStone off the main loop: parse in a `worker_thread`, extracting only the wanted feeds (R14).
  - *As built (10 Oct):* `redstone-packages.ts` (pure: parse, payload, median, the JSON check on bytes) is shared by
    `redstone-parse.worker.ts` (a third esbuild entry, `redstone-parse.mjs` beside `api.mjs`, 1.9 KB) and
    `redstone-parser.ts` (one long-lived worker; the response `ArrayBuffer` is **transferred**, zero copy; 5 s timeout
    restarts it; after 3 deaths the parse returns to the main thread, logged). The reviver stays (exact decimal text).
    Scratch check on the real 2 MB answer: event-loop delay max **24.1 ms in-thread → 1.9 ms via the worker** over 10
    parses; results identical (18 feeds, signatures, values); the bundled worker answers the same; a truncated body
    fails over to the next gateway; 3 deaths → in-thread fallback. Exit 0.
- [x] R1.7 R11/D-310: without `REDSTONE_GATEWAYS` after 29 Oct, the RedStone markets are read-only discovery with the
  reason; they turn back on when the key is set.
  - *As built (10 Oct):* one rule, `pauseOf(market, now, redstoneKeyed)` in `@senryo/config` (`price-sources.ts`):
    from `REDSTONE_KEYLESS_END_SEC` (29 Oct 00:00Z) without a key, RedStone markets and baskets with a RedStone member
    read "Paused · price feed offline". The api asks `gateway.pausedReason(m)`: the catalogue sends `paused` per market
    (optional in the schema, for older apis); the relay refuses opens and cash-outs and the parlay relay any paused
    leg with `409 MARKET_PAUSED`; Lucky and the duel deck already skip markets without a fresh price; the RedStone
    reader schedules no poll and makes no request. In both apps `useMarketLine` reads the catalogue's reason
    (`MarketLine.paused`), so every row (markets, parlay pickers) and the terminal show it; `closedWords` gives the
    shared panel copy ("NVDA is paused" / "Its price feed is offline. Calls come back when it returns."). The price
    routes moved to `api-client/routes/prices.ts` (markets.ts hit 402 lines; three price routes come in R1.14–R1.19).
    Scratch check at a clock past the end: 19 paused (18 + TECH), 0 before it or with a key, 0 Pyth; the words; the
    keyless reader makes 0 requests, a keyed one still reads. Exit 0.
- [ ] R1.8 Hygiene (R18): delete the dead `pg_notify('pyth_print')`; close the open candle on a minute timer and on
  shutdown.

### State and transport
- [ ] R1.9 `FeedState` end to end (R6):
  - each catalogue market declares `cadenceMs`/`staleMs` per source;
  - the gateway computes `live · delayed · stale · closed · halted · fallback` from server time and the calendar;
  - a `health` topic, plus a digest in the beat;
  - `/status` reports prices per source;
  - `PriceBook` keeps the server state;
  - the D-289 halts get two-observation hysteresis.
- [ ] R1.10 The ticket is decoupled from prices: public topics connect at once, `user:` joins on a later reconnect, and a
  refused user topic gets `event: topic-error` (R8).
- [ ] R1.11 Transport (R9):
  - a 5 s beat and 5 s client silence;
  - a jittered first retry of 0.5–1.5 s, then ×2 to 15 s;
  - reconnect on visible/online/NetInfo when the last frame is over 2 s old.
- [ ] R1.12 Replay epochs: ids `<epoch>-<seq>`, `event: reset`, and the client invalidating and reseeding (R10; Mitoshi
  `bus.ts`).
- [ ] R1.13 Fan-out (R13):
  - one batched `pp` frame every 100 ms;
  - a per-socket byte cap and a per-IP connection cap;
  - fan-out µs and event-loop p99 on `/status`;
  - Traefik excludes `text/event-stream` from compression (a Coolify setting).
- [ ] R1.14 Reseed and first paint (R15):
  - `/v1/prices/latest` on reconnect;
  - `/recent` pre-fills the open terminal with 5 minutes of real history;
  - a preconnect to the API origin.
- [ ] R1.15 Clock (R16): `GET /v1/time` (no-store), NTP-style offset taken from the minimum-RTT sample of the last 5,
  resampled every 60 s and on reconnect.

### Display plane
- [ ] R1.16 Display feed (D-302):
  - port `crypto-spot.ts` (Coinbase WS ticker) and `crypto-rest.ts` (5-venue REST median), adding a 20 s ping and a
    forced reopen of a silent socket;
  - coalesce to 125 ms on a `display` topic, basis-adjusted to Pyth (a rolling median of display − Pyth at each print);
  - hysteresis on failover;
  - read Coinbase's and Kraken's market-data terms first and record them in `docs/research/replan-2026-10-10/`.
- [ ] R1.17 Clients: `@senryo/live` merges display ticks into the line and pill. Quotes and limits read only settlement
  prices. Both charts draw a "Signed" marker at each Pyth print, and the chip says when the line is display.
- [ ] R1.18 Measure δ (Pyth lag behind Coinbase) and Pyth's 1–3 s autocorrelation from the recorded tape beside
  `pyth_prints` (`scripts/drive/price-lead-check.ts`). The result feeds `FILL_DELAY_SEC` in R3.
- [ ] R1.19 `/v1/prices/day` (24 h change, ported from `day-stats.ts`), with its api-client route and query hook.

### Charts and honest UI
- [ ] R1.20 Honest UI (R7):
  - `HealthChip` and the phone twin say Live only when the stream and the viewed feed are live;
  - delayed and closed charts dim, stop the pulse and show an age tag;
  - call panel copy names the cause.
- [ ] R1.21 Charts at any refresh rate (R17):
  - sub-sample x scroll from `sampleDebt`;
  - a dt-correct dot drift;
  - no per-frame allocations (the web rebuilds its path in place; the phone reuses one `SkPath`);
  - the K side taken from the raw latest tick.
- [ ] R1.22 The surge window is scaled to the measured tick interval, so surge, mega and slump fire on both apps.

### Checks
- [ ] R1.23 G3 chaos and G6 abuse as `scripts/drive` checks; rows in `acceptance.md`. G1 load and G2 soak are run when
  staging allows, with their result recorded.

## Handoff
(written at the end of the stage)

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
- [x] R1.8 Hygiene (R18): delete the dead `pg_notify('pyth_print')`; close the open candle on a minute timer and on
  shutdown.
  - *As built (10 Oct):* the NOTIFY is gone (no listener anywhere). `PriceArchive.start()` closes, 5 s after each
    minute, any candle no next minute closed; `flush()` writes every open candle on shutdown (`gateway.stop()` is
    async and awaited before `db.end()`). Candle writes **merge** (`ON CONFLICT DO UPDATE`: first open kept, high/low
    widened, the later close), so a minute split by a restart is whole. Scratch check on the scratch Postgres: a split
    minute reads open 100 / high 120 / low 95 / close 118; a quiet market's candle lands 5 s after its minute, not
    before; `savePrint` notifies nothing. Exit 0.

### State and transport
- [x] R1.9 `FeedState` end to end (R6):
  - each catalogue market declares `cadenceMs`/`staleMs` per source;
  - the gateway computes `live · delayed · stale · closed · halted · fallback` from server time and the calendar;
  - a `health` topic, plus a digest in the beat;
  - `/status` reports prices per source;
  - `PriceBook` keeps the server state;
  - the D-289 halts get two-observation hysteresis.
  - *As built (10 Oct):* `@senryo/config` holds `FEED_STATES`, one-letter codes, `FEED_TIMING` per source
    (`feedTimingOf`: a basket its slowest member's), `isQuotable` (live only) and `isWatchable` (live or delayed).
    `prices/feed-state.ts` judges every market each second from server time: calendar → `closed`; a Pyth D-289 halt
    (> 15 s or > 50 bps while open) confirmed over two observations (Owarine `confirmHalt`); then age vs its source's
    timing — a live → delayed demotion also waits for a second look (Pyth stamps whole seconds); a basket takes its
    worst member. **Deviation:** the digest rides the existing `prices` topic as event `h` (and every `time` beat), not
    a new `health` topic — today's api 400s a request naming an unknown topic, so a new topic would break any client
    that deploys first. `/v1/status` reports `prices` (ok / degraded / down), `priceSources` (counts per source) and
    `priceDiagnostics` (streams, fetcher, watch, silences). Exits use `isWatchable`, Lucky and the duel deck
    `isQuotable` (three ad-hoc freshness constants deleted); the relay refuses opens on a halted market
    (`409 MARKET_HALTED`, cash-outs still allowed). The client `PriceBook` holds the server's states (trusted 35 s
    after the last digest, else judged from receipt time at the source's timing); `isStale` = not quotable; a reseeded
    point is aged by its age at the server (F8). **Finding:** RedStone packages appear 4.2–6.5 s after their grid point
    (measured), so the read moved from +2.5 s (it always got the previous point) to +7 s, timing 20 s / 30 s, fill wait
    20 s, and the poll scheduler no longer skips the current cycle. Checks: pure (halt and demotion hysteresis,
    RedStone cadence, basket worst, Saturday closed, digest only on change) and **end to end** (live Hermes + RedStone →
    the real gateway on scratch Postgres → `/v1/stream` → `@senryo/live`): crypto and RedStone crypto live, Saturday's
    markets closed, `/v1/status` "19 live · 15 closed", event loop p99 2.5 ms (one 24 ms max at start-up), 136 boundary
    prints back-filled on start. Exit 0.
- [x] R1.10 The ticket is decoupled from prices: public topics connect at once, `user:` joins on a later reconnect, and a
  refused user topic gets `event: topic-error` (R8).
  - *As built (10 Oct):* the api grants topics one by one: a bad ticket **or an unknown topic** is refused on its own
    (`event: topic-error`), the rest stream; only a request with nothing grantable fails (so a client may ask for a
    topic an older api lacks). `LiveStream` waits for a ticket at most 1.5 s, then connects the public topics and
    restarts with `user:` once the ticket comes; a ticket is reused 45 s; a failed or refused one is retried after 30 s;
    a whole-request 401 over a ticket (today's api) reconnects public-only at once. Scratch check (04 G3d) on the real
    route and client: ticket route failing → first price in 136 ms; slow ticket → prices in 1.65 s, `user:` joined
    after; refused ticket → prices on the same request + `topic-error`; an api that 401s → public reconnect, prices in
    206 ms. Exit 0.
- [x] R1.11 Transport (R9):
  - a 5 s beat and 5 s client silence;
  - a jittered first retry of 0.5–1.5 s, then ×2 to 15 s;
  - reconnect on visible/online/NetInfo when the last frame is over 2 s old.
  - *As built (10 Oct):* api beat 15 → 5 s, `retry:` 3 → 1 s. `LiveStream`: 5 s silence with prices subscribed (12 s
    without); retries 1 s × 2ⁿ jittered ×0.5–1.5, capped at 15 s; `nudge()` replaces a socket silent > 2 s at once (and
    reopens an idle one) — called by `setVisible(true)`, the web's `online` event and the phone's `expo-network`
    `addNetworkStateListener` (already in the native build, so OTA-safe; NetInfo isn't installed); `diagnostics()`
    gives status, last frame and reconnects. The client trusts the states' digest 12 s (two beats). Scratch check on a
    fake server: half-open socket replaced 5.6 s after its last frame; refusals back off 1.8 / 3.2 / 9.3 s inside their
    bands (first retry 1.2 s); nudge leaves a talking socket alone and replaces a silent one in 7 ms. Exit 0.
- [x] R1.12 Replay epochs: ids `<epoch>-<seq>`, `event: reset`, and the client invalidating and reseeding (R10; Mitoshi
  `bus.ts`).
  - *As built (10 Oct):* `StreamBus.epoch` (start time, base 36); ids `<epoch>-<seq>`; `since(lastId)` is null for
    another epoch, a bare number or past the ring, and the route then writes `event: reset`. `Live.onReset` reseeds
    prices; `useLiveSync` invalidates every active query. (Replay, snapshot and subscribe run in one synchronous turn,
    so nothing slips between them.) Scratch check on the real route and client: prints across a reconnect replayed
    1,2,3,4 with no reset; a restart (new epoch), a gap past the 2,000-event ring, and an old numeric id each reset.
    Exit 0.
- [x] R1.13 Fan-out (R13):
  - one batched `pp` frame every 100 ms;
  - a per-socket byte cap and a per-IP connection cap;
  - fan-out µs and event-loop p99 on `/status`;
  - Traefik excludes `text/event-stream` from compression (a Coolify setting).
  - *As built (10 Oct):* the gateway queues the indexes that moved and flushes one `pp` frame (`[[i,p,t],…]`) every
    100 ms (the per-feed coalescer and its timers are gone). Each flush is serialised once as `pp` and once as legacy
    `p` frames; a socket gets `pp` only if it asked (`?pp=1`, which `LiveStream` now sends and an older api ignores) —
    switching everyone would have left un-updated phones with no ticks. A socket with > 1 MiB queued is destroyed;
    32 streams per client IP. `StreamBus` times every fan-out (`/status` → `priceDiagnostics.stream`) and, past one
    500-socket slice, delivers in ordered slices that yield between them (measured: a single pass held the loop ~15 ms
    in `writev` at 5,000 sockets). Process guards report the event loop's p99/max per minute (`/status` `process`).
    G1 in `acceptance.md`: 1,000 and 5,000 clients pass the loop, fan-out and latency gates; RSS at 5,000 open (tsx).
    **Traefik's compress exclusion is done at the R1 deploy** (Coolify change, no approval needed per the 1 Oct rule).
- [x] R1.14 Reseed and first paint (R15):
  - `/v1/prices/latest` on reconnect;
  - `/recent` pre-fills the open terminal with 5 minutes of real history;
  - a preconnect to the API origin.
  - *As built (10 Oct):* `GET /v1/prices/latest` (`no-store`): server time, the states' digest and `[i, priceE8,
    publish ms]` per market — 1.1 KB for 34 markets. `Live.reseed` uses it on every (re)connect (an older api's 404
    falls back to `/recent` for all); `Live.loadHistory(symbol)` loads one market's `/recent` unless the ring already
    spans 15 s (the stream ticks every market, so after the first seconds it rarely fetches). A chart shows ~10 s
    (600 samples at 60 Hz), so "real history" means its line opens filled: `fillLine` (shared, `@senryo/live`)
    interpolates the ring's 1 Hz points onto 600 samples; the web engine (`SampleRing.load`) and the phone's UI-thread
    state (`takePrice(…, line)`) seed from it on the first tick, and a cold start's history landing within 1 s
    redraws the line once. Web `LiveHost` preconnects to the api origin (`ReactDOM.preconnect`, anonymous, per the
    Next 16 docs). Checks: `fillLine` shape; on the real gateway `/latest` 1,109 B and `no-store`, `reseed` and
    `loadHistory` through it; in the preview against production's older api, `/latest` 404 → `/recent` fallback, and
    the BTC terminal opens with its line across the full width. (The `live-stream-check` drive script now calls
    `loadHistory`, as a terminal does.)
- [x] R1.15 Clock (R16): `GET /v1/time` (no-store), NTP-style offset taken from the minimum-RTT sample of the last 5,
  resampled every 60 s and on reconnect.
  - *As built (10 Oct):* `GET /v1/time` → `{ t }`, `no-store`, 120/min per IP. `ServerClock.sync(server, t0, t1)`
    keeps the last five timed samples and uses the smallest round trip's offset (`uncertaintyMs` = its RTT/2); beats
    and `/latest` give rough samples only until a timed one exists. `Live.syncClock()` runs on every `live` status and
    each minute after. Scratch check: a server 2 s ahead behind an uneven 40–160 / 20–60 ms link — error 42 ms by
    receipt time, 8 ms NTP-style (bound ±48 ms); a beat no longer moves a timed clock; the real route reads 0 ± 0.5 ms
    on the same host. Exit 0.

### Display plane
- [ ] R1.16 Display feed (D-302):
  - port `crypto-spot.ts` (Coinbase WS ticker) and `crypto-rest.ts` (5-venue REST median), adding a 20 s ping and a
    forced reopen of a silent socket;
  - coalesce to 125 ms on a `display` topic, basis-adjusted to Pyth (a rolling median of display − Pyth at each print);
  - hysteresis on failover;
  - read Coinbase's and Kraken's market-data terms first and record them in `docs/research/replan-2026-10-10/`.
  - *As built (10 Oct) — built, **off**, waiting on the owner:* all five venues' terms read (`09-display-terms.md`):
    none allows showing its data to app users under free terms, derived or not. `prices/display/` holds the port
    (Coinbase socket + `heartbeat` liveness and a 5 s reopen, the five-venue median with pair names read from each
    venue's own list for all 17 crypto markets, two-look hysteresis, the basis onto Pyth, `dp` frames only to batched
    apps, the `fallback` state); `DISPLAY_FEED=off` by default, so nothing reaches users. Measured through the real
    gateway: the line sat within 0.1 bps of Pyth; a legacy app got no `dp`; with no socket the median carried
    BTC/ETH/SOL. **Coinbase trades gave BTC only 0.1–1.1 Hz on a Saturday**, so the R1 gate "≥ 6 Hz" can't come from
    trades. Owner choice pending: keep the line on Pyth / Pyth Pro for crypto / license exchange data.
- [ ] R1.17 Clients: `@senryo/live` merges display ticks into the line and pill. Quotes and limits read only settlement
  prices. Both charts draw a "Signed" marker at each Pyth print, and the chip says when the line is display.
- [ ] R1.18 Measure δ (Pyth lag behind Coinbase) and Pyth's 1–3 s autocorrelation from the recorded tape beside
  `pyth_prints` (`scripts/drive/price-lead-check.ts`). The result feeds `FILL_DELAY_SEC` in R3.
- [x] R1.19 `/v1/prices/day` (24 h change, ported from `day-stats.ts`), with its api-client route and query hook.
  - *As built (10 Oct):* **from Senryo's own archive, not Coinbase** — `day-stats.ts` reads Coinbase `/stats`, which
    `09-display-terms.md` rules out for display. `PriceArchive.daySince(minute)`: per feed, the first candle's open at
    or after now − 24 h and the high and low since (two queries on the `(feed_id, minute)` key); the route maps feeds
    to symbols, omits a market with no candles, caches a minute (`public, max-age=60`, and in-process); `useDayPrices`
    in `@senryo/query`. The gateway's basket maths moved to `basket-compose.ts` (the gateway was over 400 lines).
    Scratch check on scratch Postgres: open at exactly now − 24 h, high/low inside the window only (a spike just
    before it ignored), ETH absent, the second read cached; `composeBasket` gives MAJORS 1,000 points at its bases.
    Exit 0. (No volume: the archive has none.)

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

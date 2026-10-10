# 04 · Pricing: audit, references, research and the target architecture (10 Oct 2026)

Read-only research for the 10 Oct replan. I changed nothing in any repo. The only file I wrote is this one.
The owner's requirement: *pricing cannot fail — efficient, performant, real time, with the right libraries and tools*.

Prefixes: **M** = `/Users/abu/dev/hackathon/metropolis` (HEAD `b61d1932`), **O** = `…/owarine`,
**C** = `…/crypto-world-fair` (Mitoshi), **T** = `…/canton-season3/context/13-revamp/tradash`.

## Gaps first

- **Production is still on the 3-market catalogue.** On 10 Oct at 07:0x UTC, `GET https://api.senryo.xyz/v1/prices/recent`
  for all 34 symbols returned only BTC, ETH and SOL, and the stream ticked only indices 0–2. The S7 catalogue
  (34 markets, 18 on RedStone) is not deployed (consistent with `06-senryo-today.md`: its verifiers aren't deployed
  either). So the RedStone path, the 34-feed load and the equity sessions have **never run in production**. Everything I
  say about them comes from reading the code and probing RedStone directly.
- **I did not have the Pyth key.** I could only measure Hermes ingest end to end, through the public stream. Without a
  key, Hermes answers `401 unauthorized` for price updates; the metadata route `/v2/price_feeds` stays open (probed
  10 Oct).
- **Nothing measures tick → pixel on a device.** The only chart number is a simulator dev build (acceptance S5 row
  22:05Z). The D-272 gates for fan-out (≤ 50 µs per client per frame, event-loop p99 ≤ 20 ms with 1,000 SSE
  clients) have **no acceptance row**: they were never measured.
- **The Context7 MCP needed authorisation in this session**, so the library docs below come from the web (official
  sites and repos). Claims I could not confirm on a primary source are marked *(unverified)*.
- **The pricing for Pyth Pro, the RedStone key and paid stock feeds** comes from public pages. Any spend is the
  owner's choice (§9).
- **RedStone has no public notice of the keyless shutdown.** The 8 Oct windows and the 29 Oct stop are known only from
  Mitoshi's own records. RedStone's key programme, rate and price are undocumented.
- **How far back the post-upgrade Hermes can serve `/v2/updates/price/{t}` is unknown.** The ~640 s figure predates
  the upgrade. R3's back-fill depends on the answer, so G3 must measure it.
- **Some vendor pages failed to load:** OKX, Finnhub, Binance's terms, Apple's ProMotion page. Those rows are marked
  *(unverified)*.

## 0. Verdict

The design (one keyed Hermes stream → a unique-print ring → an archive → one SSE per app → Float64 client stores →
UI-thread charts) is sound, and in places better than every reference: the unique-print proof, frames serialised
once, zero React renders per tick. **But "cannot fail" is not met today.** There are seven ways the price path can stop
or go wrong **silently**:

- one of them crashes the whole API;
- two let a side path (archive lookups, an anonymous route) knock out the live stream;
- one turns a short Hermes outage into mass refunds;
- the rest hide a dead feed behind a "Live" chip and a calmly scrolling line.

RedStone's keyless end on 29 Oct removes 19 of 34 markets (18 RedStone feeds and the TECH basket) unless the owner
buys a route (§9). Every fix is
file-level and listed in §7, ranked by how much risk it removes.

## 1. The path today (as built)

```
Pyth Hermes SSE ──(1 stream, all Pyth feeds, Bearer key)──┐                 ┌─▶ FeedRing (300 s, unique print prev<t≤publish)
  services/api/src/prices/hermes.ts                       ├─▶ PythGateway ─┤─▶ PriceArchive: pyth_prints + 1-min candles (Postgres)
RedStone "latest" poll every 10 s (+2.5 s), ~2 MB JSON ───┘   gateway.ts    ├─▶ StreamBus.emit("prints")  (durable, replay ring 2,000)
  services/api/src/prices/redstone.ts                                       └─▶ coalesce 125 ms/feed → StreamBus.tick("prices") (ephemeral)
                                                                                     │
          /v1/stream (Fastify hijack, SSE, 15 s `time` beat, retry 3 s) ◀────────────┘   stream/route.ts, bus.ts
                 │                                 /v1/prices/recent (ring, 1 pt/s, 300 s)  routes/prices.ts
                 ▼
packages/live: LiveStream (fetch + eventsource-parser; expo/fetch on iOS/Android) → PriceBook (Float64Array, rAF flush)
               ServerClock (median of 5)  PrintBook (boundary prints)     sse.ts, prices.ts, clock.ts, live.ts
                 │
   web: canvas ChartEngine (600 samples @ 60 Hz, eased)       phone: Skia Picture per frame + Reanimated useFrameCallback
   apps/web/src/features/terminal/chart/*                       apps/mobile/src/features/terminal/chart/*

Consumers of prices on the server: relay fills (printAt, ≤ 8 s / 15 s wait) · window opens (printAt, 4 s) · exits watcher
(latestE8, stale > 5 s) · Lucky, Duel, Parlay (printAt / latestE8) · keeper fills + settlement (archive only, no key).
```

**What is already right** (keep it):

- **Prints.** The unique-print rule `prev < t ≤ publish` (`ring.ts:22-24`) is archived the moment a boundary streams
  (`gateway.ts:249-260`, `archive.ts:22-44`). Keeper, relay and Proof read the same row (D-274/D-278).
- **The key.** It travels in a header only (`hermes.ts:14-18,102`). There is a jittered backoff from 0.5 s to 30 s
  (`hermes.ts:146-153`), a 10 s watchdog (`:112-114`) and rotation at 23 h 45 m (`:115-119`).
- **Fan-out.** One coalescer per feed per process, leading edge plus trailing flush (`gateway.ts:267-279`). Frames are
  serialised once for every socket (`bus.ts:26-42`). Slow sockets skip ticks (`route.ts:76-83`).
- **Client.** Ticks never enter React. The store is Float64 with a flush per frame (`prices.ts:20-47`, `frame.ts`). The
  phone chart runs on the UI thread (`LiveChart.tsx:112-129`, ≈1.25 ms per frame on the simulator).
- **The catalogue index on the wire** is guarded by the `catalog-append-only` invariant (`scripts/invariants/rules.mjs:227-230`,
  `packages/config/src/market-order.json`).

## 2. Measured today (production, 10 Oct 2026, 07:0x UTC, from a Mac on home broadband)

Script: `scratchpad/measure-stream.mjs` (90 s on `/v1/stream?topics=prices,prints` plus one `/recent`). RedStone and
Hermes were probed with `curl`.

| What | Value |
|---|---|
| `/v1/stream` headers / first `p` frame (the snapshot) | 210 ms / 212 ms after the request |
| Tick cadence BTC, ETH, SOL | p50 999 ms · p95 1,042 · max 1,384 (Pyth Starter's 1 Hz) |
| Arrival − `publish_time`×1000 | p50 269 ms · p95 296 · max 1,184. `publish_time` is whole seconds, so this bounds the true lag only from above |
| Server − local clock from `time` beats | −58…−67 ms (the one-way latency the client clock does not correct) |
| Stream bytes | 229 B/s for 3 feeds. The SSE arrives `content-encoding: gzip` (the proxy compresses it) and still flushes per frame |
| `/v1/prices/recent` (asked for 34 symbols) | 200 in 678 ms (cold TLS), 26.3 KB decoded for **3** feeds × 301 points. `cache-control: public, max-age=1, stale-while-revalidate=5` |
| Hermes without a key | `/v2/updates/price/latest` → **401**; `/v2/price_feeds` → 200 with `market_hours {is_open,next_open,next_close}` |
| RedStone `latest` (both public gateways) | 200, 1,984,810–1,984,915 B, 0.41–0.48 s (Saturday 07:10 UTC: not in a refusal window) |
| RedStone `historical/<ms>` | gateway-2: 200, 1.98 MB of packages. **gateway-1: 200 with the 29-byte body `Hello! I am working correctly`**, the same as for any unknown path |
| Parsing RedStone's 2 MB JSON (Node 25, M1 Pro) | plain 3.8–5.7 ms; **with the source-text reviver Senryo uses: 20.8–24.9 ms** |
| Chart frame (from acceptance, simulator dev build) | 1.23–1.28 ms average, max 2.1–2.6 ms; 1–7 of 600 frames over 2 ms |
| Tap → fill (from acceptance) | 1.26 s (one-tap), 2.0 s, 2,019 / 2,553 / 4,548 ms |
| Terminal LCP (from acceptance, Lighthouse slow 4G) | 6.1–8.1 s. The LCP node is the first-price text |

## 3. Findings, ranked (every one with evidence)

Severity: **P0** stops prices or settlement, or kills the process, silently. **P1** shows stale or wrong prices, or leaves
long gaps. **P2** costs performance or bandwidth. **P3** is semantics and hygiene.

### P0 — can stop prices or settlement silently

**F1. A malformed "200" from a RedStone gateway crashes the API (all prices, all streams, the relay).**
- **How it fails:**
  - `RedStoneReader.fetch` returns the body of any 2xx response without checking it (`redstone.ts:186-191`).
  - `updates()` → `parse()` calls `JSON.parse` with a reviver, which throws on non-JSON (`redstone.ts:86-92,155-157`).
  - In the poll path the rejection escapes: `void this.poll().finally(() => this.schedule())` (`redstone.ts:143-146`).
  - Nothing installs `process.on("unhandledRejection")` (grep: none in services or packages), and the image runs
    plain `node dist/run.mjs` (`services/Dockerfile:31`). Node ≥ 15 exits on an unhandled rejection.
- **Observed today:** gateway-1 answers `200 "Hello! I am working correctly"` for `historical/…` and for any unknown
  path. A gateway that returns a 200 placeholder or HTML page for `latest` is one step away. That covers a maintenance
  page, a CDN interstitial, or a refusal served with 200 *(unverified: what the refusal windows return)*. Gateway-2 is
  tried first (`constants.ts:32-35`), so gateway-1 is only reached when gateway-2 is already failing, which is exactly
  when this matters.
- **The same path through `historical()`** (`redstone.ts:134-138`) throws into `printAt`. The callers catch it, but the
  fill or print simply fails.
- **Fix:** see R1.

**F2. A side path can black out every RedStone market for 1–10 minutes.**
- The `latest` poll and `historical()` share one `fetch()` and one rest/backoff state (`redstone.ts:178-201`). Any
  failure sets `restUntil` and doubles the backoff, from 60 s up to 600 s (`constants.ts:42-43`).
- `archivePending()` runs every 2 s (`main.ts:71-75`, `ARCHIVE_PENDING_MS` `constants.ts:22`). Its SQL takes every
  pending target `> now − 300 s`, which **includes targets in the future** (`gateway.ts:72-87`).
- For each target it calls `printAt(…, 0)`, which falls through to `redstoneAt`. That downloads the **2 MB historical**
  for a grid point that may not exist yet (`gateway.ts:146-159`).
- A RedStone fill waits up to a 10 s grid step plus the read (`REDSTONE_PRINT_WAIT_MS 15 s`), so each one triggers
  about 5 such lookups, roughly 10 MB.
- On the keyed gateway, the research recorded 1 request per second per key
  (`docs/research/pivot/s7-price-sources-2026-10-09.md`, "Gaps first"). A handful of pending RedStone fills is enough
  to draw 429s.
- **The cascade:** a 429 rests the reader → the `latest` poller stops too → RedStone ticks and boundary prints stop →
  fills wait → the keeper `expire`s and refunds.
- Fix: R2.

**F3. RedStone's keyless gateways end on 29 Oct.** They have refused in growing daily windows since 8 Oct (D-284).
- `REDSTONE_GATEWAYS` is not in `deploy/api.env.example`. The code falls back to the public pair (`redstone.ts:122`).
- After 29 Oct, NVDA, AAPL, MSFT, META, GOOGL, AMZN, PLTR, AMD, AVAX, LINK, SUI, TON, ADA, LTC, DOT, NEAR, AAVE, UNI
  and the TECH basket have **neither display nor settlement**. That is 19 of 34 markets.
- During refusal windows the reader rests for 1–10 min (F2's mechanism), so these markets already go dark
  intermittently. Today that only affects testnet, since production runs 3 markets.
- Decision: §9.

**F4. Hermes is one upstream, one origin, one stream, one key.** There is no second path.
- **One origin** (`constants.ts:3`), hard-coded to the legacy host `hermes.pyth.network`. Since the 26 Aug upgrade the
  documented base is `pyth.dourolabs.app/hermes` (§5.1). If the legacy host ever answers with a cross-origin redirect,
  fetch drops the `Authorization` header and every call gets 401 *(the redirect behaviour is unverified; today the
  legacy host proxies, and streams work)*.
- **One stream for every Pyth feed** (`gateway.ts:101-106`). The binding plan said "one stream per entitlement class
  (crypto, equities)" (`docs/plan/pivot-2026-10-08.md:694`).
- **No independent Hermes exists any more.** Pythnet was decommissioned on 22 Sep 2026, and third-party providers no
  longer serve it (§5.1). Real redundancy needs Pyth Pro's three endpoints or a second vendor.
- **One bad feed takes down the stream.** A single feed the key is not entitled to makes Hermes answer 403 for the whole
  request (MON returned 403, D-281). The URL does not pass `ignore_invalid_price_ids` (`hermes.ts:97`). The 403 is
  stored (`hermes.ts:105-107`) and retried forever on a 0.5–30 s backoff. Nobody is told.
- **No key, no prices** (`gateway.ts:97-100`): this is a log line, not an alert.
- **A header stall waits about 5 minutes.** The watchdog starts only *after* the response headers arrive
  (`hermes.ts:101-114`). If Hermes accepts the connection but never answers, Node's fetch (undici) waits for its
  default `headersTimeout`. undici documents `headersTimeout` and `bodyTimeout` as `300e3` ms and the connect timeout
  as `10e3` ([undici Client.md](https://github.com/nodejs/undici/blob/main/docs/docs/api/Client.md)). That this
  default holds unchanged in Node 24's bundled undici is *(unverified)*.
- **Rotation can kill a healthy stream.** At 23 h 45 m it starts a new stream and aborts the old one 10 s later
  *whether or not the new one connected* (`hermes.ts:115-119`). A rotation during a Hermes hiccup turns a healthy
  stream into an outage.
- **The backoff resets on any 200** (`hermes.ts:111`). A server that answers 200 and then closes at once makes a
  0.5–1 s reconnect loop, which spends the key's rate budget.

**F5. The key's rate budget is shared by the stream and unthrottled REST, and one REST route is public.**
- **The limiter was never built.** The plan specified "Hermes REST batched per class and second (single-flight,
  retries at T+1.5/3/6 s, token bucket 1/s with bursts of 5)" (`pivot-2026-10-08.md:695`). What exists is one bare
  fetch per call (`hermes.ts:80-91`).
- **REST callers:**
  - `archivePending` every 2 s (F2);
  - the relay, parlays, Lucky and Duel through `printAt`;
  - **`GET /v1/prices/print?symbol&t`**: unauthenticated and not rate-limited (`routes/prices.ts:56-62`; rate limiting
    is opt-in per route, `main.ts:208`). Every miss goes to Hermes REST, or to the 2 MB RedStone historical.
- **This has happened before.** D-290 records that a bulk Hermes history read "rate-limited production's stream on
  9 Oct". An anonymous loop on `/v1/prices/print` with random past `t` can do it again on purpose.

**F6. A missed boundary is never back-filled, so a short outage becomes mass refunds.**
- Boundary prints are archived **only when they stream** (`gateway.ts:249-260`).
- The keeper settles **only from the archive** (`services/keeper/src/jobs/settle.ts:54-69`). It holds no key, by design
  (D-272). It voids a window and refunds once admission passes: 300 s for Pyth, 900 s for RedStone
  (`packages/config/src/pool-terms.ts:20-23,41`).
- `archivePending` covers fill targets only, never window expiries (`gateway.ts:72-80`). So nothing ever asks Hermes
  REST for a boundary that a reconnect, a deploy or a 429 skipped, even though Hermes can still serve it.
- **Result:** every window closing inside a Hermes gap or an api restart **refunds instead of settling**. Owarine
  recorded the same class of failure: a 4 h print outage voided 563 windows (`O/docs/plan/STATUS.md:72`).

**F7. A dead upstream is invisible to users and to ops.**
- **Ops sees nothing.**
  - `/status` hard-codes `prices: { state: "unknown", detail: "not wired yet" }` (`routes/info.ts:17,62`), although
    `gateway.status()` exists (`gateway.ts:115-120`).
  - RedStone's `lastOkAt` and `lastError` are never exposed (`redstone.ts:113-114`), and nor is `bus.connections()`
    (acceptance S5: "not exposed").
  - There is no alert anywhere. Container health is liveness only (`services/common/src/http.ts:55-63`).
- **Users see "Live".**
  - The web `HealthChip` says "Live" whenever the SSE is open (`apps/web/src/components/shell/chips.tsx:74-85`). The
    15 s `time` beats keep the SSE open even when Hermes is dead.
  - Both charts take time from the sample index, not the clock. They keep scrolling a flat line, so **a dead feed looks
    like a calm market** (`chart-engine.ts:158-166,210`; phone `state.ts:128-139`).
  - Only the call panel reacts: "Reconnecting · price paused" (`apps/web/src/features/terminal/CallPanel.tsx:33`; phone
    `CallPanel.tsx:147`; `packages/calls/src/use-call-flow.ts:91-103`). That copy is wrong when the transport is fine
    and the upstream is dead.

### P1 — stale, wrong or long-gapped prices

**F8. Staleness is one 5 s rule by device receipt time, and it is wrong for any source slower than 1 Hz.**
- **The call panel.** `STALE_MS = 5_000` (`packages/live/src/prices.ts:10,81-84`) is compared with *local receipt
  time*. A RedStone market ticks once per 10 s, so it reads **stale about half of every 10 s cycle**. On those markets
  the call panel blocks calls and says "Reconnecting" half the time.
- **Exits.** Exits use `EXIT_PRICE_STALE_SEC = 5` on `publishTime` (`services/api/src/relay/constants.ts:28`;
  `exits.ts:185-186`). With the 10 s grid plus the 2.5 s poll offset, a RedStone price counts as fresh for only about
  2.5 s in every 10 s, so **take-profit and stop-loss watch RedStone markets about a quarter of the time**.
- **Reseed.** It stamps `receivedMs = now` on a seeded point however old that point is (`prices.ts:65-69`), so a
  stopped feed looks fresh for 5 s after every reconnect.
- **Halts.** D-289's halt (Pyth stale > 15 s or confidence > 50 bps in regular hours → stop quoting and listing) is
  **not implemented** (no halt code in services or packages).

**F9. Public prices depend on the user's auth.** When signed in, the topics include `user:<address>`
(`live.ts:69,77-82`), and every (re)connect first awaits a stream ticket (`sse.ts:150-152`).
- If minting the ticket throws (expired session, api error), `run()` rejects and `fail()` retries forever.
- If it returns `undefined`, the server refuses the whole request with 401 (`route.ts:44-45,57-62`).
- Either way, **a signed-in user with a broken session gets no prices at all**.

**F10. Dead sockets are noticed late, and reconnects are slow.**
- **Detection.** The client's silence watchdog is 20 s (`sse.ts:12`) against a 15 s server beat
  (`stream/constants.ts:6`), even though prices tick at 1 Hz. A half-open socket (Wi-Fi ↔ LTE handover, NAT expiry)
  freezes prices for up to 20 s.
- **Reconnect delay.** The reconnect then waits 3 s × 2ⁿ ± 25 %: 2.25–3.75 s, 4.5–7.5 s, 9–15 s, 18–30 s
  (`sse.ts:13-16,131-133`). Tradash reconnects at a fixed 1.5 s (`T/bundle-2026-10-07/pretty/1ajlb01q0ta5l.js:14112-14116`).
- **Foreground.** `setVisible(true)` reconnects only from `idle` (`sse.ts:62-66`). A socket that iOS killed while the
  app was suspended shows old prices until the silence timer fires.
- **No `online` hook.** Neither app listens for the browser's `online` event or for NetInfo.

**F11. Replay has no epoch and no "you missed some" signal.**
- **No epoch.** Event ids restart at 1 in every process (`bus.ts:21,27`). After a deploy, a client's `Last-Event-ID`
  (say 5,000) is above every new id, so `since()` returns `[]`, not `null`. Prints, fills and results emitted between
  the restart and the reconnect are **skipped silently** (`bus.ts:50-54`).
- **No signal.** When the ring no longer reaches back, `since()` returns `null` and the server sends nothing
  (`route.ts:85-88`), so the client can't tell it should refetch.
- **The reference.** Mitoshi puts a per-process epoch in the id and buffers live events across the snapshot hand-off
  (`C/services/ops/src/runtime/bus.ts:56-63`, `C/services/ops/src/http/stream.ts:63-78`).

**F12. The client clock ignores latency and can sample a cached time.**
- `ServerClock.sample` stores `server − local` at receipt, with no RTT correction (`clock.ts:11-17`): −60 ms measured.
- `/recent` carries `serverTime` but is cacheable (`max-age=1, stale-while-revalidate=5`, `routes/prices.ts:14,24-26`),
  and the client samples it on every reseed (`live.ts:110-113`). A browser or CDN cache can feed it a time up to about
  6 s old.
- The median of five hides one bad sample, but the first minute runs on one or two.
- Countdowns and the 20 s lockout read this clock (`use-call-flow.ts`), so a large offset means taps the relay
  refuses.

**F13. Backpressure is half done.**
- Price frames are dropped while a socket is blocked, but **durable frames queue without bound** inside Node until the
  socket is destroyed 30–45 s later (`route.ts:76-99`). Blocking is only checked on the 15 s beat.
- **No batching.** Each feed's tick is its own `res.write` to every socket (`bus.ts:39-42`). Writes per second grow as
  ticks/s × clients. On a weekday with 34 feeds that is about 12 ticks/s × N.
- There is no global connection cap and no per-IP cap on `/v1/stream`.

### P2 — performance hot spots

**F14. RedStone costs about 17 GB a day and a 20–25 ms event-loop stall every 10 s.**
- The `latest` call returns about 1.98 MB for 1,010 feeds when Senryo wants 18 (`redstone.ts:150`).
- It is parsed with a source-text reviver: **20.8–24.9 ms on an M1 Pro**. On the shared box's slower vCPUs it will be
  more *(unmeasured)*.
- During that time no SSE frame is written and Hermes isn't read. On its own this breaks the D-272 gate "event-loop
  p99 ≤ 20 ms".
- `historical()` downloads the same 2 MB.

**F15. Every reconnect downloads 5 minutes of history for every symbol and then uses one point.**
- `reseed()` asks `/recent` for all symbols (`live.ts:110-118`): about 8.7 KB per feed decoded, so about 300 KB for 34
  feeds.
- `PriceBook.history()` has **no consumer** in either app (grep), and both charts start as a flat line
  (`chart-engine.ts:103-108`; phone `state.ts:94-102`). Only the newest point is used.
- Meanwhile the terminal's LCP (6.1–8.1 s) is the first-price text, and there is no `preconnect` to the API origin
  (grep).

**F16. The line advances in 60 Hz steps on 90, 120 and 144 Hz screens.**
- Both engines push samples on a fixed 60 Hz clock and place x by sample index (`chart/constants.ts:7-8`,
  `chart-engine.ts:158-166,210`; phone `state.ts:128-139`).
- On a 120 Hz screen the line moves only every other frame. The phone enables ProMotion
  (`apps/mobile/ios/Senryo/Info.plist:5-6`, `CADisableMinimumFrameDurationOnPhone`). On 90 Hz and 144 Hz screens the
  pushes fall unevenly (0/1/1, 0/1/0/1/1…), which reads as judder.
- The dot drift eases per frame (`DRIFT_EASE 0.06`, `state.ts:147`), so it runs at twice the speed at 120 Hz. Owarine
  has the same flaw.

**F17. Allocations every frame.**
- **Web:** each frame allocates a new `Path2D`, 599 `catmullRom` tuples, a gradient and the `gridTicks` objects
  (`chart-engine.ts:228-252`; `engine.ts:94-117`).
- **Phone:** each frame builds and parses an SVG path string and creates two gradient shaders on the UI thread
  (`apps/mobile/src/features/terminal/chart/draw.ts:222,230,267,279`). The plan said "Skia `usePathValue` (one reused
  path)" (`pivot-2026-10-08.md:701`).
- These are within budget on average, but the GC hitches (max 2.6 ms in a dev build) are unmeasured in release on
  devices.

### P3 — hygiene and semantics

- **F18.** `savePrint` sends `pg_notify('pyth_print', …)` for every write, and **nobody listens** (`archive.ts:43`;
  grep). `archivePending` re-saves ring prints every 2 s: an extra INSERT plus NOTIFY each time.
- **F19.** The open 1-minute candle lives in memory only: it is lost on restart. A closed market's last candle isn't
  written until its next tick (`archive.ts:51-64`).
- **F20.** At 1 Hz, τ = max(84 ms, 0.5 × tick) ≈ 500 ms (`chart/constants.ts:13-17`), so the eased line trails the
  raw pill by roughly 0.5–1 s. Near K, the line can sit on the other side of K from the price that will settle. Mitoshi
  draws the signed level separately (`C/web/src/features/terminal/useTerminalState.ts:56-57,85-97`).
- **F21.** `/v1/prices/recent` builds its symbol list from user input with no cap, and has no rate limit
  (`routes/prices.ts:21-31`).

## 4. Reference pipelines compared

Evidence for Owarine and Mitoshi comes from two read-only sweeps today. Their key lines are cited inline. Tradash comes
from its shipped bundle (no source repo; the bundle README says no licence, so re-implement and never copy).

| Concern | Senryo (as built) | Owarine | Mitoshi | Tradash |
|---|---|---|---|---|
| Display sources | Pyth Hermes (1 Hz) and RedStone (10 s), the same as settlement | Pyth SSE → RedStone 5 s → Alpaca 5 s by priority on read; Coinbase WS, falling back to a 5-venue REST median; Bybit WS for CC (`O/services/ops/src/prices/spot-feed.ts:161-166`, `crypto-spot.ts:35-41`) | Coinbase WS, falling back to a 5-venue REST median; Alpaca IEX every 1.5 s; the RedStone signed value after 15 s of silence (`C/services/ops/src/display/feed.ts:13,48-59`) | One exchange WS (Bulk `markPrice`) |
| Settlement source | The same Pyth/RedStone prints, proven on chain | Separate: 3 oracle parties sign 1-min candle closes, 2-of-3, deviation check (`O/services/ops/src/actors/price-relay/oracle-feeder.ts`) | Separate: RedStone prints only (D-196, D-206) | — (perps) |
| Ingest stall detection | 10 s watchdog after headers | **None** on Hermes; a clean end reconnects at once (`spot-feed.ts:104`) | None on Coinbase; REST covers quiet periods | None |
| Fan-out | 1 SSE, coalescer 125 ms, frames serialised once, replay ring 2,000 | SSE, coalescer 125 ms, no `id:`, no backpressure | 1 SSE, coalescer 125 ms, replay 5,000 **with an epoch**, snapshot hand-off buffered | 1 shared WS, unthrottled |
| Snapshot and resync | Latest per feed on connect; `/recent` reseed (history unused) | Snapshot never drops a symbol (archive fallback); `mergeSeed` fills gaps > 1 s (`O/packages/markets/src/runtime/live-series.ts:64-100,137-143`) | `/recent` merged once; not re-seeded after reconnect | REST snapshot per subscribe; can overwrite a newer tick |
| Client reconnect | 3 s × 2ⁿ ± 25 %, 20 s silence watchdog | `EventSource` default, then 5 s × 2ⁿ to 60 s; no watchdog | 3 s × 2ⁿ to 30 s, no jitter, no watchdog | **Fixed 1.5 s**, no watchdog |
| Stale UI | Panel only, 5 s; chip says "Live" | `aged` after 15 s on the market pages; terminal: none | "Reconnecting…" after 20 s (fast) / 45 s (signed), checked every 5 s | None |
| Clock | Median of server − local, no RTT | NTP-style RTT/2 computed but **never applied** (`O/packages/markets/src/provider/clock.ts:16`) | Chain clock + RTT/2 for windows | Device time |
| Line model | 600 samples at 60 Hz, adaptive τ, index x | 600 at 60 Hz, `easeFor` dt-correct; time-based monotone WindowChart elsewhere | 600 at 60 Hz, dt-correct 0.18 | 600 per *frame*, 0.18 per frame (window halves at 120 Hz) |
| Gaps on the line | Squeezed out (flat glide) | Flat to now with a pulsing head | Squeezed out | Squeezed out; replay back-filled from candles |
| Soak / load | None | C3 soak (43 windows × 2, SIGKILL mid-run, 0 duplicates); no fan-out load test | None found | None |

**What to take from them:**

- From Mitoshi and Owarine: a **display plane separate from settlement**, with an exchange WebSocket plus a multi-venue
  REST median as fallback. Also **source labels**, **per-source stale thresholds**, Mitoshi's **epoch in event ids**
  and **gap-free snapshot hand-off**, and Owarine's **`mergeSeed` after reconnect** and **halt hysteresis** (two
  observations in a row before flipping, `O/services/ops/src/actors/halt-watch/index.ts:1-12`).
- From Tradash: a **fast first reconnect** (1.5 s).

**What not to take:**

- the missing watchdogs;
- Owarine's clock offset that is computed but never applied;
- easing tied to the frame rate;
- a display line that settles differently from what it shows, without saying so.

## 5. Research (current docs)

Web research on 10 Oct 2026 from current official pages and live probes. **[V]** means confirmed on a primary
source or by a probe. **[U]** means second-hand or undocumented.

### 5.1 Pyth Hermes (what Senryo streams today)

- **Keyed since 26 Aug 2026, 16:00 UTC [V].**
  - Every call needs `Authorization: Bearer`. The documented base is now `https://pyth.dourolabs.app/hermes`;
    `hermes.pyth.network` (Senryo's hard-coded `HERMES_ORIGIN`, `constants.ts:3`) fronts it
    ([preparing for the upgrade](https://docs.pyth.network/price-feeds/core/upgrade/preparing)).
  - Probe: a keyless `latest` call → 401, while the metadata route `/v2/price_feeds` stays open, including
    `market_hours {is_open, next_open, next_close}` (for TSLA: closed, next open 2026-10-12 13:30Z).
- **Plans [V]** ([app.pyth.com/plans](https://app.pyth.com/plans)):
  - **Free:** $0, view-only, a 10 s update frequency.
  - **Starter:** $500/month, all crypto symbols, "up to 1 second".
  - **Pro:** from $2,500/month, every asset class including equities, "up to 1 ms", "Display and non-display rights",
    "Limited redistribution rights".
  - **Per-class prices** (the [Core upgrade blog](https://www.pyth.network/blog/the-pyth-core-upgrade)): US equities
    $5,000/month · crypto $2,500 · all classes $10,000.
- **The stream's `channel` parameter [V]** (live OpenAPI at `pyth.dourolabs.app/docs/hermes/openapi.json`, titled
  "Lazer Hermes API"):
  - `real_time`, `fixed_rate@50ms`, `fixed_rate@200ms` or `fixed_rate@1000ms`; **it defaults to 1,000 ms**. That is
    exactly the 999 ms cadence I measured. Starter caps it at 1 s; faster needs Pro.
  - Also documented: "The connection will automatically close after 24 hours"; `ignore_invalid_price_ids` (default
    `false`); `benchmarks_only`; `allow_unordered`.
  - A `/ws` endpoint takes `{type:"subscribe", ids, …, ignore_invalid_price_ids}`.
  - No per-stream feed cap is documented.
- **Rate limits [V]:** "Pyth Pro does not impose hard technical rate limits"; connections, feeds and channels follow
  the service agreement ([rate limits](https://docs.pyth.network/price-feeds/core/rate-limits)). The old public limit
  of 30 requests per 10 s per IP with a 60 s penalty is history. D-290's 9 Oct incident shows that *something* still
  limits a shared key in practice.
- **No independent Hermes left [V/U].**
  - Triton: "Pythnet has been decommissioned. On September 22nd, 2026…", and it no longer serves Hermes
    ([Triton docs](https://docs.triton.one/llms-full.txt)) [V].
  - My inference: running your own Hermes, or buying one from a third party, is no longer possible, and Douro Labs'
    keyed Hermes is the only one [U].
  - So "a second Hermes endpoint" is not redundancy. Real redundancy means Pyth Pro's three endpoints (§5.2) or
    another vendor (§5.4).
- **The old ~640 s cache figure is pre-upgrade.** It came from the old Hermes `cache.rs`. How far back
  `/v2/updates/price/{t}` reaches on the new Hermes is **[U]**, and R3's back-fill depends on it (measure in G3).
- **Equities [V, probe of `/v1/symbols`]:**
  - One feed per stock carries all its sessions, regular, pre-market (04:00–09:30), post-market (16:00–20:00) and
    overnight (20:00–04:00 ET) ([market hours](https://docs.pyth.network/price-feeds/core/market-hours)).
  - The minimum channel for AAPL, SPY, TSLA, NVDA and QQQ is 50 ms.
  - The `.EXT` feeds are deprecated.
  - Whether `publish_time` freezes when a market closes after the upgrade is **[U]**.
- **Pyth Core on Monad [V]** ([addresses](https://docs.pyth.network/price-feeds/core/upgrade/contracts); versions and
  fees from `cast`):
  - mainnet `0xB754BA51E3861Ac0Cb67f73CD046dE790A36508d`, fee 0;
  - testnet `0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379`, fee 0;
  - the legacy `0x2880…7B43` was upgraded in place: mainnet fee 0, testnet 1 wei. This matches D-274.
- **SDK [V]:** `@pythnetwork/hermes-client` 3.1.0 has no `channel` option. Senryo's raw `fetch` plus
  `eventsource-parser` (D-272) remains the right call.

### 5.2 Pyth Pro (formerly Lazer)

- **Endpoints [V]:** `wss://pyth-lazer-{0,1,2}.dourolabs.app/v1/stream`, and "you must connect to **all endpoints**"
  ([subscribe](https://docs.pyth.network/price-feeds/pro/subscribe-to-prices)). Auth is a Bearer header, or a JWT as
  the WebSocket subprotocol for frontends.
- **Subscribe message [V]**
  ([payload reference](https://docs.pyth.network/price-feeds/pro/payload-reference)):
  `{"type":"subscribe","subscriptionId":1,"priceFeedIds":[…],"properties":["price","feedUpdateTimestamp","marketSession",…],"formats":["evm"],"channel":"fixed_rate@200ms","deliveryFormat":"json","parsed":true,"ignoreInvalidFeeds":true}`.
  - Channels: `real_time` (1–50 ms), `fixed_rate@50ms`, `fixed_rate@200ms` ("most common"), `fixed_rate@1000ms`.
  - `marketSession`: `regular | preMarket | postMarket | overNight | closed`.
  - Since 16 Feb 2026, a closed market returns the last price with `feedUpdateTimestamp < timestampUs`
    ([forum](https://dev-forum.pyth.network/t/pyth-pro-streams-query/812)).
- **SDK [V]:** `@pythnetwork/pyth-lazer-sdk` 7.0.0 (2026-07-28).
  - It opens 4 connections by default, removes duplicates through a TTL cache, and has a 5 s heartbeat timeout and a
    1 s maximum retry delay.
  - `addAllConnectionsDownListener` fires only when every connection is down.
  - Its default host serves parsed JSON only. Settlement payloads need the `pyth-lazer-*` URLs.
- **The on-chain verifier is on Monad [V]:**
  - `0xACeA761c27A909d4D3895128EBe6370FDE2dF481` on mainnet and testnet; `version` 0.1.1, `verification_fee()` 1 wei
    ([addresses](https://docs.pyth.network/price-feeds/pro/contract-addresses)).
  - `verifyUpdate(payload) → (bytes, fee)`.
  - Using it needs a new `IPrintVerifier` (µs timestamps; the "unique print of t" rule must be re-expressed). That is
    design work, not a config switch.
- **Trial [V/U]:** "Generate a Pyth Pro access token instantly, no credit card required"; the length isn't stated [V]
  ([Pyth terminal](https://docs.pyth.network/price-feeds/pro/pyth-terminal)). Hackathon keys were offered in a forum
  thread for one past hackathon [U].

### 5.3 RedStone

- **The keyless shutdown has no public announcement.** The only evidence for the 8 Oct windows, the 29 Oct stop and
  `public_gateway_rejected` is Mitoshi's own records (D-210) **[U]**. Both public gateways answered 200 today at 07:10
  UTC [V].
- **The keyed gateway [V]** (RedStone SDK source
  [`data-services-urls.ts`](https://github.com/redstone-finance/redstone-oracles-monorepo/blob/main/packages/sdk/src/data-services-urls.ts)):
  - `https://oracle-gateway.a.redstone.finance`, with `x-api-key`.
  - A keyless call → `403 {"message":"Missing Authentication Token"}` (probe).
  - Fetching *all* packages needs "an admin API key". That suggests an ordinary key reads per-feed packages, which
    would end the 2 MB polling (F14) **[U]**.
  - The key programme, its rate and its price are undocumented **[U]**. The 1 rps in our notes is Mitoshi's
    observation.
- **Feeds [V, probe]:** `redstone-primary-prod` has 1,010 ids, including AAPL, AMZN, GOOGL, META, MSFT, NVDA, TSLA and
  MON. It has no SPY or QQQ.
- **On Monad [V]:**
  - Push feeds (ETH, BTC, MON, SOL, USDC…) on 0.5 % deviation or a 6 h heartbeat
    ([monad-crypto/protocols](https://github.com/monad-crypto/protocols/blob/main/mainnet/redstone.jsonc)). That is
    far too slow for 1-minute windows.
  - **Bolt**: "<10 ms", "currently live on MegaETH and Monad", access by contacting RedStone, no public stream
    ([Bolt](https://docs.redstone.finance/docs/stage1-market-data/bolt/)).

### 5.4 Other sources: display fallback and second settlement vendors

**Crypto display (free, no key).** These are display fallbacks, never settlement:

| Venue | Facts [V unless marked] |
|---|---|
| Coinbase Advanced Trade `wss://advanced-trade-ws.coinbase.com` | Subscribe within 5 s; most channels close within 60–90 s unless you subscribe to `heartbeats`; `market_trades` batched over 250 ms; 8 connections/s and 8 unauthenticated messages/s per IP ([CDP docs](https://docs.cdp.coinbase.com/)) |
| Kraken `wss://ws.kraken.com/v2` | Closes after about 1 min idle; about 150 connection attempts per 10 min per IP ([Kraken](https://docs.kraken.com/api/docs/guides/spot-ws-intro)) |
| Binance `wss://data-stream.binance.vision` | 24 h cap; ping every 20 s; 5 messages/s; 1,024 streams per connection ([spot WS docs](https://raw.githubusercontent.com/binance/binance-spot-api-docs/master/web-socket-streams.md)); US IPs refused with 451 **[U]** |
| Bybit | Ping every 20 s; under 500 connections per 5 min ([Bybit](https://bybit-exchange.github.io/docs/v5/ws/connect)) |

Owarine and Mitoshi already run Coinbase WS with a 5-venue REST median (§4). Neither pings, so R12 adds the
`heartbeats` channel and a forced reopen.

**US stock display** (every one is a licensing decision):

| Provider | Facts |
|---|---|
| Alpaca | Free IEX, 30 symbols, 1 connection per endpoint; $99/month unlimited [V] ([Alpaca](https://docs.alpaca.markets/docs/about-market-data-api)); showing it to end users [U] |
| Tiingo IEX WS | The full IEX feed needs an IEX agreement (since 1 Feb 2025); the **derived reference price (thresholdLevel 6) needs no licence** [V] ([Tiingo](https://www.tiingo.com/documentation/websockets/iex)) |
| Finnhub | Free WS, 50 symbols, personal use only [U] |
| Massive (Polygon) · Twelve Data · Databento | $199/month individual and non-pro · Pro $229 · $199/month [V] |

**Second settlement vendors on Monad.** Each needs its own `IPrintVerifier`:
- **Chainlink Data Streams [V]:** `VerifierProxy` `0xEd813D895457907399E41D36Ec0bE103E32148c8` is live on Monad mainnet
  (probe: "VerifierProxy 2.0.0"). From $150/month per feed, no free tier, 24/5 US equities with `marketStatus`, an HA
  WebSocket mode ([sign-up](https://docs.chain.link/data-streams/sign-up)). Monad isn't in Chainlink's own docs export
  [U].
- **Stork [V]:** pull oracle `0xacC0a0cF13571d30B4b8637996F5D6D774d4fd62`; WS with a token from sales; at least every
  500 ms. Equity coverage [U].
- **Switchboard [V]:** mainnet `0xB7F03eee7B9F56347e32cC71DaD65B303D5a0E67`; Surge streams under 100 ms; paid in
  SWTCH with a free tier "where payment can be zero" ([docs](https://docs.switchboard.xyz/llms-full.txt)).
- **Supra and Chronicle:** push feeds, hourly or crypto-only. Not fit for 1-minute windows [V].

### 5.5 Transport: SSE vs WebSocket for many-symbol fan-out

- **SSE is the right choice here (keep D-272).** Prices are one-way; a single stream multiplexes topics; reconnect and
  `Last-Event-ID` are in the spec; it rides HTTP/2 or 3.
  - The 6-connection cap only exists on HTTP/1.1. HTTP/2 defaults to 100 streams
    ([MDN EventSource](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)) [V].
  - The SSE spec recommends a keep-alive comment "every 15 seconds or so"
    ([WHATWG](https://html.spec.whatwg.org/multipage/server-sent-events.html)) [V].
  - A WebSocket gains nothing for a server-push firehose, and `ws`'s permessage-deflate "adds a significant overhead"
    [V].
- **Proxies [V]:**
  - Traefik (Coolify) flushes streaming responses "immediately"; `idleTimeout` is 180 s.
  - With the compress middleware, **list `text/event-stream` in `excludedContentTypes`**. Production's SSE arrives
    gzip-encoded today (§2), so do this (R13).
  - nginx needs `X-Accel-Buffering: no` (already sent, `route.ts:72`).
  - Cloudflare's proxy read timeout is now 125 s
    ([524](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/)).
- **React Native [V]:** `expo/fetch` streams bodies on iOS and Android and becomes the global fetch
  ([Expo](https://docs.expo.dev/versions/latest/sdk/expo/)). `react-native-sse` 1.2.1 (March 2024) is XHR-based and
  should stay banned (D-272). iOS may close a suspended app's sockets
  ([TN2277](https://developer.apple.com/library/archive/technotes/tn2277/_index.html)), hence R9's
  reconnect-on-foreground.
- **Libraries [V]:**
  - `eventsource-parser` 4.1.1 (2026-09-15) is current; keep it.
  - `eventsource` 5.1.2 is fetch-based and allows a custom fetch, but Senryo's own loop already does what it does.
  - `@microsoft/fetch-event-source` has had no release since 2021: don't adopt it.
  - For any future WebSocket (Pyth Pro, exchanges): `partysocket` 1.3.0 (min 1–5 s, max 10 s, ×1.3, a queue cap)
    or Pyth's own SDK. `reconnecting-websocket` is stale.

### 5.6 Smooth charts at 60–120 Hz

- **Use the rAF timestamp and frame-rate-independent damping, `k = 1 − exp(−dt/τ)`** [V]
  ([MDN rAF](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame),
  [Rory Driscoll](https://www.rorydriscoll.com/2016/03/07/frame-rate-independent-damping-using-lerp/)). Senryo already
  does this for the price ease. The dot drift and the 60 Hz *x-step* are the remaining frame-coupled parts (F16).
- **Render a little in the past** (entity interpolation): draw ~100–300 ms behind the newest tick and interpolate
  between the last two, as game netcode does ([Gambetta](https://www.gabrielgambetta.com/entity-interpolation.html))
  [V]. With 1 Hz Pyth this is the honest alternative to a 500 ms τ.
- **Canvas basics [V]:** scale by DPR, layer the canvases (already done), use `{alpha:false}` on the opaque layer,
  batch draws ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)).
  `OffscreenCanvas` in a worker is widely available (March 2023) if the main thread gets busy [V].
  - Libraries: lightweight-charts 5.x (conflation in 5.1) suits the lazy candles view; uPlot updates 3,600 points at
    60 fps for about 10 % CPU. A 600-point line needs neither [V].
- **Phone [V]** ([Reanimated performance](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance)):
  - `useFrameCallback` runs on the UI thread, about 8 ms per frame at 120 Hz.
  - `CADisableMinimumFrameDurationOnPhone` is required for 120 fps (already set).
  - Skia: `usePathValue` gives a mutable builder that yields an immutable path. Use it instead of parsing an SVG
    string per frame (F17).

### 5.7 Load and soak tools

- **k6 v2.3.0 with `xk6-sse` v0.2.0 (2026-09-12) [V]:** `import sse from "k6/x/sse"` now works without a custom build
  and emits an `sse_event` metric ([xk6-sse](https://github.com/phymbert/xk6-sse)). Use it for G1.
- **Artillery has no documented SSE support [V].** autocannon is HTTP/1.1 request benchmarking, unsuited to
  long-lived streams [V].
- **What to record:** connections, connect and reconnect rate, lag from server stamp to client p50/p95/p99, messages
  per second, drops and out-of-order messages, CPU and RSS per 1,000 connections, and survival across 24 h and proxy
  idle timeouts.

## 6. Target architecture: a price path that cannot fail silently

### 6.1 Principles

1. **Two planes with two jobs.**
   - **Settlement prints** must be *correct, provable and complete*: one authoritative source per market, archived
     immediately, back-filled when missed, never replaced by a display source.
   - **Display ticks** must be *fast, smooth and honest*: the settlement source first, a labelled fallback when it is
     late, and a visible state the whole time.
   - Quotes and limits are computed **only** from the settlement source. A display fallback moves the line, never
     the price you call at.
2. **Every price says where it came from and how old it is.** The server stamps each feed with source, publish time
   and state (`live · delayed · stale · closed · halted · fallback`), measured against **server** time and **that
   source's own cadence**. Clients never infer freshness from receipt time alone.
3. **Two independent ways to get every number.**
   - For prints: the stream, then rate-limited REST back-fill (then, if bought, Pyth Pro's three endpoints or a second
     vendor; no independent Hermes exists any more, §5.1).
   - For display: the settlement stream, then exchange WebSockets or a stock display feed, then the archive, labelled
     "last close".
   - Failover uses hysteresis: two observations before it flips, Owarine's rule.
4. **Fail loud, three ways:** a `health` topic for clients, `/status` for ops, and an external alert. A dead upstream
   can never read as "Live".
5. **Budgets are measured continuously in-process** (histograms on `/status`) and gated by exit code, never by eye.

### 6.2 Shape

```
SETTLEMENT PLANE (per market: one authoritative source)
  Pyth Core ── Hermes SSE (per entitlement class, ignore_invalid_price_ids, header timeout) ──┐
     └─ redundancy only via Pyth Pro's 3 endpoints or a 2nd vendor (§5.1–5.4, §9)              ├─▶ unique-print ring ─▶ pyth_prints
  Hermes REST (PrintFetcher: single-flight per (feed,t), token bucket, only t ≤ now) ─────────┘          ▲
  RedStone keyed gateway / or Pyth Pro equities (§9) ─▶ 10 s grid prints (own fetcher, own backoff) ─────┘
  PrintWatch: every listed boundary/fill/open with tickets archived by t+2 s, else back-fill; else alarm before admission

DISPLAY PLANE (per market: primary = settlement source; fallback labelled)
  primary ticks ─▶ FeedState(source, publishMs, cadence, session) ─▶ coalesce 125 ms ─▶ batch flush 100 ms ─▶ /v1/stream
  crypto fallback: Coinbase/Kraken/OKX WS → 5-venue REST median (port Owarine/Mitoshi `crypto-spot`, `crypto-rest`)
  stocks in session: a licensed display feed (§5.4) ; out of session: "last close" from the archive
  health topic: per-feed state on change + digest in a 5 s `time` beat; /status: per-source + event-loop p99 + fan-out µs

CLIENT (packages/live)
  LiveStream: public topics never wait for a ticket · 5 s silence watchdog · 0.5–1.5 s first retry → ×2 to 15 s ·
  reconnect on visible/online · epoch-aware Last-Event-ID + `reset` · /v1/prices/latest on reconnect
  ServerClock: NTP-style (RTT/2, min-RTT of 5) · PriceBook: server state + age, per-source thresholds
  Charts: sub-sample scroll (true 90/120/144 Hz), delayed/closed rendering, K side from the raw latest tick
```

### 6.3 Display price vs settlement print: separate concerns

| Concern | Display price (the line, the pill, lists) | Settlement print (K, the close, fills, Proof) |
|---|---|---|
| Goal | Fast, smooth, always moving *honestly* | Exact, provable, complete, the same bytes for everyone |
| Source | The settlement source first; a labelled fallback while it is `delayed` (crypto WS median, a stock display feed, the archive's "last close") | One authoritative source per market (Pyth now; RedStone or Pyth Pro per §9). **Never** a display fallback |
| Freshness rule | Per-source cadence on server time: delayed at 2.5× the cadence, stale at 5× (R6) | The admission window on chain (300 s Pyth, 900 s RedStone); back-filled before it (R3) |
| When it fails | The UI shows the state: chip, dimmed line, an age tag, the cause in words (R7) | Back-fill, alarm, and only then a void *with its reason* on the receipt |
| Who may use it | Charts and labels. **Not quotes.** A quote or limit is computed only while the settlement source is `live` (`use-call-flow.ts`) | The relay, keeper, exits (bid at the next print), Proof |
| Wire | `prices` topic (ephemeral), batched, with a state per feed | `prints` topic (durable, epoch ids) plus `/v1/prices/print` (archive) |
| Licensing | Display rights for that source (§9 item 2) | On-chain bytes that already exist; the raw payload is never redistributed (D-272) |

### 6.4 Latency and availability budgets (targets → how to measure)

| Hop | Target | Today | Measure with |
|---|---|---|---|
| Pyth publish → gateway receive | p95 ≤ 300 ms after the publish second (Starter has 1 s resolution); ≤ 100 ms on Pro | unmeasured | histogram of `receivedAt − publish_time·1000` in `HermesStream` → `/status` |
| Gateway receive → socket write | p95 ≤ 5 ms (plus ≤ 125 ms coalescing for bursts) | unmeasured | timestamp in the flush, `perf_hooks` |
| Fan-out per flush | ≤ 50 µs per client (D-272) | unmeasured | timed loop in `bus.tick` |
| Event-loop delay | p99 ≤ 20 ms with 1,000 clients and 34 feeds (D-272) | unmeasured; RedStone parsing alone costs ~21–25 ms per 10 s | `monitorEventLoopDelay` |
| Publish → pill on screen | p95 ≤ 500 ms | network part 269/296 ms (p50/p95) | client-side `arrival − publish` + 1 frame |
| Dead socket detected | ≤ 5 s | ≤ 20 s | G4 below |
| Back to live after the network returns / after foreground | p95 ≤ 2 s / ≤ 1 s | 2.25–30 s / up to 20 s | G4 |
| Boundary print archived | 99.9 % by t + 2 s; 100 % by t + 30 s outside upstream outages | stream only, no back-fill | G2/G3 count per feed-minute |
| Windows voided for a missing print | 0 outside outages longer than admission | unbounded (F6) | keeper `void` count on `/status` |
| Chart frame | ≤ 2 ms average, ≤ 4 ms p99 on devices, an x-advance on **every** frame at 120 Hz | 1.25 ms average (simulator) | G5 |

## 7. What to change in Senryo, ranked by risk removed

Each item is one reviewable change. Ports name their reference. Per the user's rules: delete what each change
supersedes in the same stage, keep constants named, and keep files ≤ 400 lines.

| # | Change | Files | Removes |
|---|---|---|---|
| **R1** | Validate gateway bodies (2xx **and** JSON: content type plus first byte `{`; a non-JSON 200 counts as that gateway's failure and the next one is tried). `try/catch` around `poll()` and `historical()`. A shared `installProcessGuards(log)` that logs `unhandledRejection` and counts it on `/status` (exit only on `uncaughtException`), called from the api and keeper `main.ts` | `services/api/src/prices/redstone.ts:143-157,178-201`; new `services/common/src/process-guards.ts`; `services/api/src/main.ts`, `services/keeper/src/main.ts` | F1 (process crash) |
| **R2** | **PrintFetcher**: one per source, single-flight per `(feed, t)`, token bucket (Hermes 1/s burst 5, as `pivot-2026-10-08.md:695` specified; RedStone ≤ 0.5 rps of a keyed 1 rps). Never fetches `t > now − grace`. One RedStone `historical` per grid point serves every RedStone feed (cached 60 s). Its **own** backoff, separate from the live poll. `archivePending` asks only for `t ≤ now − 2 s` | new `services/api/src/prices/print-fetcher.ts`; `gateway.ts:72-87,135-159`; `hermes.ts:80-91`; `redstone.ts:134-138` | F2, F5 |
| **R3** | **PrintWatch** (boundary back-fill): every 2 s, for windows with tickets whose start or expiry has no archived print by t + 2 s → `PrintFetcher`. Also on every Hermes reconnect: back-fill each minute boundary in `(lastPublish, firstNewPublish]`. Count misses and back-fills on `/status`; alert when anything nears admission | `gateway.ts` (+ a query in `services/common` beside `windowsToSettle`), `services/api/src/main.ts:71-75` | F6 (mass voids) |
| **R4** | `/v1/prices/print`: archive-only for anonymous callers (no upstream fetch), with a rate limit and a short-cached 404. `/recent`: cap symbols, add a rate limit | `services/api/src/routes/prices.ts:20-72` | F5 (anonymous key exhaustion), F21 |
| **R5** | **HermesStream hardening**: (a) a timeout to headers (`AbortSignal.any([ctrl, timeout(5 s)])` until the first byte); (b) `ignore_invalid_price_ids=true` plus one stream per entitlement class (crypto · equity/metal/fx), as the plan said; (c) rotation aborts the old stream only after the new one's first frame; (d) backoff resets only after 30 s of healthy frames; (e) per-feed silence watchdog (open market, silent for 3× its cadence → state `stale`, a REST probe, alarm); (f) `HERMES_ORIGIN` from env, defaulting to the documented `https://pyth.dourolabs.app/hermes` (§5.1); (g) pass `channel=fixed_rate@1000ms` explicitly so a plan change is a one-line switch to 200 ms; (h) 401/403 counted and alerted, never just retried | `services/api/src/prices/hermes.ts`, `constants.ts`, `gateway.ts:101-107`, `services/api/src/env.ts` | F4 |
| **R6** | **FeedState and health end to end**: each catalogue market declares `cadenceMs` and `staleMs` per source (Pyth 1 Hz → delayed 2.5 s, stale 5 s; RedStone 10 s → delayed 15 s, stale 25 s). The gateway computes state from server time and the calendar (`CALENDARS` plus Hermes `market_hours`). It is published on a `health` topic and in the beat, and `/status` reports `prices` per source (`routes/info.ts:17,62`). The client's `PriceBook` keeps the server state. `isStale` uses server time, publish age and source thresholds. The exits watcher and Lucky/Duel use the same thresholds. D-289 halts implemented with two-observation hysteresis (port `O/services/ops/src/actors/halt-watch`) | `packages/config/src/catalog.ts` (+ `markets/*`), `services/api/src/prices/feed-state.ts` (new), `gateway.ts`, `stream/route.ts`, `routes/info.ts`, `packages/live/src/prices.ts:10,53-84`, `live.ts`, `services/api/src/relay/constants.ts:28`, `exits.ts:185` | F7, F8 |
| **R7** | **Honest UI**: `HealthChip` and the phone twin show `Live` only when the stream *and* the viewed feed are live; otherwise "Price delayed 12 s", "Market closed · opens Mon 09:30 ET", "Reconnecting". Both charts render delayed and closed states: the line dims, the head stops pulsing, and an age tag appears; the line no longer scrolls a flat price as if live. Call panel copy by cause (`CallPanel.tsx:33`, phone `:147`) | `apps/web/src/components/shell/chips.tsx:74-85`, `apps/web/src/features/terminal/chart/*`, `apps/mobile/src/features/terminal/chart/*`, `packages/calls/src/use-call-flow.ts:91-103` | F7 |
| **R8** | **Decouple the ticket from prices**: connect public topics at once and add `user:` on a later reconnect when the ticket succeeds. The server grants the public topics and sends `event: topic-error` for a refused user topic instead of failing the whole request | `packages/live/src/sse.ts:139-156`, `live.ts:69,77-82`, `services/api/src/stream/route.ts:25-63` | F9 |
| **R9** | **Transport**: server beat 15 s → 5 s (`stream/constants.ts:6`); client silence 20 s → 5 s while prices are subscribed (`sse.ts:12`). First retry 0.5–1.5 s jittered, then ×2 to 15 s. Reconnect at once on `visible`/`online`/NetInfo when the last frame is over 2 s old. `lastFrameAt` and a reconnect count kept for diagnostics | `packages/live/src/sse.ts`, `services/api/src/stream/constants.ts`, both `LiveHost.tsx` | F10 |
| **R10** | **Replay with an epoch**: ids become `<epoch>-<seq>` (Mitoshi: `C/services/ops/src/runtime/bus.ts:56-63`). The server sends `event: reset` when the epoch differs or the ring can't reach back. On `reset` the client invalidates the user queries and reseeds prints | `services/api/src/stream/bus.ts`, `route.ts:85-92`, `packages/live/src/live.ts`, `sse.ts:176` | F11 |
| **R11** | **Owner decision for the RedStone markets before 29 Oct** (§9). Until a route is bought, list those 19 markets as read-only discovery after 29 Oct, with the reason, never as tradeable with no price | `packages/config/src/markets/redstone.ts`, `baskets.ts`, `deploy/api.env.example` (`REDSTONE_GATEWAYS`) | F3 |
| **R12** | **Display fallback plane** for crypto: port Owarine's `crypto-spot.ts` + `crypto-rest.ts` (Coinbase WS → 5-venue REST median), adding a 20 s ping and a forced reopen of a silent socket, which both references lack. Used only while the settlement feed is `delayed`, labelled "indicative", never for quotes or prints. For stocks in session, a display feed per §5 | new `services/api/src/prices/display/*`, `gateway.ts` (source selection with hysteresis) | F3/F4 impact on display |
| **R13** | **Fan-out**: one batched `pp` frame per 100 ms holding every changed feed (`[[i,p,t,state],…]`; the client accepts `p` and `pp` during migration). A per-socket byte cap for durable backlog, destroyed above 1 MB. Per-IP connection cap. Fan-out µs and event-loop p99 on `/status`. Exclude `text/event-stream` from the Traefik compress middleware (`excludedContentTypes`; production gzips the SSE today, §2, §5.5). That is a Coolify setting, so it needs the owner's OK at the moment it is changed | `gateway.ts:265-285`, `stream/bus.ts`, `stream/route.ts`, `packages/live/src/live.ts:122-126` | F13, the D-272 gates |
| **R14** | **RedStone off the main loop**: parse in a `worker_thread` without the reviver except for the wanted feeds (parse the 18 wanted keys' slices), or switch to a per-feed keyed endpoint if RedStone offers one (§5) | `services/api/src/prices/redstone.ts:86-106,150` | F14 |
| **R15** | **Reseed and first paint**: a new `/v1/prices/latest` (every symbol: last point, publish, state; about 2 KB) on reconnect. `/recent?symbols=<viewed>` only for the open terminal, **used** to pre-fill the chart by time (5 min of real history instead of a flat line). `<link rel="preconnect">` to the API origin. Drop `serverTime` from cached responses | `packages/live/src/live.ts:109-119`, `prices.ts:53-72`, `services/api/src/routes/prices.ts`, the web layout head, both `LiveChart.tsx` | F15, F12 part |
| **R16** | **Clock**: `GET /v1/time` (`no-store`), NTP-style `offset = server − (t0 + t1)/2`, keep the minimum-RTT sample of the last 5, resample every 60 s and on reconnect | `packages/live/src/clock.ts`, new route in `routes/info.ts` | F12 |
| **R17** | **Charts at any refresh rate**: shift x by the fractional `sampleDebt` so the line scrolls every frame; make the dot drift dt-correct; draw the line without per-frame allocations (web: inline control points, path rebuilt in place, gradient cached per size; phone: one reused `SkPath` with `rewind()` or Skia 2.6.2's `PathBuilder`, shaders cached per size). Decide K-side and the "winning" tone from the raw latest tick | `apps/web/src/features/terminal/chart/{chart-engine,engine,dot-grid}.ts`, `apps/mobile/src/features/terminal/chart/{state,draw}.ts` | F16, F17, F20 |
| **R18** | **Hygiene**: delete the dead `pg_notify('pyth_print')`. Close the open candle on a minute timer and on shutdown | `services/api/src/prices/archive.ts:43,51-64` | F18, F19 |

## 8. Checks to run (targeted integration checks, gated by exit code, rows in `acceptance.md`)

These follow the user's rule: no test suites, only checks where money or settlement correctness is uncertain, plus the
D-272 gates that were never measured. Each one is a `scripts/drive` script like `live-stream-check.ts`.

| Gate | Setup | Pass |
|---|---|---|
| **G1 fan-out load** | Staging api with a Hermes fixture replaying 34 feeds at weekday rates (the plan's fixture server). 1,000 then 5,000 SSE clients (k6 + `xk6-sse`, or a Node worker swarm, §5) for 15 min | event-loop p99 ≤ 20 ms; fan-out ≤ 50 µs per client per flush; server-send → client p95 ≤ 50 ms on LAN; RSS ≤ 256 MiB; 0 durable events lost |
| **G2 soak, 26 h** | Production-like, across the 23 h 45 m Hermes rotation, a RedStone refusal window (or a simulated 403) and one deploy restart | every open feed-minute has exactly one archived boundary print; 0 crashes; RSS slope ≈ 0; 0 voids for a missing print |
| **G3 chaos** | (a) Block Hermes egress for 90 s across a boundary. (b) SIGKILL the api at t − 1 s. (c) RedStone gateways return a 200 HTML page, then 429. (d) The ticket route returns 500 | (a) clients show "delayed" within 5 s and the boundary is back-filled within 30 s of restore; (b) clients reconnect within 5 s, get `reset`, and the boundary is back-filled; (c) no crash, Pyth markets untouched, RedStone markets "delayed"; (d) prices keep streaming |
| **G4 phone transport** | Release build on an iPhone (ProMotion) and an Android phone: airplane on/off, Wi-Fi ↔ LTE, 30 s and 120 s in the background | live again ≤ 2 s p95 after the network returns, ≤ 1 s after foreground; never a "Live" chip over a stale price |
| **G5 chart smoothness** | Release builds on a 120 Hz iPhone, a 90 Hz Android phone, and 120/144 Hz desktop Chrome and Safari | an x-advance on every frame while the price moves (instrumented); phone frame p99 ≤ 4 ms; no long task over 50 ms on the web terminal (Chrome trace) |
| **G6 abuse** | 50 rps anonymous load on `/v1/prices/print` and `/recent` | the Hermes stream stays up; clients get 429s; Hermes REST calls stay within the bucket |

## 9. Choices for the owner (plain words; each spends money or changes what's listed)

Prices are from §5 as of 10 Oct 2026. Nothing below is bought or asked for without the owner.

1. **What happens to the 19 RedStone markets on 29 Oct.** Pick one:
   - **(a) Ask RedStone for a gateway key.** It probably costs nothing, but the process, rate and price are
     undocumented. It keeps the 10 s grid: slow fills (up to 10 s) and a stepped line unless (3) is also chosen.
   - **(b) Buy Pyth Pro for US equities** ($5,000/month, or $10,000 for all classes). One source for every market,
     50 ms equity feeds with real pre-market, post-market and overnight sessions, a three-endpoint stream, display
     rights, and a verifier already on Monad. It needs a new verifier contract and a re-listing. MSFT, META, GOOGL,
     AMZN, PLTR and AMD would come from Pyth; it carries 1,252 equity feeds *(per-symbol coverage of PLTR/AMD
     unverified)*.
   - **(c) Chainlink Data Streams per feed** (from $150/month a feed, so about $2,850/month for 19 feeds). This also
     needs a new verifier.
   - **(d) Buy nothing.** After 29 Oct those markets become read-only discovery with the reason stated. They are never
     tradeable without a price.
2. **Is the current Pyth key allowed to show prices to app users?** The plans page lists "Display and non-display
   rights" under Pro, not under Starter; Starter says redistribution is not permitted. Senryo shows Starter prices to
   everyone. Separately, the key got 403 for 23 coins (D-281), which contradicts Starter's "all crypto symbols". Ask
   Pyth which plan the key is on and what it covers. *(This is a licensing question, not a technical one.)*
3. **A faster and redundant Pyth (Pro for crypto too: $2,500/month, or inside the $10,000 bundle).**
   - It gives 200 ms or 50 ms ticks instead of 1 s, which makes the line smooth without a 500 ms ease and fills faster.
   - It brings three endpoints with dedup, and with it the only real redundancy inside Pyth.
   - It needs the Pyth Pro verifier path (§5.2) for settlement, or Hermes kept for prints and Pro used for display
     only.
4. **A second settlement vendor** (Chainlink Data Streams, Stork or Switchboard) as a cross-check or fallback. The
   contracts already support a cross-check verifier that voids on divergence (`Windows.sol`, per
   `s7-price-sources-2026-10-09.md`). A true *fallback* (settle from B when A misses) would be a contract change.
5. **A stock display feed** for the line between prints: Tiingo's IEX derived reference price (no licence needed),
   Alpaca free IEX (30 symbols; end-user display terms unverified) or Alpaca at $99/month. This matters only if the
   stocks stay on a slow settlement source (1a or 1c).

**Free, needs no decision:** R1–R10, R12 for crypto (Coinbase and Kraken public WebSockets), R13–R18.

## 10. Sources

- **Code:** every `file:line` above, read at M `b61d1932`. Reference sweeps of O, C and T (Tradash's shipped bundle,
  `T/bundle-2026-10-07/pretty/*.js`, re-implement only).
- **Probes (10 Oct 2026, 07:00–07:20 UTC):**
  - `api.senryo.xyz` `/v1/stream` and `/v1/prices/recent` (`scratchpad/measure-stream.mjs`);
  - `hermes.pyth.network` keyless;
  - `oracle-gateway-{1,2}.a.redstone.finance` `latest`, `historical` and unknown paths;
  - a RedStone parse benchmark on Node 25 on an M1 Pro.
- **Project records:** `docs/plan/acceptance.md` (S3–S6 rows), `docs/plan/decisions.md` (D-272, D-274, D-281,
  D-284, D-289, D-290), `docs/plan/pivot-2026-10-08.md` "Stack and performance",
  `docs/research/pivot/{s7-price-sources-2026-10-09,architecture,monad-stack}.md`.
- **Web:** linked inline in §5, plus [undici Client.md](https://github.com/nodejs/undici/blob/main/docs/docs/api/Client.md)
  (fetch timeouts) and
  [Traefik compress](https://doc.traefik.io/traefik/reference/routing-configuration/http/middlewares/compress/)
  (`excludedContentTypes` defaults to empty, `minResponseBodyBytes` to 1024).

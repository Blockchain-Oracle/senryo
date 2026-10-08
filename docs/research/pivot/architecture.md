# Architecture, libraries, performance and caching (research behind D-272, 8 Oct 2026)

Every library decision was read through Context7 (`ctx7`). The binding stack table, caching matrix, budgets and "do not use" list are in [../../plan/pivot-2026-10-08.md](../../plan/pivot-2026-10-08.md), section "Stack and performance". This file keeps the evidence and the problems found in the current code.

## Gaps

- **Pyth publishes no keyed rate or connection limits.** Its Pro tier says "no hard technical rate limits"; the public limit is 10 requests per 10 s per IP. So we cap ourselves and count 401, 403 and 429 responses in `/health`.
- **Starter is crypto-only**, with updates at most once per second and no redistribution. Equities are Pro, at $2.5–5k per month.
- **Bundle sizes** are bundlephobia figures (dependencies included), not measured in this repo.
- **Box memory** comes from repo records (30 Sep: 7.8 GiB total, 3.0 GiB available, 3.7 of 8 GiB swap used, 38 containers).

## Current problems the cleanup deletes (S1)

- **`services/api/src/ws.ts` WsHub:**
  - polls `readOracles` every 1 s;
  - polls `readAccountSnapshot` **per subscribed account, one after another**, every 1 s. That is O(N) RPC calls per second: 100 users ≈ 100 reads/s ≈ 8.7M calls a day, four times the public 25 rps limit;
  - serialises with zod per socket per message.
- **Apps read the chain directly** (a viem client in `QueryEnv.read`) and poll it from **60 `refetchInterval` sites** in `packages/query`.
- **`packages/chain/src/clients.ts`:** no multicall batching; `pollingInterval: 150`.
- **`EnvioIndexerBridge`** polls Hasura `_meta` every 500 ms.
- **The API never sets Cache-Control or ETag.** `SingleFlight` rejects duplicates with a 409.
- **`PriceStore`:** copies the whole Map on every flush, spreads a 600-element array on every tick, and wakes every listener for any symbol.
- **`apps/mobile/src/components/charts/PriceLineChart.tsx`:** rebuilds the Skia path in `useMemo` for every sample (one React render per tick) and renders one `<Circle>` per grid dot.
- **Owarine `spot-sse.ts`:** creates a coalescer and a stringify per connection.
- **Owarine mobile `react-native-sse` 1.2.1:** reads `xhr.responseText` on every progress event, so memory grows without bound.
- **Indexer stack** is 1.7 GiB (Envio 800 MiB, its own Postgres 512 MiB, Hasura 384 MiB).

## Key facts from the docs

- **Hermes** (`/websites/pyth_network`, `/pyth-network/pyth-crosschain`):
  - SSE streams close themselves after 24 h.
  - About 640 s of history stays in memory (`cache.rs`: 1,600 slots); after that, lookups fall back to Benchmarks.
  - A streamed update can have `prev_publish_time == publish_time`, so check uniqueness before using it.
  - `@pythnetwork/hermes-client` 3.1.0 sends the token as an `ACCESS_TOKEN` **query parameter** for SSE (it ends up in URLs and logs) and pulls in zod 3 plus zodios. Don't use it.
- **Fastify 5.12.5** (`/fastify/fastify`): raw `reply.hijack()` plus `reply.raw.write`. `@fastify/sse` 0.6.0 formats each message per connection and awaits drain, which fits per-user streams, not broadcast.
- **Cloudflare** (`/cloudflare/cloudflare-docs`): JSON is DYNAMIC (uncached) unless a Cache Rule says otherwise. Idle connections are dropped after about 100 s, so heartbeat every 15 s.
- **Expo 57** (`/websites/expo_dev`): `expo/fetch` streams through `resp.body.getReader()` with no native dependency. Confirmed in `expo@57.0.26/fetch.js`.
- **Skia 2.6.2** (`/shopify/react-native-skia`): `usePathValue`, `Skia.PictureRecorder` and `PathBuilder` exist in 2.6.2. Native versions are frozen by D-270.
- **viem 2.57.4** (`/wevm/viem`): `batch.multicall` turns many calls into one billed request. JSON-RPC batching is billed per call, and the Monad Foundation RPC rejects batches. viem's `createNonceManager` lives in memory only, so we keep `LocalNonceSource` (persisted in `operator_nonces`).
- **Envio HyperIndex 3.14.0** (`/enviodev/docs`, `/websites/envio_dev`):
  - HyperSync at `monad.hypersync.xyz` and `monad-testnet.hypersync.xyz`;
  - preload is on by default (since v2.27);
  - `ENVIO_HASURA=false` (since v2.26);
  - `ENVIO_PG_SCHEMA` and `ENVIO_PG_MAX_CONNECTIONS`;
  - `@derivedFrom` is a GraphQL-only field.
- **TanStack Query** (`/tanstack/query`): `experimental_createQueryPersister` works per query with MMKV `createMMKV()` (`/margelo/react-native-mmkv`). `setQueryData` writes aren't persisted, which is what we want for stream state.
- **FlashList v2** (`/shopify/flash-list`): no size estimates needed; use `getItemType` and `useRecyclingState`.
- **Next 16** (`/vercel/next.js`): `reactCompiler: true` is a Babel plugin that compiles client components; static export stays.
- **Bundle cost** (bundlephobia, dependencies included): `@reown/appkit` 1.8.24 ≈ 272 KB gzipped, the wagmi adapter ≈ 98 KB, wagmi 3.7.7 ≈ 20 KB. That's why it loads on click.
- **Chainlink CRE quotas** (`/llmstxt/chain_link_cre_ts_llms-full_txt`):
  - cron interval ≥ 30 s;
  - 15 HTTP calls per run, 250 KB per response;
  - 5 min per run, 50 concurrent runs;
  - 50 KB reports, 10M gas per EVM write.
  - Every node in the DON runs the code, so use `cacheSettings` on HTTP calls.
- **postgres.js 3.4.9:** `sql.listen` (LISTEN/NOTIFY).

## Usage budgets

**Hermes calls per day** (one gateway; the stream's unique-print ring catches most boundaries):

| Use | Calls per day |
|---|---|
| Stream opens | ≤ 20 |
| Crypto boundaries | 1,440 |
| Equity boundaries | 390 |
| Fills (demo scale) | ≤ 8,000 |
| Backfill | ~20 |
| Health | ≤ 144 |
| **Total** | **≈ 2–10k** (token bucket ceiling 86,400) |

Without this design (per-client streams, plus keeper, relay and CRE fetching on their own): about 100–500k per day.

**RPC per day:**
- relay: 3 per intent, about 24k;
- keeper: about 43k;
- reads: about 3k;
- **total ≈ 70k (≈ 0.8 rps); clients 0.**

**Memory on `agari-box`:**
- api 256 MiB (heap 192);
- keeper 160 (heap 112);
- shared Postgres 384 (`shared_buffers` 96 MB, `max_connections` 40);
- Envio 512 (heap 384);
- **≈ 1.3 GiB total**, down from 2.8.

## Measured reference latency (CWF, Tempo testnet)

- **Tap → card:** p50 824 ms. Pre-send 324 ms, relay fill 485 ms, send → receipt 880 ms.
- The card shows "confirmed-pending" when the signature is made, not when the receipt arrives.

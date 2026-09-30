# S4 — Indexer: Envio HyperIndex V3 on 10143 + 143, indexer-client (wave B)

**Goal:** one self-hosted Envio HyperIndex V3 indexer (`indexer/`, outside the pnpm workspace) that turns our testnet
contracts, the Chainlink XAU/XAG aggregators and Perpl Exchange into the entities the apps and `/stats` read —
positions, fills, activity, card holds, LP, oracle rounds + candles (no fabricated ticks), per-user and protocol
aggregates — plus a Coolify-ready compose, a HyperSync analytics script and `@senryo/indexer-client` (typed GraphQL
documents, zod-parsed results). Display only: the card path never reads the indexer (D-014).
- **Plan:** `00-plan.md` §1 (D-014, D-020, D-022, D-040), §2.3, §4 (S4 row), §5 (Envio + resources); D-102, D-103.
- **Open first:** `specs/services.md` → "Indexer" (binding), `specs/contracts.md` (events), `contracts/src/libraries/Events.sol`,
  `context/08-integrations/envio.md`, `context/09-product/deployment-coolify.md`, `references/envio-hyperindex`
  (V3 source + the 17 bundled skills), `references/envio-local-docker-example`, `references/envio-wsteth-monad-indexer-demo`,
  `references/perpl-dex-sdk/crates/sdk/abi/dex/Exchange.json`, `packages/contracts/src/{abis,addresses}`, `ids-and-txs.md`.
- **Docs read (Context7):** Envio `/websites/envio_dev` (effect API incl. `context.cache = false`, observability port
  9898 `/healthz`), HyperSync client `/enviodev/hypersync-client-node`.
**D-number range:** D-130…D-139.

## Steps
- [x] S4.1 Stage file
- [x] S4.2 Scaffold `indexer/` (own `package.json` + `pnpm-lock.yaml` + `pnpm-workspace.yaml` settings, envio 3.12.1,
      tsconfig); `config.yaml` for 10143 (every `indexed: true` address, start block 66856078) and 143 (Chainlink
      XAU/XAG aggregators + wildcard follow, Perpl Exchange from `APP_LAUNCH_BLOCK`); `address-drift` +
      `indexer-isolated` green
- [x] S4.3 Schema + handlers for our contracts: User (latest `AccountRiskUpdated` + cumulative stats), balances,
      moves, markets, positions, fills, funding/borrow, triggers, liquidations, card holds/debt/allowance, vouchers,
      starter claims, inboxes, intent orders, LP, oracle status; daily + protocol aggregates
- [x] S4.4 Oracle rounds + candles (OHLC from rounds + fills, no fabricated ticks); aggregator changes behind the
      mainnet proxies followed without a redeploy
- [x] S4.5 Perpl: accounts, markets, positions/fills for app users, `PerplCursor @internal` taker-fill pairing with
      the `unattributedFills` alarm, funding, liquidations; targeted pairing check on real mainnet logs
- [x] S4.6 Compose adapted for Coolify (no ports/container_name/networks, mem limits, `${VAR:?}`, console off, health
      checks on the real ports) + Dockerfile; local compose run
- [x] S4.7 HyperSync analytics script ("creative HyperSync")
- [x] S4.8 `@senryo/indexer-client`: portfolio, positions, fills, activity, candles, protocol stats, `_meta`
- [x] S4.9 Local sync at head (HyperSync with `ENVIO_API_TOKEN`, or the documented RPC data source) + a portfolio
      query through `@senryo/indexer-client` against testnet data
- [x] S4.10 Gate evidence + handoff
- [x] **(user)** Envio account + HyperSync API token → `~/.config/senryo/envio.env` (lead, 2026-09-30; HyperSync 200 on both chains)
- [ ] **[OK?]** Coolify: indexer compose resource + `indexer.senryo.xyz` (S14 deploy train; DNS in S6) — steps in Handoff
- [ ] S8 re-sync: our mainnet contracts on chain 143 + the real `ENVIO_APP_LAUNCH_BLOCK_143` (data change, Handoff)

## Gate
`cd indexer && pnpm envio codegen && pnpm tsc --noEmit` · `pnpm invariants` with `address-drift` + `indexer-isolated`
active and green · fast gate green · local sync at head (token permitting) · a portfolio query through
`@senryo/indexer-client` returns testnet data (when positions exist).

**Evidence (2026-09-30, rows in `acceptance.md`):** indexer gate green (codegen + `tsc --noEmit`); `pnpm invariants`
0 errors with `indexer-isolated` ✓ and `address-drift` ✓ (no longer skipped); `pnpm typecheck` 7/7, `pnpm lint` clean.
Full re-index on HyperSync: both chains `isReady` 41 s after storage init (62,243 events on 143, 48 on 10143).
`node packages/indexer-client/scripts/smoke.ts http://localhost:8080/v1/graphql 10143 0xba0b…a061` returns S3's drive
(deposit 6 AUSD → XAU long `0x9baec89c…` → keeper liquidation `0x6b44a112…`): equity 1.080893 AUSD (= archive
`account()`), the LIQUIDATED position, both fills, the Liquidation, activity, equity curve, candles, markets, stats.
Compose smoke: 3/3 healthy, public-role queries through the client, missing required env blocks `compose config`.

## Findings
- **Data sources.** HyperSync (token) syncs both chains to head in under a minute. The documented RPC data source
  (`rpc: { for: sync }`, no token) works but the public testnet RPC caps `eth_getLogs` at 100 blocks and 25–50 req/s:
  it crawled ~10 blocks/min with 429s, so RPC stays `fallback` (`ENVIO_RPC_FOR_<id>=sync` switches it).
- **monadinfra archive RPCs** answer JSON-RPC **batches** with 403 "Restricted JSON RPC method"; single calls at old
  blocks work. The Effect client does not batch (D-134).
- **Chainlink proxies** are EACAggregatorProxy v0.6: no aggregator-change event, `phaseId` 1, OCR2 aggregators
  `0xFecc…ebCe` (XAU) / `0x8Aa8…fB4` (XAG) emit `AnswerUpdated` + `NewTransmission`. ≈19 `AnswerUpdated` logs per 100
  mainnet blocks chain-wide (the wildcard watcher's load). D-132.
- **Perpl ordering holds:** 1,438/1,438 real fills paired offline and 17,217 in the indexer, 0 unattributed. Mainnet
  sample: ~68 Perpl logs/block, of which ~1.6/block are the events we subscribe to.
- **`MarketStateUpdated` is emitted at accrual, before the size change** — its sizes lag the trade in the same tx
  (after a liquidation it still showed the closed long). The indexer adds the fill delta (D-131); for S2/S8 this is
  expected contract behaviour, not a bug, but any other consumer must know it.
- **`CollateralSwapper` emits no event of its own** (SenryoCore emits `CollateralSwapped`), so it needs no indexer
  entry; `BookFunded/BookWithdrawn` are not subscribed (pool value is a chain read).
- **Envio quirks:** `envio dev` probes Hasura health at a hard-coded `localhost:8080` (a custom `HASURA_EXTERNAL_PORT`
  hangs 120 s then fails); config env interpolation is textual and runs over comments too (`${…}` in a comment breaks
  codegen); with `NODE_ENV=production` Envio drops its dev fallbacks (`ENVIO_PG_SSL_MODE`, `HASURA_GRAPHQL_ROLE`,
  throttle intervals must be set); first start spends 20 s–2 min tracking 35 tables in Hasura; `react-dom` peer
  warning from envio's TUI (ink) is harmless; the example compose's indexer health check probed 8080 (Hasura's port).
- **Resources at head (compose, Mac arm64):** indexer 423 MiB / 800 limit, Hasura 219 / 384, Postgres 67 / 512 —
  ≈ 0.7 GiB used against the 1.7 GiB ceiling (D-102 input). Compose first sync took 10 min vs 41 s in dev while the dev
  indexer polled HyperSync with the same token (cause unverified; measure on Coolify).
- **Biome lints GraphQL:** `indexer/schema.graphql` (679 lines, one file by Envio design) is exempt from the 400-line
  rule via a `biome.json` override; the repo's file-length invariant (TS/MJS/CSS/SOL) is unaffected.

## Handoff
- **Branch** `stage/S4-indexer` (not pushed; the lead merges). STATUS.md untouched.
- **Run locally:** `cd indexer && pnpm install && ENVIO_TUI=false pnpm envio dev` with `ENVIO_API_TOKEN` in the
  environment (load `~/.config/senryo/envio.env`; never a committed `.env` — the no-secrets invariant scans the tree).
  Hasura at `http://localhost:8080/v1/graphql` (public role reads without a secret). `ENVIO_SKIP_143=true` for a
  testnet-only run. Checks: `pnpm check:perpl-cursor` (no token), `pnpm hypersync:pools --days 7` (token).
- **GraphQL schema** (`indexer/schema.graphql`; every row carries `chainId`; filter `chainId: {_eq: …}`):
  `User` (latest risk: `equityInit imTotal mmTotal holds cardDebt envelope freeToTrade freeToSpend riskNonce`;
  cumulative `deposited withdrawn realizedPnl feesPaid fundingPaid borrowPaid volume cardSpent cardRefunded
  perplCollateral tradeCount liquidationCount openPositions`; relations `balances positions fills activity moves
  holdsList triggers liquidations daily riskHistory perplAccount`) · `CollateralBalance` (AUSD/USDC slot: `balance` at
  `balanceBlock` + flows) · `CollateralMove` · `Activity` (unified feed with `fill/move/hold/trigger/liquidation`) ·
  `RiskSnapshot` · `Market` (`ours-<id>` / `perpl-<perpId>`, status, lastPrice, OI, funding, volume) · `Position`
  (lifecycle rows, both venues, 1e18/usd6) · `Fill` · `FundingAccrual` · `FundingRate` · `Trigger` · `Liquidation`
  (both venues) · `CardHold` · `CardRefund` · `CardDebt` · `Allowance` · `Voucher` · `StarterClaim` · `Inbox` ·
  `IntentOrder` · `LpPosition` · `LpRedeemRequest` · `LpPoolDaily` · `OracleFeed` (`XAU`/`XAG`) · `OracleRound` ·
  `Candle` (feed, interval 300/900/3600/14400/86400, openTime) · `OracleStatusEvent` · `PerplAccount` ·
  `UserDailyStats` · `MarketDailyStats` · `ProtocolStats` (id `global`, incl. `unattributedFills`) ·
  `ProtocolDailyStats`; hidden: `PerplCursor`, `PositionPointer`. Plus Envio's `_meta` / `chain_metadata`.
- **`@senryo/indexer-client` API** (zod only): `createIndexerClient({ url, fetch?, headers?, timeoutMs? })` →
  `request(doc, vars, signal?)` · `graphqlEndpoint(INDEXER_ORIGIN)` · `IndexerError{kind: http|graphql|parse|timeout|
  network}` · documents `PortfolioDocument({chainId, user})` → `{ user | null, meta }` · `PositionsDocument` +
  `positionsVars(account, {status?, limit?, offset?})` · `FillsDocument` + `fillsVars(account, {marketId?,
  positionId?})` · `ActivityDocument` + `activityVars(account, {before?: {timestamp, id}, kinds?})` ·
  `EquityDocument` + `equityVars(account, {since?})` · `CandlesDocument` + `candlesVars(chainId, "XAU", 3600, {since?})`
  · `OurMarketsDocument({chainId})` · `MetaDocument` + `isIndexed(metas, chainId, block)` · `ProtocolStatsDocument` +
  `protocolStatsVars(chainId, nowSeconds, days?)` · `ResultOf<typeof Doc>`. Addresses are passed lowercase.
  For S3: the api's indexer bridge polls `MetaDocument` (progressBlock) and re-queries per address; for S6/S8/S11 the
  query layer wraps these in TanStack hooks and `fromQuery()`.
- **Compose / env** (`indexer/docker-compose.yaml`, `.env.example` names only): required `ENVIO_API_TOKEN`,
  `ENVIO_PG_PASSWORD`, `HASURA_GRAPHQL_ADMIN_SECRET`; optional `ENVIO_PG_USER`, `ENVIO_PG_DATABASE`, `LOG_LEVEL`,
  `LOG_STRATEGY`, `ENVIO_APP_LAUNCH_BLOCK_143`, `ENVIO_PERPL_BUILDER_ID`, `ENVIO_START_BLOCK_143`,
  `ENVIO_PERPL_START_BLOCK_143`, `ENVIO_FEED_START_BLOCK_143`, `ENVIO_FEED_WATCH_START_BLOCK_143`, `ENVIO_SKIP_143`,
  `ENVIO_RPC_URL_{143,10143}`, `ENVIO_RPC_FOR_{143,10143}`, `ENVIO_ARCHIVE_RPC_URL_{143,10143}`. Services
  `envio-postgres` (postgres:17.5, 512m, volume `envio-pg-data`), `graphql-engine` (hasura v2.43.0, 384m, :8080),
  `envio-indexer` (build `.`, 800m / 0.8 CPU, :9898 `/healthz`). Local: `-f docker-compose.local.yaml` adds loopback ports.
- **[OK?] S14 Coolify deploy** (needs the user's OK at that moment): (1) DNS A `indexer.senryo.xyz → 84.46.247.92`
  (with S6's DNS OK); (2) Coolify → new **Docker Compose** resource from the repo (deploy key), base dir `/indexer`,
  compose `docker-compose.yaml`, Auto Deploy off; (3) runtime env (Build **off**): `ENVIO_API_TOKEN` (from
  `~/.config/senryo/envio.env`), a generated `ENVIO_PG_PASSWORD` and `HASURA_GRAPHQL_ADMIN_SECRET`; (4) "Domains for
  graphql-engine" = `https://indexer.senryo.xyz:8080`; (5) `coolify deploy uuid <uuid>`; (6) verify: 3 services
  healthy, `curl https://indexer.senryo.xyz/v1/graphql -d '{"query":"{ _meta { chainId progressBlock isReady } }"}'`,
  then `ssh agari-box docker stats --no-stream` (D-102 small-first); (7) add a Traefik rate-limit middleware on the
  Hasura router (spec). Never publish ports, never delete the volume.
- **S8 re-sync (data change):** under chain `143` in `indexer/config.yaml` add `SenryoCore`, `SessionOracle`,
  `LpVault`, `StarterDrip`, `IntentRouter`, `InboxFactory`, `DepositInbox` (no address) with the `143.json` addresses
  and deploy start block (address-drift enforces it); set `ENVIO_APP_LAUNCH_BLOCK_143` to that block. Do **not** add
  mainnet AUSD/USDC under `Stablecoin` without measuring (every mainnet transfer would be fetched; the keeper's WS
  sweep covers inboxes). Then `envio start -r` / redeploy.
- **Open / for others:** Perpl builder id (Q-003) → `ENVIO_PERPL_BUILDER_ID`; S17: THIRD_PARTY_NOTICES entry for the
  Perpl ABI subset (MIT); S3: optionally build the indexer image in `images.yml` and switch compose to `image:`;
  Q-006 (self-host OK for judging / HyperSync limits) stays open — the free token synced both chains without errors.
- **Files outside `indexer/` + `packages/indexer-client/` touched:** `biome.json` (one override: GraphQL line cap off
  for `indexer/schema.graphql`), root `pnpm-lock.yaml` (new workspace package), appends to
  `docs/plan/{decisions,acceptance,references,ids-and-txs}.md` (D-130…D-138). `packages/{config,core}` untouched.

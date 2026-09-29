# Envio (HyperIndex / HyperSync) for our trading app

> Researched 2026-09-29. Sources: docs.envio.dev (`llms.txt` + `.md` pages, V3), Envio pricing pages (Firecrawl), source clones in `../../references/`, Context7 (`/enviodev/hyperindex`), and live Monad RPC samples of Perpl's exchange.
> Anything marked **(unverified)** is our inference or couldn't be confirmed from docs or source.
> Earlier general notes: [../03-sponsors/infra-data/envio.md](../03-sponsors/infra-data/envio.md). This file replaces them for our app.

**Cloned references** (read-only; disclose any code reuse under rules §4.1):
| Path | What | Version |
|---|---|---|
| `references/envio-hyperindex/` | `enviodev/hyperindex` source. The CLI templates include the 17 Claude skills at `packages/cli/templates/static/shared/.claude/skills/` | HEAD `fb886a8` (29 Sep 2026). Latest release **v3.13.0** (23 Sep 2026) |
| `references/envio-wsteth-monad-indexer-demo/` | Official Envio **Monad mainnet (143)** V3 example: ERC-20 wstETH, `disable_default_cross_chain: true` | `envio` 3.6.1 |
| `references/envio-local-docker-example/` | Official self-host `Dockerfile` + `docker-compose.yaml` (Postgres 17.5 + Hasura v2.43 + indexer) | `envio` 3.6.1 |
| `references/perpl-dex-sdk/` | Perpl Exchange ABI: `crates/sdk/abi/dex/Exchange.json` (MIT) | already present |

Licensing: HyperIndex is under an Envio EULA (`references/envio-hyperindex/licenses/`), not an OSS license. Self-hosting and using the generated code are allowed ([Licensing](https://docs.envio.dev/docs/HyperIndex/licensing.md)).

---

## 0. The 8 facts that shape our design

1. **The current API is V3** (`import { indexer } from "envio"`, `indexer.onEvent(...)`, `chains:`). The Monad docs guide still shows V2 (`networks:`, `Contract.Event.handler`), so don't copy it. V2→V3 cheat sheet: [migrate-to-v3](https://docs.envio.dev/docs/HyperIndex/migrate-to-v3.md).
2. **Handlers run twice.** The preload pass reads in parallel and skips writes; the processing pass then runs *sequentially in on-chain order*. Writes are visible to later events in the same batch ([preload-optimization](https://docs.envio.dev/docs/HyperIndex/preload-optimization.md)). So a tx-scoped "cursor" entity is safe, but side effects must go through `createEffect` or behind `context.isPreload`.
3. **Perpl's exchange has almost no indexed params, and several events carry no accountId.** `TakerOrderFilledV2`, `OrderPlaced` and `OrderCancelled` don't identify the account. `where` topic filters only work on `indexed` params (confirmed in `packages/envio/src/EventConfigBuilder.res`, which builds topics from `p.indexed` only). So **we can't filter Perpl to "our users" at the data source**. We filter in handlers.
4. **Perpl is very noisy.** Public-RPC sample of 100 mainnet blocks (109,026,000–099): **9,143 logs**. OrderRequestV2 3,862, OrderChanged 1,820, OrderBatchCompleted 1,241 and IOC 1,093 were ~98% of it. Trade-relevant events (Position* + fills + funding) ≈ **1–1.7 per block**. At ~302 ms blocks that is roughly **300k–500k events/day** for all of Perpl (estimate from one sample). Testnet looks similar: 3,638 logs per 100 blocks.
5. **Envio Cloud's free Development plan** has a soft limit of **100k events processed** and a hard limit of **30 days**. A breach starts 7 days of grace (normal operation), then 3 days read-only, then deletion ([deployment § fair usage](https://docs.envio.dev/docs/HyperIndex/hosted-service-deployment.md)). **Indexing Perpl breaches it within hours.** Routes are in §9.
6. **Envio Cloud does not expose Hasura `_aggregate` queries.** Aggregates must be computed in handlers ([navigating-hasura § Aggregations](https://docs.envio.dev/docs/HyperIndex/navigating-hasura.md)). The bounty's "derived/aggregated entities" criterion therefore has to live in the schema anyway.
7. **Reorgs are handled automatically** when HyperSync is the source (Monad is a native HyperSync chain, so no RPC is needed). The default `max_reorg_depth` is 200 blocks ([reorgs-support](https://docs.envio.dev/docs/HyperIndex/reorgs-support.md)). External side effects are **not** rolled back.
8. **Real-time over GraphQL WebSockets is "at your own risk"** on non-Dedicated Cloud plans, with no more than ~10 concurrent connections recommended ([websockets](https://docs.envio.dev/docs/HyperIndex/websockets.md)). The mobile app should poll or go through a small backend. Live prices and order books come from Perpl's own WS.

---

## 1. Project setup (V3)

Prerequisites: Node **≥22** (Cloud recommends ≥24), pnpm (Cloud builds with pnpm 10.32.0), and Docker or Podman (local only). Put `ENVIO_API_TOKEN` (the HyperSync token from https://envio.dev/app/api-tokens) in `.env`. Envio says it **can't be created programmatically**. Cloud deployments don't need it; local and self-hosted runs do ([quickstart-with-ai](https://docs.envio.dev/docs/HyperIndex/quickstart-with-ai.md)).

```bash
pnpx envio init                      # interactive: Contract Import (explorer | local ABI) or Template
# non-interactive, from a local ABI (Perpl's contract may be unverified on explorers):
pnpx envio init contract-import local -a ./abis/PerplExchange.json \
  --contract-name PerplExchange -b 143 -s 54773010 --single-contract
# templates: -t greeter | erc20 | feature-external-calls | feature-factory
pnpm dev            # = envio dev: runs codegen, starts Docker Postgres + Hasura, opens Hasura (admin secret "testing") at :8080
pnpm codegen        # after any config.yaml / schema.graphql change
pnpm envio start -r # clean re-index (needed after config/schema/ABI changes)
pnpm envio stop     # tear down local Docker + DB
pnpm test           # vitest + createTestIndexer()
envio skills update # refresh the bundled agent skills
```
Sources: [cli-commands](https://docs.envio.dev/docs/HyperIndex/cli-commands.md), [running-locally](https://docs.envio.dev/docs/HyperIndex/running-locally.md), [quickstart](https://docs.envio.dev/docs/HyperIndex/quickstart.md).

- `package.json` must have `"type": "module"`, and `engines.node >=22` ([migrate-to-v3 Step 2](https://docs.envio.dev/docs/HyperIndex/migrate-to-v3.md)).
- Handlers are **auto-discovered from `src/handlers/`**. A per-contract `handler:` path is optional ([configuration-file § Handler File Path](https://docs.envio.dev/docs/HyperIndex/configuration-file.md)).
- Hot reload covers handler files only. Config, schema and ABI changes need a restart.
- `ENVIO_TUI=false` turns off the terminal UI in V3. The demo repo's `CLAUDE.md` still says `TUI_OFF=true`, the V2 name ([environment-variables](https://docs.envio.dev/docs/HyperIndex/environment-variables.md)).
- The observability server runs on `:9898` (`/metrics`, `/healthz`).

## 2. `config.yaml` for Monad

| Network | chain id | HyperSync | HyperRPC |
|---|---|---|---|
| Monad mainnet | `143` | `https://monad.hypersync.xyz` / `https://143.hypersync.xyz` | `https://monad.rpc.hypersync.xyz` |
| Monad testnet | `10143` | `https://monad-testnet.hypersync.xyz` / `https://10143.hypersync.xyz` | `https://monad-testnet.rpc.hypersync.xyz` |

Source: [supported-networks](https://docs.envio.dev/docs/HyperIndex/supported-networks.md), [hypersync-supported-networks](https://docs.envio.dev/docs/HyperSync/hypersync-supported-networks.md). The HyperSync `/height` endpoint answered without a token (mainnet height 109,028,901 at research time). Data queries need a token.

Options relevant to us (all from [configuration-file](https://docs.envio.dev/docs/HyperIndex/configuration-file.md)):
- `start_block`: `0` is fine on HyperSync (it fast-forwards). v3.11+ accepts `latest`, which is resolved once at first deploy.
- **Per-contract `start_block`** override. **Per-event start** via `where: { block: { number: { _gte: N } } }`. Only `_gte` is allowed on event filters (`.claude/skills/indexer-filters/SKILL.md`).
- `abi_file_path` plus events by name, instead of signatures. We use this for Perpl's large ABI.
- `address_format: lowercase` (the default is checksum). Use it so the mobile app can key on lowercased addresses.
- `block_lag`, `max_reorg_depth`, `rollback_on_reorg`, `full_batch_size`, `raw_events`.
- `${ENVIO_VAR:-default}` interpolation anywhere. Cloud env vars must be prefixed `ENVIO_`.
- `disable_default_cross_chain: true` (v3.6) makes entities per-chain, keyed `(id, chainId)`. The official Monad demo sets it with the comment "recommended; default in HyperIndex v4". **Recommended** (see [multichain-indexing](https://docs.envio.dev/docs/HyperIndex/multichain-indexing.md)).
- The same address can be registered under two contract names (v3.9).
- **Proxies: use the proxy address.** Perpl's `0x34B6…2a6F` is the ERC1967 proxy, so we use that address.

## 3. `schema.graphql` essentials

From [schema](https://docs.envio.dev/docs/HyperIndex/schema.md):
- **IDs.** Every entity needs `id` of type `ID!`, `String!`, `Int!` or `BigInt!` (numeric ids since v3.5).
- **Scalars.** `ID String Int Float Boolean Bytes BigInt BigDecimal Timestamp Json`. Enums are TS string unions (`Enum<"Side">`).
- **Relations.** A field `market: Market!` is written in handlers as **`market_id`**. `@derivedFrom(field: "market")` gives a virtual reverse list that is not stored.
- **Indexing.** `@index` adds DB indexes for GraphQL filters and sorts. Since v3.5, `getWhere` creates the indexes it needs.
- **`@internal`** (v3.8) keeps an entity stored and usable in handlers but hides it from GraphQL. An exposed entity can't reference an internal one. Use it for cursors and scratch state.
- **Other directives.** `@crossChain` marks a shared entity when per-chain mode is on. `@storage(postgres, clickhouse)` routes an entity; ClickHouse on Cloud is Dedicated only. `@config(precision)` sets numeric precision. `"""docstrings"""` show up in introspection.

## 4. Handlers (V3 API)

From [event-handlers](https://docs.envio.dev/docs/HyperIndex/event-handlers.md) and [preload-optimization](https://docs.envio.dev/docs/HyperIndex/preload-optimization.md):
- `indexer.onEvent({ contract, event, fields?, where?, wildcard? }, async ({ event, context }) => …)`. Several handlers per event are allowed (v3.4). Top-level `await` works (ESM).
- The event exposes `event.params.*`, `chainId`, `srcAddress`, `logIndex`, `block.number`, and whichever fields `fields: { transaction: ["hash"], block: ["timestamp"] }` requests (v3.7). Reading an unlisted field is a type error.
- The context exposes `context.X.get / getOrThrow / getOrCreate / getWhere({ f: { _eq|_gt|_gte|_lt|_lte|_in } }) / set / deleteUnsafe`, plus `context.log`, `context.isPreload`, `context.effect(...)` and `context.chain`.
- `indexer.chains[chainId].isRealtime` is true once a chain reaches the head. Use it to gate "live only" notifications.
- `indexer.onBlock({ name, where: ({chain}) => ({ block: { number: { _gte, _lte, _every } } }) }, …)` runs on blocks. **`block` only has `number`**, so a timestamp needs an Effect or RPC call ([block-handlers](https://docs.envio.dev/docs/HyperIndex/block-handlers.md)). Our daily buckets therefore key on event timestamps instead.
- **Effect API**: `createEffect({ name, input, output, rateLimit, cache })`. Effects are batched and memoized; `cache: true` persists results. Reusing the cache across Cloud redeploys requires a paid plan ([effect-api](https://docs.envio.dev/docs/HyperIndex/effect-api.md)). Use effects for `eth_call` (for example Perpl's `getPerpetualInfo`) and push notifications.

## 5. Dynamic registration and third-party contracts

- **Dynamic registration**: `indexer.contractRegister({ contract, event }, ({ event, context }) => context.chain.Child.add(addr))`. It can be async, and any event can trigger it. Events from the new contract in the same block are covered. There is no practical cap on addresses (v3.5+) ([dynamic-contracts](https://docs.envio.dev/docs/HyperIndex/dynamic-contracts.md)).
  - **Our use:** only if we deploy per-user or per-market contracts, for example one position-manager per market from a factory. For a single vault and engine, static addresses are enough.
  - Perpl's `DelegatedAccount` factory is mainnet `0xc535276e3e446e4f28d95ed27ccd5c32e4c8907a` (see [perpl.md](../03-sponsors/finance-trading/perpl.md)). It could be a registration source, but its event ABI is **(unverified)**.
- **Third-party contracts** are indexed exactly like ours, since you only need address + ABI. For Perpl:
  - Exchange (proxy) mainnet **`0x34B6552d57a35a1D042CcAe1951BD1C370112a6F`**, deploy block **54,773,010**.
  - Testnet **`0x1964C32f0bE608E7D29302AFF5E61268E72080cc`**, deploy block 62,953.
  - Collateral AUSD: CNS = **1e6**.
  - Sources: [perpl.md](../03-sponsors/finance-trading/perpl.md), DefiLlama `dexs/perpl/index.ts`.
- **Perpl events we need.** The ABI is `references/perpl-dex-sdk/crates/sdk/abi/dex/Exchange.json`; none of these have indexed params.

| Event | Key fields | Our use |
|---|---|---|
| `AccountCreated(address account, uint256 id)` | owner ↔ Perpl accountId | link app user ↔ Perpl account |
| `CollateralDeposit/CollateralWithdrawal(accountId, amountCNS, balanceCNS)` | balance | Perpl collateral per user |
| `ContractAdded` / `ContractAddedV2(perpId, name, symbol, …, priceDecimals, lotDecimals, …)` | market metadata | `Market` decimals (no eth_call needed) |
| `PositionOpenedV2(perpId, accountId, positionType, leverageHdths, depositCNS, pnlCollateralizedCNS, pricePNS, lotLNS, insFeeCNS, protFeeCNS, priceResiduePNSQ16)` | open | Position + Fill |
| `PositionIncreasedV2(… startLotLNS, endLotLNS …)` / `PositionDecreased(… deltaPnlCNS, fundingCNS)` / `PositionClosed(perpId, accountId, positionType, pricePNS, deltaPnlCNS, fundingCNS)` / `PositionInverted(…)` | size changes, **realized PnL and funding** | Position, Fill, PnL aggregates |
| `PositionLiquidated(perpId, posAccountId, …, liqPricePNS, liqLotLNS, …, deltaPnlCNS, fundingCNS, …)`, `PositionDeleveragedV2`, `PositionUnwound*` | forced exits | Liquidation |
| `MakerOrderFilledV2(perpId, accountId, orderId, pricePNS, lotLNS, feeCNS, …, builderId, builderFeeCNS)` | maker fee | Fill.fee / isMaker |
| `TakerOrderFilledV2(entryPricePNS, collatPricePNS, pnlPricePNS, lotLNS, feeCNS, amountCNS, balanceCNS, builderId, builderFeeCNS)` | **no perpId, no accountId** | taker fee, builder attribution, market volume |
| `FundingEventCompleted(perpId, fundingEventBlock, specifiedRatePct100k, actualRatePct100k, fundingPricePNS, fundingPaymentPNS, fundingSumPNS, …)` | per-market funding | FundingEvent history |

  - `positionType`: 0 = Long, 1 = Short (`perpl-dex-sdk/crates/sdk/src/state/position.rs`).
  - V1 and V2 variants coexist. The V2 events only *append* fields. Per DefiLlama, PositionOpened/Increased became V2 at rc_v1.1.7.3, and Maker/TakerOrderFilled became V2 at rc_v1.1.7.4 (block 95,662,781). If `start_block` is after those upgrades, only the V2 forms matter for trades. `ContractAdded` (V1) is still needed for older markets' metadata.

- **Attributing taker fills without the noisy `OrderRequestV2`.** Perpl's own SDK carries an "order context" from `OrderRequestV2` to `TakerOrderFilledV2` (`perpl-dex-sdk/crates/sdk/src/stream/trade.rs`). That would force us to index ~3,900 OrderRequestV2 logs per 100 blocks. We observed a cheaper ordering in 6 real mainnet trade txs:
  ```
  OrderRequestV2 > PositionIncreasedV2(maker A) > MakerOrderFilledV2(A) > PositionDecreased(maker B) > MakerOrderFilledV2(B) > PositionIncreasedV2(taker) > TakerOrderFilledV2 > OrderBatchCompleted
  ```
  Each fill event comes right after the `Position*` event of the same account. A one-row `@internal` cursor, holding the last Position event's tx hash, account, market and fill id, therefore attributes maker fees, taker fees and the taker's perpId. This ordering is **observed, not documented by Perpl (unverified as a guarantee)**. Lock it in with a `createTestIndexer` test on a real block range (§10).

## 6. Monad fast blocks, reorgs, finality

- **Block time.** ~302 ms measured, with ~2-block finality ([../01-tracks/onchain-finance.md](../01-tracks/onchain-finance.md)). RPC `latest` is speculative (Proposed), `safe` is Voted, `finalized` is Finalized ([../03-sponsors/infra-data/README.md](../03-sponsors/infra-data/README.md)).
- **Reorgs.** HyperIndex detects reorgs and rolls back entities automatically. Detection is **guaranteed on HyperSync**, while RPC sources have edge cases. The default depth is 200 blocks (about 60 s on Monad). Effects, webhooks and pushes are not rolled back ([reorgs-support](https://docs.envio.dev/docs/HyperIndex/reorgs-support.md)).
- **Open question.** Whether Monad HyperSync serves Proposed or only Voted/Finalized blocks is **(unverified)**. Ask in Envio Discord.
- **Safer head (optional).** `block_lag: 3` (about 1 s) keeps the indexer 3 blocks behind the head, trading latency for safety ([configuration-file § Block Lag](https://docs.envio.dev/docs/HyperIndex/configuration-file.md)).
- **Settlement.** Anything that authorizes value, such as the card's spendable balance at authorization time, must read the **vault contract at `finalized`**, not the indexer. The indexer serves display and history.
- **Notifications.** Send pushes (fill, liquidation) only when `indexer.chains[143].isRealtime` is true, via an Effect. Accept that a reorg can't un-send a push.
- **Latency.** Envio says head latency is most optimized on the major chains, and "on smaller chains, latency might be slightly higher" ([latency-at-head](https://docs.envio.dev/docs/HyperIndex/latency-at-head.md)). Monad head latency is **(unverified)**, so measure `_meta.sourceBlock − progressBlock`.

## 7. GraphQL API for the mobile app

- **Endpoints.** Local: `http://localhost:8080/v1/graphql` (Hasura). Cloud: `https://…/v1/graphql`. Filtering and sorting use Hasura syntax (`where`, `order_by`, `limit`, `offset`) ([navigating-hasura](https://docs.envio.dev/docs/HyperIndex/navigating-hasura.md)).
- **No `_aggregate` on Cloud.** Read precomputed aggregate entities instead.
- **"Wait until indexed" after a tx.** Poll `_meta { chainId progressBlock isReady sourceBlock }` until `progressBlock ≥ receipt.blockNumber`, then refetch ([observability § Indexing status](https://docs.envio.dev/docs/HyperIndex/observability.md)).
- **Subscriptions.** Swap `https` for `wss` and use `graphql-ws`. This is supported on Dedicated; on other plans it is "at your own risk" and not recommended beyond 10 concurrent connections. Self-hosted Hasura supports subscriptions natively, and there we control the limits.
- **Auth.** Cloud offers per-indexer **API keys** (`Authorization: Bearer`) or an IP allowlist ([hosted-service-features](https://docs.envio.dev/docs/HyperIndex/hosted-service-features.md)). A key shipped inside an app binary is extractable, so treat it as a rate limiter, not a secret.
- **Rate limits and endpoint URL.** The Cloud **query rate limit is 100/min on Development** and Production Small is 250/min ([envio.dev/pricing/hosting](https://envio.dev/pricing/hosting); the scraped table's columns are misaligned, so exact per-plan values are **(unverified)**). The **static production endpoint is a Production-plan feature**; on Development the URL differs per deployment (`envio-cloud deployment endpoint <indexer> <commit>`).
- **Recommended shape.**
  - The mobile app talks to a thin backend (an edge function) that caches indexer responses and holds the key.
  - Alternatively, the app fetches the current endpoint URL from remote config, so redeploys don't need an app release.
  - Live mark prices and the order book come from Perpl WS (`wss://app.perpl.xyz`). The indexer serves portfolio, history, PnL and leaderboards.

## 8. HyperSync client for analytics

`pnpm add @envio-dev/hypersync-client` (v1.4.1, 8 Sep 2026). The API is `HypersyncClient({ url, apiToken })` with `.get(query)`, `.stream(query, config)`, `.getHeight()`, `.collectParquet(...)`, and `Decoder.fromSignatures([...])` (`index.d.ts` in `enviodev/hypersync-client-node`; example `examples/all-erc20/src/app.ts`). Field names are PascalCase in `fieldSelection`. Use it for things the indexer shouldn't store, such as **Perpl-wide history since block 54,773,010** (full-market volume per perp, top-trader leaderboards, a liquidation heatmap). This matches the bounty's "creative use of HyperSync for analytics":

```ts
// scripts/perpl-volume.ts : full-history Perpl taker volume per perp, via position-event prices (sketch)
import { HypersyncClient, Decoder, type Query } from "@envio-dev/hypersync-client";

const EXCHANGE = "0x34B6552d57a35a1D042CcAe1951BD1C370112a6F";
const SIGS = [
  "PositionOpenedV2(uint256 perpId, uint256 accountId, uint8 positionType, uint256 leverageHdths, uint256 depositCNS, int256 pnlCollateralizedCNS, uint256 pricePNS, uint256 lotLNS, uint256 insFeeCNS, uint256 protFeeCNS, uint256 priceResiduePNSQ16)",
  "PositionClosed(uint256 perpId, uint256 accountId, uint8 positionType, uint256 pricePNS, int256 deltaPnlCNS, int256 fundingCNS)",
];
const client = new HypersyncClient({ url: "https://monad.hypersync.xyz", apiToken: process.env.ENVIO_API_TOKEN! });
const decoder = Decoder.fromSignatures(SIGS);
// topic0 = keccak256 of the type-only signature, e.g. `cast keccak "PositionClosed(uint256,uint256,uint8,uint256,int256,int256)"`
const TOPICS: string[] = [/* fill with the two topic0 hashes */];

const query: Query = {
  fromBlock: 54_773_010,
  logs: [{ address: [EXCHANGE], topics: [TOPICS] }],
  fieldSelection: { log: ["BlockNumber", "LogIndex", "TransactionHash", "Data", "Topic0"], block: ["Number", "Timestamp"] },
};
const pnlByAccount = new Map<bigint, bigint>();
for (;;) {
  const res = await client.get(query);
  const decoded = await decoder.decodeLogs(res.data.logs);
  decoded.forEach((d, i) => {
    if (!d || res.data.logs[i].topics?.[0] !== TOPICS[1]) return;  // PositionClosed only (field names: check typings)
    const accountId = d.body[1].val as bigint, pnl = d.body[4].val as bigint;
    pnlByAccount.set(accountId, (pnlByAccount.get(accountId) ?? 0n) + pnl);
  });
  if (res.nextBlock >= res.archiveHeight!) break;   // archiveHeight is optional in typings (unverified)
  query.fromBlock = res.nextBlock;
}
```
- Decoded field positions: `d.indexed[]` holds indexed params and `d.body[]` holds the rest, in ABI order. Log field names on the response (`topics` vs `topic0`) should be checked against `index.d.ts`, so this code is **(unverified)** until compiled.
- **Reorgs when using raw HyperSync at the head:** use the **rollback guard** (`first_parent_hash` vs the stored `hash`) ([hypersync-query § rollback guard](https://docs.envio.dev/docs/HyperSync/hypersync-query.md)).
- **HyperRPC** (`https://monad.rpc.hypersync.xyz/<token>`) is a read-only `eth_getLogs` / receipts drop-in for viem in our backend.

## 9. Local dev, self-hosting, Envio Cloud, pricing

**Local:** `pnpm dev` starts Postgres on `:5433` and Hasura on `:8080` (secret `testing`). For fast iteration, set a recent `start_block` or use `createTestIndexer` tests ([running-locally](https://docs.envio.dev/docs/HyperIndex/running-locally.md)).

**Self-host** ([self-hosting](https://docs.envio.dev/docs/HyperIndex/self-hosting.md), `references/envio-local-docker-example/`):
- `docker-compose.yaml` runs `envio-postgres` + `graphql-engine` (Hasura, with `HASURA_GRAPHQL_UNAUTHORIZED_ROLE: public`) + `envio-indexer`.
- Env vars: `ENVIO_API_TOKEN`, `ENVIO_PG_*`, `HASURA_GRAPHQL_ADMIN_SECRET`.
- The bounty explicitly accepts "deployed to Envio Cloud **or self-hosted**".

**Envio Cloud** ([hosted-service-deployment](https://docs.envio.dev/docs/HyperIndex/hosted-service-deployment.md), [envio-cloud-cli](https://docs.envio.dev/docs/HyperIndex/envio-cloud-cli.md)):
- **Setup.** Sign in at envio.dev/app with GitHub, install the *Envio Deployments* GitHub App, click Add Indexer (config path, root dir, branch), then `git push`.
- **Build requirements.** Repo ≤100 MB. `package.json` in the indexer root with `envio` pinned. pnpm 10.32.0.
- **Redeploys.** Every push is a **new deployment that re-indexes from start_block**; the old one serves until the new one syncs.
- **Limits.** 3 Development indexers per org and 3 deployments per indexer.
- **CLI.** `npx envio-cloud login` · `envio-cloud indexer add --name X --repo Y --branch main --tier development` · `envio-cloud deployment status X <commit> --watch-till-synced` · `deployment endpoint` · `deployment promote` · `indexer env set X org ENVIO_FOO=…`.

**Pricing** ([envio.dev/pricing/hosting](https://envio.dev/pricing/hosting), [hosted-service-billing](https://docs.envio.dev/docs/HyperIndex/hosted-service-billing.md)):

| Plan | Price | Notes |
|---|---|---|
| Development | Free | 30-day max. Soft limits: 100k events / 5 GB / 7 days idle, then 7-day grace + 3 days read-only + delete. Deleted over 20 GB. No backups. Per-deployment URL |
| Production Small / Medium / Large | $70 / $300 / $800 per month | 800 indexing hours included (one always-on deployment ≈ 730 h). Static production endpoint, zero-downtime promote, alerts, IP allowlist. Effect cache from Medium up. Storage column reads 1M / 10M / 100M ("approx", unit unclear, **(unverified)**) |
| Dedicated | Custom | WebSockets fully supported, direct DB, ClickHouse |

HyperSync itself: free tier is fair-use rate limited (earlier notes: Starter $70/mo, Pro $480/mo; see [../03-sponsors/infra-data/envio.md](../03-sponsors/infra-data/envio.md)).

**Hackathon perks:**
- Envio's prize line: *"Two months of Cloud hosting free, then a third month at 50% off"*, up to $6,000 across winners ([../_portal/pages/prizes.md](../_portal/pages/prizes.md) l.96–98).
- Bounty: $1,000, single prize.
- **Denham (Envio founder) is listed as bounty judge and mentor** (prizes.md l.255, l.441).
- No pre-event credit program was found. The pricing FAQ mentions student/academic discounts.

**Routes around the 100k-event free limit (Perpl firehose):**
1. **Recommended: self-host one indexer** (the docker-compose above on any small VPS or container host). No event cap; only HyperSync fair-use applies. Its Hasura also supports subscriptions and `_aggregate` if we want them.
2. **Cloud Development for our own contracts only.** Vault, card holds and our engine are low volume. Perpl history then comes from the self-hosted indexer or HyperSync scripts.
3. **Keep Perpl narrow in time.** `where: { block: { number: { _gte: APP_LAUNCH_BLOCK } } }` on the noisy Perpl events, while `AccountCreated` and `ContractAdded*` start at the deploy block. A fresh Cloud Dev deployment keeps working through the 7-day grace after a breach, then 3 days read-only.
4. **Production Small ($70/mo)**, if its event limits suffice **(unverified; ask)**.
5. **Ask Envio in Discord** (https://discord.gg/envio) or the judge for credits or a temporary plan bump for a Perpl-heavy hackathon indexer. The Monad Dev Discord is another channel.

---

## 10. Proposed schema, config and handlers for our app

**Design goals:**
- One indexer covers **our contracts** (ERC-4626 vault, card-hold contract, our own RWA perp engine) and **Perpl**. That gives two venues behind one `Position`/`Fill` model, which is the "non-trivial schema".
- Aggregates live in the schema: per-user PnL, fees, funding and volume, **daily buckets**, per-market stats, and protocol stats.
- Every entity the app reads is keyed so that one query serves one screen.

**Our own contract events** are ours to define. Proposal:
- Vault: standard **ERC-4626** `Deposit`/`Withdraw`.
- Card holds: `CardHoldPlaced(bytes32 indexed holdId, address indexed user, uint256 amount, bytes32 merchantRef)`, `CardHoldCaptured(bytes32 indexed holdId, uint256 amount)`, `CardHoldReleased(bytes32 indexed holdId)`.
- Our perp engine: mirror Perpl's Position events **but with `address indexed trader` and `uint256 indexed marketId`**, so HyperSync and `where` filters work, and put every value the UI needs in the event to avoid eth_calls.

### `config.yaml`
```yaml
# yaml-language-server: $schema=./node_modules/envio/evm.schema.json
name: metropolis-indexer
description: Vault, card holds, our RWA perps and Perpl activity on Monad
address_format: lowercase
disable_default_cross_chain: true          # per-chain rows; official Monad demo recommends it

contracts:
  - name: Vault                             # our ERC-4626 collateral vault
    events:
      - event: "Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)"
      - event: "Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)"
  - name: CardHolds                         # ours (proposed ABI)
    events:
      - event: "CardHoldPlaced(bytes32 indexed holdId, address indexed user, uint256 amount, bytes32 merchantRef)"
      - event: "CardHoldCaptured(bytes32 indexed holdId, uint256 amount)"
      - event: "CardHoldReleased(bytes32 indexed holdId)"
  - name: PerplExchange                     # third party, ABI copied from perpl-dex-sdk (MIT)
    abi_file_path: ./abis/PerplExchange.json
    events:
      - event: AccountCreated
      - event: CollateralDeposit
      - event: CollateralWithdrawal
      - event: ContractAdded
      - event: ContractAddedV2
      - event: PositionOpenedV2
      - event: PositionIncreasedV2
      - event: PositionDecreased
      - event: PositionClosed
      - event: PositionInverted
      - event: PositionLiquidated
      - event: MakerOrderFilledV2
      - event: TakerOrderFilledV2
      - event: FundingEventCompleted

chains:
  - id: ${ENVIO_CHAIN_ID:-143}              # 143 mainnet, 10143 testnet
    start_block: ${ENVIO_PERPL_DEPLOY_BLOCK:-54773010}   # testnet: 62953
    contracts:
      - name: Vault
        address: "${ENVIO_VAULT_ADDRESS}"
        start_block: ${ENVIO_VAULT_DEPLOY_BLOCK}
      - name: CardHolds
        address: "${ENVIO_CARDHOLDS_ADDRESS}"
        start_block: ${ENVIO_VAULT_DEPLOY_BLOCK}
      - name: PerplExchange
        address: "${ENVIO_PERPL_EXCHANGE:-0x34B6552d57a35a1D042CcAe1951BD1C370112a6F}"  # testnet 0x1964C32f0bE608E7D29302AFF5E61268E72080cc
```
Interpolating a numeric `id`/`start_block` from env follows the documented `${ENVIO_CHAIN_ID:-…}` example. A numeric `start_block` via env is **(unverified)**; hard-code per network if codegen rejects it.

### `schema.graphql`
```graphql
enum Venue { OURS PERPL }
enum Side { LONG SHORT }
enum PositionStatus { OPEN CLOSED LIQUIDATED }
enum FillKind { OPEN INCREASE DECREASE CLOSE INVERT LIQUIDATION }
enum HoldStatus { HELD CAPTURED RELEASED }

"""An app user = the Mera smart-account address"""
type User {
  id: ID!                                   # lowercased address
  createdAt: Int!
  vaultShares: BigInt!
  vaultAssetsIn: BigInt!                    # cumulative deposits (AUSD/USDC units)
  vaultAssetsOut: BigInt!
  cardHeld: BigInt!                         # sum of open holds
  cardSpent: BigInt!                        # captured total
  perplCollateral: BigInt!                  # CNS, latest balanceCNS
  realizedPnl: BigInt!                      # both venues, collateral units
  fundingPaid: BigInt!                      # positive = paid
  feesPaid: BigInt!
  volume: BigInt!                           # notional, collateral units
  tradeCount: Int!
  liquidationCount: Int!
  perplAccount: PerplAccount
  positions: [Position!]! @derivedFrom(field: "user")
  fills: [Fill!]! @derivedFrom(field: "user")
  deposits: [VaultDeposit!]! @derivedFrom(field: "user")
  withdrawals: [VaultWithdrawal!]! @derivedFrom(field: "user")
  cardHolds: [CardHold!]! @derivedFrom(field: "user")
  daily: [UserDailyStats!]! @derivedFrom(field: "user")
  liquidations: [Liquidation!]! @derivedFrom(field: "user")
}

type PerplAccount {
  id: ID!                                   # Perpl accountId (decimal string)
  owner: String! @index
  user: User                                # set only for app users
  balance: BigInt!                          # CNS
  createdAt: Int!
}

type VaultDeposit { id: ID! user: User! assets: BigInt! shares: BigInt! sender: String! timestamp: Int! @index txHash: String! }
type VaultWithdrawal { id: ID! user: User! assets: BigInt! shares: BigInt! receiver: String! timestamp: Int! @index txHash: String! }

type CardHold {
  id: ID!                                   # holdId
  user: User!
  amount: BigInt!
  captured: BigInt!
  status: HoldStatus! @index
  merchantRef: String!
  createdAt: Int!
  settledAt: Int
}

type Market {
  id: ID!                                   # "perpl-<perpId>" | "ours-<marketId>"
  venue: Venue!
  symbol: String!
  priceDecimals: Int!
  lotDecimals: Int!
  volume: BigInt!                           # all traders, collateral units
  tradeCount: Int!
  appVolume: BigInt!                        # our users only
  openInterestLots: BigInt!                 # our users only (Perpl-wide OI: HyperSync/eth_call)
  lastFundingRatePct100k: BigInt
  positions: [Position!]! @derivedFrom(field: "market")
  fills: [Fill!]! @derivedFrom(field: "market")
  funding: [FundingEvent!]! @derivedFrom(field: "market")
}

type Position {
  id: ID!                                   # "<marketId>-<account>" (isolated margin: one per market)
  user: User!
  market: Market!
  side: Side!
  status: PositionStatus! @index
  sizeLots: BigInt!
  entryPrice: BigInt!                       # market price units
  margin: BigInt!                           # collateral units
  leverageHdths: BigInt!
  realizedPnl: BigInt!
  fundingPaid: BigInt!
  feesPaid: BigInt!
  openedAt: Int!
  updatedAt: Int! @index
  closedAt: Int
  fills: [Fill!]! @derivedFrom(field: "position")
}

type Fill {
  id: ID!                                   # "<chainId>_<block>_<logIndex>" of the Position* event
  user: User!
  market: Market!
  position: Position!
  kind: FillKind!
  side: Side!
  lots: BigInt!
  price: BigInt!
  notional: BigInt!                         # collateral units
  isMaker: Boolean
  fee: BigInt!
  builderId: BigInt
  realizedPnl: BigInt!
  funding: BigInt!
  timestamp: Int! @index
  txHash: String!
}

type Liquidation {
  id: ID!
  user: User!
  market: Market!
  position: Position!
  markPrice: BigInt!
  liqPrice: BigInt!
  lots: BigInt!
  pnl: BigInt!
  timestamp: Int! @index
  txHash: String!
}

type FundingEvent {
  id: ID!                                   # "<marketId>-<fundingEventBlock>"
  market: Market!
  ratePct100k: BigInt!
  paymentPNS: BigInt!
  block: Int!
  timestamp: Int!
}

"""Per-user daily rollup, used by the PnL chart"""
type UserDailyStats {
  id: ID!                                   # "<user>-<dayIndex>"
  user: User!
  day: Int! @index                          # floor(ts / 86400)
  realizedPnl: BigInt!
  fees: BigInt!
  funding: BigInt!
  volume: BigInt!
  trades: Int!
}

type ProtocolStats {
  id: ID!                                   # "global"
  users: Int!
  tvl: BigInt!                              # vault net assets
  openHolds: BigInt!
  appVolumeOurs: BigInt!
  appVolumePerpl: BigInt!
  builderVolume: BigInt!                    # Perpl taker fills carrying our builderId
  perplVolumeAll: BigInt!                   # every Perpl taker fill (third-party aggregate)
  liquidations: Int!
}

type ProtocolDailyStats {
  id: ID!                                   # dayIndex
  day: Int! @index
  newUsers: Int!
  deposits: BigInt!
  withdrawals: BigInt!
  volume: BigInt!
  cardSpend: BigInt!
}

"""Tx-scoped scratch: links Perpl fill events to the preceding Position* event"""
type PerplCursor @internal {
  id: ID!                                   # "cursor"
  txHash: String!
  accountId: String!
  marketId: String!
  fillId: String                            # set only if the account is an app user
}
```
- Why `PerplCursor` can be `@internal`: no exposed entity references it (a rule enforced by codegen).
- Nullable relations (`User.perplAccount`, `PerplAccount.user`) are written as `perplAccount_id` / `user_id`. Whether the TS field is optional or `| undefined` is **(unverified)**, so check the generated types.

### `src/handlers/vault.ts` (generic ERC-4626 Deposit)
```ts
import { indexer, type User } from "envio";

const DAY = 86_400;

export const newUser = (id: string, ts: number): User => ({
  id, createdAt: ts, vaultShares: 0n, vaultAssetsIn: 0n, vaultAssetsOut: 0n,
  cardHeld: 0n, cardSpent: 0n, perplCollateral: 0n, realizedPnl: 0n, fundingPaid: 0n,
  feesPaid: 0n, volume: 0n, tradeCount: 0, liquidationCount: 0, perplAccount_id: undefined,
});

indexer.onEvent(
  { contract: "Vault", event: "Deposit", fields: { transaction: ["hash"], block: ["timestamp"] } },
  async ({ event, context }) => {
    const { owner, sender, assets, shares } = event.params;
    const ts = event.block.timestamp;
    const day = Math.floor(ts / DAY);

    // All reads up front so the preload pass batches them
    const [user, stats, daily, perplAccts] = await Promise.all([
      context.User.get(owner),
      context.ProtocolStats.get("global"),
      context.ProtocolDailyStats.get(String(day)),
      context.PerplAccount.getWhere({ owner: { _eq: owner } }),
    ]);

    const isNew = !user;
    const base = user ?? newUser(owner, ts);
    const linked = perplAccts[0];

    context.User.set({
      ...base,
      vaultShares: base.vaultShares + shares,
      vaultAssetsIn: base.vaultAssetsIn + assets,
      perplAccount_id: base.perplAccount_id ?? linked?.id,
    });
    if (linked && !linked.user_id) context.PerplAccount.set({ ...linked, user_id: owner });

    context.VaultDeposit.set({
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      user_id: owner, assets, shares, sender, timestamp: ts, txHash: event.transaction.hash,
    });

    const s = stats ?? { id: "global", users: 0, tvl: 0n, openHolds: 0n, appVolumeOurs: 0n,
      appVolumePerpl: 0n, builderVolume: 0n, perplVolumeAll: 0n, liquidations: 0 };
    context.ProtocolStats.set({ ...s, users: s.users + (isNew ? 1 : 0), tvl: s.tvl + assets });

    const d = daily ?? { id: String(day), day, newUsers: 0, deposits: 0n, withdrawals: 0n, volume: 0n, cardSpend: 0n };
    context.ProtocolDailyStats.set({ ...d, newUsers: d.newUsers + (isNew ? 1 : 0), deposits: d.deposits + assets });
  },
);
```

### `src/handlers/perpl.ts` (third-party exchange: account link, position open, fill attribution)
```ts
import { indexer } from "envio";

const DAY = 86_400;
const CNS = 10n ** 6n;                      // Perpl collateral scale (AUSD)
const OUR_BUILDER_ID = BigInt(process.env.ENVIO_PERPL_BUILDER_ID ?? "0");  // from Perpl, 1..255
const APP_LAUNCH = Number(process.env.ENVIO_APP_LAUNCH_BLOCK ?? "0");
const pm = (perpId: bigint) => `perpl-${perpId}`;

// notional (CNS) = price/10^pd * lots/10^ld * 1e6
const notional = (price: bigint, lots: bigint, pd: number, ld: number) =>
  (price * lots * CNS) / 10n ** BigInt(pd + ld);

indexer.onEvent(
  { contract: "PerplExchange", event: "AccountCreated", fields: { block: ["timestamp"] } },
  async ({ event, context }) => {
    const { account, id } = event.params;
    const user = await context.User.get(account);
    context.PerplAccount.set({
      id: id.toString(), owner: account, user_id: user ? account : undefined,
      balance: 0n, createdAt: event.block.timestamp,
    });
    if (user) context.User.set({ ...user, perplAccount_id: id.toString() });
  },
);

indexer.onEvent(
  { contract: "PerplExchange", event: "ContractAddedV2" },
  async ({ event, context }) => {
    const p = event.params;
    const existing = await context.Market.get(pm(p.perpId));
    context.Market.set({
      id: pm(p.perpId), venue: "PERPL", symbol: p.symbol,
      priceDecimals: Number(p.priceDecimals), lotDecimals: Number(p.lotDecimals),
      volume: existing?.volume ?? 0n, tradeCount: existing?.tradeCount ?? 0,
      appVolume: existing?.appVolume ?? 0n, openInterestLots: existing?.openInterestLots ?? 0n,
      lastFundingRatePct100k: existing?.lastFundingRatePct100k,
    });
  },
);

// Noisy events start at our launch block; metadata events above start at Perpl's deploy block.
const afterLaunch = { block: { number: { _gte: APP_LAUNCH } } };

indexer.onEvent(
  {
    contract: "PerplExchange", event: "PositionOpenedV2", where: afterLaunch,
    fields: { transaction: ["hash"], block: ["timestamp"] },
  },
  async ({ event, context }) => {
    const p = event.params;
    const marketId = pm(p.perpId);
    const [acct, market] = await Promise.all([
      context.PerplAccount.get(p.accountId.toString()),
      context.Market.get(marketId),
    ]);
    const userId = acct?.user_id;
    const fillId = `${event.chainId}_${event.block.number}_${event.logIndex}`;

    // Always move the cursor, even for non-app accounts, so fills can't attach to a stale fill
    context.PerplCursor.set({
      id: "cursor", txHash: event.transaction.hash, accountId: p.accountId.toString(),
      marketId, fillId: userId ? fillId : undefined,
    });
    if (!userId || !market) return;          // not our user (or market metadata missing)

    const [user, daily] = await Promise.all([
      context.User.get(userId),
      context.UserDailyStats.get(`${userId}-${Math.floor(event.block.timestamp / DAY)}`),
    ]);
    if (!user) return;

    const ts = event.block.timestamp;
    const day = Math.floor(ts / DAY);
    const side = p.positionType === 0n ? "LONG" : "SHORT";   // uint8 decodes as bigint (unverified: may be number)
    const positionId = `${marketId}-${p.accountId}`;
    const value = notional(p.pricePNS, p.lotLNS, market.priceDecimals, market.lotDecimals);
    const openFee = p.insFeeCNS + p.protFeeCNS;

    context.Position.set({
      id: positionId, user_id: userId, market_id: marketId, side, status: "OPEN",
      sizeLots: p.lotLNS, entryPrice: p.pricePNS, margin: p.depositCNS, leverageHdths: p.leverageHdths,
      realizedPnl: 0n, fundingPaid: 0n, feesPaid: openFee, openedAt: ts, updatedAt: ts, closedAt: undefined,
    });
    context.Fill.set({
      id: fillId, user_id: userId, market_id: marketId, position_id: positionId, kind: "OPEN", side,
      lots: p.lotLNS, price: p.pricePNS, notional: value, isMaker: undefined, fee: openFee,
      builderId: undefined, realizedPnl: 0n, funding: 0n, timestamp: ts, txHash: event.transaction.hash,
    });
    context.User.set({ ...user, volume: user.volume + value, tradeCount: user.tradeCount + 1, feesPaid: user.feesPaid + openFee });
    const d = daily ?? { id: `${userId}-${day}`, user_id: userId, day, realizedPnl: 0n, fees: 0n, funding: 0n, volume: 0n, trades: 0 };
    context.UserDailyStats.set({ ...d, volume: d.volume + value, trades: d.trades + 1, fees: d.fees + openFee });
    context.Market.set({ ...market, appVolume: market.appVolume + value, openInterestLots: market.openInterestLots + p.lotLNS });
  },
);
// PositionIncreasedV2 / PositionDecreased / PositionClosed / PositionInverted / PositionLiquidated:
// the same shape. Move the cursor, then for app users update Position (size, entry, margin, status),
// write a Fill (kind), and add deltaPnlCNS / fundingCNS to Position, User, UserDailyStats.
// PositionLiquidated also writes a Liquidation and bumps liquidationCount.

indexer.onEvent(
  { contract: "PerplExchange", event: "MakerOrderFilledV2", where: afterLaunch, fields: { transaction: ["hash"] } },
  async ({ event, context }) => {
    const p = event.params;
    const cur = await context.PerplCursor.get("cursor");
    if (!cur?.fillId || cur.txHash !== event.transaction.hash || cur.accountId !== p.accountId.toString()) return;
    const fill = await context.Fill.get(cur.fillId);
    if (!fill) return;
    context.Fill.set({ ...fill, isMaker: true, fee: fill.fee + p.feeCNS, builderId: p.builderId });
    context.PerplCursor.set({ ...cur, fillId: undefined });   // consumed
    // (also add p.feeCNS to User/UserDailyStats/Position fees, omitted for brevity)
  },
);

indexer.onEvent(
  { contract: "PerplExchange", event: "TakerOrderFilledV2", where: afterLaunch, fields: { transaction: ["hash"] } },
  async ({ event, context }) => {
    const p = event.params;
    const [cur, stats] = await Promise.all([context.PerplCursor.get("cursor"), context.ProtocolStats.get("global")]);
    if (!cur || cur.txHash !== event.transaction.hash) return;   // ordering assumption failed; see §5
    const market = await context.Market.get(cur.marketId);
    const value = market ? notional(p.entryPricePNS, p.lotLNS, market.priceDecimals, market.lotDecimals) : 0n;

    if (stats) context.ProtocolStats.set({
      ...stats,
      perplVolumeAll: stats.perplVolumeAll + value,
      builderVolume: stats.builderVolume + (OUR_BUILDER_ID !== 0n && p.builderId === OUR_BUILDER_ID ? value : 0n),
    });
    if (market) context.Market.set({ ...market, volume: market.volume + value, tradeCount: market.tradeCount + 1 });

    if (!cur.fillId) return;                                     // taker isn't an app user
    const fill = await context.Fill.get(cur.fillId);
    if (fill) context.Fill.set({ ...fill, isMaker: false, fee: fill.fee + p.feeCNS, builderId: p.builderId });
    context.PerplCursor.set({ ...cur, fillId: undefined });
  },
);
```

**Notes on this code:**
- **Preload.**
  - Reads come before any `if (context.isPreload)`-style exit, so they batch.
  - Reads that depend on an earlier read are awaited in sequence, which is allowed; the processing pass sees in-memory state.
  - `ProtocolStats` is only initialized by the Vault handler. If Perpl events arrive before any deposit, initialize it with `getOrCreate`.
- **Stats sources.** `perplVolumeAll` counts every Perpl taker fill after launch; it is a third-party aggregate built from `TakerOrderFilledV2.entryPricePNS × lotLNS`. The field semantics (entry vs collat price, total lots per taker order) are **(unverified)**. Cross-check against DefiLlama, which computes volume from maker fills.
- **Test first.**
  ```ts
  const ix = createTestIndexer();
  await ix.process({ chains: { 143: { startBlock: 109_026_000, endBlock: 109_026_099 } } });
  ```
  Then assert that every `Fill` with `isMaker === false` has a fee. Also `simulate` synthetic sequences ([testing](https://docs.envio.dev/docs/HyperIndex/testing.md)).
- **Card holds.** `CardHoldPlaced` sets `CardHold{HELD}` and raises `User.cardHeld` and `ProtocolStats.openHolds`. `Captured` moves the amount to `cardSpent` and `ProtocolDailyStats.cardSpend`. `Released` reverses the hold. The app's "spendable" figure is `vaultAssets − margin in our positions − cardHeld`, **for display only**; authorization reads the vault at `finalized`.
- **Our own perp engine.** It uses the same `Position`/`Fill`/`Market` entities with `venue: OURS`, so "all positions" is one query across both venues.

### Example queries (mobile screens)
```graphql
# Portfolio screen
query Portfolio($u: String!) {
  User(where: { id: { _eq: $u } }) {
    vaultAssetsIn vaultAssetsOut cardHeld perplCollateral realizedPnl fundingPaid feesPaid volume
    positions(where: { status: { _eq: "OPEN" } }) { id side sizeLots entryPrice margin market { symbol venue priceDecimals lotDecimals } }
  }
}
# Activity feed
query Fills($u: String!) { Fill(where: { user_id: { _eq: $u } }, order_by: { timestamp: desc }, limit: 50) { kind side lots price fee realizedPnl timestamp txHash market { symbol } } }
# PnL chart
query Daily($u: String!) { UserDailyStats(where: { user_id: { _eq: $u } }, order_by: { day: asc }) { day realizedPnl fees funding volume } }
# Leaderboard
query Top { User(order_by: { realizedPnl: desc }, limit: 20) { id realizedPnl volume tradeCount } }
# After sending a tx: wait for indexing
query Meta { _meta { chainId progressBlock isReady } }
```
Filtering on a relation's `_id` column in Hasura `where` (for example `user_id`) is **(unverified)**; `where: { user: { id: { _eq: $u } } }` is the standard Hasura form.

## 11. How this scores on the bounty (judging text quoted in [../_portal/bounties/envio-best-use-of-envio.md](../_portal/bounties/envio-best-use-of-envio.md))

- **"Non-trivial schema design, derived/aggregated entities."** The schema has two venues under one Position/Fill model, plus `@derivedFrom` reverse lists, daily rollups, per-market and protocol aggregates, and an `@internal` cursor that reconstructs fill attribution from third-party events.
- **"Creative use of HyperSync for analytics."** A Perpl-wide history script since the deploy block (leaderboard, liquidation heatmap) feeds a "market insights" screen.
- **"Working product… data is live and correct."** The app's Portfolio, Activity and PnL screens read the indexer. Show `_meta` progress and a backfill speed number in the demo.
- **Deliverables.** A public repo with `config.yaml`, `schema.graphql`, `src/handlers/*` and tests. Deploy to Envio Cloud or self-host. Put the GraphQL URL in the README.

## Sources
- https://docs.envio.dev/llms.txt
- HyperIndex:
  - https://docs.envio.dev/docs/HyperIndex/quickstart.md
  - https://docs.envio.dev/docs/HyperIndex/cli-commands.md
  - https://docs.envio.dev/docs/HyperIndex/configuration-file.md
  - https://docs.envio.dev/docs/HyperIndex/schema.md
  - https://docs.envio.dev/docs/HyperIndex/event-handlers.md
  - https://docs.envio.dev/docs/HyperIndex/preload-optimization.md
  - https://docs.envio.dev/docs/HyperIndex/dynamic-contracts.md
  - https://docs.envio.dev/docs/HyperIndex/wildcard-indexing.md
  - https://docs.envio.dev/docs/HyperIndex/block-handlers.md
  - https://docs.envio.dev/docs/HyperIndex/effect-api.md
  - https://docs.envio.dev/docs/HyperIndex/reorgs-support.md
  - https://docs.envio.dev/docs/HyperIndex/latency-at-head.md
  - https://docs.envio.dev/docs/HyperIndex/websockets.md
  - https://docs.envio.dev/docs/HyperIndex/navigating-hasura.md
  - https://docs.envio.dev/docs/HyperIndex/observability.md
  - https://docs.envio.dev/docs/HyperIndex/testing.md
  - https://docs.envio.dev/docs/HyperIndex/running-locally.md
  - https://docs.envio.dev/docs/HyperIndex/self-hosting.md
  - https://docs.envio.dev/docs/HyperIndex/environment-variables.md
  - https://docs.envio.dev/docs/HyperIndex/migrate-to-v3.md
  - https://docs.envio.dev/docs/HyperIndex/quickstart-with-ai.md
  - https://docs.envio.dev/docs/HyperIndex/supported-networks.md
- Envio Cloud and pricing:
  - https://docs.envio.dev/docs/HyperIndex/hosted-service-deployment.md
  - https://docs.envio.dev/docs/HyperIndex/hosted-service-features.md
  - https://docs.envio.dev/docs/HyperIndex/hosted-service-billing.md
  - https://docs.envio.dev/docs/HyperIndex/envio-cloud-cli.md
  - https://envio.dev/pricing
  - https://envio.dev/pricing/hosting
- HyperSync:
  - https://docs.envio.dev/docs/HyperSync/hypersync-clients.md
  - https://docs.envio.dev/docs/HyperSync/hypersync-query.md
  - https://docs.envio.dev/docs/HyperSync/hypersync-supported-networks.md
  - https://github.com/enviodev/hypersync-client-node (README, `index.d.ts`, `examples/all-erc20`, `examples/watch`)
- Source clones:
  - `references/envio-hyperindex` (`packages/envio/src/EventConfigBuilder.res`, `packages/cli/templates/static/shared/.claude/skills/indexer-filters/SKILL.md`)
  - `references/envio-wsteth-monad-indexer-demo`
  - `references/envio-local-docker-example`
- Perpl:
  - `references/perpl-dex-sdk/crates/sdk/abi/dex/Exchange.json`, `src/stream/trade.rs`, `src/state/exchange.rs`, `src/state/position.rs`
  - https://github.com/DefiLlama/dimension-adapters (`dexs/perpl/index.ts`, `open-interest/perpl.ts`)
- Live data: `eth_getLogs` on https://rpc.monad.xyz and https://testnet-rpc.monad.xyz, 29 Sep 2026 (100-block samples; topic0 decoded with `cast keccak` against the Perpl ABI)

# Envio — HyperIndex, HyperSync, HyperRPC on Monad

> Researched 2026-09-28 from docs.envio.dev (llms.txt + .md pages), docs.monad.xyz guides, envio.dev/pricing. Envio HyperIndex is on **V3** now (`indexer.onEvent` API, `chains:` key). The Monad docs' Envio guide still uses the **V2** API, so don't copy it as-is. See Gotchas.

## Overview

| Product | What it is | When to use it |
|---|---|---|
| **HyperIndex** | TypeScript indexing framework: `config.yaml`, `schema.graphql` and handlers produce Postgres plus a Hasura GraphQL API. Runs locally in Docker or on Envio Cloud. | The backend for any dapp that needs aggregates, leaderboards, histories or feeds |
| **HyperSync** | A high-throughput data API that bypasses JSON-RPC. You filter logs, txs, blocks and traces over any block range, and one request can cover thousands of blocks. Clients exist for Node, Python, Rust and Go. | Backfills, snapshots, analytics, and AI agents that answer ad-hoc onchain questions |
| **HyperRPC** | A read-only JSON-RPC endpoint backed by HyperSync, up to 5x faster than a node on data-heavy methods | A drop-in replacement for `eth_getLogs` and receipts in existing viem/ethers code |
| **Envio Cloud** | Managed HyperIndex hosting with git-push deploys (formerly "Hosted Service") | Where your indexer lives for the demo. **Winners get free Envio Cloud hosting.** |

Envio is well known in the Monad ecosystem. It sponsored an earlier Monad x Envio hackathon (winners included Gorillionaire, an AI trading-signals app, and MonFundMe) and the MetaMask Smart Accounts x Monad Dev Cook-Off. In the Cook-Off, "Best use of Envio" went to *Last Monad*, a live Monad network dashboard. Other winners there were an automation app (TradeClub), an AI monitoring agent (ShieldAI) and a smart-account explorer.

## Monad support (verified)

| Network | Chain ID | HyperSync | HyperRPC |
|---|---|---|---|
| Monad Mainnet | `143` | `https://monad.hypersync.xyz` or `https://143.hypersync.xyz` | `https://monad.rpc.hypersync.xyz` or `https://143.rpc.hypersync.xyz` |
| Monad Testnet | `10143` | `https://monad-testnet.hypersync.xyz` or `https://10143.hypersync.xyz` | `https://monad-testnet.rpc.hypersync.xyz` or `https://10143.rpc.hypersync.xyz` |

- Monad is a **native HyperSync chain**, so HyperIndex needs **no RPC URL** in `config.yaml`. HyperSync is the default data source.
- **Monad traces are live on HyperSync, with full history from block 0** (April 2026 update). Envio also published an export tool: https://github.com/enviodev/export-monad-traces. Trace support exists only on Ethereum, Base, Arbitrum, Gnosis and Monad.
- HyperRPC supports `eth_chainId`, `eth_blockNumber`, `eth_getBlockByNumber/Hash`, `eth_getBlockReceipts`, `eth_getTransactionByHash`, `eth_getTransactionByBlock*AndIndex`, `eth_getTransactionReceipt`, `eth_getLogs`, and `trace_block` on select chains. It is **read-only**, so you cannot send transactions through it.
- **An API token is required** for HyperSync and HyperRPC. Requests without one get HTTP 401. Create a token at https://envio.dev/app/api-tokens.
  - HyperSync: pass the token as a Bearer header or as `apiToken` in the client.
  - HyperRPC: append the token to the URL, as in `https://monad.rpc.hypersync.xyz/<api-token>`.
  - Indexers on Envio Cloud get HyperSync access without a custom token.

## Quickstart: HyperIndex (V3) for a Monad contract

Prerequisites: Node **v22+**, pnpm, and Docker (only needed to run locally). Put your token in `.env`:

```bash
ENVIO_API_TOKEN=your_token_here
```

**Option A: auto-generate from a verified contract (fastest)**

```bash
export ENVIO_API_TOKEN=...
pnpx envio init contract-import explorer \
  -n my-monad-indexer -c 0xYourContract -b 143 \
  --single-contract --all-events -d my-monad-indexer
# For an unverified contract, run `pnpx envio init`, choose Contract Import > Local ABI > custom network id 143 (or 10143)
cd my-monad-indexer && pnpm dev   # Hasura at http://localhost:8080, password: testing
```

**Option B: write the three files by hand.** The example below indexes a hypothetical app factory plus WMON on Monad mainnet and keeps per-account aggregates.

`package.json` must have `"type": "module"` (`pnpm pkg set type=module`, then `pnpm add envio`).

`config.yaml`
```yaml
# yaml-language-server: $schema=./node_modules/envio/evm.schema.json
name: monad-app-indexer
description: Metropolis app backend on Monad
contracts:
  - name: MarketFactory          # hypothetical: your factory
    handler: src/EventHandlers.ts
    events:
      - event: "MarketCreated(address indexed market, address indexed creator, string question)"
  - name: Market                 # hypothetical: child contracts, registered dynamically
    handler: src/EventHandlers.ts
    events:
      - event: "BetPlaced(address indexed user, bool side, uint256 amount)"
  - name: WMON
    handler: src/EventHandlers.ts
    events:
      # WETH9-style event names; the topic hash depends only on the types
      - event: "Transfer(address indexed src, address indexed dst, uint256 wad)"
chains:
  - id: 143                      # Monad mainnet (10143 = testnet)
    start_block: 0               # HyperSync fast-forwards to the first relevant block
    contracts:
      - name: MarketFactory
        address: "0xYourFactoryAddress"
      - name: Market             # no address: added at runtime via contractRegister
      - name: WMON
        address: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A"  # canonical WMON (Monad docs)
```

`schema.graphql`
```graphql
type Market {
  id: ID!                 # market address
  creator: String! @index
  question: String!
  totalVolume: BigInt!
  betCount: Int!
  bets: [Bet!]! @derivedFrom(field: "market")
}

type Bet {
  id: ID!                 # chainId_block_logIndex
  market: Market!         # set via market_id in handlers
  user: String! @index
  side: Boolean!
  amount: BigInt!
  blockNumber: Int!
  timestamp: Int!
  txHash: String!
}

type Account {
  id: ID!
  wmonSent: BigInt!
  wmonReceived: BigInt!
  betVolume: BigInt!
}
```

`src/EventHandlers.ts`
```typescript
import { indexer } from "envio";

// 1) Dynamic registration: every market deployed by the factory gets indexed
indexer.contractRegister(
  { contract: "MarketFactory", event: "MarketCreated" },
  ({ event, context }) => {
    context.chain.Market.add(event.params.market);
  },
);

indexer.onEvent(
  { contract: "MarketFactory", event: "MarketCreated" },
  async ({ event, context }) => {
    context.Market.set({
      id: event.params.market,
      creator: event.params.creator,
      question: event.params.question,
      totalVolume: 0n,
      betCount: 0,
    });
  },
);

// 2) Child-contract events; `fields` opts into tx/block fields (v3.7+)
indexer.onEvent(
  {
    contract: "Market",
    event: "BetPlaced",
    fields: { transaction: ["hash"], block: ["timestamp"] },
  },
  async ({ event, context }) => {
    const marketId = event.srcAddress;
    const market = await context.Market.get(marketId);
    const acct = await context.Account.get(event.params.user);

    context.Bet.set({
      id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
      market_id: marketId,
      user: event.params.user,
      side: event.params.side,
      amount: event.params.amount,
      blockNumber: event.block.number,
      timestamp: event.block.timestamp,
      txHash: event.transaction.hash,
    });

    if (market) {
      context.Market.set({
        ...market,
        totalVolume: market.totalVolume + event.params.amount,
        betCount: market.betCount + 1,
      });
    }
    context.Account.set({
      id: event.params.user,
      wmonSent: acct?.wmonSent ?? 0n,
      wmonReceived: acct?.wmonReceived ?? 0n,
      betVolume: (acct?.betVolume ?? 0n) + event.params.amount,
    });
  },
);

// 3) WMON transfers into per-account totals
indexer.onEvent({ contract: "WMON", event: "Transfer" }, async ({ event, context }) => {
  const { src, dst, wad } = event.params;
  const [from, to] = await Promise.all([context.Account.get(src), context.Account.get(dst)]);
  context.Account.set({
    id: src,
    wmonSent: (from?.wmonSent ?? 0n) + wad,
    wmonReceived: from?.wmonReceived ?? 0n,
    betVolume: from?.betVolume ?? 0n,
  });
  context.Account.set({
    id: dst,
    wmonSent: to?.wmonSent ?? 0n,
    wmonReceived: (to?.wmonReceived ?? 0n) + wad,
    betVolume: to?.betVolume ?? 0n,
  });
});
```

Run and query:
```bash
pnpm codegen     # rerun after any config.yaml or schema change
pnpx envio dev   # Docker: Postgres + Hasura at :8080 (password "testing")
pnpm test        # V3 ships a testing framework (createTestIndexer, Vitest)
```
```graphql
query TopMarkets {
  Market(order_by: { totalVolume: desc }, limit: 10) { id question totalVolume betCount }
}
```

### External calls and notifications (bots, AI agents)

V3 **always** runs handlers twice because of preload optimization. Any side effect, such as a Telegram message, a webhook or an LLM call, must therefore use one of these:
- the **Effect API** (`createEffect` + `context.effect(...)`), which is batched, memoized and can be cached, **or**
- `if (context.isPreload) return;` placed before the side effect.

To alert only on live events and skip history, check `indexer.chains[event.chainId].isRealtime`.

```typescript
import { indexer, createEffect, S } from "envio";

const notify = createEffect(
  { name: "notify", input: S.string, output: S.boolean, rateLimit: { calls: 5, per: "second" } },
  async ({ input }) => {
    await fetch(process.env.WEBHOOK_URL!, { method: "POST", body: input });
    return true;
  },
);

indexer.onEvent({ contract: "Market", event: "BetPlaced" }, async ({ event, context }) => {
  if (indexer.chains[event.chainId].isRealtime && event.params.amount > 10n ** 20n) {
    await context.effect(notify, `Whale bet ${event.params.amount} on ${event.srcAddress}`);
  }
});
```

### Deploy to Envio Cloud
1. Sign in at https://envio.dev/app/login with GitHub, then install the *Envio Deployments* GitHub App on your repo.
2. Click Add Indexer, choose the repo, the indexer directory and a deployment branch (for example `envio`), then `git push` to that branch.
3. Every push creates a new deployment that re-indexes from `start_block`. The old deployment keeps serving until the new one has synced.
4. CLI alternative: `npx envio-cloud login`, then `envio-cloud indexer add --name my-indexer --repo my-repo --branch main --tier development`.

## Quickstart: HyperSync (historical scan and snapshot)

**Raw HTTP, as in the Monad docs guide.** Paginate with `next_block`:
```typescript
const HYPERSYNC_URL = "https://monad.hypersync.xyz"; // testnet: https://monad-testnet.hypersync.xyz
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

async function page(contract: string, fromBlock: number) {
  const r = await fetch(`${HYPERSYNC_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.ENVIO_API_TOKEN}` },
    body: JSON.stringify({
      from_block: fromBlock,
      logs: [{ address: [contract], topics: [[TRANSFER]] }],
      field_selection: { log: ["topic0", "topic1", "topic2", "data"], block: ["number", "timestamp"] },
    }),
  });
  if (!r.ok) throw new Error(`HyperSync ${r.status}`);
  return r.json(); // { data: [{ logs: [...] }], next_block, archive_height }
}

// ERC-20 balance snapshot: replay all transfers
const balances = new Map<string, bigint>();
let from = 0;
while (true) {
  const res = await page("0xToken", from);
  for (const b of res.data) for (const l of b.logs ?? []) {
    const f = "0x" + l.topic1.slice(-40), t = "0x" + l.topic2.slice(-40), v = BigInt(l.data);
    balances.set(f, (balances.get(f) ?? 0n) - v);
    balances.set(t, (balances.get(t) ?? 0n) + v);
  }
  if (!res.next_block || res.next_block <= from) break;
  from = res.next_block;
}
```

**Node client** (`pnpm add @envio-dev/hypersync-client`). Streaming handles pagination for you:
```typescript
import { HypersyncClient } from "@envio-dev/hypersync-client";

const client = new HypersyncClient({ url: "https://monad.hypersync.xyz", apiToken: process.env.ENVIO_API_TOKEN! });
const query = {
  fromBlock: 0,
  logs: [{ address: ["0xYourContract"], topics: [["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"]] }],
  fieldSelection: { log: ["Data", "Address", "Topic0", "Topic1", "Topic2", "Topic3"] },
};
const stream = await client.stream(query, {});           // { reverse: true } scans from the chain head backwards
while (true) {
  const res = await stream.recv();
  if (res === null) break;
  // res.data.logs ... decode with viem decodeEventLog({ abi, topics, data })
  if (res.nextBlock) query.fromBlock = res.nextBlock;
}
```
- You can build queries in the browser without code at https://builder.hypersync.xyz.
- `pnpx logtui <preset> <chain>` is a terminal event viewer. Monad preset availability is unverified.

## Features worth demoing
- **Speed.** Backfilling a token's full history takes seconds on HyperSync. HyperIndex was fastest in 4 of 5 scenarios in the open benchmark run of 16 Sep 2026.
- **Multichain in one indexer.** Add more `chains:` entries, for example Monad plus Ethereum for a bridge dashboard.
- **Factory and dynamic contracts** via `indexer.contractRegister`. Wildcard indexing (`wildcard: true`) with topic filters indexes, for example, every ERC-20 transfer *to your contract*.
- **Block handlers** (`indexer.onBlock`) for time-series snapshots such as TVL every N blocks.
- **Effect API** for offchain enrichment (IPFS metadata, prices, LLM scoring) with caching.
- **Traces on HyperSync for Monad.** Use them for internal transactions, MEV or fund-flow tools.
- Experimental **ClickHouse sink** for analytics-heavy data.
- **AI tooling:**
  - Envio Docs MCP server: `claude mcp add --transport http envio-docs https://docs.envio.dev/mcp`
  - Built-in Claude skills and an agent-oriented `envio init`, useful when an AI coding agent builds the indexer.

## Pricing and limits
- **Envio Cloud "Development" (free).** For testing only.
  - Hard limits: 30-day maximum lifespan; deleted above 20 GB.
  - Soft limits, whichever comes first: 100k events processed, 5 GB storage, or 7 days with no requests. Breaching one starts deletion: 7-day grace period, then 3 days read-only, then deleted.
  - Paid tiers are Production Small, Medium and Large, plus Dedicated. See https://envio.dev/pricing.
- **HyperSync.**
  - Free: fair-use rate limit.
  - Starter: $70/mo for 100 requests/min (burst to 250).
  - Pro: $480/mo for 1,000 requests/min.
  - Rate limits cap speed, not monthly volume. On HTTP 429 the clients wait and retry.
- **HyperRPC.** $4 per million calls, $1 monthly minimum. Each call inside a batch counts separately.

## Perk / bounty

| | Details |
|---|---|
| **$1,000 "Best Use of Envio"** | A sponsor bounty open to every team |
| **$5,000 prize line** | Free Envio Cloud hosting for winning teams |

- **How to claim.** No public claim form was found. Bounty eligibility presumably comes from the Metropolis submission form or project profile, where you mark Envio as used. The hackathon site says the full details are "listed in full on the platform". Ask in the Monad Dev Discord (https://discord.gg/monaddev) or Envio Discord (https://discord.gg/envio) if unsure. Envio founder Denham Preen is listed as a Metropolis mentor. (unverified)
- **How to score on "Best Use".** Make Envio load-bearing, not decorative:
  1. Serve the product's main read path from the HyperIndex GraphQL API (feeds, leaderboards, portfolio, history).
  2. Use at least one non-trivial feature: dynamic contracts, Effect API enrichment, multichain, block handlers, or HyperSync or traces.
  3. Deploy on Envio Cloud and put the GraphQL endpoint in the README.
  4. Show a sync-speed number in the demo, such as "backfilled N events in X s".

**Ideas that pair naturally with the tracks:**
- **Onchain Finance and Trading.** A realtime trade and liquidation feed. PnL leaderboards built from HyperIndex aggregates. A copy-trading signal engine where HyperIndex feeds an AI agent through GraphQL. Whale alerts through the Effect API.
- **Consumer and Payments.** Payment receipts and history for a merchant dashboard. Subscription status indexed from events.
- **Social and Attention.** Social-graph and attention-market indexer. Trending scores computed in handlers and snapshotted with `onBlock`.
- **Trust, Identity and AI.** An agent-memory and reputation indexer. A just-in-time indexing agent that uses HyperSync to answer onchain questions on demand, as in Envio's own blog pattern. A fund-flow and internal-tx explorer built on Monad traces.
- **Monad network analytics.** Like the *Last Monad* winner: a live parallel-execution dashboard using HyperSync blocks, txs and traces.

## Gotchas
1. **V2 vs V3 API.** The Monad docs guide ("tg-bot-using-envio") uses the V2 style: `import { WrappedMonad } from "generated"` and `WrappedMonad.Transfer.handler(...)`, with a `networks:` config key. Current `envio` (V3) uses `import { indexer } from "envio"`, `indexer.onEvent({contract, event}, ...)` and `chains:`. Pin one version and follow the matching docs. There is a migration guide at https://docs.envio.dev/docs/HyperIndex/migrate-to-v3.md.
2. **Handlers run twice** (preload). Never put non-idempotent side effects directly in a handler. Use the Effect API or `context.isPreload`.
3. **`ENVIO_API_TOKEN` is mandatory.** Without it nothing syncs and contract-import refuses to run.
4. **Node 22+** and ESM (`"type": "module"`). Docker is needed for `envio dev`.
5. **Rerun `pnpm codegen`** after editing `config.yaml` or `schema.graphql`.
6. **Relationship fields are set as `<field>_id`** in handlers (for example `market_id`). `@derivedFrom` fields are virtual.
7. **Free Cloud deployments expire.** The 30-day lifespan and 100k-event soft limit can kill a demo during judging (Oct 14–27). Redeploy near submission day, keep `start_block` tight, or ask Envio about the winner hosting perk early.
8. **Every push re-indexes from `start_block`.** A `start_block: 0` on a busy contract makes redeploys slow. Pin the deployment block, or use `start_block: latest` (v3.11+) for pure realtime.
9. **Monad blocks are fast (~300–400 ms) and speculative at `latest`.** HyperIndex handles reorgs, but anything user-facing that settles value should key off finalized data.
10. **Proxies.** Use the proxy address, not the implementation.

## Sources
- https://docs.envio.dev/llms.txt
- https://docs.envio.dev/docs/HyperIndex/quickstart.md
- https://docs.envio.dev/docs/HyperIndex/configuration-file.md
- https://docs.envio.dev/docs/HyperIndex/event-handlers.md
- https://docs.envio.dev/docs/HyperIndex/schema.md
- https://docs.envio.dev/docs/HyperIndex/dynamic-contracts.md
- https://docs.envio.dev/docs/HyperIndex/tutorial-erc20-token-transfers.md
- https://docs.envio.dev/docs/HyperIndex/supported-networks.md
- https://docs.envio.dev/docs/HyperSync/hypersync-supported-networks.md
- https://docs.envio.dev/docs/HyperRPC/overview-hyperrpc.md
- https://docs.envio.dev/docs/HyperRPC/hyperrpc-supported-networks.md
- https://docs.envio.dev/docs/HyperSync/hypersync-quickstart.md
- https://docs.envio.dev/docs/HyperSync/hypersync-query.md
- https://docs.envio.dev/docs/HyperSync/api-tokens.md
- https://docs.envio.dev/docs/HyperIndex/hosted-service-billing.md
- https://docs.envio.dev/docs/HyperIndex/hosted-service-deployment.md
- https://docs.envio.dev/docs/HyperIndex/envio-cloud-cli.md
- https://envio.dev/pricing/hypersync
- https://docs.envio.dev/blog/envio-developer-update-april-2026.md (Monad traces)
- https://docs.envio.dev/blog/envio-docs-mcp-server.md
- https://docs.envio.dev/blog/announcing-the-monad-envio-hackathon-winners.md
- https://docs.envio.dev/blog/metamask-smart-accounts-hackathon-winners.md
- https://docs.monad.xyz/guides/indexers/tg-bot-using-envio.md
- https://docs.monad.xyz/guides/indexers/token-snapshot-hypersync.md
- https://docs.monad.xyz/developer-essentials/network-information.md (WMON address)
- https://monad.xyz/developers/metropolis (prize lines)

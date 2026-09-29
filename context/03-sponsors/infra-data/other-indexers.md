# Other Indexers & Data APIs on Monad (non-sponsor)

> Researched 2026-09-28 from docs.monad.xyz/tooling-and-infra/indexers/*, docs.goldsky.com (supported networks), thegraph.com supported networks, the Ponder docs repo and portal.thirdweb.com llms.txt. These are **not Metropolis sponsors**, except that Envio is covered in `envio.md`. If you want the Envio bounty, keep Envio as the primary indexer and use these only where they add something Envio lacks.

## Quick decision table

| Tool | Type | Monad | Language / query | Best for | Hosting |
|---|---|---|---|---|---|
| **Envio HyperIndex** (sponsor) | Indexing framework | ✅ mainnet + testnet, native HyperSync | TS handlers → GraphQL | Default choice; bounty plus free hosting for winners | Envio Cloud / self |
| **Goldsky** | Subgraphs + Turbo Pipelines + Edge RPC + Compose | ✅ M+T in all four products | AssemblyScript subgraphs; SQL/TS pipelines into your DB | Porting an existing subgraph; streaming into your own Postgres | Goldsky |
| **The Graph** | Decentralized subgraphs | ✅ network slug `monad` | AssemblyScript → GraphQL | Decentralization story; reuse of existing subgraphs | Subgraph Studio / network |
| **Ponder** | Open-source TS indexer | ✅ any EVM via RPC (you supply the RPC) | TS + Drizzle → SQL/GraphQL | Self-hosted, type-safe, simple | Self (Railway etc.) |
| **Allium** | Enterprise data platform | ✅ (Monad docs list testnet data; mainnet status unverified) | SQL / API / Kafka streams | Analytics and research dashboards | Allium (contact sales) |
| **thirdweb Insight** | Hosted data API | Listed on Monad docs "Common Data" | REST / TS SDK (`getContractEvents`, `getOwnedTokens`, …) | Quick wallet, token and NFT reads with no indexer | thirdweb |
| **QuickNode Streams** (sponsor perk) | Push pipeline | ✅ | JS filters → webhook/Postgres/S3 | No-code event pipelines | QuickNode |
| Others | GhostGraph (Solidity indexers), Ormi, Sentio, SQD (+ Portal MCP), SubQuery, StreamingFast Substreams; data APIs: GoldRush, Dune Sim, Moralis, Mobula, Codex, Birdeye, Zerion, Sequence, SonarX, Rarible | per Monad docs | — | — | — |

## Goldsky
- **Monad coverage** (docs.goldsky.com/chains/supported-networks): Monad `143 / 10143` shows **M+T** for Turbo, Edge RPC, Compose and Subgraphs.
- **Products:**
  - **Subgraphs** (graph-node compatible, with webhooks).
  - **Turbo Pipelines**: stream decoded Monad data straight into *your* Postgres, ClickHouse or queue, with filters.
  - **Compose**: onchain plus offchain data.
  - **Edge RPC**: powers the public `https://rpc2.monad.xyz` (300 req per 10 s, batch 10, historical `eth_call` supported).
- **Quickstart** (subgraph):
```bash
npm i -g @goldskycom/cli && goldsky login
graph init --from-contract 0xYourContract --network monad my-subgraph   # network slug "monad" (unverified for Goldsky; "monad-testnet" for testnet)
cd my-subgraph && graph codegen && graph build
goldsky subgraph deploy my-subgraph/1.0.0 --path .
```
- **When to use.** If the team already has AssemblyScript subgraphs, or wants raw decoded logs replicated into its own database for SQL analytics.
- **Docs:** https://docs.goldsky.com/llms.txt

## The Graph
- Monad appears on The Graph's supported-networks page with slug **`monad`**.
- Flow: create a subgraph in Subgraph Studio (https://thegraph.com/studio), then `graph init`, `graph codegen`, `graph build`, `graph deploy`. Query through the Studio endpoint during the hackathon. Publishing to the decentralized network needs GRT curation, which is overkill for a hackathon.
- Envio supports **TheGraph-style query conversion** and AI-assisted subgraph migration if you later want to move to Envio.
- **Docs:** https://thegraph.com/docs/en/subgraphs/quick-start/

## Ponder
- An open-source TS framework (Drizzle schema; SQL and GraphQL APIs). It works on Monad through any RPC. Because it relies on `eth_getLogs`, **set `ethGetLogsBlockRange` to your provider's cap**: 100 on QuickNode/MF public, 500 on Dwellir Developer, 1,000 on Alchemy.
```typescript
// ponder.config.ts
import { createConfig } from "ponder";
import { MarketAbi } from "./abis/Market";

export default createConfig({
  chains: {
    monad: {
      id: 143,
      rpc: process.env.PONDER_RPC_URL_143,          // QuickNode/Alchemy/Envio HyperRPC
      ws: process.env.PONDER_WS_URL_143,
      ethGetLogsBlockRange: 1000,                    // match provider limit
    },
  },
  contracts: {
    Market: { abi: MarketAbi, chain: "monad", address: "0xYourContract", startBlock: 12345678 },
  },
});
```
```typescript
// src/index.ts
import { ponder } from "ponder:registry";
import { bets } from "ponder:schema";
ponder.on("Market:BetPlaced", async ({ event, context }) => {
  await context.db.insert(bets).values({ id: event.id, user: event.args.user, amount: event.args.amount });
});
```
- Tip: Envio **HyperRPC** (`https://monad.rpc.hypersync.xyz/<token>`) can serve as Ponder's `rpc` for faster `eth_getLogs` backfills. Check that the read-only method subset covers what Ponder calls. (unverified)
- **Docs:** https://ponder.sh/docs/config/chains

## Allium
- An enterprise data platform (Explorer SQL/API, a Developer real-time transfers API, and Datastreams over Kafka, PubSub or SNS). It delivers into Snowflake, BigQuery, Databricks or S3.
- Monad docs list **Monad Testnet** chain data (blocks, txs, logs, traces, contracts) and enriched NFT/DEX data. Mainnet coverage is likely but unverified.
- Access through https://www.allium.so/contact. It is not self-serve, so it's poor for a six-week hackathon unless you already have access.

## thirdweb Insight
- A hosted data API with out-of-the-box endpoints for events, transactions, tokens and NFTs, plus custom "blueprints". Monad docs list it under Common Data.
- TS SDK v5 functions: `getContractEvents`, `getOwnedTokens`, `getOwnedNFTs`, `getNFT`, `getContractNFTs`, `getTransactions`. REST reference: https://insight.thirdweb.com/reference.
- thirdweb also offers **RPC Edge** for Monad, plus Engine (server wallets) and an x402 facilitator.
- **When to use.** Quick portfolio or NFT reads in a consumer UI without building an indexer. Free account at https://thirdweb.com/team.

## Other notable options from the Monad docs
- **GhostGraph:** write indexers in Solidity. Monad guide: https://docs.monad.xyz/guides/indexers/ghost
- **SQD:** Portal API plus the Subsquid SDK. It has a **Portal MCP server** so AI agents can query onchain data directly: https://docs.sqd.dev/en/ai/mcp-server
- **Sentio:** processors plus subgraph hosting with dashboards and alerting.
- **StreamingFast Substreams:** Rust, gRPC, 20+ sinks. Monad tutorial: https://docs.substreams.dev/tutorials/intro-to-tutorials/monad
- **SubQuery:** a Monad testnet starter.
- **Ormi:** subgraphs plus a Data API.
- **Data APIs:**
  - GoldRush (Covalent): balances and history across 100+ chains.
  - Dune Sim: balances and transactions.
  - Moralis: data, Streams and RPC.
  - Codex, Mobula, Birdeye: prices, OHLCV and token data.
  - Zerion API: a Metropolis sponsor perk, handled elsewhere.
  - Sequence Indexer, SonarX, Rarible.

## Gotchas
- **RPC-based indexers** (Ponder, subgraphs on your own graph-node) hit Monad's small `eth_getLogs` ranges and 300–400 ms blocks. Backfills are slow unless the backend has a HyperSync or Firehose-style data lake (Envio, Goldsky, SQD, Substreams).
- **Reorgs and speculative heads.** Monad `latest` = Proposed. Make sure your indexer handles reorgs, or only serves finalized data for anything financial.
- **Mixing indexers dilutes the Envio bounty story.** If you use a second tool, make Envio the source of truth for the core product.

## Sources
- https://docs.monad.xyz/tooling-and-infra/indexers/indexing-frameworks.md
- https://docs.monad.xyz/tooling-and-infra/indexers/common-data.md
- https://docs.goldsky.com/llms.txt
- https://docs.goldsky.com/chains/supported-networks
- https://thegraph.com/docs/en/supported-networks/
- https://raw.githubusercontent.com/ponder-sh/ponder/main/docs/pages/docs/config/chains.mdx
- https://raw.githubusercontent.com/ponder-sh/ponder/main/docs/pages/docs/indexing/overview.mdx
- https://portal.thirdweb.com/llms.txt
- https://docs.monad.xyz/developer-essentials/network-information.md
- https://docs.monad.xyz/reference/rpc-limits.md

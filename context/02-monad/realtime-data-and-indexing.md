# Real-Time Data & Indexing on Monad

At 300 ms blocks with up to ~3,750 transactions each, Monad produces roughly 100× more data per second than Ethereum. The docs are explicit: **polling JSON-RPC (`eth_getLogs` loops) doesn't scale here.** Push feeds and indexers are essential in more cases than on other EVM chains.

## Three real-time sources

| Source | How | Published by | Granularity | Tx-level detail | When |
|---|---|---|---|---|---|
| Geth-style `eth_subscribe` (`newHeads`, `logs`) | WebSocket | RPC server | per block | logs only | when the block is `Proposed` (speculative) |
| Monad extensions (`monadNewHeads`, `monadLogs`) | WebSocket | RPC server | per block, plus commit-state updates | logs only | `Proposed`, then updates to Voted, Finalized, Verified |
| **Execution Events SDK** (C/C++/Rust) | shared-memory ring on **your own node** | execution daemon | per tx | logs, call frames, state reads/writes | as soon as the proposal is received (lowest latency) |

Not supported: the `syncing` and `newPendingTransactions` subscriptions.

### WebSocket: plain logs (viem)
```ts
import { createPublicClient, webSocket, parseAbiItem } from "viem";
import { monad } from "viem/chains";
const ws = createPublicClient({ chain: monad, transport: webSocket("wss://rpc.monad.xyz") });

const unwatch = ws.watchEvent({
  address: "0xYourContract",
  event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)"),
  onLogs: (logs) => { /* speculative (Proposed) data; may be replaced */ },
});
ws.watchBlocks({ onBlock: (b) => {/* newHeads */} });
```

### WebSocket: commit-state-aware (raw JSON-RPC)
```json
{"jsonrpc":"2.0","id":1,"method":"eth_subscribe","params":["monadNewHeads"]}
{"jsonrpc":"2.0","id":2,"method":"eth_subscribe","params":["monadLogs",{"address":"0xYourContract"}]}
```
Each update carries `blockId` (unique per proposal) and `commitState` (`Proposed` | `Voted` | `Finalized` | `Verified`). Expect several updates per block. A block may go straight from `Proposed` to `Finalized`. If a proposal is abandoned, **no event is sent**: another block finalizing at the same height supersedes it. Key your state by `blockId` until finalization.

```ts
// minimal monadLogs consumer (node, 'ws' package)
import WebSocket from "ws";
const sock = new WebSocket("wss://rpc.monad.xyz");
const pending = new Map<string, any[]>(); // blockId -> logs
sock.on("open", () => sock.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_subscribe",
  params: ["monadLogs", { address: "0xYourContract" }] })));
sock.on("message", (m) => {
  const r = JSON.parse(m.toString()).params?.result; if (!r) return;
  // Field names below follow the docs' description; confirm payload shape against a live feed (unverified)
  const { blockId, commitState } = r;
  if (commitState === "Proposed") { /* optimistic UI */ }
  if (commitState === "Finalized") { /* settle */ }
});
```

### Execution Events SDK
- Runs **on the same host as a Monad full node** because it reads a shared-memory event ring. Not practical for a hackathon unless you run a node. Docs: https://docs.monad.xyz/execution-events. Example app: `monad-developers/monode` (live at node.monad.xyz). Snapshot data exists for offline development (execution-events/getting-started/snapshot).

## Why speculative data is worth handling
- **Pipelining:** start risk checks, model computation, and transaction signing when a signal appears at `Proposed`. Fire the transaction if the block finalizes; discard the work if it doesn't.
- **Instant UX:** show "pending ✓" at `Proposed`. It reverts very rarely.
- **Safe alternative:** read with `blockTag: "safe"` or `"finalized"` and never deal with reverts.

## Polling limits (if you must poll)
- `eth_getLogs` range: **100 blocks** on `rpc.monad.xyz` and MF, 1,000 on Alchemy (`rpc1`) and Ankr (`rpc3`).
- Public rate limits are 15–25 rps. Batch limits: 100 (QuickNode/Alchemy), 10 (Goldsky/Ankr), 1 (MF).
- Old-state `eth_call` fails on regular nodes. Use `rpc-mainnet.monadinfra.com` or `rpc2.monad.xyz` for historical state.

## Indexers

### Indexing frameworks (bring your own schema)
| Provider | Monad id / notes |
|---|---|
| **Envio HyperIndex / HyperSync** | network id `143` / `10143` in `config.yaml`. **Hackathon sponsor ($1K "Best Use of Envio").** Guides: tg-bot-using-envio, token-snapshot-hypersync. Also HyperRPC (free read-only). |
| The Graph (subgraphs) | network `monad-mainnet` / `monad-testnet` |
| Goldsky (subgraphs + Mirror) | subgraph net `monad-mainnet`/`monad-testnet`; Mirror dataset `monad_mainnet.*`/`monad_testnet.*` (e.g. `monad_testnet.erc20_transfers`) |
| Ghost (GhostGraph) | guide: /guides/indexers/ghost |
| Ormi, Sentio, SQD, StreamingFast (Substreams), SubQuery | listed in the docs |

Envio minimal `config.yaml`:
```yaml
name: my-indexer
networks:
  - id: 143          # 10143 for testnet
    start_block: 0   # set to your deploy block!
    contracts:
      - name: MyContract
        address: ["0xYourContract"]
        handler: src/EventHandlers.ts
        events:
          - event: Transfer(address indexed from, address indexed to, uint256 value)
```

### Common-data APIs (balances, transfers, prices, trades)
Allium (`monad_mainnet`), Birdeye, Codex, Dune Sim, GoldRush (Covalent), Goldsky, Mobula, Moralis (portfolio guide), QuickNode Streams (`monad-mainnet`; guide: index every WMON transfer), Rarible (NFTs), Sequence, SonarX, thirdweb Insight (chain id in URL), Zerion.

## Picking an approach for a 2-week hackathon
- **Live UI for your own contract:** WebSocket `watchEvent` or `monadLogs`, plus a `finalized` read for balances.
- **History, leaderboards, analytics:** Envio HyperIndex. It's quick to set up, handles the log-range limits, and qualifies for the Envio bounty.
- **Wallet balances and token lists:** a common-data API (Moralis, Zerion, Dune Sim, Alchemy).
- **Sub-100 ms trading bots:** `monadLogs` from a paid RPC's WebSocket, or run a node with the Execution Events SDK.

## Sources
- https://docs.monad.xyz/monad-arch/realtime-data/data-sources.md
- https://docs.monad.xyz/monad-arch/realtime-data/spec-realtime.md
- https://docs.monad.xyz/reference/json-rpc/overview.md (WebSocket subscriptions)
- https://docs.monad.xyz/execution-events/index.md
- https://docs.monad.xyz/developer-essentials/best-practices.md
- https://docs.monad.xyz/tooling-and-infra/indexers/indexing-frameworks.md
- https://docs.monad.xyz/tooling-and-infra/indexers/common-data.md
- https://github.com/monad-developers/monode

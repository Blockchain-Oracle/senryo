# QuickNode on Monad — RPC, Streams, Webhooks, MCP

> Researched 2026-09-28 from quicknode.com/docs (llms.txt, per-chain llms, .md pages), quicknode.com/pricing, and the Monad docs Streams guide.

## Overview
QuickNode is a managed RPC and data platform. On Monad it offers:
- **Core RPC** over HTTP and WSS, **archive**, and the **Debug API**. Mainnet and testnet are both archive nodes; QuickNode notes "over 40,000 recent blocks available" under pruning.
- **Streams**: push-based, exactly-once, ordered delivery of blocks, receipts, traces and logs, with JS (or Go) filters. Destinations: webhook, S3, Postgres, Snowflake, BigQuery.
- **Webhooks**: simpler event notifications from templates or custom JS.
- The **Key-Value Store** (watchlists and dedup, usable from Streams filters), **SQL Explorer**, **IPFS**, **Admin API**, CLI and SDK.
- **AI:** Quicknode MCP server and a "build-web3" agent plugin/skill; also **x402 / MPP** pay-per-request access with no account needed.

QuickNode also runs the canonical public Monad endpoint `https://rpc.monad.xyz` (25 rps, batch 100, `eth_getLogs` max 100 blocks).

Sahil Sen (QuickNode Staff DevRel) is a Metropolis mentor.

**QuickNode Functions** (serverless) does not appear anywhere in the current docs index. Treat it as discontinued or renamed. (unverified)

## Monad support (verified)

| Network | Chain ID | HTTP | WSS | Archive |
|---|---|---|---|---|
| Mainnet | 143 | ✓ | ✓ | Yes |
| Testnet | 10143 | ✓ | ✓ | Yes |

- Endpoint format: `https://<your-endpoint-name>.monad-mainnet.quiknode.pro/<auth-token>/`, and the same with `wss://`. The docs' demo is `https://docs-demo.monad-mainnet.quiknode.pro/`. For testnet the subdomain is presumably `monad-testnet` (unverified); copy the exact URL from the dashboard.
- APIs: Ethereum JSON-RPC, and Debug (`debug_traceTransaction`, `debug_traceBlockByNumber/Hash`, `debug_traceCall`, `debug_getRaw*`).
- Products supported on Monad: **Streams** and **Webhooks**.
- Marketplace add-ons: nothing Monad-specific was found in the docs (unverified). Browse https://www.quicknode.com/docs/add-ons/llms.txt.

## Quickstart code

### RPC with viem
```typescript
import { createPublicClient, http, webSocket } from "viem";
import { monad } from "viem/chains";

export const client = createPublicClient({ chain: monad, transport: http(process.env.QN_MONAD_HTTP!) });
export const wsClient = createPublicClient({ chain: monad, transport: webSocket(process.env.QN_MONAD_WSS!) });

// Monad debug calls REQUIRE the tracer options object (empty {} means callTracer)
const trace = await client.request({
  method: "debug_traceTransaction" as any,
  params: ["0xTxHash", { tracer: "callTracer" }] as any,
});
```

### Streams: index every transfer of a token (Monad docs pattern)
In the Dashboard:
1. Streams > Create Stream > Network: **Monad**.
2. Pick the start and end block, the latest-block delay (for example 3 blocks for reorg safety), and whether to restream on reorg.
3. Dataset: **Block with Receipts**.
4. Customize payload > template "Decoded ERC20 transfers", then replace the filter with:
```javascript
function main(stream) {
  const erc20Abi = `[{"anonymous":false,"inputs":[
    {"indexed":true,"type":"address","name":"from"},
    {"indexed":true,"type":"address","name":"to"},
    {"indexed":false,"type":"uint256","name":"value"}],
    "name":"Transfer","type":"event"}]`;
  const data = stream.data ? stream.data : stream;
  let result = decodeEVMReceipts(data[0].receipts, [erc20Abi]);   // built-in helper
  const TOKEN = "0xyourtoken".toLowerCase();
  result = result.filter(r => {
    if (!r.decodedLogs) return false;
    r.decodedLogs = r.decodedLogs.filter(l => l.address.toLowerCase() === TOKEN);
    return r.decodedLogs.length > 0;
  });
  return { result };
}
```
5. Destination: **Webhook** (test with Svix Play), Postgres, S3, Snowflake or BigQuery. Use "Check Connection", then "Create Stream".

### Webhooks (lighter weight)
Create a webhook from a template (wallet activity, contract events) in the dashboard, or through the REST API at `/webhooks/rest/v1/webhooks`. See https://www.quicknode.com/docs/webhooks/llms.txt.

### MCP for coding agents
QuickNode ships an official MCP server and a "build-web3" plugin with install commands for Claude Code, Cursor and others. It can read live chain data and manage endpoints. See https://www.quicknode.com/docs/build-with-ai/quicknode-mcp.md.

## Pricing and limits (quicknode.com/pricing, 2026-09-28)

| Plan | Price | API credits | RPS | Endpoints | Trace/Debug |
|---|---|---|---|---|---|
| Free trial | $0 | 10M | 15 | 1 | — |
| **Build** (the hackathon perk) | $49/mo ($34 billed annually) | 80M | 50 | 10 | ✓ |
| Accelerate | $249/mo | 450M | 125 | 20 | ✓ |
| Scale | $499/mo | 950M | 250 | 50 | ✓ |
| Business | from $999/mo | 2B | 500 | 50 | ✓ |

- Methods cost different numbers of credits. See https://www.quicknode.com/api-credits/monad.
- Streams are billed by credits per matched block (see Streams billing).

## Perk / bounty
- **Participant resource:** 3 months of the QuickNode **Build Plan** free for every team.
- **How to claim.** Not published publicly. Expect a promo code or link on the Metropolis platform or in the Monad Dev Discord (https://discord.gg/monaddev), or ask Sahil Sen. (unverified)
  - Claim it early: the Build plan unlocks trace/debug, which the free trial lacks.
- There is no QuickNode cash bounty in Metropolis.
- **Good uses:**
  - Primary RPC plus WSS for the dapp.
  - Streams into Postgres as a no-code indexer for an analytics or alerts backend.
  - Streams with the Key-Value Store for wallet-watchlist notifications, such as a payments app notifying merchants.
  - The debug API for a transaction-explainer or AI "what happened in this tx" feature.

## Gotchas
1. **`debug_trace*` on Monad requires the options object.** Omitting it returns `-32602 Invalid params`. `{}` defaults to `callTracer`, and there are no struct-log (opcode-level) traces.
2. **Tight `eth_getLogs` ranges.** The public `rpc.monad.xyz` (QuickNode) allows 100 blocks per call; Monad blocks are ~300–400 ms and large. Paginate, or use Streams, Envio HyperSync or HyperRPC for history.
3. **Free trial has no trace/debug** and 15 rps. Activate the Build perk before demo day.
4. **Streams "Latest block delay" and "Restream on reorg"** control finality semantics. Use a delay of 2–3 blocks, or restream, for anything that moves money.
5. **`eth_getTransactionByHash` never returns pending txs on Monad**, and `newPendingTransactions` subscriptions are unsupported chain-wide.

## Sources
- https://www.quicknode.com/docs/llms.txt
- https://www.quicknode.com/docs/monad/llms.txt
- https://www.quicknode.com/docs/monad/api-overview.md
- https://www.quicknode.com/docs/monad/endpoints.md
- https://www.quicknode.com/docs/monad/eth_blockNumber.md
- https://www.quicknode.com/docs/webhooks/llms.txt
- https://www.quicknode.com/docs/build-with-ai/quicknode-mcp.md
- https://www.quicknode.com/pricing
- https://www.quicknode.com/chains/monad
- https://docs.monad.xyz/guides/indexers/quicknode-streams.md
- https://docs.monad.xyz/reference/rpc-limits.md
- https://docs.monad.xyz/developer-essentials/network-information.md

# RPC Providers on Monad — Chainstack, Crouton Digital, Spectrum, Dwellir (+ others)

> Researched 2026-09-28 from provider llms.txt files and docs, docs.monad.xyz/tooling-and-infra/rpc-providers, and docs.monad.xyz/reference/rpc-limits. For Alchemy see `alchemy.md`; for QuickNode see `quicknode.md`; for Envio HyperRPC see `envio.md`.

## TL;DR comparison

| Provider | Metropolis prize/perk | Monad endpoint format | Plan you get | Key limits | Notes |
|---|---|---|---|---|---|
| **Chainstack** | $10,000 total: **annual Pro plans** for the Track 01 winner and the overall winner | Per-node URL, e.g. `https://monad-testnet.core.chainstack.com/<key>` (mainnet presumably `monad-mainnet.core.chainstack.com/<key>`, unverified) | Pro: $199/mo, 80M request units, 400 RPS, dedicated nodes available | Free Developer plan: 3M RU/mo, 25 RPS | Debug and trace documented for Monad. SOC 2. |
| **Crouton Digital** | $10,000: **3 months of unlimited RPC** for winning teams | Not published (unverified). They run Monad mainnet and testnet validators and "Dedicated RPC". | Unlimited RPC (for winners) | n/a | Validator/staking shop. Get the endpoint from them after winning. |
| **Spectrum Nodes** | $3,000 prize: a Business month per track winner, Enterprise for the champion. **Participants: 2 months Business free.** | `https://<your-endpoint>.simplystaking.xyz/<API_KEY>/v1` (unified API) | Business: $150/mo, 1.15B credits, 200 RPS, unlimited endpoints | — | Unified JSON-RPC data API (`getPortfolio`, `traceTransaction`, `simulateCall`, `rpcProxy`) plus a Monad testnet faucet |
| **Dwellir** | **Participants: 3 months Developer plan free** | `https://api-monad-mainnet-full.n.dwellir.com/<key>` and `wss://…`; testnet `api-monad-testnet-full.n.dwellir.com/<key>` | Developer: $49/mo, 25M responses, 100 rps (burst 500) | `eth_getLogs` max **500 blocks** on Developer; free plan has no getLogs, trace or debug | 1 response = 1 credit on every method, including trace and debug |
| QuickNode | Participants: 3 months Build plan | `https://<name>.monad-mainnet.quiknode.pro/<token>/` | Build: 80M credits, 50 RPS | see quicknode.md | Streams, Webhooks |
| Alchemy | $1,000 credits bounty | `https://monad-mainnet.g.alchemy.com/v2/<key>` | Free: 30M CU/mo | see alchemy.md | Wallet APIs, Gas Manager |
| Envio HyperRPC | (Envio bounty) | `https://monad.rpc.hypersync.xyz/<token>` | $4 per million calls | read-only subset | Fast `eth_getLogs` and receipts |
| Tenderly Node RPC | (Pro license perk) | `https://monad.gateway.tenderly.co/<access-key>` | see tenderly.md | — | `tenderly_simulateTransaction`, trace |
| Goldsky Edge | — | public `https://rpc2.monad.xyz` | — | 300 req per 10 s, batch 10 | Historical `eth_call` supported |

**Canonical public endpoints (mainnet).** These are rate-limited and fine for dev only.

| URL | Operator | Rate limit | Batch | eth_getLogs range | Notes |
|---|---|---|---|---|---|
| `https://rpc.monad.xyz` | QuickNode | 25 rps | 100 | 100 blocks | |
| `https://rpc1.monad.xyz` | Alchemy | 15 rps | 100 | 1,000 blocks / 10k logs | no debug/trace |
| `https://rpc2.monad.xyz` | Goldsky Edge | 300 / 10 s | 10 | — | historical state |
| `https://rpc3.monad.xyz` | Ankr | 300 / 10 s | 10 | 1,000 blocks | no debug |
| `https://rpc-mainnet.monadinfra.com` | Monad Foundation | 20 rps | 1 | 100 blocks | historical state |

Testnet public RPC: `https://testnet-rpc.monad.xyz`.

Other Monad RPC providers listed by the Monad docs: Ankr, Blockdaemon, BlockPI, BoltRPC, dRPC NodeCloud, GetBlock, Node101, OnFinality, Tatum, thirdweb RPC Edge, Triton One (mainnet only), Validation Cloud.

## Chainstack
- **What it is.** A managed node platform (global geo-balanced nodes plus dedicated nodes) across 27+ protocols. It also offers Unlimited Node (flat-price RPS tiers), Warp transactions and MEV protection on some chains.
- **Monad support.**
  - Mainnet (143) and testnet (10143).
  - Documented method groups: blocks, transactions, execution, **debug and trace** (`debug_traceTransaction`, `debug_traceBlockByNumber/Hash`, `debug_traceCall`), logs, gas, and accounts.
  - Monad reference index: https://docs.chainstack.com/reference/monad/llms.txt
- **Getting started.**
  1. Sign up at https://console.chainstack.com/user/account/create.
  2. Deploy a node and pick Monad.
  3. Copy the HTTPS/WSS URL from "Access and credentials".
- **Plans** (chainstack.com/pricing):

| Plan | Price | Request units / month | RPS |
|---|---|---|---|
| Developer | free | 3M | 25 |
| Growth | $49 | 20M | 250 |
| **Pro** | $199 | 80M | 400 |
| Business | $499 | 200M | 600 |
| Enterprise | — | 400M | — |

  Dedicated nodes start from the Pro plan.
- **Prize angle.**
  - Only the **Track 01 winner** (Onchain Finance and Trading) and the **overall winner** get an annual Pro plan.
  - No action is needed beyond winning. Using Chainstack does not appear to be required (unverified).
  - A trading app is the natural fit: Pro's 400 RPS and dedicated-node option matter for bots.
- **Chainstack Monad docs** also include a "Monad tooling" page: https://docs.chainstack.com/docs/monad-tooling (not scraped).

## Crouton Digital
- **What it is.** A non-custodial validator and staking-infrastructure provider (ISO 27001 and SOC2 roadmap). It runs validators on 60+ PoS networks and offers public RPC, Dedicated RPC, monitoring, snapshots and white-label validators. Its site lists **Monad (MON) mainnet and testnet validator and infrastructure support**.
- **Prize.** $10,000 in value: **3 months of unlimited RPC for winning teams.**
- **How to use it.** There is no self-serve Monad RPC signup on their site. Winners presumably get provisioned through the organizers or their contact form (https://crouton.digital/services). (unverified)
- It is not relevant during the build. Use a self-serve provider now and swap to Crouton after winning if you want.

## Spectrum Nodes (Simply Staking)
- **What it is.**
  - Bare-metal RPC in Malta, the Netherlands, Canada and Singapore; 200+ networks; SOC 2 Type 1.
  - A **unified data API**: typed JSON-RPC methods across chains, with `params.chain = "monad"`.
  - An SDK (`@spectrumnodes/sdk`), a CLI (`@spectrumnodes/cli`, agent-friendly JSON output), Webhooks (decoded native, internal, ERC-20/721/1155 transfers; reorg-aware; at-least-once), and a Marketplace (contract methods callable as named RPC).
  - A **Monad testnet faucet** that drips 0.01 MON every 24 h.
- **Monad support.**
  - Slug `monad`, chain 143, archive.
  - Methods: `getBlockHeight`, `getBalance`, `getTokenBalance`, `getTokenMetadata`, `getTokenAllowance`, `getPortfolio` (USD values), `getNftCollection`, `getBlockTransactions`, `estimateGas`, `traceTransaction`, `getCode`, `simulateCall`, `rpcProxy` (raw JSON-RPC passthrough), `getChainHealth`.
- **Quickstart:**
```bash
curl -X POST https://your-endpoint.simplystaking.xyz/$SPECTRUM_KEY/v1 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"getPortfolio","params":{"chain":"monad","address":"0xUser"},"id":1}'
```
  For viem/ethers you need a standard JSON-RPC URL. Use the endpoint from the dashboard, or `rpcProxy`. The exact raw-RPC URL shape is unverified.
- **Plans.** Starting at $1.99/mo pay-as-you-go. **Business: $150/mo, 1.15B credits, unlimited endpoints, all APIs, 200 RPS, $1.5 per extra 10M credits.**
- **Perk and prize.**
  - Participants: **2 months of the Business plan free** (claim via the Metropolis platform or Discord; mechanism unverified).
  - Prize: a Business month per track winner, Enterprise for the champion ($3,000 total).
- **Good uses.** `getPortfolio` and webhooks for a consumer wallet or payments app without running an indexer.

## Dwellir
- **What it is.** RPC for 140–150+ networks with **flat 1:1 pricing**: every response is one credit, including trace, debug and archive, with no compute units. Nodes are in Stockholm for Monad; dedicated clusters start at $4,260/mo.
- **Monad endpoints:**
  - Mainnet: `https://api-monad-mainnet-full.n.dwellir.com/<API_KEY>` and `wss://api-monad-mainnet-full.n.dwellir.com/<API_KEY>`
  - Testnet: `https://api-monad-testnet-full.n.dwellir.com/<API_KEY>` and `wss://api-monad-testnet-full.n.dwellir.com/<API_KEY>`
  - Auth: the key in the URL path, **or** an `X-Api-Key: <key>` header.
- **Plans:**

| Plan | Price | Included | Throughput | Overage | eth_getLogs range | Trace/Debug |
|---|---|---|---|---|---|---|
| Free | $0 | 100k responses/day | 20 rps | — | not available | ✗ |
| **Developer** (the perk) | $49/mo | 25M responses | 100 rps (burst 500) | $5/M | 500 blocks | ✓ |
| Growth | $299/mo | 150M | 500 rps | $3/M | 10k blocks | ✓ |
| Scale | $999/mo | 500M | 5,000 rps | $2/M | 10k blocks | ✓ |

- **Perk.** **3 months of the Developer plan free for all participants.** Sign up at https://dashboard.dwellir.com/register; the promo mechanism is unverified.
- **Good uses.** Trace-heavy or debug-heavy tools, because flat pricing makes `debug_traceTransaction` cost the same as `eth_blockNumber`. Also a second provider for failover.

## Recommended RPC setup for the hackathon
1. **Primary:** QuickNode Build (free perk) or Alchemy (free tier plus bounty). Pick Alchemy if you use Wallet APIs or Gas Manager.
2. **Fallback:** Dwellir Developer (free perk) or Spectrum Business (free perk) via viem `fallback()`:
```typescript
import { createPublicClient, fallback, http } from "viem";
import { monad } from "viem/chains";
export const client = createPublicClient({
  chain: monad,
  transport: fallback([
    http(process.env.RPC_PRIMARY!),   // QuickNode / Alchemy
    http(process.env.RPC_FALLBACK!),  // Dwellir / Spectrum / Chainstack
    http("https://rpc.monad.xyz"),    // public, last resort
  ], { rank: false }),
});
```
3. **History and logs:** don't loop `eth_getLogs` over RPC. Use Envio HyperSync or HyperIndex, or QuickNode Streams.
4. **Simulation and debugging:** Tenderly Node RPC.

## Gotchas (all providers)
- **`eth_getLogs` block-range caps are low on Monad**, because blocks come every ~300–400 ms and can hold up to ~3,750 txs. Examples: 100 blocks (QuickNode public), 500 (Dwellir Developer), 1,000 (Alchemy and Ankr public). Paginate, and expect `-32602 Invalid block range`.
- **`debug_trace*` requires an explicit tracer options object**; the default is `callTracer`, with no struct logs.
- **`eth_call` on old blocks may fail.** Full nodes don't keep arbitrary historic state. Use archive-capable providers (QuickNode, Goldsky Edge, the MF public endpoint).
- **`eth_maxPriorityFeePerGas` returns a hardcoded 2 gwei.** `eth_sendRawTransaction` validates nonce and balance asynchronously, so it may accept a tx that later fails.
- **`latest` = Proposed (speculative), `safe` = Voted, `finalized` = Finalized.** Settle value only on `finalized`.
- **No `newPendingTransactions` subscription**, and `eth_getTransactionByHash` returns only included txs.
- Batch limits vary: 1 on MF public, 10 on Goldsky and Ankr public, 100 on QuickNode and Alchemy public.

## Sources
- https://docs.monad.xyz/tooling-and-infra/rpc-providers.md
- https://docs.monad.xyz/developer-essentials/network-information.md
- https://docs.monad.xyz/reference/rpc-limits.md
- https://docs.chainstack.com/llms.txt
- https://docs.chainstack.com/reference/monad-getting-started.md
- https://docs.chainstack.com/reference/monad/llms.txt
- https://chainstack.com/pricing/
- https://crouton.digital/llms.txt
- https://crouton.digital/networks
- https://crouton.digital/services
- https://spectrumnodes.com/llms.txt
- https://spectrumnodes.com/docs/llms.txt
- https://spectrumnodes.com/docs/chains/monad.md
- https://spectrumnodes.com/docs/authentication.md
- https://spectrumnodes.com/pricing
- https://spectrumnodes.com/networks/monad
- https://www.dwellir.com/llms.txt
- https://www.dwellir.com/networks/monad.md
- https://monad.xyz/developers/metropolis (prize and perk lines)

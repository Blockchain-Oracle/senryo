# Zerion API — Interpreted wallet data (portfolio, positions, tx history, PnL, webhooks, swaps)

> Prize: **$6,000**, listed on the Metropolis page as "Three months of the Zerion API Builder plan for all winners" (a sponsored prize in credits). **Participant resource: 1 month of the Zerion API Builder tier free for all participants**, covering "wallet data across 50+ chains". Claim it through the hackathon platform or dashboard.zerion.io (how to redeem is unverified).

## Overview
A REST API (JSON:API envelope) for **decoded, priced** wallet data across EVM chains and Solana:
- Portfolio totals
- Token and DeFi positions (4.5k+ protocols)
- Human-readable transaction history
- FIFO **PnL**
- Balance charts
- NFTs
- Token prices and charts
- Gas prices
- **Swap/bridge quotes**
- **Webhooks** for wallet transactions
- Kafka streaming
- Spam filtering
- RWA classification

Privy's dashboard and the Base App both use it. Also available: an MCP server, the Zerion CLI with agent skills, and **pay-per-request via x402** (USDC on Base/Solana) or MPP (Tempo) with no API key.

## Monad support
- Supported chains list: **Monad**, chain id `monad`, with ✅ Tokens, ✅ Txns, ✅ DeFi and ✅ NFTs. **Monad Testnet** has chain id `monad-test-v2`.
- Zerion blog: "Zerion API Powers the Monad Ecosystem" (Infinex, Backpack, HeyElsa and P2P use it on Monad) and "Guide to Building on Monad With Zerion API".
- Zerion's x402 payment runs on Base or Solana, **not Monad**. Use a normal API key for Monad data.

## Auth
HTTP Basic, with the API key as the username and an empty password: `Authorization: Basic base64("<KEY>:")`. **Server-side only.** Never ship the key to the browser.

## Quickstart (Next.js route handler)
```ts
// app/api/portfolio/[address]/route.ts
const Z = "https://api.zerion.io/v1";
const auth = "Basic " + Buffer.from(`${process.env.ZERION_API_KEY}:`).toString("base64");
const z = (path: string) => fetch(`${Z}${path}`, { headers: { authorization: auth, accept: "application/json" }, next: { revalidate: 15 } });

export async function GET(_: Request, { params }: { params: { address: string } }) {
  const a = params.address;
  const [portfolio, positions, txs] = await Promise.all([
    z(`/wallets/${a}/portfolio?currency=usd&filter[positions]=only_simple`).then(r => r.json()),
    z(`/wallets/${a}/positions/?filter[chain_ids]=monad&filter[positions]=no_filter&filter[trash]=only_non_trash&currency=usd&sort=value`).then(r => r.json()),
    z(`/wallets/${a}/transactions/?filter[chain_ids]=monad&filter[trash]=only_non_trash&currency=usd&page[size]=25`).then(r => r.json()),
  ]);
  return Response.json({ portfolio: portfolio.data, positions: positions.data, txs: txs.data });
}
```
Response items are JSON:API resources `{type, id, attributes, relationships}`. Positions have `attributes.value`, `quantity`, `fungible_info` and `position_type`. Transactions have `attributes.operation_type`, `transfers[]`, `fee` and `mined_at`, plus the `application_metadata` dapp context.

**Real-time activity via webhooks (instead of polling Monad RPC):**
```ts
await fetch("https://api.zerion.io/v1/tx-subscriptions", {
  method: "POST",
  headers: { authorization: auth, "content-type": "application/json" },
  body: JSON.stringify({ callback_url: "https://yourapp.xyz/api/zerion-hook",
                         addresses: ["0xUserWallet"], chain_ids: ["monad"] }),
});
```
Verify webhook signatures using the certificate URL from the payload headers. Only accept certificates from `*.zerion.io` (the recipe includes Express code). **Free plan: 5 wallets per subscription**, 100 wallets per request. For production callback URLs, email `api@zerion.io` to get the URL whitelisted.

## Key endpoints
| Endpoint | Notes |
|---|---|
| `GET /v1/wallets/{address}/portfolio` | Totals by chain and position type |
| `GET /v1/wallets/{address}/positions/` | `filter[positions]=only_simple|only_complex|no_filter`, `filter[chain_ids]`, `filter[position_types]`, `filter[fungible_ids]`, `filter[dapp_ids]`, `filter[trash]`, `sort`, `currency` |
| `GET /v1/wallets/{address}/transactions/` | `filter[operation_types]`, `filter[asset_types]`, `filter[chain_ids]`, `filter[min_mined_at]`/`max`, `filter[search_query]`, cursor pagination |
| `GET /v1/wallets/{address}/pnl` · `/charts/...` | PnL and balance chart. **Limited to 25% of plan quota** (along with DeFi positions) |
| `GET /v1/wallets/{address}/nft-positions/` etc. | NFTs |
| `GET /v1/wallet-sets/...` | Combined EVM + Solana address views |
| `GET /v1/fungibles/` · `/fungibles/by-implementation` | Token metadata, prices, charts by chain+contract |
| `GET /v1/chains/` | Chain ids and feature flags. Only chains listed here are accepted in `filter[chain_ids]` |
| `GET /v1/swap/...` (quotes) | Same-chain swap and cross-chain bridge quotes with ready-to-sign transactions (check Monad coverage) |
| `GET /v1/gas-prices/` | Per-chain gas |
| `POST /v1/tx-subscriptions` + manage endpoints | Webhooks |

## Pricing
| Plan | Price | Quota |
|---|---|---|
| Developer | $0 | 2K requests/day, 3 RPS |
| **Builder** (free 1 month for participants) | $149/mo | 250K requests/mo, 10 RPS |
| Startup | $499/mo | 1M/mo, 25 RPS |
| Enterprise | custom | 2.5M+/mo |

Rate-limit headers are `RateLimit-Org-{Second,Day,Month}-{Limit,Remaining,Reset}`. A 429 means back off until `…-Second-Reset`.

## Bounty angle and ideas
Winners get a 3-month Builder plan. Judges will likely value apps where Zerion is **the data layer that makes the UX possible**: portfolio, activity feeds, PnL and alerts done without building your own indexer, especially Monad-native plus cross-chain.
1. **"Plain-English wallet" for the no-blockchain payments app**: a human-readable activity feed ("You paid Alex $12") from `transactions` with `operation_type` and `transfers`, and push notifications from `tx-subscriptions` on Monad.
2. **Agent risk co-pilot**: an MCP or agent tool that reads `positions` and `pnl` before an agent (MetaMask Agent Wallet plugin, Privy agent) trades, enforcing exposure limits. Also a good Trust/AI track story.
3. **Social / attention**: "proof-of-portfolio" profile cards or leaderboards for a community (PnL, DeFi positions on Monad) with spam-filtered positions, or copy-trading alerts through webhooks.
4. **Group settle-up**: show each member's cross-chain balances and suggest which asset and chain to settle from.

## Gotchas
- Keep the key on the server, and cache aggressively on the free tier (2K per day).
- DeFi positions, portfolio chart and PnL together count against **only 25% of the quota** and don't have overages.
- Use `filter[trash]=only_non_trash` (it is the default) so spam airdrops don't appear.
- Webhook callback URLs must be public. Use webhook.site for testing and get the whitelist for production.
- Monad testnet coverage (`monad-test-v2`) may be thinner than mainnet. Demo with mainnet addresses where you can.

## Sources
- https://developers.zerion.io/llms.txt · https://developers.zerion.io/supported-blockchains · https://developers.zerion.io/authentication
- https://developers.zerion.io/api-reference/wallets/get-wallet-fungible-positions · …/get-wallet-transactions · …/get-wallet-portfolio
- https://developers.zerion.io/webhooks · https://developers.zerion.io/recipes/wallet-activity-alerts · https://developers.zerion.io/rate-limits
- https://developers.zerion.io/build-with-ai/x402 · https://developers.zerion.io/build-with-ai/zerion-cli · https://developers.zerion.io/recipes/ai-agent-integration
- https://zerion.io/api (pricing) · https://zerion.io/blog/guide-to-building-on-monad-with-zerion-api/ · https://zerion.io/blog/zerion-api-powers-the-monad-ecosystem/
- Metropolis sponsor listing: context/_sources/metropolis.md

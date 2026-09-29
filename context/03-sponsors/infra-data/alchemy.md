# Alchemy on Monad — RPC, Wallet APIs (formerly Account Kit), Gas Manager, Webhooks

> Researched 2026-09-28 from alchemy.com/docs (llms.txt + .md pages) and alchemy.com/monad. **Account Kit is now "Wallet APIs"**: the SDK is `@alchemy/wallet-apis` v5, and `@account-kit/*` v4 is legacy.

## Overview
Alchemy is a full-stack web3 developer platform. The parts that matter on Monad:
- **Node / JSON-RPC API** on Monad mainnet and testnet, including Monad-specific WebSocket subscriptions.
- **Wallet APIs** for smart wallets, with EIP-7702 by default, a bundler, gas sponsorship (Gas Manager), ERC-20 gas payments, session keys, and batching.
- **Webhooks** (Address Activity, Custom GraphQL, NFT Activity). Monad is listed on Alchemy's Monad landing page; confirm per-product support at https://dashboard.alchemy.com/chains.
- **Data APIs** (Token, NFT, Transfers, Portfolio, Prices). **Monad coverage could not be confirmed from the docs** (unverified). Check the dashboard Chains page before you depend on them.

Uttam Singh (Alchemy Sr. DevRel) is listed as a Metropolis mentor.

## Monad support

| Item | Value |
|---|---|
| Mainnet HTTPS | `https://monad-mainnet.g.alchemy.com/v2/<API_KEY>` |
| Testnet HTTPS | `https://monad-testnet.g.alchemy.com/v2/<API_KEY>` |
| WebSocket | `wss://monad-mainnet.g.alchemy.com/v2/<API_KEY>` (standard Alchemy wss pattern; `eth_subscribe` is documented for Monad) |
| Chain IDs | 143 (mainnet), 10143 (testnet) |
| Public fallback run by Alchemy | `https://rpc1.monad.xyz` / `wss://rpc1.monad.xyz`: 15 rps, batch 100, `debug_`/`trace_` disabled, `eth_getLogs` max 1,000 blocks / 10,000 logs |

Note: the Alchemy Monad *Quickstart* page still says "We currently only support the Monad testnet". It is stale. The per-method reference pages and the chain list both show `monad-mainnet.g.alchemy.com`.

**Monad RPC methods documented by Alchemy:**
- The standard `eth_*` set.
- `eth_callMany`, `eth_simulateV1`, `eth_sendRawTransactionSync` (sends and waits for the receipt), `eth_fillTransaction`, `eth_getAccount`, `txpool_content`.
- `eth_subscribe` (WSS only).
- **Monad-specific subscriptions**, both fired when a block is *Proposed*:
  - `monadNewHeads`: adds `blockId` and `commitState` fields to the usual head data.
  - `monadLogs`: logs, delivered early.
  - Both are ideal for ultra-low-latency UIs, but the data is speculative until finalized.

**Wallet APIs on Monad** (from the supported-chains table):

| Network | Bundler | Gas Sponsorship | ERC-20 Gas Payments | BSOs |
|---|---|---|---|---|
| Monad Mainnet | ✅ | ✅ | ✅ | ✅ |
| Monad Testnet | ✅ | ✅ | ✅ | ✅ |

## Quickstart code

### 1. RPC with viem (Monad chains are built into viem)
```typescript
import { createPublicClient, http, webSocket } from "viem";
import { monad, monadTestnet } from "viem/chains"; // monad = 143, monadTestnet = 10143

const KEY = process.env.ALCHEMY_API_KEY!;
export const client = createPublicClient({
  chain: monad,
  transport: http(`https://monad-mainnet.g.alchemy.com/v2/${KEY}`),
});

console.log(await client.getBlockNumber());
```

### 2. Early block and log notifications (`monadNewHeads` / `monadLogs`)
```bash
wscat -c wss://monad-mainnet.g.alchemy.com/v2/$ALCHEMY_API_KEY
> {"jsonrpc":"2.0","id":1,"method":"eth_subscribe","params":["monadNewHeads"]}
> {"jsonrpc":"2.0","id":2,"method":"eth_subscribe","params":["monadLogs",{"address":"0xYourContract"}]}
```
Each head carries `commitState: "Proposed"`. Treat it as provisional and reconcile against `finalized`.

### 3. Gasless smart wallet on Monad (Wallet APIs v5)
```bash
npm install @alchemy/wallet-apis viem
```
```typescript
import { createSmartWalletClient, alchemyWalletTransport } from "@alchemy/wallet-apis";
import { monad } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { encodeFunctionData, parseAbi } from "viem";

const client = createSmartWalletClient({
  transport: alchemyWalletTransport({ apiKey: process.env.ALCHEMY_API_KEY! }),
  chain: monad,
  signer: privateKeyToAccount(process.env.PK as `0x${string}`), // or Privy/Turnkey/any viem signer
  paymaster: { policyId: process.env.ALCHEMY_GAS_POLICY_ID! },  // Gas Manager policy
});

// EIP-7702 by default: the EOA is delegated to a smart wallet on its first tx
const { id } = await client.sendCalls({
  calls: [{
    to: "0xYourContract",
    data: encodeFunctionData({ abi: parseAbi(["function mint(address)"]), functionName: "mint", args: ["0xUser"] }),
  }],
});
const status = await client.waitForCallsStatus({ id });
console.log(status.status);
```
- Create the gas policy in Dashboard > Gas Manager.
- Signers: Privy, Turnkey, Openfort, or any viem-compatible signer.
- Session keys and batching are supported, which suits agent and auto-trading UX.

### 4. Webhook receiver (Address Activity / Custom). Verify the signature.
```typescript
import crypto from "node:crypto";
export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("x-alchemy-signature") ?? "";
  const expected = crypto.createHmac("sha256", process.env.ALCHEMY_WEBHOOK_SIGNING_KEY!).update(body).digest("hex");
  if (sig !== expected) return new Response("bad sig", { status: 401 });
  const evt = JSON.parse(body); // evt.event.activity[] for Address Activity
  // ...
  return new Response("ok");
}
```
Check that Monad appears in the webhook network dropdown (unverified per product).

## Features
- **Free tier:** 30M compute units/month, 5 apps, 5 webhooks, all mainnets and testnets (from alchemy.com/monad).
- **Gas Manager.** Sponsor gas or accept ERC-20 for gas on Monad.
- **Simulation methods:** `eth_simulateV1` and `eth_callMany` on Monad. Use them for "preview before sign" UX.
- **`eth_sendRawTransactionSync`.** One call returns the receipt, which suits Monad's sub-second blocks.
- **AI tooling.** An Alchemy "Build with AI" section exists (MCP, llms.txt): https://www.alchemy.com/docs/build-with-ai/llms.txt

## Perk / bounty
- **"Best Projects using Alchemy": $1,000 in Alchemy credits.**
- **How to claim.** Not published. Presumably you tag Alchemy in the Metropolis submission and describe the integration. (unverified)
- **Angle.** Judges will look for Alchemy doing something that matters to the product, beyond a plain RPC URL. The strongest story on Monad:
  1. **Gasless onboarding.** Wallet APIs + Gas Manager + EIP-7702: users never hold MON for their first actions.
  2. **Realtime UX.** `monadNewHeads`/`monadLogs` for instant UI updates at Monad speed.
  3. **Webhooks.** Push notifications for payments or alerts.
- **Ideas:**
  - A consumer payments app with sponsored gas and batch "approve + pay" in one call.
  - An AI trading agent using session keys that are scoped and time-limited.
  - A social tipping app with ERC-20 gas payment in USDC.
  - A realtime orderbook/feed UI on `monadLogs`.

## Gotchas
1. **Package naming churn.** Docs now say "Wallet APIs" and `@alchemy/wallet-apis` v5. Older tutorials use `@account-kit/*` v4 (`policyId` on the client, `paymasterService`, `@account-kit/infra` chains, hex values). Don't mix the two.
2. **v5 defaults to EIP-7702**, which delegates the user's EOA. If you want a separate smart-account address (Modular Account v2 or Light Account), configure it explicitly.
3. **Speculative data.** `monadNewHeads`/`monadLogs` fire at *Proposed*. Show it as pending and settle on `finalized`.
4. **Compute units.** Methods cost different CU amounts. Trace, debug and archive calls burn quota fast, and one comparison blog puts `eth_getLogs` at 75 CU (unverified).
5. **The public `rpc1.monad.xyz` is Alchemy-backed but tiny** (15 rps, no debug or trace). Use your own key for the demo.
6. Data APIs (Token/NFT/Portfolio) on Monad are **unverified**. Have a fallback such as Envio or your own indexer.

## Sources
- https://www.alchemy.com/docs/llms.txt
- https://www.alchemy.com/docs/chains/monad/llms.txt
- https://www.alchemy.com/docs/reference/monad-api-quickstart.md
- https://www.alchemy.com/docs/chains/monad/monad-api-endpoints/eth-block-number.md (mainnet URL)
- https://www.alchemy.com/docs/reference/node-supported-chains.md
- https://www.alchemy.com/docs/reference/monadnewheads.md
- https://www.alchemy.com/docs/reference/monadlogs.md
- https://www.alchemy.com/docs/wallets/supported-chains.md
- https://www.alchemy.com/docs/wallets/quickstart.md
- https://www.alchemy.com/docs/reference/webhook-types.md
- https://www.alchemy.com/monad
- https://docs.monad.xyz/developer-essentials/network-information.md
- https://docs.monad.xyz/reference/rpc-limits.md
- viem chain definitions: https://unpkg.com/viem@latest/chains/definitions/monad.ts

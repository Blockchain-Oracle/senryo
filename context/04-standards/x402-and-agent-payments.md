# x402 & Agent Payments on Monad

> Last researched: 2026-09-28. Related bounty: MetaMask **"Best Agent Wallet Plugin" ($2,500)**. Pairs with ERC-8004 (`proofOfPayment` in feedback).

## Overview

**x402** revives HTTP `402 Payment Required` as a protocol for internet-native micropayments: any HTTP endpoint (API, MCP tool, content) becomes payable per request with a signed stablecoin authorization — no accounts, API keys or subscriptions. Originated at Coinbase; the repo now lives at **`x402-foundation/x402`** (mirror `coinbase/x402`). Current protocol is **v2**. Monad runs its own hosted facilitator, and Monad's canonical contracts include the x402 Permit2 proxies.

Monad also documents **MPP (Machine Payments Protocol)** via `@monad-crypto/mpp`.

## How it works (v2)

1. Client `GET /resource`.
2. Server → `402` + payment requirements (`accepts[]`: `scheme`, `network` (CAIP-2 e.g. `eip155:143`), `amount`, `asset`, `payTo`, `maxTimeoutSeconds`, `extra`).
3. Client signs an authorization locally (no tx) — for USDC, **EIP-3009 `transferWithAuthorization`** typed data.
4. Client retries with header **`PAYMENT-SIGNATURE`** (v1 was `X-PAYMENT`).
5. Server → facilitator `POST /verify` → serves content → `POST /settle` (facilitator submits tx and pays gas). Response header **`PAYMENT-RESPONSE`** (v1: `X-PAYMENT-RESPONSE`).

v2 packages: `@x402/core`, `@x402/evm`, `@x402/svm`, `@x402/fetch`, `@x402/axios`, `@x402/next`, `@x402/express` (all **v2.27.0** on npm today).

## Monad specifics (verified)

| Item | Value |
|---|---|
| Monad facilitator | **`https://x402-facilitator.molandak.org`** — v2 only; `GET /supported`, `POST /verify`, `POST /settle` |
| Live `/supported` (queried 2026-09-28) | `exact`, `upto`, **`batch-settlement`** on both `eip155:143` and `eip155:10143`; signer/facilitatorAddress `0x7f6a2850669202519f0FE8aa912451238820Db86` |
| USDC mainnet (143) | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` — built into `@x402/evm >= 2.22.0` |
| USDC testnet (10143) | `0x534b2f3A21130d7a60830c2Df862319e593943A3` — **not built in**; register a custom money parser |
| EIP-712 domain for Monad USDC | `name: "USDC"` (**not** "USD Coin"), `version: "2"` |
| x402 ExactPermit2Proxy | `0x402085c248EeA27D92E8b30b2C58ed07f9E20001` |
| x402 UptoPermit2Proxy | `0x4020A4f3b7b90ccA423B9fabCc0CE57C6C240002` |
| Permit2 | `0x000000000022d473030f116ddee9f6b43ac78ba3` |
| Testnet USDC faucet | https://faucet.circle.com (Monad Testnet, 1 USDC / 2h); MON gas: https://faucet.monad.xyz |

Schemes:
- **`exact`** — fixed price; EIP-3009 direct on USDC (Permit2 fallback for non-3009 tokens). Recommended default.
- **`upto`** — metered (LLM tokens, bandwidth): client signs a max via Permit2, facilitator settles actual ≤ max (supports $0 settlement). Needs Permit2 allowance for the proxy; facilitator returns **HTTP 412 `PERMIT2_ALLOWANCE_REQUIRED`** otherwise. Use `@x402/evm >= 2.12.0` (2.9–2.11 point to an undeployed proxy `0x402039b3…0002` and fail silently).
- **`batch-settlement`** — advertised by the live facilitator but not documented in Monad's guide (unverified semantics).

## Code

### Server (Next.js route, Monad testnet)

```ts
// npm i @x402/core @x402/evm @x402/fetch @x402/next
import { NextRequest, NextResponse } from "next/server";
import { withX402, type RouteConfig } from "@x402/next";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { Network } from "@x402/core/types";

const NETWORK: Network = "eip155:10143";
const USDC_TESTNET = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
const server = new x402ResourceServer(new HTTPFacilitatorClient({ url: "https://x402-facilitator.molandak.org" }));

const scheme = new ExactEvmScheme();
scheme.registerMoneyParser(async (amount: number, network: string) => {
  if (network !== NETWORK) return null;
  return { amount: BigInt(Math.round(amount * 1e6)).toString(), asset: USDC_TESTNET, extra: { name: "USDC", version: "2" } };
});
server.register(NETWORK, scheme);

const routeConfig: RouteConfig = {
  accepts: { scheme: "exact", network: NETWORK, payTo: process.env.PAY_TO_ADDRESS!, price: "$0.001" },
  resource: "http://localhost:3000/api/premium",
};
async function handler(_req: NextRequest) { return NextResponse.json({ content: "premium" }); }
export const GET = withX402(handler, routeConfig, server);
```
(Adapted from the Monad guide; the parser's exact return shape follows that guide — double-check against `@x402/evm` types.)

### Client / agent (Node, private key)

```ts
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount(process.env.AGENT_PK as `0x${string}`);
const signer = { address: account.address, signTypedData: (m: any) => account.signTypedData(m) };
const client = new x402Client().register("eip155:10143", new ExactEvmScheme(signer));
const payFetch = wrapFetchWithPayment(fetch, client);

const res = await payFetch("https://api.example.xyz/api/premium");
console.log(await res.json(), res.headers.get("PAYMENT-RESPONSE"));
```
(In the browser, build `signer` from wagmi's `walletClient.signTypedData` — see Monad guide.)

### Raw facilitator call (manual EIP-3009)

```ts
const domain = { name: "USDC", version: "2", chainId: 10143n, verifyingContract: USDC_TESTNET };
const types = { TransferWithAuthorization: [
  { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
  { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" } ] };
const now = Math.floor(Date.now() / 1000);
const authorization = { from: account.address, to: PAY_TO, value: "1000", validAfter: String(now - 60),
  validBefore: String(now + 900), nonce: toHex(crypto.getRandomValues(new Uint8Array(32))) };
const signature = await account.signTypedData({ domain, types, primaryType: "TransferWithAuthorization",
  message: { ...authorization, value: 1000n, validAfter: BigInt(authorization.validAfter), validBefore: BigInt(authorization.validBefore) } });

const body = { x402Version: 2,
  paymentPayload: { x402Version: 2, payload: { authorization, signature },
    accepted: { scheme: "exact", network: "eip155:10143", amount: "1000", asset: USDC_TESTNET, payTo: PAY_TO, maxTimeoutSeconds: 300, extra: { name: "USDC", version: "2" } } },
  paymentRequirements: { /* same as accepted */ } };
await fetch("https://x402-facilitator.molandak.org/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
// then POST /settle with same body → { success, transaction/txHash }
```
(Exact /verify body wrapper keys are abbreviated in the Monad guide — verify against `GET /supported` + x402 v2 spec before relying on this raw form; prefer the SDK.)

### MPP alternative (`@monad-crypto/mpp`)

```ts
// npm i @monad-crypto/mpp mppx viem
import { monad } from "@monad-crypto/mpp/server";
import { Mppx } from "mppx";
import { Hono } from "hono";
const mppx = Mppx.create({ methods: [monad({ account, recipient: account.address /*, testnet: true */ })] });
const app = new Hono();
app.get("/premium", mppx.charge(), (c) => c.json({ message: "Premium content" }));
```
Defaults to mainnet (143); `testnet: true` for 10143. Client submits a tx hash or signed authorization as credential.

## Agent payment patterns

| Pattern | When | Tooling |
|---|---|---|
| **Pay-per-call x402** | Agent buys API/MCP tool calls | `@x402/fetch` wrapper around agent's fetch; MCP servers that return 402 |
| **Metered `upto`** | LLM inference resale, streaming data | Permit2 max authorization, settle actual usage |
| **Agent-to-agent commerce** | 8004-registered agents hire each other | 8004 discovery (`x402Support: true`) → x402 pay → `giveFeedback` with `proofOfPayment` |
| **Scoped delegation** | Human funds an agent with limits | MetaMask Smart Accounts Kit delegations / ERC-7715 Advanced Permissions; session keys (ZeroDev, Biconomy) |
| **Passkey-approved spend** | Above-threshold payments need human | P256 smart account co-signer; agent key for small amounts |
| **Agent wallets in TEEs** | Keys not held by dev | Coinbase CDP server wallets, Privy/Turnkey, Phala TEEs |

### MetaMask delegation for agents (brief)

- **MetaMask Smart Accounts Kit** (formerly Delegation Toolkit), `@metamask/smart-accounts-kit` v2.0.0, viem-based. **Monad mainnet + testnet supported** for smart accounts and **ERC-7715 Advanced Permissions**.
- Pattern: user's smart account signs a **delegation** to the agent's address with **caveats** (spend caps per period, allowed targets/methods, expiry); agent redeems via the DelegationManager. Delegations can be re-delegated (agent → sub-agent) with narrower caveats.
- ERC-7715 lets a dapp/agent *request* permissions (e.g., "spend 10 USDC/day") from a MetaMask user directly.
- Fit for the "Best Agent Wallet Plugin" bounty: a plugin that gives an agent framework (MCP/Vercel AI SDK) a delegated, caveat-limited MetaMask smart account that can pay x402 on Monad.

## Hackathon project ideas

1. **x402 MCP gateway on Monad** — wrap any MCP server; each tool call is an x402 micro-payment; auto-register as an ERC-8004 agent with `x402Support: true`.
2. **Metered LLM proxy** — resell Kimi/Qwen/Hunyuan inference per token via `upto` scheme (ties into AI sponsor bounties).
3. **Reputation-weighted payments** — pay more / escrow less for higher-8004-rated agents; feedback requires x402 receipt.
4. **Agent allowance wallet** — MetaMask delegation with daily caps + passkey approval above cap.
5. **Paywalled media with provenance** — pay-per-download of C2PA-signed content, license minted onchain.

## Gotchas

- Monad facilitator is **v2-only**; v1 libraries (`x402`, `x402-express`, `X-PAYMENT`) won't work.
- USDC EIP-712 domain name on Monad is **"USDC"**; using "USD Coin" makes signatures invalid.
- Testnet USDC needs a custom money parser; mainnet is built-in only in `@x402/evm >= 2.22.0`.
- Coinbase's CDP facilitator focuses on Base/Solana (per third-party lists) — use the Monad facilitator for Monad.
- `validBefore`/`validAfter` clock skew: start `validAfter` 60 s in the past.
- `upto` requires a prior Permit2 approval tx from the payer (not gasless on first use).
- `resource` URL must match the host the client called; use env-based absolute URLs in deploys.

## Sources

- https://docs.monad.xyz/guides/x402
- https://docs.monad.xyz/tooling-and-infra/agentic-payments
- https://docs.monad.xyz/reference/mpp/overview , https://mpp.dev
- https://x402-facilitator.molandak.org/supported (live)
- https://docs.monad.xyz/developer-essentials/network-information (canonical contracts)
- https://www.x402.org , https://docs.x402.org/guides/migration-v1-to-v2
- https://github.com/x402-foundation/x402 , https://github.com/coinbase/x402
- https://github.com/xpayllc/x402facilitators , https://www.x402.org/ecosystem?category=facilitators
- https://docs.metamask.io/smart-accounts-kit/ , https://docs.metamask.io/smart-accounts-kit/development/get-started/supported-networks/
- https://github.com/MetaMask/smart-accounts-kit

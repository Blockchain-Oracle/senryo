# Payment Patterns on Monad — stablecoins, per-second subscriptions, group settle-up, gasless UX, x402

Built for the Consumer track prompts:
- "a payments app that never mentions a blockchain"
- "subscriptions that charge by the second"
- "shared wallets and group spending that settle up without an intermediary"

## 1. Stablecoins on Monad (mainnet, chain 143)
From `monad-crypto/token-list` and Circle:
| Token | Address | Decimals |
|---|---|---|
| **USDC** (native Circle) | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` | 6 |
| USDT0 | `0xe7cd86e13AC4309349F30B3435a9d337750fC82D` | 6 |
| AUSD (Agora) | `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` | 6 |
| USD1 | `0x111111d2bf19e43C34263401e0CAd979eD1cdb61` | 6 |
| mUSD | `0xacA92E438df0B2401fF60dA7E4337B687a2435DA` | 6 |
| WMON | `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` | 18 |

**Testnet USDC (10143):** `0x534b2f3A21130d7a60830c2Df862319e593943A3`. Get it from faucet.circle.com (pick Monad Testnet; 1 USDC per 2h). Testnet MON comes from faucet.monad.xyz.

**USDC EIP-712 domain name on Monad is `"USDC"`** (not "USD Coin"), version `"2"`. This matters for EIP-3009 and permit signatures. Custom stablecoins can be issued with Brale (docs.monad.xyz/guides/brale). Agora ($10k ×2 bounties) centres on AUSD.

## 2. "Never mention a blockchain": the reference stack
```
Login (email/passkey)  ──► Privy or Dynamic embedded wallet (or Mera passkey EOA)
Top up (card)          ──► Mercuryo widget: MON on MONAD → auto-swap to USDC   (or Privy/Dynamic funding)
Send / pay             ──► USDC transfer, gas sponsored (Privy sponsor:true | ZeroDev/Pimlico paymaster)
Activity / balances    ──► Zerion API (portfolio + decoded tx feed + webhooks) shown in $ with names, not hashes
Recurring / automated  ──► Sablier Flow per-second stream  or  Privy session signer / MetaMask ERC-7715 periodic permission
Machine payments       ──► x402 via Monad facilitator (gas-free for payer)
```
UX rules:
- Show amounts in fiat.
- Use `uiOptions.showWalletUIs:false` (Privy) to hide confirm modals for low-risk sends.
- Resolve recipients by email or phone. Privy can pregenerate a wallet for an email (`privy.users().create` + `wallets().create({owner:{user_id}})`), so money can be sent to someone who hasn't signed up yet.
- On Monad, show "done" on receipt: blocks are ~0.4 s, and finality is reached after a few blocks.

## 3. Subscriptions that charge by the second
### Option A: Sablier Flow (open-ended streams) on Monad
- **SablierFlow (flow-v3.0) on Monad mainnet: `0x95004df5abe86a246664d8f5fb2683f24df768d1`**. FlowNFTDescriptor is `0xf51BB8bd1cfc7C890dB68c39dCCA67CAd7810Ce4`. The Sablier UI supports Monad. A testnet deployment is **(unverified)**; check docs.sablier.com/guides/flow/deployments.
- Flow is a debt tracker: `amount owed = ratePerSecond × elapsed`. Anyone can deposit at any time, and the sender can pause, refund or void. Withdraw is publicly callable to the recipient, and each stream is an ERC-721 (transferable if set).
- `ratePerSecond` is a **UD21x18 (18-decimal fixed point, uint128)** *regardless of token decimals*. For 6-decimal USDC, scale up by 1e12: `rps = amount * 1e12 / duration`.
```solidity
import { ISablierFlow } from "@sablier/flow/src/interfaces/ISablierFlow.sol";
import { ud21x18 } from "@prb/math/src/UD21x18.sol";
ISablierFlow constant FLOW = ISablierFlow(0x95004df5abe86a246664d8f5fb2683f24df768d1);
IERC20 constant USDC = IERC20(0x754704Bc059F8C67012fEd69BC8A327a5aafb603);

// $9.99 / 30 days, charged per second
uint128 rps = uint128((9_990_000 * 1e12) / 30 days);
uint256 id = FLOW.create({ sender: msg.sender, recipient: merchant, ratePerSecond: ud21x18(rps),
                           startTime: uint40(block.timestamp), token: USDC, transferable: true });
// then USDC.approve(FLOW, x); FLOW.deposit(id, amount, sender, recipient)  (check exact v3.0 signatures / createAndDeposit)
```
Cancel equals `pause` + `refund`. The merchant calls `withdraw` (or `withdrawMax`) whenever it likes. Note: Sablier Labs announced it is winding down active development (Bankless), but the deployed contracts are immutable and remain usable.

### Option B: Pull-based subscriptions with delegated permissions
- **MetaMask ERC-7715** `native-token-stream` / `erc20-token-stream` / `erc20-token-periodic` permission. The user grants it once in the MetaMask extension, and your session account redeems it with `sendTransactionWithDelegation`. Supported on Monad (see metamask-agent-wallets.md).
- **Privy session signer + policy**: the server pulls or settles on a schedule, and the policy allows only `to == SubscriptionManager` and caps the amount.
- **Dynamic delegated access**: same idea, with webhooks.

### Option C: Metered and usage-based billing (x402 `upto`)
The Monad facilitator's **`upto`** scheme has the client sign a maximum, and the facilitator settles actual usage ≤ max (including $0 with no tx). It is ideal for LLM tokens or bandwidth "by the second". It requires `@x402/evm ≥ 2.12.0` (2.22.0 recommended) and the canonical `x402UptoPermit2Proxy` at `0x4020A4f3b7b90ccA423B9fabCc0CE57C6C240002`. Versions 2.9–2.11 point at a proxy that doesn't exist on Monad.

## 4. Shared wallets / group spending / settle-up
| Pattern | How | Notes |
|---|---|---|
| **Safe multisig** | Safe v1.3 is deployed on Monad (`0x69f4…2938`, SafeL2 `0xfb1b…91EA`). Members' embedded wallets act as owners | Heavier UX. Good for a "house account" |
| **Split ledger + netting contract** | Track IOUs off-chain (or in events). A `settle()` computes the minimal transfer set and executes USDC `transferFrom`s in one tx, batched via a smart account or MultiSendCallOnly `0xA1da…102B` | Monad's cheap gas makes on-chain per-expense logging viable |
| **Group smart account** | A ZeroDev Kernel / MetaMask Hybrid account with multiple signers, or session keys per member with caveats (e.g. ≤ $50/tx) | Pairs with Dynamic (ZeroDev ext) or MetaMask Smart Accounts Kit |
| **Streams between members** | Sablier Flow streams for rent or shared subscriptions | "Settle continuously" |
| **Compliant group** | CVA (aUSDC) only among CVI-verified members | Stacks with the Cleanverse bounty |

A settle-up sketch (Solidity):
```solidity
function settle(address[] calldata from, address[] calldata to, uint256[] calldata amt) external onlyGroupAdmin {
    for (uint i; i < from.length; ++i) USDC.transferFrom(from[i], to[i], amt[i]); // members pre-approved a cap
    emit Settled(block.number);
}
```
Pre-approval can be an EIP-2612 `permit` with domain name "USDC", or a Permit2 allowance (Permit2 is deployed at the canonical address).

## 5. Gasless UX: choose one
| Need | Easiest on Monad |
|---|---|
| Embedded-wallet app, simple sends | **Privy `sponsor: true`** (Monad + testnet supported; 7702 + paymaster) |
| Dynamic app | **ZeroDev extension** (Dynamic native sponsorship lacks Monad) |
| Any signer, batching, custom policies | **Pimlico / ZeroDev / Alchemy / Biconomy / thirdweb** 4337 (see account-abstraction-on-monad.md) |
| Pay-per-call / agent payments | **x402 via the Monad facilitator** (facilitator pays gas; the payer signs EIP-3009) |
| Agent CLI | **MetaMask Agent Wallet** relay (ERC-20 only, where `relaySupported`) |

## 6. x402 on Monad (reference implementation)
- Facilitator: **`https://x402-facilitator.molandak.org`** (mainnet `eip155:143` and testnet `eip155:10143`). Only **x402 v2+**. Endpoints are `GET /supported`, `POST /verify` and `POST /settle`. Status `412` means `PERMIT2_ALLOWANCE_REQUIRED`.
- MetaMask facilitator (ERC-7710 delegation payments): `https://tx-sentinel-monad-mainnet.dev-api.cx.metamask.io/platform/v2/x402` via `@metamask/x402`.
- Third-party: MonX402 (monx402.com).
```bash
npm install @x402/core @x402/evm @x402/fetch @x402/next     # @x402/evm >= 2.22.0 (built-in Monad mainnet USDC)
```
```ts
// app/api/premium/route.ts — seller (mainnet: no custom money parser needed on >= 2.22.0)
import { NextResponse, type NextRequest } from "next/server";
import { withX402, type RouteConfig } from "@x402/next";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";

const server = new x402ResourceServer(new HTTPFacilitatorClient({ url: "https://x402-facilitator.molandak.org" }));
server.register("eip155:143", new ExactEvmScheme());
// TESTNET: register a moneyParser returning {amount, asset:"0x534b…43A3", extra:{name:"USDC",version:"2"}} for eip155:10143
const route: RouteConfig = { accepts: { scheme: "exact", network: "eip155:143", payTo: process.env.PAY_TO_ADDRESS!, price: "$0.001" },
                             resource: "https://yourapp.xyz/api/premium" };
export const GET = withX402(async (_req: NextRequest) => NextResponse.json({ content: "premium" }), route, server);
```
```ts
// buyer (browser, wagmi walletClient) — or Privy useX402Fetch / createX402Client
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { x402Client } from "@x402/core/client";
const client = new x402Client().register("eip155:143", new ExactEvmScheme({ address, signTypedData: (m) => walletClient.signTypedData(m as any) }));
const res = await wrapFetchWithPayment(fetch, client)("/api/premium");
```

## 7. Monad gotchas for payments
- **The gas limit is charged, not gas used.** Pass explicit `gas` (e.g. `21_000n` for a MON transfer, and a measured value for an ERC-20 transfer) instead of padded estimates.
- **Reserve balance**: an undelegated EOA spending below 10 MON has to wait k=3 blocks before the next MON spend. A 7702-delegated EOA simply can't reduce MON below 10. Keep user wallets on USDC with sponsored gas and avoid MON outflows.
- A successful `eth_sendRawTransaction` only means "accepted by this node". Confirm through the receipt, since there is no global mempool.
- WebSocket `monadNewHeads`/`monadLogs` give pre-finalization events, which make a snappy "payment received" UX possible. Use `newHeads`/`logs` when you need the standard behaviour.
- USDC's domain name is "USDC" in signatures, and USDC has 6 decimals (but Cleanverse aUSDC on testnet has **18**).

## Sources
- https://github.com/monad-crypto/token-list · https://developers.circle.com/stablecoins/usdc-contract-addresses
- https://docs.sablier.com/guides/flow/deployments (Monad) · https://docs.sablier.com/concepts/flow/overview · https://docs.sablier.com/guides/flow/examples/create-stream · …/flow-calculate-rps
- https://monad.xyz/blog/streaming-payments-with-stablecoins · https://www.bankless.com/read/news/sablier-is-winding-down-development-of-its-token-streaming-protocol
- https://docs.monad.xyz/guides/x402 · https://docs.monad.xyz/tooling-and-infra/agentic-payments · https://docs.monad.xyz/developer-essentials/network-information
- https://docs.monad.xyz/developer-essentials/wallet-developers · https://docs.monad.xyz/developer-essentials/eip-7702 · https://docs.monad.xyz/guides/brale
- https://docs.privy.io/wallets/gas-and-asset-management/gas/overview · https://docs.metamask.io/llms-smart-accounts-kit-full.txt

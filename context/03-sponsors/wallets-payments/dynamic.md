# Dynamic (Fireblocks) — Auth, MPC embedded wallets, server/agent wallets, stablecoin payments

> Bounty: **"Best Use of Dynamic" — $5,000**. Dynamic is now part of Fireblocks, and its docs now include "Fireblocks Flow" (stablecoin payments). A Dynamic infrastructure livestream ran on 8 Sep 2026 (Metropolis Livestreams).

## Overview
- **Auth + wallets in one SDK**: email/SMS/social/passkey auth, **800+ external wallet connectors**, and **TSS-MPC embedded wallets** ("WaaS").
- **Two web SDK generations**:
  - **JavaScript SDK (new, recommended)**: `@dynamic-labs-sdk/*`. It is **headless**, so you build every UI yourself. React hooks come from `@dynamic-labs-sdk/react-hooks`.
  - **Legacy React SDK**: `@dynamic-labs/sdk-react-core` with a drop-in `<DynamicWidget/>` modal. It is the fastest route for a hackathon UI, but in maintenance mode.
- **Server wallets** (Node/Python/Rust/Java) authenticated with an API token. **Agent wallets** authenticate as a Dynamic user through a JWT. **Delegated access** lets a user grant your server limited signing rights over their embedded wallet (triggered from React, used from Node, with webhooks).
- **Policy engine** with layers (environment → account → wallet → signer) and `waas.policy.violation` webhooks.
- **Funding**: onramps (Banxa, Coinbase, MoonPay, Kraken, Crypto.com) and a swap API. **Fireblocks Flow** adds payment links, conversions and settlements (accept any token, settle in your chosen token/chain).
- **Agent payments**: server wallets plug into x402 / MPP.

## Monad support
| Item | Status |
|---|---|
| Embedded wallets on Monad | ✅. Tier 1 covers "EVM (all EVM networks)" for send, sign and delegated access. Monad docs list Dynamic for mainnet and testnet |
| Dynamic native gas sponsorship | ❌ **Not on Monad.** Only ETH, Base, OP, Arb, BSC, Robinhood, Arc and their testnets |
| Gasless on Monad | Use the **ZeroDev extension** (`@dynamic-labs-sdk/zerodev`, Kernel smart accounts), since ZeroDev is ✅ on Monad per Monad docs. Or use Pimlico with a server relay |
| Enabling Monad | Dashboard → **Chains & Networks** → EVM → enable Monad / Monad Testnet. If a network is missing, the legacy SDK supports `overrides.evmNetworks` (below) |
| Ecosystem page | https://www.dynamic.xyz/ecosystems/monad |

## Quickstart A — new JS SDK (headless), React + Vite
```bash
npm i @dynamic-labs-sdk/client @dynamic-labs-sdk/evm @dynamic-labs-sdk/react-hooks @tanstack/react-query viem
```
```ts
// src/dynamicClient.ts  (module-level singleton; import at app root)
import { createDynamicClient } from "@dynamic-labs-sdk/client";
import { addEvmExtension } from "@dynamic-labs-sdk/evm";
export const dynamicClient = createDynamicClient({
  environmentId: import.meta.env.VITE_DYNAMIC_ENV_ID,
  metadata: { name: "My Monad App", universalLink: window.location.origin }, // `universalLink`, not `url`
});
addEvmExtension();
```
```tsx
// main.tsx
<QueryClientProvider client={queryClient}>          {/* outer */}
  <DynamicProvider client={dynamicClient}>          {/* inner, from @dynamic-labs-sdk/react-hooks */}
    <WaasBootstrap /><App />
  </DynamicProvider>
</QueryClientProvider>
```
```tsx
// Email OTP + create the embedded wallet (wallet creation is NOT automatic)
import { useSendEmailOTP, useVerifyOTP, useOnEvent, useGetWalletAccounts } from "@dynamic-labs-sdk/react-hooks";
import { createWaasWalletAccounts, getChainsMissingWaasWalletAccounts } from "@dynamic-labs-sdk/client/waas";

export function WaasBootstrap() {
  useOnEvent({ event: "userChanged", listener: async ({ user }) => {
    if (!user) return;
    const missing = getChainsMissingWaasWalletAccounts();
    if (missing.length) await createWaasWalletAccounts({ chains: missing });
  }});
  return null;
}
// sendEmailOTP({ email }) -> verifyOTP({ otpVerification, verificationToken: code })
```
```tsx
// Send USDC on Monad with a viem WalletClient
import { isEvmWalletAccount } from "@dynamic-labs-sdk/evm";
import { createWalletClientForWalletAccount } from "@dynamic-labs-sdk/evm/viem";
import { erc20Abi, parseUnits } from "viem";
const { data: accounts = [] } = useGetWalletAccounts();
const walletAccount = accounts.find(isEvmWalletAccount);
const wc = await createWalletClientForWalletAccount({ walletAccount });   // signs on the wallet's active network
// switch first: useSwitchActiveNetwork / switchActiveNetwork -> Monad
await wc.writeContract({ address: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603", abi: erc20Abi,
  functionName: "transfer", args: [to, parseUnits("5", 6)] });
```
Gasless on Monad: `npm i @dynamic-labs-sdk/zerodev`, call `addZerodevExtension()` after `addEvmExtension()`, enable ZeroDev in console → Account Abstraction (add a ZeroDev project with Monad), then use `createKernelClientForWalletAccount` / `canSponsorUserOperation`. Exact parameters are in the docs (unverified here).

## Quickstart B — legacy React SDK with the prebuilt widget (fastest demo)
```bash
npm i @dynamic-labs/sdk-react-core @dynamic-labs/ethereum viem
```
```tsx
import { DynamicContextProvider, DynamicWidget, mergeNetworks } from '@dynamic-labs/sdk-react-core';
import { EthereumWalletConnectors } from '@dynamic-labs/ethereum';

const monadNetworks = [{
  chainId: 10143, networkId: 10143, name: 'Monad Testnet', vanityName: 'Monad Testnet',
  rpcUrls: ['https://testnet-rpc.monad.xyz'], blockExplorerUrls: ['https://testnet.monadvision.com'],
  iconUrls: ['https://<your-icon>.svg'],
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18, iconUrl: 'https://<your-icon>.svg' },
}];

<DynamicContextProvider settings={{
  environmentId: 'YOUR_ENV_ID',
  walletConnectors: [EthereumWalletConnectors],
  overrides: { evmNetworks: (dash) => mergeNetworks(monadNetworks, dash) }, // only if Monad isn't in dashboard list
}}>
  <DynamicWidget />
</DynamicContextProvider>
```
`useDynamicContext()` gives `primaryWallet`, `user`, `handleLogOut`.

## Server wallets (Node)
```bash
pnpm add @dynamic-labs-wallet/node-evm @dynamic-labs-wallet/core viem
```
```ts
import { DynamicEvmWalletClient } from '@dynamic-labs-wallet/node-evm';
import { ThresholdSignatureScheme } from '@dynamic-labs-wallet/core';
import { createWalletClient, http } from 'viem';
import { monadTestnet } from 'viem/chains';

const evm = new DynamicEvmWalletClient({ environmentId: process.env.DYNAMIC_ENVIRONMENT_ID!, enableMPCAccelerator: false });
await evm.authenticateApiToken(process.env.DYNAMIC_AUTH_TOKEN!);          // server API token, never client-side

const { walletMetadata, externalServerKeyShares } = await evm.createWalletAccount({
  thresholdSignatureScheme: ThresholdSignatureScheme.TWO_OF_TWO,
  password: process.env.WALLET_PASSWORD, backUpToDynamic: true,
  onError: (e: Error) => console.error(e),
});
// prepare tx with viem (nonce/gas/chainId 10143), then:
const signedTx = await evm.signTransaction({ walletMetadata, transaction: preparedTx, password: process.env.WALLET_PASSWORD });
const wc = createWalletClient({ chain: monadTestnet, transport: http(), account: walletMetadata.accountAddress as `0x${string}` });
await wc.sendRawTransaction({ serializedTransaction: signedTx });
```
Set `enableMPCAccelerator: false` locally. `true` only works on AWS Nitro and otherwise raises `SessionAttestationError`. Also see `getWalletClient` (the viem wallet client for server wallets) and `createDelegatedEvmWalletClient` (for delegated access).

## Key APIs
| Area | API |
|---|---|
| Hooks (JS SDK) | `useUser`, `useGetWalletAccounts`, `useInitStatus`, `useOnEvent`, `useSendEmailOTP`, `useVerifyOTP`, `useLogout`, `useSwitchActiveNetwork` |
| EVM | `createWalletClientForWalletAccount`, `createPublicClientFromNetworkData`, `sendSponsoredTransaction` (not on Monad) |
| AA | `@dynamic-labs-sdk/zerodev`: `addZerodevExtension`, `createKernelClientForWalletAccount` |
| Server | `DynamicEvmWalletClient.createWalletAccount / signMessage / signTransaction` |
| Agents | Agent wallets (user JWT + session key), delegated access + webhooks, x402/MPP (docs /agents/agent-payments) |
| Payments | Fireblocks Flow: payment links, conversions, settlements, webhooks (docs /flow/*). Check Monad availability |
| Docs MCP | `claude mcp add --transport http dynamic https://www.dynamic.xyz/docs/mcp` |

## Pricing
Self-serve is **free up to 1,000 MAU**, $249/mo for 1,000–5,000, then $0.05/MAU. Enterprise is custom. Gas sponsorship is plan-dependent ("contact us if sponsorship isn't available on your plan").

## Bounty angle and ideas
The public criteria are only the title "Best Use of Dynamic". A strong "best use" goes beyond login and combines embedded wallets, a Monad-specific UX, policies or delegated access, and server or agent wallets.
1. **Pay-by-link checkout for creators on Monad**: Dynamic auth and embedded wallet for buyers, ZeroDev-sponsored USDC payment, and a merchant server wallet that auto-sweeps. If Flow payment links support Monad, add them; otherwise build a custom payment link.
2. **Delegated-access "autopay"**: the user approves delegated access once, then a Node service pays recurring bills or per-second subscriptions on Monad within policy limits, with violation webhooks shown in the UI.
3. **Multi-wallet group treasury**: friends log in with any external wallet (800+ connectors) or email. The app creates a Kernel smart account per group (ZeroDev) and settles up in a single batched userOp.
4. **Agent wallet + x402**: an autonomous agent (Dynamic agent wallet, JWT-authenticated) buys data or API calls from x402 endpoints priced in Monad USDC. Can pair with MetaMask or Zerion ideas.

## Gotchas
- Headless JS SDK: no modal, so you build the login UI, step-up auth and device registration screens yourself. Those two are required from API version `2026_04_01`.
- Common failures: chain not enabled in dashboard, login method not enabled, embedded wallets not enabled, or **CORS origin not allowlisted** (add `http://localhost:5173` or whatever port you use).
- `createWaasWalletAccounts` must run on `userChanged`, and should not be guarded by `accounts.length===0` (the list can be stale).
- Use `wallet.address`, not `accountAddress`, and `verificationToken`, not `otp`.
- Native gas sponsorship doesn't cover Monad, so budget time for the ZeroDev path or for users holding MON.
- Monad charges the gas **limit**. ZeroDev/Kernel userOps carry large verification gas limits that the paymaster pays for, so watch paymaster spend.

## Sources
- https://www.dynamic.xyz/docs/llms.txt · https://www.dynamic.xyz/docs/javascript/reference/react-quickstart
- https://www.dynamic.xyz/docs/react/reference/quickstart · https://www.dynamic.xyz/docs/react/chains/adding-custom-networks
- https://www.dynamic.xyz/docs/embedded-wallets/chains/overview · https://www.dynamic.xyz/docs/embedded-wallets/gas-sponsorship
- https://www.dynamic.xyz/docs/javascript/reference/zerodev/adding-zerodev-extension
- https://www.dynamic.xyz/docs/node/quickstart · https://www.dynamic.xyz/docs/node/evm/sign-transactions
- https://www.dynamic.xyz/docs/agents/overview · https://www.dynamic.xyz/docs/flow/overview · https://www.dynamic.xyz/docs/funding/overview
- https://www.dynamic.xyz/docs/recipes/stablecoins/sending-usdc · https://www.dynamic.xyz/pricing · https://www.dynamic.xyz/ecosystems/monad
- https://docs.monad.xyz/tooling-and-infra/wallet-infra/embedded-wallets

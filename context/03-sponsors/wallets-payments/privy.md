# Privy — Embedded wallets, auth, server/agent wallets

> Bounty: **"Privy!" — $5,000** (Metropolis sponsor bounty). Research date 2026-09-28.
> Privy mentor at Metropolis: Kenny Zhang (Crypto GTM Lead, x.com/crosschaingah).

## Overview
- Auth (email/SMS OTP, social, passkey, external wallet, Telegram, custom JWT) and **self-custodial embedded wallets** secured with TEE + key sharding. Monad docs list the security model as "TEE + SSS".
- **Server wallets / agent wallets**: wallets your backend (or an AI agent) owns and controls through `@privy-io/node` or REST.
- **Signers ("session signers")**: the user adds your app's authorization key as a signer on their embedded wallet, scoped by **policies**. The server can then transact while the user is offline, for limit orders, DCA, subscriptions, or agents.
- **Policy engine**: allowlist contracts and recipients, set value caps, time bounds, and chain restrictions.
- **Native gas sponsorship** (`sponsor: true`), which **explicitly lists Monad and Monad Testnet**. It works through EIP-7702 plus a paymaster.
- **EVM smart wallets** (ERC-4337: Kernel/Safe/Alchemy, etc.), with the embedded wallet acting as signer.
- Built-in **x402 client** (`useX402Fetch`, `createX402Client`), card on-ramps, fiat and crypto deposit accounts, and swaps.

## Monad support
| Item | Status |
|---|---|
| Embedded wallets on Monad | ✅. Any EVM chain works. Use `monad`/`monadTestnet` from `viem/chains`. Privy docs name Monad explicitly |
| Native gas sponsorship (App pays) | ✅ **Monad** and **Monad Testnet** are on the supported list |
| User-pays gas in stablecoins | ❌ Not on Monad. The list covers only ETH/Base/OP/Arb/Polygon/Tempo |
| Smart wallets (4337) | ✅ via Pimlico bundler. The official Monad template `monad-developers/next-serwist-privy-smart-wallet` uses Kernel with EntryPoint v0.7 |
| Testnet subsidy | Monad docs: "Sign up, then email `monad@privy.io`" for subsidized usage on Monad Testnet |
| Official Monad templates | `next-serwist-privy-embedded-wallet`, `next-serwist-privy-smart-wallet`, `next-serwist-0x-privy-embedded-wallet`, React Native Privy template (docs.monad.xyz/templates/...) |

Chain IDs: mainnet `143` (`eip155:143`), testnet `10143` (`eip155:10143`). RPCs: `https://rpc.monad.xyz`, `https://testnet-rpc.monad.xyz`.

## Quickstart (Next.js App Router)
```bash
npm i @privy-io/react-auth viem
```
```tsx
// app/providers.tsx
'use client';
import {PrivyProvider} from '@privy-io/react-auth';
import {monad, monadTestnet} from 'viem/chains';

export default function Providers({children}: {children: React.ReactNode}) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ['email', 'google', 'passkey'],   // (option names per Privy dashboard/SDK)
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        defaultChain: monadTestnet,                    // must also be in supportedChains
        supportedChains: [monadTestnet, monad],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
```
Wait for the SDK before reading user state (`const {ready} = usePrivy()`). For wallets, check `useWallets().ready`.

**Email OTP login and a gas-sponsored USDC transfer** (the user never sees gas):
```tsx
'use client';
import {useLoginWithEmail, useSendTransaction, useWallets} from '@privy-io/react-auth';
import {encodeFunctionData, erc20Abi, parseUnits} from 'viem';

const USDC_MONAD = '0x754704Bc059F8C67012fEd69BC8A327a5aafb603';     // mainnet, 6 decimals
const USDC_MONAD_TESTNET = '0x534b2f3A21130d7a60830c2Df862319e593943A3';

export function PayButton({to, amount}: {to: `0x${string}`; amount: string}) {
  const {sendTransaction} = useSendTransaction();
  const {wallets} = useWallets();
  return (
    <button onClick={() =>
      sendTransaction(
        {
          to: USDC_MONAD_TESTNET,
          data: encodeFunctionData({abi: erc20Abi, functionName: 'transfer', args: [to, parseUnits(amount, 6)]}),
          chainId: 10143,
        },
        {
          sponsor: true,                                   // Privy native gas sponsorship (7702 + paymaster)
          address: wallets[0]?.address,
          uiOptions: {showWalletUIs: false},               // hide the confirm modal -> "no blockchain" UX
        },
      )}>
      Pay ${amount}
    </button>
  );
}

export function EmailLogin() {
  const {sendCode, loginWithCode} = useLoginWithEmail();
  // sendCode({email}) -> loginWithCode({code})
  return null;
}
```
Before `sponsor: true` works you need to: buy prepaid credits under Dashboard → **Fee sponsorship**, turn on "Sponsor gas fees", tick Monad / Monad Testnet under Supported chains, and use **TEE execution** (required). To sponsor from the client, enable "Allow transactions from the client".

## Server side (`@privy-io/node`)
```bash
npm i @privy-io/node
```
```ts
import {PrivyClient} from '@privy-io/node';
const privy = new PrivyClient({appId: process.env.PRIVY_APP_ID!, appSecret: process.env.PRIVY_APP_SECRET!});

// 1) App-owned server wallet (treasury, escrow bot, agent)
const w = await privy.wallets().create({chain_type: 'ethereum'});

// 2) Pregenerate a wallet for a user by email (e.g. "send $ to an email" flows)
const user = await privy.users().create({linked_accounts: [{type: 'email', address: 'friend@example.com'}]});
const uw = await privy.wallets().create({chain_type: 'ethereum', owner: {user_id: user.id}});

// 3) Send on Monad, gas-sponsored
const {hash} = await privy.wallets().ethereum().sendTransaction(w.id, {
  caip2: 'eip155:10143',
  params: {transaction: {to: '0xRecipient', value: '0x0', data: '0x', chain_id: 10143}},
  sponsor: true,
});
```
REST equivalent: `POST https://api.privy.io/v1/wallets/<wallet_id>/rpc` with Basic auth `appId:appSecret`, header `privy-app-id`, body `{"method":"eth_sendTransaction","caip2":"eip155:143","sponsor":true,"params":{"transaction":{...}}}`. Wallets that have an owner also need the `privy-authorization-signature` header.

### Delegated server actions (subscriptions, agents, auto-settle)
1. Generate a P-256 authorization key: `openssl ecparam -name prime256v1 -genkey -noout -out private.pem && openssl ec -in private.pem -pubout -out public.pem`.
2. Register it as a 1-of-1 **key quorum** in Dashboard → Authorization keys. Save the quorum id.
3. (Optional) Create a **policy**:
```ts
const policy = await privy.policies().create({
  name: 'Only pay the subscription contract',
  version: '1.0',
  chain_type: 'ethereum',
  rules: [{
    name: 'Allow SubscriptionManager',
    method: 'eth_sendTransaction',
    action: 'ALLOW',
    conditions: [{field_source: 'ethereum_transaction', field: 'to', operator: 'eq', value: '0xSubscriptionManager'}],
  }],
});
```
4. On the client, after login:
```tsx
import {useSigners} from '@privy-io/react-auth';
const {addSigners} = useSigners();
await addSigners({address: userWalletAddress, signers: [{signerId: KEY_QUORUM_ID, policyIds: [policy.id]}]});
```
5. On the server, sign with the authorization key. The SDK accepts an `authorization_context`: `{authorization_private_keys: [...]}` for app keys or `{user_jwts: [...]}` for user-owned requests.
```ts
await privy.wallets().ethereum().sendTransaction(userWalletId, {
  caip2: 'eip155:143',
  params: {transaction: {to: SUB_MANAGER, data: calldata, chain_id: 143}},
  sponsor: true,
  authorization_context: {authorization_private_keys: [process.env.PRIVY_AUTH_KEY!]}, // exact placement per Node SDK (verify)
});
```
Delegated wallets show up in `user.linked_accounts` with `type:'wallet'` and `delegated: true`.

### x402 with Privy
```tsx
import {useX402Fetch, useWallets} from '@privy-io/react-auth'; // react-auth >= 3.7.0
const {wrapFetchWithPayment} = useX402Fetch();
const payFetch = wrapFetchWithPayment({
  walletAddress: wallets[0].address, fetch,
  maxValue: BigInt(1_000_000),                // cap: 1 USDC
  signatureOptions: {type: 'erc1271'},        // REQUIRED if you use gas-sponsored (7702) wallets
});
```
Node: `import {createX402Client} from '@privy-io/node/x402'` + `wrapFetchWithPayment(fetch, x402client)` from `@x402/fetch`. Point it at an endpoint priced in Monad USDC, served through the Monad facilitator (see payment-patterns.md).

## Key APIs cheat-sheet
| Need | API |
|---|---|
| Login | `useLoginWithEmail`, `useLogin({onComplete})`, `usePrivy().login()` |
| Wallets | `useWallets()`, `useCreateWallet`, `createOnLogin` |
| Send | `useSendTransaction().sendTransaction(tx, {sponsor, uiOptions, address})` |
| 7702 | `useSign7702Authorization` (docs: wallets/using-wallets/ethereum/sign-7702-authorization) |
| Smart wallets | `SmartWalletsProvider` / `useSmartWallets` (Dashboard → Smart wallets: pick Kernel/Safe/etc. + bundler/paymaster URLs) |
| Signers | `useSigners().addSigners/removeSigners` |
| Server | `privy.wallets().create/.ethereum().sendTransaction/.signMessage`, `privy.users().create`, `privy.policies().create` |
| Funding | `useFundWallet` / `useDepositFunds` (card on-ramp, crypto deposits). Check Monad coverage per provider |
| Agents | x402 (`useX402Fetch`), MPP, agent-owned wallets and delegated signing |

## Pricing
- **Developer: free up to 499 MAU**, with 50K signatures and $1M transaction volume per month. Core is $299/mo (500–2,499 MAU). Scale is $499/mo (2,500–9,999). Enterprise is custom.
- Gas sponsorship uses prepaid credits, and mainnet sponsorship needs a saved payment method. Email `monad@privy.io` for testnet subsidies.

## Bounty angle and ideas
The published bounty title is only "Privy!", so the criteria are unverified. Privy's own positioning points to projects that use **several Privy primitives in depth**, have **consumer-grade onboarding** (email/passkey → wallet → first tx in seconds, no gas prompts), and go beyond login-only integrations. The Consumer track example "a payments app that never mentions a blockchain" fits Privy exactly.
1. **"Venmo on Monad"**: email/phone login, embedded wallet, sponsored USDC transfers, and pay-by-email. Pregenerate a wallet for the recipient's email with `privy.users().create` and they claim by logging in. Add Mercuryo on-ramp and Zerion activity feed to stack bounties.
2. **Per-second subscriptions with session signers**: the user signs once to add a policy-scoped signer (only the `SubscriptionManager` or Sablier Flow contract, with a max amount). The server tops up or settles streams while the user is offline. The user can revoke by removing the signer.
3. **Group wallet / settle-up**: each friend has a Privy wallet, and a shared `SplitVault` contract lets a backend server wallet net debts and settle in one sponsored batch. Pairs with the Consumer track "shared wallets" idea.
4. **Agent wallet with guardrails**: an AI agent holds a Privy server wallet under policies (allowlisted contracts plus a daily cap) and pays APIs through x402 on Monad. Also a candidate for the Trust/AI track.

## Gotchas
- **Monad bills the gas *limit*, not gas used.** Keep gas estimates tight. Privy fills gas for you, so pass explicit `gas` for simple transfers if costs look inflated.
- **EIP-7702 reserve rule on Monad.** Privy's native sponsorship upgrades the EOA through 7702. On Monad, a delegated EOA **cannot let its MON balance dip below 10 MON** in a transaction (it reverts). Sponsored USDC-only flows are fine because the MON balance doesn't change. Avoid designs where a sponsored/delegated wallet sends out MON while holding under 10 MON. Delegated code also cannot `CREATE`/`CREATE2`.
- `defaultChain` must also appear in `supportedChains`, and an empty `supportedChains` array throws.
- Native sponsorship needs TEE execution mode (older apps must migrate).
- x402 with sponsored wallets needs `signatureOptions: {type:'erc1271'}`.
- Privy's default RPCs are rate-limited. Use `addRpcUrlOverrideToChain(monad, RPC)` from `@privy-io/chains` with your QuickNode/Alchemy/Dwellir URL (participants get free RPC plans).
- `eth_sendTransaction` over the server API returns once the tx is broadcast, not confirmed. Poll the receipt, remembering that Monad has no global mempool.

## Sources
- https://docs.privy.io/llms.txt · https://docs.privy.io/basics/react/setup · https://docs.privy.io/basics/react/quickstart
- https://docs.privy.io/basics/react/advanced/configuring-evm-networks
- https://docs.privy.io/basics/nodeJS/quickstart · https://docs.privy.io/wallets/using-wallets/ethereum/send-a-transaction
- https://docs.privy.io/wallets/gas-and-asset-management/gas/overview (Monad listed) · …/gas/setup
- https://docs.privy.io/wallets/using-wallets/signers/quickstart · https://docs.privy.io/controls/policies/create-a-policy
- https://docs.privy.io/recipes/agent-integrations/x402 · https://docs.privy.io/wallets/overview/solutions/agent-wallets
- https://www.privy.io/pricing
- https://docs.monad.xyz/tooling-and-infra/wallet-infra/embedded-wallets · https://docs.monad.xyz/templates/next-serwist-privy-smart-wallet
- https://docs.monad.xyz/developer-essentials/eip-7702

# Wallets, Auth, Onboarding, On-ramps & Payments — Sponsor Index

> ⚠️ **Bounty details here were researched before the portal was captured.** For official bounty requirements, eligible tracks, prize splits and judging criteria, use [prizes-and-bounties.md](../../00-hackathon/prizes-and-bounties.md) and the full texts in `_portal/bounties/`. Where they differ, **the portal wins**. Known corrections: Agora Mobile requires **Mera + AUSD + Perpl** and is **Track 01 only**; Agora Cross-Border requires **Mera + AUSD, mobile**, and is **Track 02 only**; Kuru ×2, Perpl Analytics and MetaMask Agent Wallet are **Track 01 only**; Hunyuan is **Track 03 only**; Cleanverse and Qwen are **Track 04 only** (Qwen credits go to the top 3 Track 4 winners).


Metropolis (1 Sep–13 Oct 2026). Researched 2026-09-28. Monad mainnet is chain `143` (`eip155:143`, RPC `https://rpc.monad.xyz`, explorer monadvision.com). Testnet is `10143` (`eip155:10143`, RPC `https://testnet-rpc.monad.xyz`). Both chains ship in `viem/chains` as `monad` and `monadTestnet`.

## Sponsor table
| Sponsor | Bounty | $ | What to build | Key doc |
|---|---|---|---|---|
| **Privy** | "Privy!" | $5,000 | No-crypto payments app: email/passkey login → embedded wallet → **gas-sponsored USDC on Monad** (`sponsor:true`, Monad listed). Add session signers + policies for autopay/agents | [privy.md](privy.md) · docs.privy.io/llms.txt |
| **Dynamic** (Fireblocks) | Best Use of Dynamic | $5,000 | MPC embedded wallets + 800 connectors. Delegated access/agent wallets for autopay; ZeroDev extension for gasless on Monad (native sponsorship **not** on Monad) | [dynamic.md](dynamic.md) · dynamic.xyz/docs/llms.txt |
| **MetaMask** | Best Agent Wallet Plugin | $2,500 | An **`mm` CLI plugin** (`@metamask/agent-wallet/plugin`) adding a **new trading capability** on Monad (e.g. Kuru limit orders, Sablier streams, a risk guard) | [metamask-agent-wallets.md](metamask-agent-wallets.md) · docs.metamask.io/agent-wallet/plugins |
| **Mercuryo** | Sponsored prize (credits + integration support) | $10,000 | Card top-up via widget, **MON on `MONAD`** (no USDC-on-Monad yet), silent auth, webhooks, recurring DCA, off-ramp | [mercuryo.md](mercuryo.md) · widget.docs.mercuryo.io |
| **Zerion** | Sponsored prize (3-mo Builder plan for winners) + **1-mo Builder free for all** | $6,000 | Zerion as the data layer: $-denominated portfolio, decoded activity feed, PnL, **tx webhooks** (`chain_ids:["monad"]`) | [zerion-api.md](zerion-api.md) · developers.zerion.io |
| **Cleanverse** | Best Integration of CVI/CVA | $2,000 | Value moves only between **CVI (A-Pass)** wallets, in **CVA (aUSDC)**, enforced on-chain via `complianceVerify` + Travel Rule | [cleanverse.md](cleanverse.md) · docs.cleanverse.com (invite code) |
| Monad Foundation (related) | Best Mera-Powered UX · Mera: One Passkey, Many Keys | $2,500 ×2 | Passkey-derived EOAs with `@category-labs/mera` (no seed phrase) | [account-abstraction-on-monad.md](account-abstraction-on-monad.md#passkeys-the-trust-tracks-passkey-native-accounts-using-p256-and-webauthn) |
| Alchemy (related) | Best Projects using Alchemy | $1,000 credits | Account Kit / Gas Manager on Monad | [account-abstraction-on-monad.md](account-abstraction-on-monad.md) |

Cross-cutting: [account-abstraction-on-monad.md](account-abstraction-on-monad.md) (4337/7702/paymasters/passkeys) · [payment-patterns.md](payment-patterns.md) (stablecoin addresses, per-second subscriptions, group settle-up, gasless, x402).

## Which wallet stack to pick
**Default recommendation: Privy.**
- Its native gas sponsorship explicitly supports **Monad and Monad Testnet** with a one-line `sponsor: true`, so you need no bundler or paymaster account.
- It has the strongest server-side story: server wallets, session signers, a policy engine, and x402 built in.
- Official Monad templates use it (`next-serwist-privy-*`), and it is free up to 499 MAU.
- This path targets the Privy $5k and suits the Consumer track's "never mentions a blockchain".

| If you… | Pick |
|---|---|
| Are building a consumer payments/subscription app and want the fastest gasless path on Monad | **Privy** (+ Mercuryo top-up + Zerion feed) |
| Need many external wallets and a hosted modal, or want Fireblocks-grade MPC/server wallets | **Dynamic**. Budget time for ZeroDev (Kernel) because native sponsorship skips Monad. The legacy `<DynamicWidget/>` is fastest; the new JS SDK is headless |
| Are building an AI-agent product | **MetaMask Agent Wallet plugin** (bounty target) and/or **Privy/Dynamic agent/server wallets** + x402 on the Monad facilitator. ERC-7715 (MetaMask Smart Accounts Kit, Monad ✅) for "user grants agent a daily cap" |
| Are going for the Trust track "passkey-native, no seed phrase" | **Mera** (Monad Foundation bounties) as the signer, optionally owning a 4337 account (ZeroDev/MetaMask Hybrid) |
| Need custom batching or paymaster policies with any signer | **Pimlico permissionless.js** or **ZeroDev**, both ✅ on Monad mainnet |

**Don't** integrate Privy and Dynamic in one app. Pick one auth/wallet provider, then stack the non-competing bounties on top: **Mercuryo** (fiat in), **Zerion** (data), **Cleanverse** (compliance), **MetaMask plugin** (separate CLI deliverable), and Sablier/x402 (rails).

### A bounty-stacking blueprint (Consumer track)
"Pay anyone by email, subscriptions by the second":
- Privy email login with an embedded wallet.
- Mercuryo card top-up (MON → auto-swap to USDC).
- Sponsored USDC sends, with a Privy-pregenerated wallet for recipients who haven't signed up.
- Per-second subscriptions via Sablier Flow (`0x9500…68d1`), with auto top-up through a Privy session signer under a policy.
- A Zerion webhook-driven activity feed.
- Optional: an `mm` plugin so an AI agent can manage the same streams from the CLI (MetaMask bounty).

## Top Monad gotchas (read before coding)
1. **Gas is charged on the gas *limit*.** Keep estimates tight, and pass explicit `gas` for simple transfers.
2. **EIP-7702 reserve rule**: a delegated EOA's tx reverts if it lowers MON below **10 MON**. Privy sponsorship and the MetaMask relay use 7702, so keep users on USDC with sponsored gas. Delegated code can't `CREATE/CREATE2`.
3. **No global mempool.** RPC acceptance is not inclusion. Poll receipts, and wait k=3 blocks before spending freshly received MON.
4. **USDC EIP-712 domain name is `"USDC"`**, version `"2"`. Use `@x402/evm ≥ 2.22.0` for Monad.
5. **Coverage gaps**: Dynamic native sponsorship lacks Monad, Mercuryo has no USDC on Monad, Privy "user pays gas in USDC" isn't on Monad, and Zerion x402 settles on Base/Solana only.
6. Start access requests now: **Cleanverse docs invite code**, **Mercuryo sandbox + Sdk-Partner-Token**, **Privy testnet subsidy (`monad@privy.io`)**, and **Zerion free Builder month**.

## Unverified items flagged in files
- The exact MetaMask `walletExecutor` call shape (taken from published SDK types, not docs).
- Cleanverse endpoints and addresses (from a third-party hackathon repo; docs are gated).
- Privy Node `authorization_context` placement on `sendTransaction`.
- Pimlico ERC-20 paymaster on Monad.
- Sablier Flow testnet address.
- Exact judging criteria for the Privy and Dynamic bounties (only titles are public).

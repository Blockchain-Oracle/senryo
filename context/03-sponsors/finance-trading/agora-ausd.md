# Agora — AUSD stablecoin

Bounties (largest in this area): **$10,000 "Best Mobile Trading App on Monad"** and **$10,000 "Best Cross-Border Payments App on Monad"** (agora.finance). Mentors: Nick van Eck (CEO), Drake Evans (CTO). Detailed rubric is not public; it is behind login at hackathon.monad.xyz (unverified). Assume **AUSD must be the dollar in the app**.

## Overview
- **AUSD (Agora Dollar)**: fully reserved USD stablecoin (cash, short-term Treasuries, overnight repo), monthly attestations, 1:1 mint/redeem with no fees for Agora customers. One address on every EVM chain.
- On Monad it's a core dollar: collateral on **Perpl**, quote asset on **Kuru** (MON-AUSD market), feeds on **Chainlink** (AUSD/USD, EarnAUSD/AUSD, sAUSD/AUSD) and **Pyth** (AUSD_USD). Agora's Monad AUSD supply was $100M+ soon after launch; its marketing shows "Monad · settled in 1.9s".
- Agora products: AUSD token, **Stablecoin/Public API** (mint/redeem routes, accounts, transactions, metrics), **Instant Settlement** (fixed-price, KYC-whitelisted AUSD⇄USDC swap, Uniswap-v2 interface), **Whitelabel stablecoins** (ERC-4626 vault over AUSD: "your own branded USD").

## How it works (token)
- ERC-20, 6 decimals, upgradeable, RBAC (Admin, Pauser, Freezer, Minter, Burner), freezing for compliance.
- Supports **EIP-712, ERC-1271, ERC-2612 `permit`, ERC-3009 `transferWithAuthorization`/`receiveWithAuthorization`** → gasless, signature-based payments (relayer or x402 pays gas). This is the key primitive for payments UX.
- Bridge contract `0x9CaB7Ede13dc56652E44D2404E969C212f22689b` on Monad/Ethereum/Base/Avalanche/Katana (bridge mechanism not documented in scraped pages; unverified).

## Addresses
| | Address |
|---|---|
| AUSD Monad mainnet (143) | `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` |
| AUSD Monad testnet (10143) | `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` |
| AUSD testnet faucet (Monad testnet, same on other testnets) | `0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C` — `requestFunds(address)` (Sepolia example mints 10,000 AUSD) |
| AUSD bridge (Monad) | `0x9CaB7Ede13dc56652E44D2404E969C212f22689b` |
| Instant Settlement Factory (Monad main & test) | `0x8468587Af422ad440F58a57E955eCA6A970b5375` |
| Instant Settlement AUSD/USDC pair (Monad mainnet) | `0xf33286E3222D1c829dACeac48c0Ec651F6452470` |
| Instant Settlement CTK/AUSD pair (Monad testnet) | `0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae`; Whitelister `0x7c10F56d6f04a51376393a1C3670e966863F6BD5` |
| Chainlink AUSD/USD (Monad) | `0xE20751C7B5867bCBef815ffc1b284c3f412a9e13` (8 dec) |
| Pyth AUSD/USD feed id | `0xd9912df360b5b7f21a122f15bdd5e27f62ce5e72bd316c291f7c86620e07fb2a` |
| Kuru MON-AUSD market | `0x131a2e70a5b31a517a74b8c567149bc294470da9` |
Also Chainlink exchange-rate feeds on Monad for `EarnAUSD/AUSD` and `sAUSD/AUSD` (yield-bearing AUSD variants exist on Monad; issuer/contract addresses not verified here).

## SDK / API quickstart
No dedicated npm SDK — AUSD is a plain ERC-20; use viem/ethers. Docs MCP server: `https://docs.agora.finance/_mcp/server`.

### Gasless AUSD transfer (ERC-3009) with viem
```ts
import { createWalletClient, http, parseUnits, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monad } from "viem/chains"; // or defineChain({ id: 143, rpcUrls: { default: { http: ["https://rpc.monad.xyz"] } }, ... })
const AUSD = "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a";
const sender = privateKeyToAccount(process.env.PK as `0x${string}`);
const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)));
const msg = { from: sender.address, to: "0xRecipient", value: parseUnits("25", 6),
  validAfter: 0n, validBefore: BigInt(Math.floor(Date.now()/1000) + 600), nonce };
const signature = await sender.signTypedData({
  domain: { name: "<read AUSD name()>", version: "<read eip712Domain()>", chainId: 143, verifyingContract: AUSD },
  types: { TransferWithAuthorization: [
    { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" }] },
  primaryType: "TransferWithAuthorization", message: msg });
// relayer submits: AUSD.transferWithAuthorization(from,to,value,validAfter,validBefore,nonce,v,r,s | signature)
```
Read the EIP-712 domain onchain (`eip712Domain()` per ERC-5267, or `name()` + `DOMAIN_SEPARATOR()`) — exact domain name/version not in docs (unverified). Check which `transferWithAuthorization` overload (v,r,s vs bytes signature) the ABI exposes.

### Agora Public API (`https://api.agora.finance`)
```bash
curl https://api.agora.finance/v0/metrics                  # public: aggregate + per-chain AUSD supply
curl https://api.agora.finance/v0/metrics/total-supply
curl https://api.agora.finance/v0/metrics/circulating-supply
# authenticated (org API key from app.agora.finance, Owner/Admin only):
curl -X POST https://api.agora.finance/v0/auth/token -H "Authorization: Bearer $AGORA_API_KEY"   # -> { sessionJwt } (15 min)
curl https://api.agora.finance/v0/accounts     -H "Authorization: Bearer $JWT"   # bank accounts + wallets
curl https://api.agora.finance/v0/routes       -H "Authorization: Bearer $JWT"   # mint/redeem routes (fiat<->AUSD, stable<->AUSD)
curl https://api.agora.finance/v0/transactions -H "Authorization: Bearer $JWT"
```
OpenAPI: `https://api.agora.finance/v0/openapi.json`. Amounts are decimal **strings**. Filters: `?network=base,arbitrum`, `createdAt.gte=...`. Hackathon teams realistically only get the public metrics (org onboarding/KYC required for routes — unverified whether Agora grants sandbox access; ask mentors).

### Instant Settlement (AUSD⇄USDC at fixed price; whitelisted/KYC only)
Uniswap-v2-style pair: `getAmountsOut(amountIn, path)`, `swapExactTokensForTokens`, `swapTokensForExactTokens`, `getReserves`-like reserve/fee/price reads. Guides: quick-start (viem), fetching-all-pairs/reserves/fees/price. Non-whitelisted wallets revert → for a public app, use Kuru/Uniswap/Curve for AUSD liquidity and mention Instant Settlement as the institutional off-ramp.

## Bounty & ideas
Judging angle (inferred): real consumer UX on mobile (not a desktop dApp in a WebView), AUSD as the unit of account, Monad speed made visible (sub-second settlement), compliance-aware flows for payments, and credible go-to-market for Agora's B2B/fintech customers.

**Mobile trading app ($10K)**
1. **AUSD perps + spot pocket terminal**: Expo/React Native + Privy/Dynamic embedded wallet; spot via Kuru (MON-AUSD book, Kuru Flow quotes), perps via Perpl WS API with builder code; AUSD balance as "cash"; haptic one-tap trades; push notifications for liquidation distance. Triple-dips Kuru #1 + Perpl API.
2. **"Stocks-app UX" for onchain assets**: watchlists, price alerts that become Kuru limit orders, recurring AUSD buys (DCA) executed by a Chainlink CRE cron workflow.
3. **Smart-money mirror app**: Nansen smart-money netflows on Monad → swipe-to-follow trades settled in AUSD.

**Cross-border payments ($10K)**
1. **Remittance app with any-chain on-ramp**: sender funds from any chain/asset via Aurora Intents deposit address → lands as USDC on Monad → swapped to AUSD → recipient gets AUSD by phone/email (embedded wallet) → cash-out partner stub; ERC-3009 gasless claims. Also Aurora bounty.
2. **B2B invoice & payroll rails**: invoice links payable in AUSD, gasless `transferWithAuthorization` batch payroll, FX display via Chainlink EUR/GBP/JPY/USD feeds on Monad, receipt NFTs/attestations; CRE workflow reconciles against an HTTP accounting API.
3. **Merchant QR + x402 checkout**: AUSD pay-per-request/merchant QR using canonical x402 contracts on Monad (`x402ExactPermit2Proxy 0x402085c248EeA27D92E8b30b2C58ed07f9E20001`, `ERC3009DepositCollector 0x4020806089470a89826cB9fB1f4059150b550004` — from monad-crypto/protocols CANONICAL) with instant settlement proof on Monad.

## Gotchas
- 6 decimals (not 18). API amounts are decimal strings.
- Mainnet and testnet addresses differ (`0x0000…9012a` vs `0xa901…22dC`).
- Instant Settlement and mint/redeem require KYC/whitelisting; don't build a demo that depends on it without confirming access.
- Aurora/NEAR Intents supported-token list on Monad currently shows MON, USDC, USDT0 only (no AUSD) → route in as USDC then swap to AUSD on Monad.
- AUSD has freeze/pause roles; handle transfer reverts gracefully in payment UX.

## Sources
- https://docs.agora.finance/llms.txt , /developer/contract-deployments.md , /contract-overview.md , /developer/advanced-erc-features.md
- https://docs.agora.finance/api.md , /api/authentication.md , https://api.agora.finance/v0/openapi.json
- https://docs.agora.finance/instant-settlement.md , /instant-settlement/protocol-deployments.md , /instant-settlement/guides/getting-testnet-tokens.md
- https://www.agora.finance/ ; https://github.com/monad-crypto/protocols (agora.jsonc, CANONICAL.jsonc)
- https://reference-data-directory.vercel.app/feeds-monad-mainnet.json (Chainlink AUSD feeds)

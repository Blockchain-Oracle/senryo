# Aurora Intents — any-chain liquidity into Monad (NEAR Intents based)

Bounty: **$5,000 "Bring Any-Chain Liquidity to Monad"** (intents.aurora.dev). Aurora's X post (2026-09-02): "Build the best integration of **Swap API, Intents Deposits, or Intents Connect** into your Monad app… $5K, split across 3 winners. Every winner also gets marketing support, 1:1 builder support, BD warm intros, and a livestream feature."
Mentor+judges: Armand Didier (Head of Product), Chris Gutkowski (Head of Delivery). Workshop recording: "Swap, fund, and execute into Monad from any chain. One integration, no bridge screen. This is Intents Connect in action" (x.com/auroraisnear/status/2097731867252552093, demo at 1:46:00).

## Overview
Aurora Intents = cross-chain execution layer on top of **NEAR Intents** (solver network + Verifier contract on NEAR; Omni/HOT bridges; MPC Chain Signatures). Three products, all list **Monad as source AND destination**:
| Product | What it does | Integration |
|---|---|---|
| **Swap API / Swap Widget** | any-chain → any-chain swap via quote → deposit address → auto-settle | REST `https://intents-api.aurora.dev` or iframe/React widget from Studio |
| **Intents Deposits** | persistent (reusable, no TTL) deposit addresses per user; user sends any asset on any chain, app receives target asset on Monad | widget or same Swap API; persistent-address API |
| **Intents Connect** (beta) | user signs ONE intent on origin chain; funds bridge to an **intermediary account** on the destination (owned by the origin wallet via NEAR Chain Signatures MPC) which then executes your contract calls ("recipe") | `@aurora-is-near/intents-connect` SDK / REST |

Source chains include BTC, SOL, TRON, TON, ZEC, NEAR, Sui, Stellar, all major EVMs. Supported Monad assets today (live from `GET /api/tokens/{key}`):
| Symbol | assetId | Monad contract |
|---|---|---|
| MON | `nep245:v2_1.omni.hot.tg:143_11111111111111111111` | native |
| USDC | `nep245:v2_1.omni.hot.tg:143_2dmLwYWkCQKyTjeUPAsGJuiVLbFx` | `0x754704bc059f8c67012fed69bc8a327a5aafb603` |
| USDT0 | `nep245:v2_1.omni.hot.tg:143_4EJiJxSALvGoTZbnc8K7Ft9533et` | `0xe7cd86e13ac4309349f30b3435a9d337750fc82d` |
(No AUSD — swap USDC→AUSD on Monad in a Connect recipe step or after arrival.) NEAR Intents treasury on Monad: `0x233c5370ccfb3cd7409d9a3fb98ab94de94cb4cd` (registry).

Fees: API key from **Intents Studio** (https://studio.aurora.dev) — key is non-confidential (usable client-side for Swap/Deposits). Integrator fee 0–100 bps; split 60% integrator / 40% Aurora, Aurora min 2 bps. CSV reports in Studio.

## Quickstart

### Swap API / Intents Deposits (REST)
```bash
KEY=<appKey from studio.aurora.dev>
curl "https://intents-api.aurora.dev/api/tokens/$KEY"          # assetIds (filter blockchain=="monad")
curl -X POST "https://intents-api.aurora.dev/api/quote/$KEY" -H 'content-type: application/json' -d '{
  "dry": false, "swapType": "EXACT_INPUT", "slippageTolerance": 100,
  "originAsset": "nep141:sol-...omft.near",                 # e.g. USDC on Solana (get from /tokens)
  "depositType": "ORIGIN_CHAIN",
  "destinationAsset": "nep245:v2_1.omni.hot.tg:143_2dmLwYWkCQKyTjeUPAsGJuiVLbFx",   # USDC on Monad
  "amount": "25000000", "recipient": "0xYourMonadAddress", "recipientType": "DESTINATION_CHAIN",
  "refundTo": "<origin-chain address>", "refundType": "ORIGIN_CHAIN",
  "deadline": "2026-10-13T00:00:00.000Z" }'
# -> depositAddress (+ memo). User transfers to it; settlement is automatic.
curl "https://intents-api.aurora.dev/api/transactions/$KEY?walletAddress=0x..."   # status/history
```
Other endpoints: submit deposit tx hash, get swap status, ongoing incidents, persistent-address create/status/data, confidential-swaps (auth by signed data). Blockchain enum includes `"monad"`. Same flow as NEAR's **1Click API** (`https://1click.chaindefuser.com/v0/...`, JWT optional; `@defuse-protocol/one-click-sdk-typescript`) if you want to go direct (unverified whether direct 1Click use counts for the Aurora bounty — use Aurora endpoints to be safe).

### Widget
Studio → Swap or Deposit widget mode → pick destination asset (e.g. USDC on Monad) + receiver → "Embed in your app" (iframe link or React snippet). React package lives in github.com/aurora-is-near/intents-swap-widget (components + hooks; custom wallet connection).

### Intents Connect SDK (the strongest bounty fit: "execute into Monad")
```bash
npm install @aurora-is-near/intents-connect @aurora-is-near/intents-connect-wallet
```
```ts
import { createIntentsConnectApi, createExecutionRunner, type Recipe } from "@aurora-is-near/intents-connect";
const USDC_MONAD = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";
// Recipe: what the intermediary does on Monad after funds arrive. amount is opaque ({MIN_AMOUNT_OUT}).
const depositToMyVault: Recipe<{ vault: `0x${string}` }> = {
  id: "monad-vault-deposit", intent: "vault_deposit", title: "Deposit into vault on Monad",
  flow: "bridge-in", type: "evm",
  destination: { chain: "monad" /* chain key: verify via listSupportedTokens */, assetId: "nep245:v2_1.omni.hot.tg:143_2dmLwYWkCQKyTjeUPAsGJuiVLbFx", tokenAddress: USDC_MONAD },
  buildSteps: ({ intermediary, userAddress, amount }, { vault }) => [
    { to: USDC_MONAD, functionSignature: "approve(address,uint256)", parameters: [vault, amount], value: "0" },
    { to: vault, functionSignature: "deposit(uint256,address)", parameters: [amount, userAddress], value: "0" },
  ],
};
const runner = createExecutionRunner({
  api: createIntentsConnectApi({ baseUrl: "https://intents-connect-alpha-api.aurora.dev", apiKeyProxyUrl: "/api/intents-connect" }),
  wallet: connector,            // WalletConnector from intents-connect-wallet (EVM/Solana/NEAR/Stellar)
  onEvent: (e) => console.log(e),
});
const preview = await runner.preview({ recipe: depositToMyVault, params: { vault: "0x..." }, quote, originChain: "sol", originToken, depositViaWallet: true });
const exec = await runner.run(preview.plan);   // sign -> deposit -> bridge -> steps -> SUCCESS
```
- Steps: exactly `{to, functionSignature, parameters, value, metadata?}`; max 30 EVM steps; at least one step must touch `destination.tokenAddress` (fee is charged in it); no `quote.recipient` on bridge-in — put the final recipient in step params.
- Placeholders `{INTERMEDIARY}`, `{MIN_AMOUNT_OUT}`, `{AMOUNT_IN}`, `{DEPOSIT_ADDRESS}`. Fee strategy `placeholder` (EVM default) or `threeRound`.
- `flow: "steps-only"` = act on funds already in the intermediary (sell/withdraw back out). Runner: `preview/run`, `previewSteps/runSteps`, `resume`, `retryDeposit`, `cancel`. React: `IntentsConnectProvider`, `useExecution`.
- REST: `POST /api/v1/executions/{wallet}` (x-api-key), `/steps`, `/submit`, `/deposit/submit`, `GET /api/v1/executions/{wallet}/intermediary`, `GET /api/v1/supported_tokens`. Keep the key server-side (proxy).
- Signing standards: erc191 (EVM), raw_ed25519 (Solana), nep413 (NEAR), sep53 (Stellar); Tron/TON not yet.
- Examples in docs: Polymarket funding, Hydrex LP mint, Aave supply/withdraw from Solana, Jupiter.

## Bounty & ideas
Judging angle (inferred from post): depth of integration (Connect > Deposits > Swap widget), a real Monad destination action (not just a bridge), one-signature UX from a non-EVM chain, and fee/volume potential for Aurora.
1. **"Trade on Kuru/Perpl from Solana/BTC in one signature"**: Connect recipe = bridge USDC → Monad intermediary → swap to AUSD → `createAccount`/deposit on Perpl or deposit to Kuru MarginAccount + place order. Stacks with Kuru/Perpl bounties.
2. **Any-chain savings/remittance inbox**: persistent Intents Deposit address per user (share like an IBAN); any asset from any chain lands as USDC on Monad, auto-converted to AUSD and credited in a mobile wallet. Stacks with Agora cross-border.
3. **Omnichain vault onboarding kit**: drop-in React component for Monad DeFi (Morpho/Euler/Curvance/Neverland vaults) — recipe templates + UX best practices (status timeline, refunds, resume after reload); open-source it for other Monad teams.

## Gotchas
- Intents Connect is **beta** (alpha API host); expect rough edges — build retries using `resume`.
- Treat `ctx.amount` as opaque; never do arithmetic on it with the default fee strategy.
- Destination fee is taken in the destination token; keep a step touching that token.
- Cross-chain min sizes / liquidity not guaranteed; show dry quote (`dry: true`) before asking for deposit.
- Refund addresses are on the origin chain; set `refundTo` correctly for non-EVM origins.
- Only MON/USDC/USDT0 supported on Monad for now.

## Sources
- https://docs.intents.aurora.dev/llms.txt ; /welcome-to-aurora-intents.md ; /getting-started/api-keys-and-fees.md
- https://docs.intents.aurora.dev/intents-connect/intents-connect-sdk/typescript-sdk.md ; /recipes-and-fees.md ; /supported-chains.md
- https://docs.intents.aurora.dev/intents-deposits/quickstart/api-integration.md ; /intents-swap/widget-integration.md
- https://intents-api.aurora.dev/api/tokens/{key} (live token list) ; https://docs.near-intents.org/llms.txt
- https://github.com/aurora-is-near/intents-swap-widget
- https://x.com/auroraisnear/status/2095134807810613658 ; https://x.com/auroraisnear/status/2097731867252552093

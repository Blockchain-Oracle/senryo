# Aurora Intents: fund our Monad vault from any chain (Swap API, Intents Deposits, Intents Connect)

Researched 2026-09-29. Supersedes `../03-sponsors/finance-trading/aurora-intents.md` for our app. That file is still correct on the basics. This file adds verified hosts, the vault contract design, the Mera signer route and measured latency and fees.

**Sources read in full**
- Every page listed in `https://docs.intents.aurora.dev/llms.txt` (99 pages, fetched as `.md`). Cleaned copies are in the scratchpad `int-aurora/clean/`.
- Source: `references/intents-swap-widget/` (HEAD `357e944`, 2026-09-28). This monorepo contains `packages/intents-connect` (SDK v7.24.2 on npm), `packages/intents-connect-wallet`, `packages/intents-swap-widget` and `apps/intents-connect-demo`. The demo includes an **Aave-on-Monad recipe**.
- Source: `references/one-click-sdk-typescript/` (NEAR 1Click SDK, the upstream API).
- NEAR Intents docs: `https://docs.near-intents.org/resources/fees.md` and `/integration/distribution-channels/1click-api/authentication.md`.
- Live calls (2026-09-29): `GET https://1click.chaindefuser.com/v0/tokens`, `GET https://intents-connect-alpha-api.aurora.dev/api/v1/supported_tokens`, and six dry `POST /v0/quote` calls into Monad USDC.
- Context7 does **not** index Aurora Intents. It only has `/near/intents` (the Verifier contract), which isn't useful here.

Legend: "(unverified)" means my inference or something untested. Everything else is quoted from a cited URL or file, or was measured.

---

## 0. The facts that shape our design

1. **Monad supports exactly 3 assets: MON, USDC and USDT0. There is no AUSD.** I verified this live in both the 1Click token list and the Intents Connect `supported_tokens` (in and out). The vault must accept **USDC** (and optionally USDT0). Any AUSD conversion happens on Monad, inside our contract or a recipe step.
2. **Intents Connect is the only product that can call our vault contract when funds land.** An "intermediary account" on Monad receives the bridged USDC and runs our steps (`approve` → `vault.depositFor(...)`). No callback interface is required: the steps are ordinary calls where `msg.sender` is the intermediary.
3. **Intents Deposits (persistent addresses) can't execute a call yet.** The docs promise a "destination action… encoded at generation time", but the API has no parameter for it, and "Custom Actions" is marked *"Coming soon"*. Route: point the persistent address at a **per-user inbox contract** that anyone can `sweep()` into the vault (§6.2), and ask the Aurora mentor about Custom Actions access.
4. **Mera accounts are plain secp256k1 EOAs** (`mera.md` §0). Intents Connect's EVM signing is `erc191` `personal_sign`. So the user's **Mera account can sign the intent with Face ID**, and the funds can then come by QR from any wallet or exchange (`depositViaWallet: false`). The beneficiary is passed as a recipe param (unverified end to end; see §5.4).
5. **Mainnet only.** The docs have no testnet, and Monad testnet isn't in any token list. Test with `dry: true` quotes (free) and $2–5 real transfers.
6. **Latency (measured, dry quotes into Monad USDC):** Solana 22 s, Arbitrum 27 s, Base 37 s, Ethereum 47 s, **Bitcoin 809 s (about 13.5 min)**. On 5 USDC, the output was 4.988 USDC without an API key. The Monad withdraw fee is 0.000788 USDC.
7. **Getting keys is self-serve** at `https://studio.aurora.dev` (*"Permissionless… API keys are issued immediately"*). The integrator fee is set per key, 0–100 bps, with a **60/40 split in our favour** and an Aurora minimum of 2 bps.
8. **Intents Connect is beta.** The SDK points at `intents-connect-alpha-api.aurora.dev`. The API reference lists `intents-connect-api.aurora.dev`, and both answer. There is **one live execution per wallet per chain** (`EXECUTION_IN_FLIGHT`).

---

## 1. Which product for which flow

| Our flow | Product | Why |
|---|---|---|
| **"Add funds" → collateral credited to the user's vault in one flow, with an optional "open position"** (bounty headline and bonus) | **Intents Connect** (SDK `@aurora-is-near/intents-connect`) | Its steps can call `vault.depositFor` or `vault.depositAndOpen` on Monad. The bounty bonus is *"contract-level composability via Intents Connect"* |
| **"My deposit address": one reusable QR per user and per chain family, usable from a CEX or BTC/Tron/TON/XRP** | **Intents Deposits → Persistent Addresses API** | No wallet connection and no expiry. Covers 35 source chains. Intents Connect has no BTC, Doge or XRP source yet ("Coming soon") |
| A one-off quote-based deposit ("send exactly 0.05 SOL") | **Swap API** (`/api/quote` → `depositAddress`) | This is the same 1Click lifecycle with a single-use address and a deadline |
| Cash out: vault → USDC on another chain | Swap API from Monad (`originAsset` = Monad USDC), or Connect `outOperation` | Optional |

Official guidance (`welcome-to-aurora-intents.md`): *"Need cross-chain deposits / funding flows → Start with Intents Deposits. Want full control over cross-chain execution logic → Explore Intents Connect."*

**Supported chains** (docs `intents-deposits/supported-chains.md` and `intents-connect/supported-chains.md`):
- Deposits and Swap, as source and destination: ADI, Aleo, Aptos, Arbitrum, Aurora, Avalanche, Base, Bera, BSC, Bitcoin, Bitcoin Cash, Cardano, Dash, Dogecoin, Ethereum, Gnosis, Hyperliquid, Litecoin, **Monad**, NEAR, Optimism, Plasma, Polygon, Robinhood, Scroll, Solana, Starknet, Stellar, Sui, TON, Tron, XLayer, XRP, Zcash.
- Intents Connect **sources**: ADI, Aleo, Aptos, Arbitrum, Aurora, Avalanche, Base, Bera, BSC, Ethereum, Gnosis, **Monad**, NEAR, Optimism, Plasma, Polygon, Robinhood, Scroll, Solana, Stellar, TON, Tron, XLayer. Coming soon: BTC, BCH, Cardano, Dash, Doge, Hyperliquid, LTC, Starknet, Sui, XRP, Zcash.
- Intents Connect **destinations** include **Monad**, the EVM chains, Solana and Sui.
- The SDK can't sign for TON or Tron yet: *"TON (`ton_connect`) and Tron (`tip191`) wallets are not supported yet"* (`intents-connect-sdk.md`). The raw API lists `tip191` and `ton_connect` as standards.

**Monad asset IDs** (live, 2026-09-29, `1click.chaindefuser.com/v0/tokens` and Connect `supported_tokens`):

| Symbol | assetId | Contract | Decimals |
|---|---|---|---|
| MON | `nep245:v2_1.omni.hot.tg:143_11111111111111111111` | native | 18 |
| USDC | `nep245:v2_1.omni.hot.tg:143_2dmLwYWkCQKyTjeUPAsGJuiVLbFx` | `0x754704bc059f8c67012fed69bc8a327a5aafb603` | 6 |
| USDT0 | `nep245:v2_1.omni.hot.tg:143_4EJiJxSALvGoTZbnc8K7Ft9533et` | `0xe7cd86e13ac4309349f30b3435a9d337750fc82d` | 6 |

The demo notes: *"Monad uses HOT's nep245 identifiers, not the nep141 scheme used on Base"* (`apps/intents-connect-demo/src/aave/constants.ts`). Monad chain key: `monad`, chain id `143` (`packages/intents-connect/src/chains.ts`).

---

## 2. Endpoints and auth (exhaustive, from the docs' OpenAPI blocks)

### 2.1 Swap API and Intents Deposits: `https://intents-api.aurora.dev`
Auth: the **API key sits in the path** (`{apiKey}`). OpenAPI `security: []`. *"The API key is not confidential, allowing its use in public-facing services such as websites"* (`getting-started/api-keys-and-fees.md`). Requests are *"rate limited per API key"* (429).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/tokens/{apiKey}` | `{ tokens[], asset_stats[] }` with assetId, decimals, blockchain, symbol, price and contractAddress |
| POST | `/api/quote/{apiKey}` | Quote. With `dry:false` it returns `quote.depositAddress` (+ `depositMemo`) |
| POST | `/api/deposit/submit/{apiKey}` | Optional: `{ txHash, depositAddress, memo?, nearSenderAccount? }`. *"can speed up swap processing"* |
| GET | `/api/status/{apiKey}?depositAddress=…&depositMemo=…` | Status of one swap |
| GET | `/api/transactions/{apiKey}?walletAddress=…&numberOfTransactions=…` | History (cursor: `lastDepositAddress`, `direction`) |
| GET | `/api/incidents/{apiKey}` | Ongoing incidents by chain and asset. Show a banner |
| POST | `/api/persistent-deposit-address/{apiKey}` | Create or fetch a persistent address |
| GET | `/api/persistent-deposit-status/{apiKey}?type=received\|success\|failed&address=…` | Deposits for a persistent address |
| GET | `/api/persistent-deposit-addresses/{apiKey}?sender=…&recipient=…` | List addresses (paginated) |
| GET | `/api/persistent-deposit-address-data/{apiKey}?address=…` | One address record |
| — | Confidential swaps API | Auth by signed data. Out of scope |

The widget source also contains `staging: 'https://staging-intents-api.aurora.dev'` (`packages/intents-swap-widget/src/network.ts`). The docs don't mention it (unverified, don't rely on it).

### 2.2 Intents Connect
- **Base URL:** the SDK docs say *"The SDK talks to `https://intents-connect-alpha-api.aurora.dev`"*. The demo uses this (`apps/intents-connect-demo/src/shared/config.ts`). The API reference `servers` field says `https://intents-connect-api.aurora.dev`, and both returned 200 on `supported_tokens` today. **Use the alpha host with the SDK**, as Aurora's own demo does. Ask the mentor which host counts as production.
- **Auth:** the `x-api-key` header (*"API key generated at https://studio.aurora.dev"*), sent **only on the create calls**. The docs say: *"Keep the API key off the client. In browsers, pass `apiKeyProxyUrl`… your server adds the `x-api-key` header."* The async-operations guide says `/steps` *"does **not** require `x-api-key`"*, but the SDK sends it anyway. Harmless.
- The API-usage page also says *"Get access: Start using the API or contact the team"*. Same Studio key (unverified). Route: create the key in Studio, try one `dry:true` create, and ping the mentor if you get a 401.

| SDK method | HTTP | Key |
|---|---|---|
| `getIntermediary(wallet)` | `GET /api/v1/executions/{wallet}/intermediary` → `{result:{evm, solana, originAccount, originType}}` | |
| `createExecution(wallet, body)` | `POST /api/v1/executions/{wallet}` (dry → 200 quote, real → 201 + signing payload) | yes |
| `createStepsExecution` | `POST /api/v1/executions/{wallet}/steps` (no bridge, spends intermediary funds) | (see above) |
| `submitSignature` | `POST /api/v1/executions/{wallet}/submit` `{executionId, signature, publicKey?}` | |
| `recordDeposit` | `POST /api/v1/executions/deposit/submit` `{depositAddress, txHash, memo?}` | |
| `listExecutions` | `GET /api/v1/executions/{wallet}?id=…&status=…` | |
| `deleteExecution` | `DELETE /api/v1/executions/{wallet}/{id}` (signed `delete_execution:{id}`) | |
| `listSupportedTokens` | `GET /api/v1/supported_tokens?flow=inOperation\|outOperation` | |

**Execution limits** (from the Request-an-execution description): max **30 EVM steps**, body ≤ 256 KB, `functionSignature` ≤ 1024 bytes with ≤ 6 levels of tuple nesting. Step objects accept **only** `to, functionSignature, parameters, value, metadata`. Any other key returns 400 (`ILLEGAL_STEP_SHAPE`).

**Signing format** (`developer-guides/submit-signing.md`): for `erc191`, *"sign `payload.payload_json` verbatim as a string… Do not pre-hash"* using `personal_sign`. The signature is sent as `secp256k1:` + bs58(`r‖s‖v0/1`). The SDK does this for you.

### 2.3 Upstream: NEAR 1Click (for reference only)
`https://1click.chaindefuser.com/v0/{tokens,quote,status,deposit/submit}`. Auth is a JWT in `X-API-Key` from `partners.near-intents.org`. Without a key, NEAR docs say an *"Additional 0.25% (25 bps)"* applies. **For the bounty, call the Aurora endpoints** (`intents-api.aurora.dev`), which are keyed to our Studio key and get the 60/40 split. Using 1Click directly probably wouldn't count as "Aurora Intents" (unverified).

---

## 3. Lifecycle: quote → deposit address → status

### 3.1 Swap API (single-use address)
Request fields (required: `dry, swapType, depositType, amount, originAsset, destinationAsset, slippageTolerance, refundTo, refundType, recipient, recipientType`):
- `swapType`: `EXACT_INPUT | EXACT_OUTPUT | FLEX_INPUT | ANY_INPUT`. For EXACT_INPUT: *"If deposit is less than `amountIn`, the deposit is refunded by deadline. If deposit is above… the excess is refunded to refundTo"*. **Use `FLEX_INPUT` for "send any amount" QR flows**: *"Any amount higher than `minAmountIn` is accepted and converted… as long as `minAmountOut` is met."*
- `depositType: ORIGIN_CHAIN` (address on the source chain). `recipientType: DESTINATION_CHAIN` (a Monad 0x address). `refundType: ORIGIN_CHAIN` with `refundTo` = the user's source-chain address. `deadline`: ISO. *"If omitted, a default deadline is applied."*
- The response `quote` includes `depositAddress, depositMemo?, amountIn, amountOut, minAmountOut, minAmountIn, maxAmountIn, timeEstimate (s), deadline, timeWhenInactive, refundFee, withdrawFee`.
- `dry: true` → *"the response will NOT contain… `depositAddress`, `timeWhenInactive`, `deadline`"*. Use it for the preview screen.

Statuses (`/api/status`): `PENDING_DEPOSIT → KNOWN_DEPOSIT_TX → PROCESSING → SUCCESS`. Failure paths: `INCOMPLETE_DEPOSIT` (*"below the required amount"*), `REFUNDED`, `FAILED`. The success payload carries `swapDetails.destinationChainTxHashes[{hash, explorerUrl}]`, `amountOut`, `refundedAmount`, `refundReason` and `depositedAmount`.

### 3.2 Persistent addresses (Intents Deposits)
`POST /api/persistent-deposit-address/{apiKey}` with body `{ recipient, sender, depositChain, destinationChain, destinationAsset, confidential? }`.
- *"The same address is returned for repeat calls with the same API key + recipient + sender + depositChain + destinationChain/destinationAsset + confidential, so users can safely save it externally."*
- *"**EVM chains share one address.** … generate the deposit address **once** using any EVM chain as `depositChain`"* (the special value `"evm"` resolves to Base).
- `sender` = *"Identifier of the user… (e.g. their ID in the system)"*. Use our user id or the Mera address.
- `destinationAsset` accepts `"USDC"` with `destinationChain: "monad"`, or the asset ID. Use the asset ID (§1 table).
- The response is `{ depositAddress, alreadyExists, memo? (Stellar only), correlationId? }`.
- Status: `GET /api/persistent-deposit-status/{apiKey}?type=received|success|failed&address=…`. `received` = *"deposits that reached the Intents account"*; `success` = *"completed outbound withdrawals to the recipient"*. There are no webhooks (*"Webhooks (coming soon)"*), so poll or index Monad `Transfer` events with Envio.
- Fees on persistent addresses: *"The fees actually applied to each swap come from `/api/persistent-deposit-fees`, which 1Click calls per swap"*. The key's fee rules apply automatically.

### 3.3 Intents Connect execution
Server statuses (`deep-dive/execution-lifecycle.md`): `CREATED → DEPOSIT_PENDING → DEPOSIT_PROCESSING → OPERATION_PENDING → OPERATION_PROCESSING → SUCCESS`. Terminal failures: `EXPIRED`, `DEPOSIT_FAILED`, `OPERATION_FAILED`.

SDK phases: `resolving-identity → planning → creating → awaiting-signature → submitting → awaiting-deposit → settling → success|failed|expired|cancelled`. *"The user always **signs before depositing**, so a deposit address can't be shown too early."* *"`expired` is not [terminal]: a late deposit revives the execution."* The poll budget is about 12 min (`DEFAULT_POLL_INTERVAL_MS = 3_000`, `DEFAULT_MAX_POLL_ATTEMPTS = 240` in `runner/constants.ts`). After that, `ExecutionPollTimeoutError` → `resume(executionId)`.

---

## 4. Refund and failure handling (a judged criterion: *"correct settlement/refund handling"*)

| Case | What happens | What we build |
|---|---|---|
| Swap or persistent: deposit below minimum or past the deadline | `INCOMPLETE_DEPOSIT` → refunded to `refundTo` on the origin chain, minus `refundFee` | Show `refundFee` in the preview. Measured: Base 0.0024 USDC, Arbitrum 0.0053, Ethereum 0.30, Solana 0.32 USDC. Surface `refundReason` and `refundedAmount` |
| Swap fails | `REFUNDED` / `FAILED` | Timeline state, plus a support link to `https://aurora.dev/intents-support` with the deposit address and tx hash (`handling-support-cases.md`) |
| Connect: deposit window passed | `EXPIRED`. *"Transferred funds will be refunded."* A late deposit revives it | Keep polling and show "Waiting (late deposits still count)". The refund target isn't documented; it is probably the origin wallet (unverified) |
| Connect: `DEPOSIT_FAILED` | *"Transferred funds will be refunded."* | Same as above |
| **Connect: `OPERATION_FAILED`** (e.g. our vault reverts) | *"assets end up in intermediary accounts, requiring a retry or withdrawal"*. The USDC sits in the intermediary, still controlled by the signer | Offer **Retry deposit** as a `steps-only` run of the same steps with a literal amount (the intermediary's USDC balance minus the fee, using `feeFromAmount: true`), or **Withdraw** via `outOperation`. Read the balance with `USDC.balanceOf(intermediary)` |
| User rejected the signature | The runner auto-cancels (`autoCancelOnSignatureRejection`) | Show "Cancelled" |
| Wallet transfer rejected | `DepositTransferError`. The runner stays in `awaiting-deposit` | `runner.retryDeposit()` |
| App killed mid-flow | Save `executionId` on the `created` event | `runner.resume(id)` on app start |
| Another flow already in progress | `EXECUTION_IN_FLIGHT` with `meta.executionId` | `deriveExecutionRecovery(err)` → resume or cancel |

Design rule for the vault: **never revert on amount**. Accept whatever `{MIN_AMOUNT_OUT}` delivers. Revert only on real invariant violations, so `OPERATION_FAILED` stays rare.

---

## 5. Intents Connect: how a deposit triggers our vault on Monad

### 5.1 Mechanism
1. The user's **origin wallet** signs a typed intent covering chains, asset, amount, steps, max fee, expiry and nonce (`security-and-trust-model.md`).
2. The funds are sent to a deposit address. NEAR Intents swaps and bridges them, then delivers USDC to the user's **intermediary account on Monad**. This is an EVM address derived deterministically from the origin wallet and *"fully controlled by the user's origin/source wallet"* via NEAR Chain Signatures MPC (`deep-dive/intermediary-accounts.md`).
3. Aurora's relayer submits our steps from the intermediary and **pays Monad gas** (*"Intents Connect handles destination-chain gas"*). The service *"simulates destination transactions before broadcast"*.
4. The service appends a final **network-fee transfer in the destination token** (gas reimbursement), so *"at least one step must call `destination.tokenAddress`"*. Our `approve` satisfies that.

### 5.2 What our vault must implement
- **No special interface and no callback.** Steps are plain calls from `msg.sender = intermediary`. Any ABI works: the service ABI-encodes `functionSignature` + `parameters`, and tuples are supported as nested arrays (Polymarket's `exactInputSingle((…))`).
- **A beneficiary parameter:** `depositFor(token, amount, beneficiary)`. `msg.sender` is the intermediary, not the user's Mera account. Don't key balances on `msg.sender`.
- **Pull with `transferFrom`** after the recipe's `approve`, and credit the actual received delta. Use the recipe's exact-amount approve; the docs stress *"exact-amount approvals"*.
- **Token allowlist:** USDC (and USDT0).
- **Treat the amount as opaque.** Under the default fee strategy it is the literal `{MIN_AMOUNT_OUT}`, which the service fills with *"the guaranteed amount delivered to the intermediary, after the fee"*. No arithmetic on it in the recipe.
- **Opening a position in the same flow needs the user's consent on Monad.** The intermediary is controlled by the *origin* wallet, which may not be the Mera account, so the vault must not let an arbitrary caller open positions for `beneficiary`. Pattern: the user signs an EIP-712 `OpenOrder` with their **Mera EOA** in-app (Face ID, off-chain, no gas). The recipe passes it as a step parameter, and the vault checks `ecrecover == beneficiary`, nonce and deadline. Pass the signature as `(uint8 v, bytes32 r, bytes32 s)`: the examples only prove `address/uint/tuple` params, and support for `bytes` is **(unverified)**.
- Emit `Deposited(payer=intermediary, beneficiary, token, amount, ref)` for Envio and the UI.
- Reentrancy guard. Stay non-upgradeable for the demo.

### 5.3 Solidity sketch (unverified: our design on documented mechanics, not an Aurora-provided interface)
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// Entry points called by the Intents Connect intermediary (msg.sender) on Monad,
/// and by DepositInbox (persistent-address path).
contract CollateralVault is ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    IERC20 public constant USDC  = IERC20(0x754704Bc059F8C67012fEd69BC8A327a5aafb603);
    IERC20 public constant USDT0 = IERC20(0xe7cD86e13AC4309349F30B3435a9d337750fC82D);

    mapping(address => uint256) public collateral;      // 6-decimals USD
    mapping(address => uint256) public nonces;

    struct OpenOrder {            // signed by the beneficiary's Mera EOA (EIP-712)
        bytes32 market;           // e.g. keccak256("XAU-USD")
        bool    isLong;
        uint256 maxCollateral;    // cap: min(received, maxCollateral) is posted
        uint256 leverageX100;     // 500 = 5x
        uint256 acceptablePrice;  // slippage bound, 1e18
        uint256 nonce;
        uint256 deadline;
    }
    bytes32 private constant OPEN_ORDER_TYPEHASH = keccak256(
        "OpenOrder(bytes32 market,bool isLong,uint256 maxCollateral,uint256 leverageX100,uint256 acceptablePrice,uint256 nonce,uint256 deadline)"
    );

    event Deposited(address indexed payer, address indexed beneficiary, address token, uint256 amount);
    event PositionOpened(address indexed trader, bytes32 market, bool isLong, uint256 collateral);

    constructor() EIP712("MetropolisVault", "1") {}

    /// Step 2 of the Connect recipe (after USDC.approve(vault, {MIN_AMOUNT_OUT})).
    function depositFor(address token, uint256 amount, address beneficiary)
        external nonReentrant returns (uint256 received)
    {
        received = _pull(token, amount, beneficiary);
    }

    /// Deposit-and-execute: credit, then open a position the user pre-authorised with Face ID.
    function depositAndOpen(
        address token, uint256 amount, address beneficiary,
        OpenOrder calldata o, uint8 v, bytes32 r, bytes32 s
    ) external nonReentrant returns (uint256 received) {
        received = _pull(token, amount, beneficiary);
        // If the order is stale/invalid, keep the deposit (don't revert -> avoids OPERATION_FAILED).
        if (block.timestamp > o.deadline || o.nonce != nonces[beneficiary]) return received;
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            OPEN_ORDER_TYPEHASH, o.market, o.isLong, o.maxCollateral, o.leverageX100,
            o.acceptablePrice, o.nonce, o.deadline)));
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, v, r, s);
        if (err != ECDSA.RecoverError.NoError || signer != beneficiary) return received;
        nonces[beneficiary]++;
        uint256 posted = received < o.maxCollateral ? received : o.maxCollateral;
        _openPosition(beneficiary, o, posted);  // our perp engine; must itself not revert on price -> try/skip
    }

    function _pull(address token, uint256 amount, address beneficiary) internal returns (uint256 received) {
        require(token == address(USDC) || token == address(USDT0), "token");
        require(beneficiary != address(0) && amount > 0, "args");
        uint256 before = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        received = IERC20(token).balanceOf(address(this)) - before;
        collateral[beneficiary] += received; // USDT0 treated 1:1 for the demo (unverified risk choice)
        emit Deposited(msg.sender, beneficiary, token, received);
    }

    function _openPosition(address trader, OpenOrder calldata o, uint256 posted) internal {
        // integrate with the engine; debit collateral[trader] by `posted`
        emit PositionOpened(trader, o.market, o.isLong, posted);
    }
}
```

### 5.4 The recipe (TypeScript, SDK v7.24.2)
Modelled on Aurora's own Monad example `apps/intents-connect-demo/src/aave/constants.ts` and `plan.ts`. **Important:** in the SDK, `ctx.userAddress` is the *origin* wallet address (`runner/stages/planSteps.ts: userAddress: requireAddress()`). For a Solana origin that is a base58 key, so **pass the Monad beneficiary through `params`** (the same pattern as Polymarket, whose docs say: *"never `quote.recipient` on a bridge-in"*).

```ts
// lib/aurora/connect.ts
import {
  createIntentsConnectApi, createExecutionRunner, deriveExecutionRecovery,
  EVM_CHAIN_IDS, type Recipe, type WalletConnector,
} from '@aurora-is-near/intents-connect';

export const MONAD_USDC = '0x754704Bc059F8C67012fEd69BC8A327a5aafb603';
export const MONAD_USDC_ASSET = 'nep245:v2_1.omni.hot.tg:143_2dmLwYWkCQKyTjeUPAsGJuiVLbFx';
export const VAULT = process.env.EXPO_PUBLIC_VAULT as `0x${string}`;

type Params = { beneficiary: `0x${string}` };

export const vaultDepositRecipe: Recipe<Params> = {
  id: 'metropolis-vault-deposit',
  intent: 'vault_deposit',
  title: 'Add collateral to Metropolis',
  flow: 'bridge-in',
  type: 'evm',
  destination: { chain: 'monad', assetId: MONAD_USDC_ASSET, tokenAddress: MONAD_USDC },
  buildSteps: ({ amount }, { beneficiary }) => [
    { to: MONAD_USDC, functionSignature: 'approve(address,uint256)', parameters: [VAULT, amount], value: '0' },
    { to: VAULT, functionSignature: 'depositFor(address,uint256,address)',
      parameters: [MONAD_USDC, amount, beneficiary], value: '0' },
  ],
};

// Deposit-and-open variant: order signed in-app by the Mera EOA (EIP-712) beforehand.
export const vaultDepositAndOpenRecipe: Recipe<Params & { order: string[]; v: string; r: string; s: string }> = {
  ...vaultDepositRecipe,
  id: 'metropolis-vault-deposit-open',
  intent: 'vault_deposit_open',
  title: 'Add collateral and open position',
  buildSteps: ({ amount }, { beneficiary, order, v, r, s }) => [
    { to: MONAD_USDC, functionSignature: 'approve(address,uint256)', parameters: [VAULT, amount], value: '0' },
    { to: VAULT,
      functionSignature:
        'depositAndOpen(address,uint256,address,(bytes32,bool,uint256,uint256,uint256,uint256,uint256),uint8,bytes32,bytes32)',
      parameters: [MONAD_USDC, amount, beneficiary, order, v, r, s], // tuple = nested array
      value: '0' },
  ],
};

export function makeRunner(wallet: WalletConnector, onEvent: (e: unknown) => void) {
  return createExecutionRunner({
    api: createIntentsConnectApi({
      baseUrl: 'https://intents-connect-alpha-api.aurora.dev',
      apiKeyProxyUrl: `${process.env.EXPO_PUBLIC_API}/aurora-connect/`, // our server adds x-api-key
    }),
    wallet,
    onEvent,
  });
}

export async function fundVault(opts: {
  runner: ReturnType<typeof makeRunner>;
  beneficiary: `0x${string}`;                         // user's Mera address on Monad
  origin: { assetId: string; blockchain: string; contractAddress?: string; decimals: number };
  amountAtomic: string;
  depositViaWallet: boolean;                          // false = show QR/address
}) {
  const plan = {
    recipe: vaultDepositRecipe,
    params: { beneficiary: opts.beneficiary },
    quote: {
      originAsset: opts.origin.assetId,
      destinationAsset: MONAD_USDC_ASSET,
      amount: opts.amountAtomic,
      swapType: 'EXACT_INPUT' as const,
      slippageTolerance: 100,
      deadline: new Date(Date.now() + 15 * 60_000).toISOString(),
    },
    originChain: opts.origin.blockchain,
    originToken: { contractAddress: opts.origin.contractAddress, decimals: opts.origin.decimals },
    originChainId: EVM_CHAIN_IDS[opts.origin.blockchain] ?? null,
    depositViaWallet: opts.depositViaWallet,
  };
  const preview = await opts.runner.preview(plan);   // fee + frozen steps, no side effects
  try {
    return await opts.runner.run(preview.plan);      // sign -> deposit -> bridge -> steps -> SUCCESS
  } catch (err) {
    const rec = deriveExecutionRecovery(err);
    if (rec?.kind === 'resume-or-cancel') return opts.runner.resume(rec.executionId);
    if (rec?.kind === 'retry-transfer') return opts.runner.retryDeposit();
    throw err;
  }
}
```
`preview()` returns `{ plan, … }`. The source comment says *"Pass this plan to run() to commit the exact prepared instructions"* (`packages/intents-connect/src/runner/types.ts:76`).

**Server proxy** (keeps `x-api-key` off the device; any backend works):
```ts
// e.g. Cloudflare Worker / Next route: /aurora-connect/*
export async function handler(req: Request) {
  const url = new URL(req.url);
  const upstream = 'https://intents-connect-alpha-api.aurora.dev' + url.pathname.replace(/^\/aurora-connect/, '') + url.search;
  return fetch(upstream, {
    method: req.method,
    headers: { 'content-type': 'application/json', 'x-api-key': AURORA_CONNECT_KEY },
    body: req.method === 'GET' ? undefined : await req.text(),
  });
}
```

**Mera as the signer (the mobile route, unverified end to end).** The backend *"recovers the signer with `ecrecover`"* (`signers/standards/erc191.ts`), so only EOAs work, and Mera accounts are EOAs. The erc191 signer needs an EIP-1193 provider with `personal_sign` (`signers/intentsConnect.ts` → `signErc191({ message: payload.payload_json, provider: providers.evm, expectedAddress })`). Mera gives us a viem account (`toViemAccount(session)`, see `mera.md`), so a small shim is enough:
```ts
import type { WalletConnector } from '@aurora-is-near/intents-connect';
export function meraConnector(account: { address: `0x${string}`; signMessage: (a: { message: string }) => Promise<`0x${string}`> }): WalletConnector {
  const eip1193 = {
    request: async ({ method, params }: { method: string; params?: unknown[] | object }) => {
      if (method === 'personal_sign') {
        const [msg] = params as [string, string];
        // SDK passes payload_json verbatim as a plain string, params = [message, address] (signers/standards/erc191.ts)
        return account.signMessage({ message: msg });
      }
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [account.address];
      throw new Error(`unsupported ${method}`);
    },
  };
  return {
    id: 'mera', name: 'Face ID', chains: ['eth', 'base', 'arb', 'op', 'pol', 'bsc', 'monad'] as never,
    signingStandard: 'erc191',
    connect: async () => {}, disconnect: async () => {},
    getAddress: () => account.address,
    getProviders: () => ({ evm: eip1193 }) as never,
  };
}
```
With `depositViaWallet: false`, the SDK emits `deposit-address { address, memo, deadline }` → **show a QR**. The docs say *"With `false`, the user deposits to the shown address from any wallet or exchange."*

Open questions to test on a $2 deposit or put to the mentor:
- (a) Does the API accept an EVM signer with a **non-EVM origin asset** (e.g. SOL)? (unverified)
- (b) Where do `EXPIRED`/`DEPOSIT_FAILED` refunds go? Probably the signer's address on the origin chain. That's fine for EVM origins, because the Mera EOA controls the same address on every EVM chain, but the user may need gas there to move it (unverified).
- (c) Does the SDK run in React Native/Hermes? It is ESM-only, with runtime deps `valtio` and `@scure/base`, and "No chain SDKs" (unverified in RN). Fallback: run the runner in an Expo **web** build, or call the REST endpoints directly with the same bodies.

If (a) fails, non-EVM users take the persistent-address path (§6).

---

## 6. Mobile UX pattern

### 6.1 "Add funds" sheet (one screen, two tabs)
1. **"From a wallet" (Intents Connect, deposit and execute).** Pick a source asset from `supported_tokens.in`, filtered to held or popular assets. Enter an amount. The preview shows `networkFee`, `minAmountOut` and `timeEstimate`. Face ID (Mera signs the intent). Then either a WalletConnect transfer or a QR (`depositViaWallet:false`). A timeline follows: *Signed → Waiting for deposit → Bridging → Adding to vault → Done (tx link)*. Optional toggle: "Open my {XAU long 5x} when funds land" → `depositAndOpen` recipe, with the order signed via Face ID first.
2. **"Deposit address" (Intents Deposits, persistent).** The user picks a network: EVM (one address for all EVM chains), Bitcoin, Solana, Tron, TON and so on. We call `POST /api/persistent-deposit-address` once per (user, chain family) and cache the result. It shows a QR and the address plus a **Transfer requirements** block, per Aurora's UX rules (`integration-best-practices/ux-recommendations.md`):
   - *"The deposit address must never be rendered without its transfer requirements."*
   - *"The QR code must never appear alone."*
   - Show *"N assets supported"*.
   - Copy like *"Send only USDC from Base to this address."*
   - Show min deposit, fees and ETA next to the address.
   - Stellar requires the memo.
   - Poll `/api/incidents` and show a banner if a route is degraded.

### 6.2 Making persistent deposits land in the vault automatically (our design, unverified)
Set the persistent address `recipient` = **`DepositInbox` for this user**: a CREATE2-predicted clone, which can be undeployed at the time the address is created, since ERC-20 transfers to it still work. Anyone can call `sweep`. Funds can only go to that user's vault balance.
```solidity
contract InboxFactory {
    address public immutable impl; CollateralVault public immutable vault;
    constructor(address _impl, CollateralVault _vault) { impl = _impl; vault = _vault; }
    function inboxOf(address user) public view returns (address) {
        return Clones.predictDeterministicAddress(impl, bytes32(uint256(uint160(user))));
    }
    function sweep(address user, address token) external {
        address inbox = inboxOf(user);
        if (inbox.code.length == 0) {
            Clones.cloneDeterministic(impl, bytes32(uint256(uint160(user))));
            DepositInbox(inbox).init(user, vault);
        }
        DepositInbox(inbox).flush(token);
    }
}
contract DepositInbox {
    using SafeERC20 for IERC20;
    address public owner; CollateralVault public vault; address public factory;
    function init(address _owner, CollateralVault _vault) external {
        require(factory == address(0)); factory = msg.sender; owner = _owner; vault = _vault;
    }
    function flush(address token) external {
        require(msg.sender == factory);
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal == 0) return;
        IERC20(token).forceApprove(address(vault), bal);
        vault.depositFor(token, bal, owner);
    }
}
```
**Trigger:** a keeper calls `sweep(user, USDC)` when `/api/persistent-deposit-status?type=success` shows a new entry. Better: when Envio indexes `USDC.Transfer(to = inboxOf(user))`. This matches the Envio bounty. Crediting arrives about 1 Monad block after settlement, and the user needs no MON and no Face ID. For judging, frame this as "deposit & execute" on the Monad side. The Connect path (§5) is the one that literally uses *"contract-level composability via Intents Connect"*.

---

## 7. Fees and revenue share
- **Aurora integrator fee** (`getting-started/api-keys-and-fees.md`): *"The collected fee is split 60/40 between the Integrator (60%) and Aurora (40%). … Aurora Fee = max(2 bps, 40% of the Integrator fee). The maximum fee set is 100 basis points."* The examples: 0 bps → Aurora 2 bps; 10 bps → us 6 and Aurora 4. Configure it per key in Studio ("Edit fees"). CSV reports are in the Studio "Reports" section. The Client Portal shows volume, fees earned and wallet analytics per key (`getting-started/client-portal.md`). The bounty page says *"40–60% revenue share in favor of the integrator"*.
- **Fee payout:** *"Fees Collection is configured by Aurora"*. To enable it, send them the target chain, asset (USDC recommended) and recipient address. The default withdrawal threshold is **$1,000** (`integration-best-practices/fees-collection.md`). For the hackathon, ask for **USDC on Monad** to our treasury, and a lower threshold.
- **Intents Connect network fee:** gas reimbursement, *"paid in the destination asset as a final transfer step the service appends"* (`recipes-and-fees.md`). It is quoted upfront (`quoted` event and `networkFee`).
- **Underlying NEAR Intents costs:** a protocol fee of 0.0001%. 1Click platform fees depend on auth (`docs.near-intents.org/resources/fees.md`). Whether Aurora-keyed requests incur 1Click's 20 bps (or 1 bp for stablecoins) on top of our fee is (unverified). Measure it by comparing `amountOut` from our Aurora key against the unauthenticated 1Click quote.
- **Measured** (unauthenticated 1Click dry quotes, 2026-09-29, into Monad USDC; `quoteRequest.appFees` showed a 20 bps fee):

| Source | In | Out (Monad USDC) | timeEstimate | refundFee |
|---|---|---|---|---|
| Base USDC | 5.0 | 4.988199 | 37 s | 0.0024 USDC |
| Arbitrum USDC | 5.0 | 4.988199 | 27 s | 0.0053 USDC |
| Ethereum USDC | 5.0 | 4.988703 | 47 s | 0.30 USDC |
| Solana USDC | 5.0 | 4.988199 | 22 s | 0.32 USDC |
| SOL | 0.05 ($5.99) | 5.983126 | 24 s | 0.086 SOL-units* |
| BTC | 0.0002 ($16.86) | 16.811819 | 809 s | 1900 sats |

`withdrawFee` into Monad USDC = 788 units = $0.000788 in every case. *The SOL refundFee is 86161 lamports (0.000086 SOL).

---

## 8. Testing
- **No testnet.** Aurora's own docs assistant (the `?ask=` endpoint) found none, and Monad testnet isn't in either token list. Test on mainnet.
- Stage 1: `dry: true` quotes and Connect `preview()` cost nothing. Use them for UI and fee math. Read `minAmountIn` from the quote to find the route minimum.
- Stage 2: $2–5 of USDC from **Arbitrum or Base**, which are cheap and fast (27–37 s). Check `destinationChainTxHashes` on Monad, and check our `Deposited` event.
- Stage 3 (demo): one live Solana → Monad Connect deposit (22 s) and one persistent-address deposit sent from a CEX or phone wallet. The deliverable is *"A live, working cross-chain flow showing funds arriving from another chain and being used within the Monad app"*.
- Aurora's demo app runs locally with `yarn workspace intents-connect-demo dev` (`apps/intents-connect-demo/README.md`). Its Aave tab already does "any chain → Aave on Monad". Run it once to watch a real Monad Connect execution before we write ours. Its `config.ts` ships a demo API key; use **our own Studio key** so volume and fees are attributed to us.
- Deploy the vault on Monad **mainnet** for this flow. Testnet funds can't arrive via Aurora.

## 9. Access and support (the routes around the obstacles)
- **API key:** `https://studio.aurora.dev`. Sign in with email → API keys → Create. Use separate keys for dev and demo (the docs recommend *"separate API keys for production, development, QA"*).
- **Intents Connect API and widget:** the widget is *"Get early access… contact the team"*. The SDK and API are usable with the Studio key (unverified).
- **Mentor:** the bounty page lists a *"Dedicated mentor from the Aurora Intents Product team"*, *"1:1 technical session on request during office hours"* and Telegram `t.me/c/auroraisnear/377725`. Judges and mentors: Armand Didier (Head of Product) and Chris Gutkowski (Head of Delivery; also an npm maintainer of the SDK). Ask them:
  1. Are Custom Actions on persistent addresses available for Monad?
  2. Which Connect host counts as prod?
  3. Can an EVM signer (Mera) be used with a non-EVM origin asset?
  4. Where do Connect refunds go?
  5. Is 1Click's fee stacked on Aurora keys?
  6. Can Fees Collection pay out USDC on Monad?
- **User support:** `https://aurora.dev/intents-support`. Send the tx hash and deposit address.

## 10. Bounty checklist (from `_portal/bounties/aurora-intents-bring-any-chain-liquidity-to-monad.md`)
- [ ] Working integration of **Intents Connect** (vault recipe) **and** Intents Deposits (persistent addresses), demoed live, not mocked
- [ ] Funds from another chain are *used* in the app: collateral is credited, and optionally a position opens in the same flow
- [ ] Settlement and refund handling: the §4 table is implemented, including the `OPERATION_FAILED` retry and withdraw, and `resume` after app restart
- [ ] Cross-chain complexity hidden: one Face ID signature and one transfer, gas handled by Connect, no bridge screen
- [ ] Bonus: multi-chain sources (EVM, Solana, BTC via persistent addresses), contract-level composability via Connect
- [ ] Integrator fee set on our key (e.g. 10 bps → 6 bps to us), and a revenue line in the pitch

## 11. Gotchas
- `ctx.amount` is the literal `{MIN_AMOUNT_OUT}` under the EVM default. Never do maths on it (`recipes-and-fees.md`).
- A bridge-in with `quote.recipient` set → `RECIPIENT_NOT_ALLOWED`. Put the beneficiary in the step params.
- A step set that never calls the destination token → `DESTINATION_TOKEN_UNTOUCHED`.
- One in-flight execution per wallet per chain → `EXECUTION_IN_FLIGHT`. Disable "Add funds" while one is live, or offer resume.
- Stellar deposits **must** carry the memo, or the funds are lost.
- Persistent-address fee rules can't depend on the origin asset (*"only fee rules that do not constrain the origin asset apply"*).
- A persistent address is bound to (key, sender, recipient, destinationAsset, confidential, chain). Changing the API key, or the inbox/recipient contract, **changes every user's address**. Freeze the key and factory before users save addresses.
- The demo's Aave recipe uses `userAddress` as `onBehalfOf`. That only works for EVM origins. Don't copy it.
- The demo sets `amountOutMinimum = 0` in Polymarket: *"Set a real minimum in production."*

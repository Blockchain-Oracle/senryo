# Routes — how each asset gets in, out and across

This file drives every picker in [`b-money.md`](b-money.md) (B1, B4, B5, B6, B9, B10). It comes from plan §0.8.

**Evidence tags:** **LIVE 2 Oct (plan)** = tested when the plan was written · **RECHECKED 2 Oct** = re-run while writing this file, result quoted · **UNVERIFIED** = a research task, not a fact. Shorthand: `cfg/` = `packages/config/src/`.

## 1. Holdings discovery (B1): `GET /v1/holdings?chainId` in `services/api`, cached

**Primary: Envio HyperSync**
- Endpoints: `https://143.hypersync.xyz` and `https://10143.hypersync.xyz`, using the project's existing Envio token.
- RECHECKED: `/height` answered without auth: 109,882,204 (143) and 67,531,373 (10143). The token-gated query itself was not run.
- Query: ERC-20 `Transfer` logs with the user's address in topic1 or topic2. This gives the candidate token contracts.
- Then `balanceOf`, `decimals` and `symbol` in one multicall at one finalized block, through `rpc.monad.xyz`.
- MON: `eth_getBalance`.

**Fallback: Alchemy Portfolio API** — `assets/tokens/by-address` on `monad-mainnet` / `monad-testnet`, one call. LIVE 2 Oct (plan); the free key is created at execution.

**Verified status and logos**
- Verified = the address is on the Monad token list (`tokenlist-mainnet.json`). Match by **address, never symbol**.
- RECHECKED: the main branch is v2.49.0, with 119 tokens, all with a `logoURI`. The repo pins commit `20779d2` (v2.48.0): `cfg/spot.ts:77-82`, `cfg/generated/spot-tokens.ts:5-6`.
- RECHECKED addresses: AUSD `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` (6) · USDC `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` (6) · USDT0 `0xe7cd86e13AC4309349F30B3435a9d337750fC82D` (6) · WMON `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` (18) · XAUt0 `0x01bFF41798a0BcF287b996046Ca68b395DbC1071` (6).
- Unknown tokens: GeckoTerminal `image_url` if one exists, else a generated monogram.

**Prices**
- Alchemy Prices API first, then GeckoTerminal `simple/networks/monad/token_price/{addresses}`.
- RECHECKED (keyless): XAUt0 $4,877.11, USDC $1.0006.
- Rate-limit contradiction: `cfg/spot.ts:55` says 10 calls/min, the plan says about 30/min. Budget for 10 and cache server-side.
- Testnet: balances only, no prices.

**Spam rules** (spam seen live by the plan: a fake "WMON" `0x561a…`, SAKURA, JUSTIN): an unverified token gets no price and doesn't count in the Total; it sits in the collapsed "Other tokens" section; a lookalike symbol triggers a warning; zero balances are dropped.

**Wallet activity (B12, D8) rides the same scan** (built 3 Oct): each query also selects the address's own transactions (MON value) and WMON `Deposit`/`Withdrawal`; on 143 a second cursor reads internal calls into the address on `143-traces.hypersync.xyz` (join-all, so reverted calls are dropped; 10143 has no traces host). Every movement is stored in `wallet_transfers` below a 3-block finality margin and `GET /v1/activity/wallet` folds them per transaction (received / sent / swap). One scan still spends at most 3 queries in all, transfers first. LIVE 3 Oct: the shared token (15 queries / 60 s) is drained within ~1 s of each window by other users, so a first scan of a busy address advances about one page a minute.

## 2. Any ↔ any swap (B6; also the auto-swap inside trade, card and pool funding)

| Source | Call | RECHECKED 2 Oct: 10 USDC → XAUt0 |
|---|---|---|
| **Monorail** (free, 0 bps, buys and sells nad.fun curve tokens) | `GET pathfinder.monorail.xyz/v4/quote?source&from&to&amount&sender` → `transaction{to,data,value}` | 0.002533 out (min 0.00252). Route USDC→MON→WBTC→XAUt0. `compound_impact` 12.63. `gas_estimate` 894,000. `tx.to` = `0xa68a7f0601effdc65c64d9c47ca1b18d96b4352c` |
| **KyberSwap** (free, sells curve tokens only) | `GET aggregator-api.kyberswap.com/monad/api/v1/routes` → `POST …/route/build` | 0.002387 out. Route curve-stable-ng (USDC→USDT0) → pancake-v3 (→XAUt0). Gas 490,498. `routerAddress` = `0x6131B5fae19EA4f9D964eAc0408E4408b66337b5` |

**Pick:** query both in parallel and take the better minimum output. Monorail won by about 6% here.

**Send list:** `[approve(router, exactAmount)?, call(tx.to, tx.data, tx.value)]`.
- Approvals are exact, as in `packages/chain/src/spot-swap.ts:111-131`.

**Router pins**
- Add `MAINNET_EXTERNAL.aggregators` beside `uniswapV4` (`cfg/markets.ts:115-128`) with the two addresses above.
- The app refuses any `tx.to` outside the pins before signing.
- UNVERIFIED: that these are the canonical, non-upgradeable routers. Confirm them from each provider's docs before pinning.

**Gas budget**
- There is no aggregator `GasAction` yet. Today's budgets are `spotSwap` 350k and `uniswapSwap` 600k (`cfg/gas.ts:127-136`).
- Monorail's estimate of 894k exceeds both. Add `aggregatorSwap` = quote gas + overhead + 10%, fork-measured, the same way as `spotSwapGasLimit` (`cfg/gas.ts:162-167`).

**Impact rule (warn >1%, block >5%)**
- The aggregators disagree on XAUt0. Implied prices: $3,948 (Monorail) and $4,189 (Kyber), against GeckoTerminal's $4,877.
- So measure impact against an independent reference: the XAU feed for XAUt0, the B1 price for other tokens. Never trust the aggregator's own number alone.
- UNVERIFIED: what Monorail's `compound_impact` means and what unit it uses.

**Kept as-is**
- The Uniswap v4 Permit2 path for its existing tokens (`cfg/markets.ts:118-126`, `cfg/spot.ts`).
- `@nadfun/sdk` as the last resort for curve buys.

**Testnet:** no aggregator coverage and no v4 pools (`cfg/spot.ts:4`). Practice swaps test AUSD ↔ test USDC at par through our own `PracticeSwap` (D-252, 10143 `0x1D75507fde3680af51f0d11A8A40B59a93399e6A`; `@senryo/chain` `preparePracticeSwap`); every other Practice pair stays locked. LIVE 3 Oct: `scripts/drive` `practice-swap-check`.

## 3. Out of Monad to another chain (B9)

`services/api` proxies the quotes. The app signs only Monad-side transactions (approve, deposit or burn).

| Asset ↓ / To → | Ethereum · Base · Arbitrum · Optimism · Polygon | BNB | Solana | Tron | Bitcoin · TON |
|---|---|---|---|---|---|
| USDC | **CCTP v2** (Monad domain 15, no fee) · Relay for speed | Across / Relay | CCTP v2 / Relay | Relay → USDT | Relay (verify) |
| USDT0 | Across (via LI.FI, `order=FASTEST`) | Across | Relay / LI.FI | Across USDT | Relay (verify) |
| AUSD | **Relay** (AUSD→AUSD Ethereum, or →USDC) | Relay | Relay | swap → USDC → Relay | swap → USDC → Relay |
| XAUt0 | LI.FI → Relay to Ethereum XAUt | — | — | — | — |
| MON | **Relay** (native or USDC) | Relay | Relay | Relay | Relay |
| Any other verified token | composed: swap → USDC → the USDC row | ← | ← | ← | ← |
| Unverified token | ✗ "Unverified · swap first" (no auto-compose, BD-7) | | | | |

RECHECKED 2 Oct:
- **Relay, 10 USDC Monad → Base USDC:**
  - 9.967879 out, about 2 s.
  - Fees: relayer $0.0321 (service $0.0300 + gas $0.0021), origin gas $0.0006.
  - Steps: `approve` → `deposit` to `0x4cd00e387622c35bddb9b4c962c136462338bc31`. Pin this depository.
- **Relay, 10 AUSD Monad → Base USDC:** 9.972376 out, about 2 s.
- **Relay on Monad:** native MON plus erc20 USDC, AUSD and mUSD. Featured: MON, USDC, WMON.
- **CCTP v2 fees:** 15 → 0 and 15 → 6 are 0 bps at both finality thresholds (1000 fast, 2000 standard).
- **Not rechecked:** Across, LI.FI, the XAUt0 route, BTC/TON delivery. These remain LIVE 2 Oct (plan) or "verify".

## 4. Into Monad from other chains (B4)

The destination is always the user's Monad wallet (Part F9).

| Asset arriving on Monad | Routes | Evidence |
|---|---|---|
| MON | Relay from 60 chains (incl. BTC, Solana, Tron, TON) | RECHECKED: 60 chains. `bitcoin`, `solana`, `tron`, `ton`, `bsc` and the L2s listed. Monad `depositEnabled: true` |
| USDC | CCTP v2 from any CCTP chain · Relay · Across · NEAR Intents | RECHECKED CCTP 0 → 15: fast 1 bps, standard 0 bps |
| AUSD | Relay | RECHECKED: AUSD in Relay's Monad currencies. Not on NEAR Intents |
| USDT0 | Across (USDT) · NEAR Intents | RECHECKED: NEAR 1Click `/v0/tokens` lists Monad MON, USDT0, USDC |
| XAUt0 | LI.FI / Relay from Ethereum XAUt | LIVE 2 Oct (plan). Not rechecked |
| ETH, WBTC and others | bridge as USDC (or MON), then the B6 swap on arrival | composed. "Arrives as USDC · swap here" |
| Memes, unverified | ✗ "No bridge · buy here" | — |

**Persistent deposit addresses:** Aurora / NEAR Intents for BTC, TON and Tron (§5).
- **Relay deposit addresses (RECHECKED 2 Oct, claude/compose):** `POST api.relay.link/quote/v2` with
  `useDepositAddress: true` (open mode) answers an address on the origin chain for Base/Arbitrum/Ethereum/… → Monad
  USDC, AUSD (from USDC), MON (from ETH) and USDT0 (from USDT) without a key; XAUT isn't a Relay solver currency (no
  address). Solana / Bitcoin origins answer "missing an api key". Track by address: `/requests/v2?depositAddress=`
  (keyless, retired 24 Nov 2026) or `/requests/v3` with a key. The order's own deadline is ~180 days; each later or
  different-sized deposit is re-quoted and filled under its own request id.

## 5. Aurora (NEAR Intents) and the incident watcher

**Endpoints** (RECHECKED via `intents-api.aurora.dev/docs/json`, all keyed by the Studio API key):
- `POST /api/quote/{apiKey}`
- `GET /api/status/{apiKey}`
- `POST /api/deposit/submit/{apiKey}`
- `POST /api/persistent-deposit-address/{apiKey}`, `GET …-addresses`, `GET …-status`, `POST …-sync`
- `GET /api/incidents/{apiKey}`

**Correction to the plan:** the keyless `GET /api/incidents` returns **404**. The incident feed needs the key.

**Incident status:**
- The plan recorded an open HOT-bridge incident since 1 Oct with `chain_all: monad`; every Monad pair failed.
- Not rechecked: there is no key yet.
- Aurora also has no AUSD or XAUt0. That matches 1Click, which lists only MON, USDT0 and USDC on Monad.

**What we build**
- The Aurora integration: Studio key, quote proxy, persistent addresses, and the existing `aurora_deposits` table (`services/common/migrations/0002_api.ts:111-124`) with a poller.
- An incident watcher in `services/api`:
  - It polls `/api/incidents/{apiKey}` every 60 s.
  - It feeds `aurora` in `/v1/status`, which is `unknown` today (`services/api/src/routes/info.ts:81-88`).
  - While any incident covers Monad, Aurora tiles are hidden from the B4/B9 grids and the banner reads "Aurora paused · using Relay".
  - Tiles return automatically when the incident closes. No release is needed.

**Bounty dependency:** the Aurora live demo ($5K) needs the incident cleared before the 13 Oct freeze. Relay and CCTP carry the product in the meantime.

## 6. Card or bank: Ramp (B5 buy, B10 sell)

**Assets**
- RECHECKED: `api.ramp.network/api/host-api/assets` lists 214 assets.
- Monad assets, all enabled: `MONAD_MON` (native), `MONAD_USDC`, `MONAD_AUSD`, `MONAD_USDT0`.
- The response carries no min or max values. Limits come from the plan (LIVE 2 Oct): buy $6.25–$15,000, sell from about $6.68, varying by country.

**Buy**
- The hosted page `app.rampnetwork.com` with `userAddress`, `finalUrl` and `enabledFlows`.
- It opens **without a key** (LIVE 2 Oct, plan), so buy ships now.

**Sell**
- The native off-ramp flow `useSendCryptoCallback`: Ramp gives asset, amount and its deposit address → the app sends with a step-up → returns `txHash`.
- It needs a `hostApiKey` with off-ramp enabled, **issued through Ramp support** (not self-serve).
- Until then: "Bank cash-out pending Ramp approval".

**UNVERIFIED:**
- the replacement for the deprecated `swapAsset` parameter;
- the React Native embed (`WebView` + `postMessage` vs an in-app browser);
- purchase status without a key (what `finalUrl` returns);
- the off-ramp asset-list endpoint (`/api/host-api/v3/sell/assets` returned nothing on 2 Oct, so the path is unconfirmed).

## 7. Execution rules for every composed route

1. **Order:** [fee top-up] → [pull from trading] → [swap] → [approve exact] → deposit or burn → (destination leg).
   - Each step is a `TxRequest` through `sendAndFinalize` (`packages/chain/src/send.ts:210-222`).
   - Each carries an explicit gas cap, because Monad charges the limit (`cfg/gas.ts:1-3`).
2. **`to` pinning:** every step's `to` must be one of:
   - the asset's token (approve);
   - a pinned aggregator router;
   - the Relay depository;
   - the CCTP `TokenMessengerV2` on 143 (UNVERIFIED address);
   - the Across SpokePool on 143 (UNVERIFIED).
3. **MON value-dip rule** (`context/02-monad/differences-from-ethereum.md:14-18`):
   - A step that sends MON value goes first, or keeps ≥10 MON after it.
   - A second MON-spending transaction within 3 blocks that dips below 10 MON is included, reverts, and still pays gas.
4. **Journal:** `plannedActions` cover the whole route (`packages/query/src/operations.ts:18`).
   - A mid-route failure is `partial`; **Finish** runs only the remaining steps.
   - The source tx hash plus the provider's request id resume tracking after the app is killed.
5. **Tracking:**
   - Relay `GET api.relay.link/intents/status/v2?requestId=`. RECHECKED: answers `{"status":"unknown"}` for an unknown id.
   - CCTP attestation via the `iris-api` messages endpoint (UNVERIFIED path).
   - Aurora `/api/status/{apiKey}`.
   - Across deposit status (UNVERIFIED).

## 8. Testnet (Practice) notes

- **Cross-chain:** only CCTP v2 supports 10143 (plan). RECHECKED: the Circle sandbox `iris-api-sandbox` answers fees for 15 → 0.
  - That gives Practice a real USDC rehearsal, Sepolia ↔ Monad Testnet. Every other route locks: "Mainnet only".
- **Relay:** RECHECKED: `api.testnets.relay.link/chains` lists 2 chains, without 10143.
- **Not on testnet:** aggregators, Uniswap v4 pools (`cfg/spot.ts:4`) and Ramp. Holdings give balances only, with no prices. The one Practice swap is the par `PracticeSwap` (AUSD ↔ USDC, §2).
- **Fees:** sponsored via `StarterDrip.topUp` (`contracts/src/periphery/StarterDrip.sol:105-112`).

## 9. Still to test (UNVERIFIED register)

1. LayerZero OFT addresses on Monad. deBridge and Mayan quotes (plan).
2. Relay delivery to Bitcoin and TON. (Relay deposit-address mode: verified for EVM origins, §4.)
3. Across and LI.FI quotes for USDT0 and XAUt0 from and to Monad.
4. CCTP `TokenMessengerV2` and `MessageTransmitterV2` addresses on 143 and 10143.
5. The canonical Monorail and Kyber routers, and whether they are upgradeable. The meaning of `compound_impact`.
6. The Aurora incident feed with the Studio key, and the current status of the Monad incident.
7. Ramp: `swapAsset` replacement, React Native embed, purchase status, sell asset list.
8. The Alchemy Portfolio and Prices APIs on `monad-mainnet` (no key yet).

# Kuru — fully onchain CLOB + aggregator on Monad

Bounties: **$5,000 "Build the Next Consumer Trading App on Kuru"** and **$5,000 "Bring New Assets and Markets to Kuru"** (Onchain Finance & Trading).
Kuru's own wording (X, 2026-09-01): (1) "Build a new trading experience routed through Kuru's onchain order book." (2) "Build infrastructure to bring new asset classes onto Kuru."
Mentor: Vaibhav (Kuru CEO/co-founder). Full bounty rubric is behind login at hackathon.monad.xyz (unverified details).

## Overview
- Kuru = fully onchain Central Limit Order Book (CLOB) DEX + smart aggregator ("Kuru Flow") on Monad. Matching is onchain: taker orders "crank" maker orders; no offchain matching engine. This is exactly the track example idea "fully onchain order books with no offchain matching engine".
- Each market = OrderBook contract + discretised AMM liquidity ("Backstop AMM") living *inside* the book as virtual orders.
- Four liquidity sources feed one book: Vaults (KuruAMMVault), concentrated liquidity via **Flip Orders**, Backstop AMM (v2-style), external market makers.
- Products: Swap, Trade terminal (TradingView), Discover, Launch (token+market deploy), Vaults, Portfolio, Referrals, embedded Privy wallet.

## How it works
- **Router** (market factory + owner/upgrader of all markets) deploys markets and stores market params; used to route across markets.
- **MarginAccount**: all limit-order debits/credits settle here (avoids DoS during onchain matching). Deposit before placing limit orders; takers can choose wallet or margin path.
- **OrderBook**: price-time priority. Params: `pricePrecision`, `sizePrecision`, `tickSize`, `minSize`, `maxSize`, `takerFeeBps`, `makerFeeBps`, AMM spread. Bad `sizePrecision` "will wreck backstop liquidity" — use `ParamCreator.calculatePrecisions`.
- **Flip orders**: a limit order that re-posts on the opposite side after each fill (bid $99 → ask $101 → bid $99 …). CLMM-like LPing on a CLOB; JIT can't front-run (price-time priority). Gas per order, so wide ranges are expensive.
- **Kuru Flow**: aggregator indexing all Monad liquidity; JWT-gated quote API; supports referrer fee sharing (monetization hook for your app).
- Monad consensus states are exposed in the WS feed: `proposed`, `voted`, `finalized`, `committed` — you can show "speculative" book state before finality (nice UX differentiator).
- **New v2 contracts in progress**: `Kuru-Labs/ts-sdk` (pushed 2026-09-22) is "Viem-first TypeScript SDK for Kuru spot/account contracts and delegated trading wallets" — AccountCore, EIP-7702 delegated trading wallets, EIP-712 signed intents submitted to a Relay (`https://relay.testnet.kuru.io`), post-fill hooks, binary Exchange WS (`KXMD`). Published to npm as `@toxicflow-labs/ts-sdk`. Appears testnet-only / not yet in docs (unverified whether mainnet).

## SDK / API quickstart

### TypeScript SDK (current mainnet contracts, ethers v5)
```bash
npm i @kuru-labs/kuru-sdk ethers@5
```
Key classes (from docs): `ParamFetcher.getMarketParams`, `CostEstimator.estimateMarketBuy / estimateRequiredBaseForSell`, `IOC.placeMarket`, `GTC.placeLimit`, `GTC.estimateGas`, `OrderCanceler.cancelOrders`, `MarginDeposit.deposit`, `OrderBook.getL2OrderBook`, `PositionProvider.provisionLiquidity`, `PositionViewer.get{Spot,Curve,BidAsk}BatchLPDetails`, `ParamCreator.calculatePrecisions / deployMarket`, `MonadDeployer.deployTokenAndMarket`. ABIs in `@kuru-labs/kuru-sdk/abi/*.json`.

```ts
import { ethers } from "ethers";
import * as KuruSdk from "@kuru-labs/kuru-sdk";

const provider = new ethers.providers.JsonRpcProvider("https://rpc.monad.xyz");
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const market = "0x065C9d28E428A0db40191a54d33d5b7c71a9C394"; // MON-USDC mainnet

const params = await KuruSdk.ParamFetcher.getMarketParams(provider, market);
// Quote: how much MON for 5 USDC
const { output, estimatedGas } = await KuruSdk.CostEstimator.estimateMarketBuy(provider, market, params, 5);
const minAmountOut = (output * 0.99).toFixed(params.baseAssetDecimals.toNumber());
// Market buy (IOC). size = quote amount for buys
const rcpt = await KuruSdk.IOC.placeMarket(signer, market, params, {
  approveTokens: true, size: "5", isBuy: true, minAmountOut, isMargin: false, fillOrKill: true,
});
// L2 book
const book = await KuruSdk.OrderBook.getL2OrderBook(provider, market, params);
```
Limit orders: first `KuruSdk.MarginDeposit.deposit(signer, marginAccount, user, token, amount, decimals, true)`, then `KuruSdk.GTC.placeLimit(...)`; parse `OrderCreated(uint40,address,uint96,uint32,bool)` / `Trade(uint40,address,bool,uint256,uint96,address,address,uint96)` logs for order IDs.

### Deploy a new market (bounty #2)
```ts
import { ParamCreator } from "@kuru-labs/kuru-sdk";
const pc = new ParamCreator();
// implied price = quote/base; maxPrice; minSize (base); tick in bps
const p = pc.calculatePrecisions(10 /*quote*/, 1 /*base*/, 20 /*maxPrice*/, 0.01 /*minSize*/, 10 /*tickBps*/);
const market = await pc.deployMarket(
  signer, "0xd651346d7c789536ebf06dc72aE3C8502cd695CC" /*Router mainnet*/,
  0 /*0 NO_NATIVE, 1 NATIVE_IN_BASE, 2 NATIVE_IN_QUOTE*/, baseToken, quoteToken,
  p.sizePrecision, p.pricePrecision, p.tickSize, p.minSize, p.maxSize,
  30 /*takerFeeBps*/, 10 /*makerFeeBps*/, ethers.BigNumber.from(100) /*AMM spread, 100 = 1%*/);
```
Or `MonadDeployer.deployTokenAndMarket(signer, monadDeployer, tokenParams, marketParams)` = new token + MON-paired market + seeded vault in one tx.

### Python SDK (market making)
```bash
pip install kuru-sdk-py   # or: uv add kuru-sdk-py
```
`KuruClient`: `await client.start()` (performs EIP-7702 authorization + RPC WS), `client.set_order_callback(cb)`, `client.place_orders()` (atomic cancel+place). Config: `rpc_url=https://rpc.monad.xyz`, `rpc_ws_url=wss://rpc.monad.xyz`, `kuru_ws_url=wss://ws.kuru.io/`, `kuru_api_url=https://api.kuru.io/`, `rpc_logs_subscription="monadLogs"` (speculative) or `"logs"`. Example bot: github.com/Kuru-Labs/mm-example.

### Exchange REST/WS (Binance-style, public market data)
- REST `https://exchange.kuru.io`: `GET /api/v3/exchangeInfo`, `/api/v3/depth?symbol=MON_USDC`, `/api/v3/trades`, `/api/v3/ticker/24hr`, `/api/v3/klines`, `/api/v3/{user}/user/order-events` (MM-friendly, 2s cache), `/api/v2/{user}/user/orders/active/{market}`, `/health`. Rate limit: token bucket 1200 weight/min/IP, burst 100.
- WS `wss://exchange.kuru.io/ws`: `{"method":"SUBSCRIBE","params":["mon_usdc@depth","mon_usdc@trade"],"id":1}`. Streams: `@depth`, `@depth5/10/20`, `@depth@<proposed|voted|finalized|committed>`, `@monadDepth` (all 4 states), `@trade`.

### Kuru Flow (aggregator) API — base `https://ws.kuru.io`
```bash
# 1) JWT (1 rps) for a user
curl -X POST https://ws.kuru.io/api/generate-token -H 'content-type: application/json' \
  -d '{"user_address":"0xUSER"}'
# 2) Quote (Bearer JWT or X-API-Key)
curl -X POST https://ws.kuru.io/api/quote -H "Authorization: Bearer $JWT" -H 'content-type: application/json' \
  -d '{"userAddress":"0xUSER","tokenIn":"0x754704Bc059F8C67012fEd69BC8A327a5aafb603","tokenOut":"0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A","amount":"5000000","autoSlippage":true,"referrerAddress":"0xYOU","referrerFeeBps":25}'
```
Response: `type,status,output,message,path,buildResponse,gasPrices` (`buildResponse` = tx to send; spender/entrypoint `0xb3e6…13cb`). Ready-made agent tooling: github.com/Kuru-Labs/kuru-trading-skills (`bun run trade quote buy WMON 10`, `prepare` mode for external signers).

### Historical data
Daily L2 snapshots (Parquet, public S3): `https://kuru-l2-snapshots.s3.amazonaws.com/market={addr}/date={YYYY-MM-DD}/l2_book_snapshots.parquet` (bids/asks JSON, 1e18 price precision). Great for backtesting/analytics.

### Indexing
Router `MarketRegistered` → discover markets; each OrderBook `Trade` → all trades.

## Monad addresses (from docs.kuru.io/contracts/Contract-addresses)
Mainnet (chain 143):
| Contract | Address |
|---|---|
| Router (market factory) | `0xd651346d7c789536ebf06dc72aE3C8502cd695CC` |
| MarginAccount | `0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5` |
| KuruFlowEntrypoint (aggregator / spender) | `0xb3e6778480b2E488385E8205eA05E20060B813cb` |
| KuruFlowRouter | `0x0d3a1BE29E9dEd63c7a5678b31e847D68F71FFa2` |
| KuruForwarder | `0x974E61BBa9C4704E8Bcc1923fdC3527B41323FAA` |
| MonadDeployer | `0xe29309e308af3EE3B1a414E97c37A58509f27D1E` |
| MON-AUSD market | `0x131a2e70a5b31a517a74b8c567149bc294470da9` |
| MON-USDC market | `0x065C9d28E428A0db40191a54d33d5b7c71a9C394` |
| WMON / AUSD / USDC | `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` / `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` / `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` |
(monad-crypto/protocols registry also lists Vault `0x4869a4c7657cef5e5496c9ce56dde4cd593e4923`, Vault2 `0xD6Eae39b96FbdB7daA2227829Be34b4e1BC9069a`, legacy KuruFlowRouter `0x465D06d4521ae9Ce724E0c182Daad5D8a2Ff7040`.)

Testnet (10143): Router `0x7EFbE105Ca7415dE98F96622173458ac1c054630`, MarginAccount `0xd029C2D98ff85D8F64799017fE00a59B1159CE02`, Forwarder `0x681bB1508E14433b148a2549ba2726454aDc9BB4`, Deployer `0xDacd06372cEb638640c9D8466A023b7362324e1A`, Utils `0xE0841E0F06c5770C1D4930EC6C507ee33199C88C`, USDC `0x3bA3d39AFcf8bb994f7964B3e0171Ea2Ba361570`, MON-USDC `0xa241896A7Dbe8a550D2E5fF7A914bB1989ceD2D9`.

## Bounty & ideas
Likely judging angle: real volume/orders routed through Kuru contracts (not just the Flow aggregator), consumer-grade UX that hides CLOB complexity, novel use of Kuru primitives (flip orders, backstop AMM, vaults, speculative-state feeds), and for #2, genuinely new asset classes with sustainable liquidity.

**#1 Consumer trading app**
1. **"Tap-to-trade" mobile app** (Privy embedded wallet + passkeys): one-thumb limit orders shown as "price alerts that execute", flip-order "auto buy-low/sell-high" presets, live book from `@monadDepth` showing proposed→finalized fills in <1s. Stack with Agora mobile bounty (AUSD quote asset, MON-AUSD market).
2. **Social copy-limit-orders**: follow a trader; their `order-events` stream mirrors into your margin account as scaled GTC orders; referral fees via Kuru Flow `referrerFeeBps`. Pair with Nansen smart-money labels for discovery.
3. **Agentic trading chat** (Telegram/Farcaster mini-app): natural-language → `kuru-trading-skills` prepare flow → user signs; add DCA/TWAP executed as ladders of flip orders.

**#2 New assets & markets**
1. **Cross-chain asset listing pipeline**: Aurora Intents deposit address → bridged asset lands on Monad → auto-deploy Kuru market with `calculatePrecisions` + seed Backstop AMM vault; "list any token from any chain in one click". Also qualifies for Aurora bounty.
2. **Oracle-anchored RWA / FX markets**: AUSD-quoted markets for tokenized FX/gold using Chainlink feeds (EUR/USD, GBP/USD, JPY/USD, XAU/USD exist on Monad) to drive a keeper/CRE workflow that quotes flip-order ladders around the oracle price (liquidity bootstrapping for assets MMs ignore). Also a Chainlink CRE entry.
3. **Pre-market / points / LST-spread markets**: markets on LST/MON pairs (shMON, gMON, aprMON, sMON) with tight flip-order ranges, or prediction-share tokens traded on a CLOB instead of an AMM.

## Gotchas
- SDK uses **ethers v5** (`ethers.providers.JsonRpcProvider`), not v6/viem (new ts-sdk is viem).
- Limit orders revert without MarginAccount deposit + allowance. For market buys `size` is in **quote**; for limit orders `size` is base.
- Price/size are precision-scaled integers; read per-market params, never hard-code. Trade `fillPrice` in API = 1e18 precision.
- Market params are effectively permanent — wrong `sizePrecision`/`tickSize` breaks the market; test on testnet first.
- Kuru Flow JWT is 1 rps; get an API key from the team for anything real (unverified how).
- Contract addresses differ between docs and registry for the Flow router (V1 vs V2) — use docs values.

## Sources
- https://docs.kuru.io/llms.txt , https://docs.kuru.io/llms-full.txt
- https://docs.kuru.io/contracts/Contract-addresses , https://docs.kuru.io/sdk/orderbook-sdk , https://docs.kuru.io/sdk/deploy-market
- https://docs.kuru.io/kuru-exchange/openapi.yaml , https://docs.kuru.io/kuru-flow/openapi.json
- https://github.com/Kuru-Labs (kuru-sdk, ts-sdk, kuru-sdk-py, mm-example, kuru-trading-skills)
- https://x.com/KuruExchange/status/2094830938463010922 (bounty text)
- https://github.com/monad-crypto/protocols/blob/main/mainnet/kuru.jsonc

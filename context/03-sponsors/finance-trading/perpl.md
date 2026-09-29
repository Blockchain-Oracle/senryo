# Perpl — fully onchain perps CLOB on Monad

Bounties: **$5,000 "Best use of Perpl's API"** and **$3,000 "Best Analytics / Risk Tool"** (app.perpl.xyz). Perpl X post (2026-09-17): "Submissions close October 13th." A commenter asked if one project can submit to both — no public answer (unverified).
Judge: PBJ (Perpl co-founder). Mentor: gvan (Perpl Head of Growth).

## Overview
- Isolated-margin perpetual futures DEX where **order book, matching, margin, liquidation, funding and settlement all run onchain** on Monad ("no off-chain or centralized points of failure"). Optimised for <100k gas MM post+cancel.
- Collateral: **AUSD** (Agora Dollar, 6 decimals) — natural overlap with Agora bounties.
- Liquidity: CLOB + PLP vault (independently operated vaults), builder codes, referrals, points/mPoints, tournaments.
- Fees (bps, 14-day volume tiers): Tier1 <$5M maker 0.45 / taker 3.45 … VIP2 ≥$1B maker −0.5 / taker 1.25.

## How it works
- **Isolated margin**: each position has its own collateral; account balance never auto-rescues a position. A position can be liquidated while free balance exists — a great UX/risk-tool angle.
- **Prices**: Spot Index = **Chainlink Data Streams** pushed onchain (on >0.1% move or when within 10s of max age). Mark price recomputed every block = median of up to 4 inputs (external venue mids Binance/Hyperliquid/OKX/Bybit, basis-adjusted spot, …) anchored to spot. Settlement/liquidation revert if spot is stale.
- **Funding**: hourly-ish — applied every **8571 blocks** (~1h at 0.42s blocks), rate set up to 143 blocks in advance via permissioned setter, clamped by `absFundingClampPctPer100k` (0–15%), funding price must be within tolerance of Chainlink. Payments are **virtualized** (staking-reward-style accumulator), not per-position transfers. (Track idea "funding that updates every block" is explicitly *not* what Perpl does → room for a research/risk tool or a proposal prototype.)
- Liquidation → insurance fund → ADL. OI caps and withdrawal limits exist (security section).
- Order lifecycle keyed by `rq` (client idempotency ID, strictly increasing per account) and `lb` (last valid block — orders expire by block height).

## API quickstart
Base URLs:
| | REST | WebSocket | Chain | Exchange contract | Collateral |
|---|---|---|---|---|---|
| Mainnet | `https://app.perpl.xyz/api` | `wss://app.perpl.xyz` | 143 | `0x34B6552d57a35a1D042CcAe1951BD1C370112a6F` | AUSD `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` |
| Testnet | `https://testnet.perpl.xyz/api` | `wss://testnet.perpl.xyz` | 10143 | `0x1964C32f0bE608E7D29302AFF5E61268E72080cc` | aUSD `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` |
Exchange deploy block: mainnet `54773010`, testnet `62953` (use as log-scan lower bound). Min account-open deposit: 10 AUSD mainnet / 100 aUSD testnet (read live from `/v1/pub/context`).

Markets (market_id; differ per network — fetch `/v1/pub/context`): mainnet BTC 1, MON 10, ETH 20, SOL 31 (legacy 30), HYPE 40, ZEC 50; testnet BTC 16, ETH 32, SOL 48, MON 64, ZEC 256.

### Public (no auth)
```ts
const API = "https://app.perpl.xyz/api";
const ctx = await fetch(`${API}/v1/pub/context`).then(r => r.json()); // markets, tokens, chain, decimals, fees
// candles: GET /v1/market-data/:market_id/candles/:resolution_sec/:from_ms-:to_ms
const ws = new WebSocket("wss://app.perpl.xyz/ws/v1/market-data");
ws.onopen = () => ws.send(JSON.stringify({ mt: 5, subs: [
  { stream: "order-book@1", subscribe: true },      // L2 BTC
  { stream: "trades@1", subscribe: true },
  { stream: "funding@143", subscribe: true },        // funding updates (mt 10)
  { stream: "market-state@143", subscribe: true },   // prices, volume, OI (mt 9)
]}));
```
Streams: `heartbeat@<chain>`, `gas-stats@<chain>`, `market-config@<chain>`, `market-state@<chain>`, `funding@<chain>`, `candles@<market>*<res>`, `order-book@<market>`, `trades@<market>`.

### Auth (API key = Ed25519 keypair)
Create at `https://app.perpl.xyz/apikeys` (wallet-signed enrollment) → you get `X-API-Key` token + Ed25519 private key. Scopes `read`/`trade`; **withdrawals never allowed via API key**. Max 16 active keys/profile. Programmatic enrollment: `POST /v1/api-key/payload` then `POST /v1/api-key/enroll` (Origin must be whitelisted by Perpl for 3rd-party apps).
```ts
import { createHash, randomBytes } from "crypto";
import * as ed from "@noble/ed25519";               // npm i @noble/ed25519
const CHAIN_ID = 143, KEY = process.env.PERPL_API_KEY!;
const priv = Buffer.from(process.env.PERPL_API_KEY_SECRET!.replace(/^0x/, ""), "hex");
async function signedFetch(method: string, target: string, body = "") {
  const ts = Date.now().toString(), nonce = randomBytes(16).toString("base64url");
  const canonical = [CHAIN_ID, method, target, ts, nonce, createHash("sha256").update(body).digest("hex")].join("\n");
  const sig = Buffer.from(await ed.signAsync(Buffer.from(canonical), priv)).toString("base64url");
  return fetch(`https://app.perpl.xyz/api${target}`, { method, body: body || undefined, headers: {
    "X-API-Key": KEY, "X-API-Timestamp": ts, "X-API-Nonce": nonce, "X-API-Signature": sig,
    ...(body ? { "Content-Type": "application/json" } : {}) } });
}
await signedFetch("GET", "/v1/trading/fills?count=1");
```
Authenticated REST (history): `/v1/trading/account-history`, `/fills`, `/order-history`, `/position-history` (cursor `page`=`np`, `count`≤100), `/v1/profile/ref-code`. Rate limits ~100/min public, ~60/min auth. Timestamp window ±30s, nonce single-use.

### Trading over WS (`/ws/v1/trading`)
First frame `mt:29` ApiKeySignIn, signature over `"<chain_id>\ntrading-ws-signin\n<ts>\n<nonce>"`. Server pushes WalletSnapshot (19; contains account id + `lfr`), OrdersSnapshot (23), PositionsSnapshot (26).
```ts
ws.send(JSON.stringify({
  mt: 22, rq: ++nextRq /* > account.lfr */, mkt: 1, acc: accountId,
  t: 1 /*OpenLong; 2 OpenShort, 3 CloseLong, …, 5 Cancel*/,
  p: 95000 * 10 /* BTC price_decimals=1 */, s: 10000 /* 0.1 BTC, size_decimals=5 */,
  fl: 0 /*GTC; IOC=4*/, lv: 1000 /*10x in hundredths*/, lb: currentBlock + 100,
  // market order: p:0, fl:4, ms:<max slippage bps>; TP/SL: tp, tpc (1 GTLast,2 LTELast,3 GTEMark,4 LTEMark)
}));
```
Updates: OrdersUpdate 24, FillsUpdate 25, PositionsUpdate 27, AccountStatsUpdate 28. Dedup: first non-failure status wins; `sr:32 OrderDescIdTooLow` → retry once with new `rq`.

### Builder codes (monetize your front-end)
Contact Perpl for a builder id (1..255). Users enroll keys bound to your code with a signed fee ceiling (`max_builder_fee_per_100k`, max 100 = 0.1%); each order sets `bf`. Gives volume attribution even at 0 fee — useful to *prove* usage to judges.

### Rust SDK / CLI
github.com/PerplFoundation/dex-sdk (`perpl-sdk`, `perpl-cli`, Rust ≥1.85). `Chain::mainnet()`; in-memory exchange state cache from log polling (no funding events yet). `perpl-cli snapshot | trace | show account|book|trades | block <n> | tx <hash>`. Examples incl. MM bot: github.com/PerplFoundation/dex-sdk-examples (`cargo run --bin perpl_market_making_bot -- bbo --order-size 0.01`). Also `PerplFoundation/delegated-account` (owner/operator hot-wallet delegation; Factory mainnet `0xc535276e3e446e4f28d95ed27ccd5c32e4c8907a`). API docs repo: `PerplFoundation/api-docs` (Python + TS reference clients).

## Bounty & ideas
Judging angle (inferred): #1 rewards products that route real trading through the API/WS (bots, terminals, mobile, agents) — builder-code attribution makes impact measurable. #2 rewards tools traders/LPs actually need given isolated margin + onchain transparency.

**Best use of API ($5K)**
1. **Mobile perps terminal with builder code** — AUSD-native, one-tap TP/SL, "liquidation distance" slider, push alerts from `funding@`/`market-state@`. Also targets Agora's $10K mobile trading bounty.
2. **Agent/Telegram copilot** that turns intents ("short ETH 3x if funding > 0.01%/h") into WS `OrderRequest`s with trigger orders; read-scoped key for monitoring, trade-scoped for execution; Nansen smart-money perp signals as input.
3. **Basis/funding arb bot**: Perpl vs Hyperliquid funding spread using external venue data + Perpl WS; auto hedge; publish PnL dashboard.

**Analytics / Risk ($3K)**
1. **Isolated-margin risk radar**: per-position liquidation-price heatmap across the whole exchange (rebuild state via `perpl-cli trace`/log scan from block 54773010), liquidation cascade simulator, OI concentration, ADL/insurance fund health.
2. **Oracle & funding observatory**: live Chainlink spot vs mark vs external mids, staleness countdown, funding-rate forecaster (impact-price formula from docs), "what if funding updated every block" simulator.
3. **Portfolio stress tester**: connect wallet → pull positions/fills → Monte-Carlo VaR, suggested collateral top-ups (explicitly because free balance won't save positions).

## Gotchas
- REST URL **includes** `/api`, WS URL does **not**. Sign the request-target byte-for-byte including query string.
- API key ≠ exchange account: call `createAccount(uint256)` on Exchange with ≥ min AUSD first, else 404s.
- All amounts are scaled ints: collateral 1e6; price/size decimals per market; leverage in hundredths; builder fee in per_100k vs market fees in micros.
- `rq` must be strictly increasing (seed from `lfr`); orders need `lb` (block expiry) ≤ head + `order_ttl_blocks`.
- Market IDs differ mainnet vs testnet; SOL relisted as 31.
- Minimum dollar order value currently 0 but owner-adjustable (read `getMinimumPostCNS/SettleCNS`).

## Sources
- https://docs.perpl.xyz/llms.txt , /resources/for-developers/overview.md , /quickstart.md , /networks-and-configuration.md , /api/rest.md , /api/websocket.md , /api/builder-codes.md , /recipes.md , /sdk/perpl-cli.md
- https://docs.perpl.xyz/exchange/funding.md , /exchange/price-indices.md , /exchange/fees.md , /exchange/margin.md
- https://github.com/PerplFoundation (dex-sdk, dex-sdk-examples, api-docs, delegated-account)
- https://x.com/perpltrade/status/2100637172827058219

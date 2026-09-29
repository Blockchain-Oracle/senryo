# Monad Gap Check

Checked 2026-09-29 against DefiLlama (`https://api.llama.fi/protocols`, 140 protocols list Monad), the Monad App Hub, and [../05-ecosystem/ecosystem-map.md](../05-ecosystem/ecosystem-map.md).

## Categories on Monad (DefiLlama, count of protocols)
Dexs 46 · Risk Curators 16 · Lending 13 · Onchain Capital Allocator 7 · Yield 7 · Derivatives 7 · RWA 5 · Liquid Staking 5 · Launchpad 5 · CEX 3 · Bridge 3 · Yield Aggregator 3 · Prediction Market 2 · Privacy 2 · Payments 1 · Uncollateralized Lending 1 · Luck Games 1 · Liquidity Automation 1 · NFT Marketplace 1 · others.

## Per pattern
| Pattern (proven elsewhere) | On Monad today | Evidence |
|---|---|---|
| Tokenized-stock products (packs, stock-paired launchpads, programmable equity) | **Corrected: tokenized stocks exist, but tiny.** Anchored launched tokenized top-10 Nasdaq stocks on Monad via **Monday Trade** (Apr 2026; Monday Trade Spot fees $552/30d). Chainlink publishes wNVDAx/wSPYx/wTSLAx/wSPCXx/wEWYx/wQQQx feeds on Monad. **No product that packs, streams, conditions or launches against them.** My first check missed this because DefiLlama's "RWA" category on Monad only lists treasury/credit protocols (Valos, Theo, Huma, Travessia, Mu Digital) | [deep-dive-rwa-perps.md](deep-dive-rwa-perps.md) §148, §264 |
| Equity/RWA perps (added from deep dive) | LeverUp listed 50 RWA pairs (16 Sep; execution on trade[XYZ]; $0 volume). HelloTrade perps "Live in Alpha". Total Monad perp OI $1.84M. XStable's domain is parked (inactive, unverified) | [deep-dive-rwa-perps.md](deep-dive-rwa-perps.md) |
| Equity/RWA perps (pre-deep-dive row) | Superseded by the row above | — |
| Physical trading-card market (order book / AMM / rental / lending) | **None.** **Oripa** is live but does *"Pack Opening"* + *"Sell Back Instantly"* only (App Hub listing, scraped 2026-09-29). The only NFT marketplace (Sweep n Flip) has $0 TVL | App Hub, DefiLlama |
| Money-stake commitment / step-bet pools | **None.** LootGO is free walk-to-earn with no stakes | App Hub (via research agent) |
| Group bill-split / settle-up | **None found** | ecosystem-map |
| Salary / per-second streaming for consumers | **Primitive only**: Sablier Lockup is deployed, with **$0.00M** TVL on Monad | DefiLlama, 2026-09-29 |
| Prediction markets | **Small, pool-style**: Levr Bet $1.90M, Kizzy $0.07M. No order-book binary markets on Kuru | DefiLlama |
| Undercollateralised credit | **Tiny**: Accountable $0.14M on Monad | DefiLlama |
| Launchpads | Nad.fun V2 $0.48M, V1 $0.14M, NOXA, Printr, Monad Grid (all MON-paired memecoins) | DefiLlama |
| Mobile social trading | **Exists**: fomo is on Monad, but with $13.2K fees/30d (vs $12.0M on Solana) | solana-hyperliquid.md |
| Onchain insurance | **None** | DefiLlama |

## Numbers re-checked directly (DefiLlama fees API, 2026-09-29)
| Protocol | Last 30d fees | Previous 30d | Read |
|---|---|---|---|
| Collector Crypt (Solana) | $11.39M | $10.62M | Steady, large |
| StonkFun (Solana) | $24.85M | $1.13M | **Spike**: ~$50K/day until 5 Sep, $1–2.3M/day 6–24 Sep, then down to ~$0.5M/day by 27 Sep. Mania pattern |
| Gacha (Abstract) | $2.40M | $3.74M | **Cooling** |
| Courtyard (Polygon) | $2.17M | $2.90M | **Cooling** |
| pump.fun Mobile App (Solana) | $7.55M | $4.94M | Growing |
| Wildcat (Ethereum) | $1.38M | $1.44M | Steady |
| ether.fi Cash | no DefiLlama fees series | | Use Paymentscan figures in evm file |

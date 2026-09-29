# Trend Radar: what's actually hot across crypto (Jun–Sep 2026)

> Researched 2026-09-29. We rank by **hard metrics**, not by headlines. Method and evidence standard: [README.md](README.md).
> **Main data source:** DefiLlama free API, pulled 2026-09-29 (`/overview/fees`, `/overview/dexs`, `/overview/open-interest`, `/protocols`, stablecoins). Daily per-protocol series were summed by month and grouped by DefiLlama's own category labels. **Sep 2026 = Sep 1–28, scaled to 30 days** (×30/28). Raw pulls and scripts are in the session scratchpad (`research/trends/`).
> DefiLlama's `/overview/derivatives` and `/raises` are **paywalled**, so perp *volume* comes from a live Hyperliquid API snapshot plus third-party reports. Anything we couldn't confirm is marked **(unverified)**.

## 1. Ranked categories

"Fees" means DefiLlama fees in $M per month. "Mar→Jun→Sep" gives the 6-month trend.

| # | Category | 3–6 month trend (numbers, source, date) | Top products (by the metric) | Verdict |
|---|---|---|---|---|
| 1 | **Prediction markets** | Kalshi+Polymarket volume **$20.8B (May) → $46.6B (Jun) → $53.0B (Jul)** (Pew/The Block, 2026-09-23). Kalshi alone: **$56.6B Sep MTD** to Sep 28 (DeFiRate). Category fees **$14.7M → $76.3M → $97.3M** (Mar→Jun→Sep, DefiLlama). | Kalshi, Polymarket US, Polymarket Intl, Predict Fun (BSC), OPINION | **HOT** |
| 2 | **RWA perps (HIP-3 equities, commodities, pre-IPO)** | trade.xyz = **$3.09B of Hyperliquid's ~$10.5B 24h volume (29%)** (Hyperliquid API snapshot, 2026-09-29). Talos says trade.xyz was **55% of HL volume in Aug 2026**. Tracked perp open interest **$9.5B → $10.3B → $15.7B** (Mar→Jun→Sep, DefiLlama OI). | trade.xyz (HIP-3), Variational, Polymarket Perps, Ondo Perps, Lighter Robinhood Perps | **HOT** |
| 3 | **Tokenized stocks and Robinhood Chain** | Robinhood Chain DEX volume **$15.3B (Jul) → $19.4B (Aug) → $54.0B (Sep)** (DefiLlama). Tokenized stocks: **$3.16B** distributed, +16% in 30d; **4.01M holders, +63% in 30d**; 3.17M monthly active addresses, +111% (rwa.xyz, 2026-09-29) | Ondo Global Markets, bStocks, xStocks, Robinhood Stock Tokens | **HOT** |
| 4 | **Launchpads and memecoin trading terminals** | Launchpad fees **$46.1M → $30.2M → $259.6M** (Mar→Jun→Sep). Trading-app fees **$33.9M → $23.2M → $126.3M** (DefiLlama) | Pons V2 (Robinhood Chain), pump.fun, Flap (BSC), GMGN, Axiom, fomo | **HOT, but mania** (see Rejected) |
| 5 | **Stablecoin cards and neobanks** | Card spend **$759M in Jul 2026, 2.5× YoY** (a16z crypto, 2026-08-08). 11 tracked programs: $305.6M in Aug, +10.9% MoM (SpendNode). EtherFi Cash volume **$62.5M → $83.5M → $131.9M**. Plasma One **$1.1M → $9.0M → $25.9M** (DefiLlama) | ether.fi Cash, KAST, RedotPay, Plasma One, Karta | **HOT (steady compounding)** |
| 6 | **Curated lending vaults (yield)** | "Risk Curators" fees **$8.9M → $14.7M → $22.5M**. Morpho Blue fees **$11.3M → $18.8M → $20.2M**. Aave V3 fell **$47.4M → $37.3M** (DefiLlama) | Steakhouse, Sentora, Gauntlet, Morpho | **STEADY → warming** |
| 7 | **Physical TCG / collectibles** | Category fees **$15.1M → $25.7M (Jun peak) → $16.5M**. Volume **$13.5M → $334.9M → $303.4M** (DefiLlama; tracking starts ~May) | Collector Crypt, Courtyard, Phygitals, Beezie, Gacha TCG (Abstract) | **STEADY (plateau after Jun peak)** |
| 8 | **Compute markets** | TradFi is moving first: **CME H100/B200 rental-index futures list 2026-10-05** (CME PR, 2026-08-11), and **ICE + Ornn GPU compute futures** have been announced. Onchain: USD.AI TVL **$230M** (DefiLlama; the project claims $585M), GAIB $18.9M. AI/semis perps were **53% of trade.xyz daily volume in Jul** (Talos) | USD.AI, GAIB, HIP-3 pre-IPO perps (io:ANTH, io:OAI) | **EMERGING (narrative hot, onchain thin)** |
| 9 | **Spot DEX (overall)** | **$240B (Mar) → $229B (Jun) → $302B (Sep)** per month, still well below **$588B (Oct 2025)** (DefiLlama) | Uniswap V4/V3 (mostly Robinhood Chain), PumpSwap, Raydium, Meteora | **STEADY (Sep rebound)** |
| 10 | **Stablecoin supply** | **$307.6B (Mar 1) → $317.4B (Jun 1) → $311.5B (Sep 28)** (DefiLlama stablecoins) | USDT, USDC | **STEADY / flat** |
| 11 | **Crypto-native perps (generic)** | Derivatives category fees **$136.2M → $128.8M → $123.3M**. Hyperliquid Perps fees **$67.0M → $77.7M → $72.5M** (DefiLlama) | Hyperliquid, Jupiter Perps, Aster, edgeX, Lighter | **STEADY** |
| 12 | **Onchain lotteries and luck games** | "Luck Games" fees **~$0 (Mar) → $7.9M (Jul) → $4.3M (Sep)** (DefiLlama). Megapot raised a **$5M pre-seed led by Dragonfly** (Mar 2026) | Fake World Assets (unverified what it is), Megapot | **Small, new** |
| 13 | **AI-agent payments (x402) and agent identity** | x402 settlement volume **−93% YTD, −55% over 3 months**; 7-day average ~$41.8K/day (Helios data via Yahoo, 2026-08-13). ERC-8004: **101,127 agents** registered (census, 2026-09-26) | x402 (Coinbase/Cloudflare), ERC-8004 registries, Virtuals | **COOLING on usage** (hot on VC and standards) |
| 14 | **Creator coins / onchain social** | ZORA Coins fees **$0.03M (Mar) → $0.01M (Sep)**. SoFi category **$0.6M → $2.2M**, and that's almost all Gacha TCG (DefiLlama) | Zora, Base App | **COOLING** |

## 2. The hot categories in detail

### 2.1 Prediction markets: HOT
**What's driving it**
- **Sports and the World Cup.** Sports trading "topped $58 billion on Kalshi and neared $22 billion on Polymarket" in Jun+Jul 2026 ([Pew, 2026-09-23](https://www.pewresearch.org/short-reads/2026/09/23/prediction-markets-trading-volume-doubled-between-may-and-july-largely-driven-by-sports/)).
- **Parlays are the new mechanism.** On a record Kalshi weekend, parlay volume hit $1.92B on Saturday and $1.76B on Sunday ([InGame](https://www.ingame.com/kalshi-volume-parlays-3b-record/), Sep 2026). Polymarket has "Combos": $14.5M in Jun → $18.5M in Sep (DefiLlama dexs).
- **Venues are converging with perps.** Polymarket launched **Polymarket Perps on 2026-09-03**: up to 20×, and 67 markets within hours, covering crypto, equities, commodities and SpaceX ([Bloomberg](https://www.bloomberg.com/news/articles/2026-09-03/polymarket-launches-perpetual-oil-futures-in-24-7-trading-push), [Blockhead](https://www.blockhead.co/2026/09/07/polymarket-launches-perpetual-futures-with-up-to-20x-leverage-across-crypto-stocks-commodities/)).
- **Capital is following.** Prediction markets raised **$2B in H1 2026**, the #2 category after payments ([CoinDesk, 2026-08-15](https://www.coindesk.com/business/2026/08/15/the-usd11-2-billion-in-2026-funding-that-killed-crypto-s-permissionless-era)). Dragonfly's fourth fund ($650M) names Polymarket as an early bet ([Fortune, 2026-02-18](https://fortune.com/2026/02/18/dragonfly-term-sheet-venture-capital-blockchain-crypto-polymarket-rain/)).
- **The onchain venue is losing share.** Polymarket International volume fell **$4.79B (Mar) → $2.22B (Sep)** (DefiLlama). The growth is in the regulated US venues (Kalshi, Polymarket US). Share in Sep 2026: Kalshi ~80%, Polymarket ~15% ([World of Statistics on X](https://x.com/stats_feed/status/2099894669035397276)) (unverified secondary). DeFiRate puts Polymarket at 6.2% of September volume ([DeFiRate](https://defirate.com/prediction-markets/volume/polymarket/)).
- ⚠️ **Two volume measures.** DeFiRate and The Block count **notional**: Kalshi = $56.6B Sep MTD. DefiLlama counts something smaller: Kalshi = $14.2B in Sep. Always say which one you're quoting.

#### Kalshi (offchain, CFTC-regulated)
- What it does: A regulated event-contract exchange. Sports dominate, and parlays are growing fast.
- Traction: 2026 volume = $5.26B (Mar) → $9.40B (Jun) → $14.18B (Sep, scaled) per month ([DefiLlama dexs API](https://api.llama.fi/overview/dexs), 2026-09-29). Notional = $56.6B Sep MTD; record day $3.24B on Sep 27 ([DeFiRate](https://defirate.com/prediction-markets/volume/kalshi/), 2026-09-28).
- Why it's working: It's legal in the US, it has sports distribution, and parlays at long odds work like "lottery tickets".
- Open source?: closed
- On Monad already?: no (offchain)
- Metropolis fit: Track 01, official idea 02: "Options written on non-traditional underlyings: social attention, creator growth trajectories, real-world event outcomes verified by oracle". Also Track 03, idea 03: "Attention futures".
- Monad angle: Onchain parlays and combos need cheap multi-leg settlement and a live order book. That fits ~sub-second blocks.
- Risks: Its moat is regulation, not tech. Onchain clones hit the same legal wall in the US.

#### Polymarket US / Polymarket International / Polymarket Perps
- What it does: The biggest crypto-native prediction venue. It now also runs a separate perps venue (non-US only).
- Traction: Polymarket US fees = **$2.97M (Mar) → $30.0M (Jun) → $58.6M (Sep)**. International volume $4.79B → $2.22B (DefiLlama, 2026-09-29).
- Why it's working: The US license brings in US flow, and the brand carries over to new products (Perps, Combos).
- Open source?: Uses the Gnosis Conditional Token Framework (public contracts; license unverified); the app is closed.
- On Monad already?: no (unverified)
- Metropolis fit: Track 01, idea 02 (event underlyings) or idea 06 ("Embedded trading experiences inside wallets, games, or other apps").
- Risks: The onchain International venue is shrinking.

#### Predict Fun (BSC), OPINION, PredictStreet (ADI)
- Traction: Predict Fun fees **$0.69M (Mar) → $3.50M (Jun) → $5.95M (Sep)**. OPINION volume ~$0.3–0.44B/month, flat (DefiLlama).
- Why it's working: Predict Fun is a crypto-native, chain-local venue riding BSC's retail flow.
- Metropolis fit: Track 01, idea 02 or idea 05 ("Mobile-first or simplified trading experiences built for a specific segment").

### 2.2 RWA perps (equities, commodities, pre-IPO on Hyperliquid HIP-3 and others): HOT
**What's driving it**
- **24/7 access to TradFi underlyings** (oil, silver, S&P 500, Nasdaq-100, Samsung) plus **pre-IPO markets**. The SpaceX IPO market alone did >$1.3B on trade.xyz ([Talos](https://www.talos.com/insights/trade-xyzs-role-in-hyperliquid)).
- **HIP-3 market-deployment auctions** let third parties list markets. In the 2026-09-29 snapshot Hyperliquid had 11 builder DEXs: xyz, flx, vntl, hyna, km, abcd, cash, para, mkts, io. The **io** DEX lists `io:ANTH` and `io:OAI` (Anthropic/OpenAI pre-IPO) and `io:SNDK`. The **para** DEX lists `para:ANSEM`, a perp on a person / attention (unverified what it tracks). Source: `api.hyperliquid.xyz/info`, `perpDexs` and `metaAndAssetCtxs`.
- **Strategic money is here.** Variational raised a **$50M round led by Dragonfly** for "real-world perps" ([CoinDesk, 2026-05-21](https://www.coindesk.com/business/2026/05/21/peer-to-peer-trading-startup-variational-raises-usd50-million-for-real-world-perps-in-funding-round-led-by-dragonfly)). Variational OI grew **$0.35B → $1.02B** (Mar→Sep, DefiLlama OI).

#### trade.xyz (Hyperliquid HIP-3)
- What it does: A builder-deployed perp DEX on Hyperliquid with 108–127 equity, index, commodity and pre-IPO markets.
- Traction: 24h volume = **$3.09B**; OI (mark × size) ≈ **$3.73B** (Hyperliquid API, 2026-09-29). Top markets: SP500 $356M, CL (crude) $316M, SILVER $296M, XYZ100 $279M. Talos: **$460B since Jan 2026, 55% of HL volume in Aug 2026**, $5.0M fees/month ([Talos](https://www.talos.com/insights/trade-xyzs-role-in-hyperliquid)).
- Why it's working: Crypto margin, 24/7 trading, and listings go live in hours. "Growth Mode" cuts fees by more than 90%.
- Open source?: closed (HIP-3 spec is public)
- On Monad already?: no
- Metropolis fit: Track 01, idea 05 ("Mobile-first or simplified trading experiences built for a specific segment (new traders, a specific asset class, a specific region)") and idea 12 (tokenized equities as a programmable asset). The Agora Mobile Trading $10K bounty is also Track 01.
- Monad angle: A Kuru CLOB exists on Monad. An RWA perp venue or UI there is plausible.
- Risks: Oracles for off-hours pricing, regulatory exposure, and trade.xyz's liquidity moat.

### 2.3 Tokenized stocks and Robinhood Chain: HOT
**What's driving it**
- **Robinhood Chain mainnet (2026-07-01, Arbitrum Orbit)** with Robinhood Stock Tokens. Memecoins took over: 79.2% of chain DEX volume on 2026-07-27 ([CoinGecko](https://www.coingecko.com/learn/robinhood-chain-built-for-rwa-loved-for-memes)).
- **New mechanism: stock-paired memecoins.** Tokens are paired directly against stock tokens (NVDA, TSLA, GME/AMC) ([KuCoin](https://www.kucoin.com/blog/robinhood-stock-paired-meme-coins)). "Memecoin-stock" pairs did $217M on one day ([Incrypted](https://incrypted.com/en/daily-dex-trading-volume-on-robinhood-chain-topped-1-55-billion-driven-by-memecoins-and-rwas/)).
- **Distribution expanding.** Coinbase put tokenized US stocks on Base on 2026-08-24, and Robinhood offers them in 120+ countries ([Seoul Economic Daily, 2026-09-27](https://en.sedaily.com/finance/2026/09/27/tokenized-stocks-jump-fivefold-in-2026-as-us-venues-prepare)). The same article says tokenized-stock AUM was **$4.43B, +390% YTD** in mid-September. That is a different basis from rwa.xyz's "distributed" $3.16B.
- Robinhood Chain's share of fees: in the last 30 days it had **$60.3B DEX volume, #2 behind Solana ($88.9B)**. Uniswap V4 fees on Robinhood Chain were $108M of V4's $137M (DefiLlama, 2026-09-29).

#### Ondo Global Markets / bStocks / xStocks
- Traction: distributed value Ondo **$869M**, bStocks **$763M**, xStocks **$579M** ([rwa.xyz/stocks](https://app.rwa.xyz/stocks), 2026-09-29). Ondo GM's onchain DEX volume is *falling*: **$1.38B (Mar) → $0.45B (Sep)** (DefiLlama). Holders are growing while DEX trading moves to Robinhood Chain and to perps.
- Why it's working: Non-US retail gets US-equity access, 24/7, with DeFi composability.
- Open source?: closed issuers
- On Monad already?: partial (unverified). Check in `monad-gap-check.md`.
- Metropolis fit: Track 01, idea 12: "Tokenized equities as a programmable asset — a contract that locks, streams, conditions, or distributes the equity itself… build against a mock ERC-20". Also idea 01: "Next-generation launchpads built around a specific emerging asset class".
- Risks: Real stock tokens aren't on Monad, but the track explicitly allows a mock.

### 2.4 Launchpads and trading terminals: HOT (a mania, treat it with care)
- Pons V2 (Robinhood Chain) fees: **$0 (Jul) → $22.7M (Aug) → $139.7M (Sep)** (DefiLlama). It did $370.2M volume on 2026-09-01 per Dune ([Yahoo](https://finance.yahoo.com/markets/crypto/articles/pons-earned-more-fees-24-114245303.html)). Bitquery: on Sep 3, **35,008 of 69,598** Pons trader wallets were first-timers ([Bitquery](https://bitquery.io/investigations/pons-launchpad)).
- Flap (BSC) **$1.2M → $42.6M**. pump.fun $32.7M → $47.6M (Mar→Sep).
- Trading terminals: GMGN **$10.2M → $50.9M**, Axiom $19.9M → $38.5M, fomo **$2.0M → $34.8M** (Mar→Sep). fomo is multichain and already lists Monad (DefiLlama chains field).
- ⚠️ **Rug allegation.** An onchain analyst alleges **$18.43M was extracted from 53 Pons launches** ([CMC news summary, 2026-09-27](https://coinmarketcap.com/cmc-ai/pons/latest-updates/)) (unverified primary).
- Metropolis fit: Track 01, idea 01 is explicit: "…not another fair-launch meme bonding curve". Adapt the **distribution mechanic** only, e.g. a launchpad around stock tokens or around compute contracts.

### 2.5 Stablecoin cards and neobanks: HOT (steady compounding)
- a16z: **$759M card spend in Jul 2026**, 2.5× YoY, ~9M purchases, $86 average; USDC 58%; Optimism 29% / Solana 19% / Base 19% ([a16z crypto, 2026-08-08](https://a16zcrypto.substack.com/p/crypto-cards-hit-759-million-a-month)).
- SpendNode (Aug 2026): ether.fi **$109.5M** (+9.2%), KAST **$104.8M** (+17.0%), Plasma One **$19.9M** (+31%), Tria $18.9M. RedotPay top-ups were **$519.9M, +40%** (a proxy, not spend) ([SpendNode](https://www.spendnode.io/crypto-cards/stats/)).
- Funding: payments & stablecoins was the **#1 category in H1 2026 at $3.7B**. Rain raised $250M, with Dragonfly's Rob Hadick investing ([CoinDesk](https://www.coindesk.com/business/2026/08/15/the-usd11-2-billion-in-2026-funding-that-killed-crypto-s-permissionless-era)). Dragonfly also led Mesh's $75M Series C (Feb 2026) and Rhythmic's $4M seed (unverified primary for both).
- Caveat: stablecoin **supply is flat** at ~$307–318B all year (DefiLlama). The growth is in *usage per dollar*, not in new dollars.

#### ether.fi Cash (Optimism/Scroll)
- Traction: card volume **$62.5M (Mar) → $131.9M (Sep)** (DefiLlama). $109.5M spend in Aug (SpendNode).
- Why it's working: You borrow against yield-bearing collateral and spend, so you don't sell. It's a Visa rail.
- Metropolis fit: Track 02, idea 06: "Salary streaming at the individual level… with idle balances earning yield in the background until you spend them". Agora Cross-Border $10K is a Track 02 bounty.
- Risks: A card needs an issuer partner (Rain/Visa). For a hackathon, demo the onchain half.

#### Plasma One (Plasma)
- Traction: **$1.10M (Mar) → $25.89M (Sep)** card volume (DefiLlama). This is the fastest-growing card we found.
- Why it's working: A stablecoin-chain neobank with zero-fee USDT.
- Metropolis fit: Track 02 (consumer neobank). Also see `evm-l2s-and-payment-chains.md`.

### 2.6 Physical TCG: STEADY (we checked the five Track-03 TCG ideas)
- Collector Crypt (Solana): fees **$5.3M (Mar) → $16.1M (Jun) → $12.0M (Sep)**; volume $50M (May) → $175M (Jun) → $136M (Sep). Cumulative volume **$1.6B** ([Solana Compass](https://solanacompass.com/news/collector-crypt-crosses-16-billion-in-volume-as-solanas-tokenized-card-market-builds-scale)). A $1M PSA-10 Charizard sale was announced on [X](https://x.com/Collector_Crypt) (unverified date).
- Courtyard (Polygon): fees **$6.3M → $2.3M**, i.e. **cooling**. Volume flat at ~$100–140M/month.
- Phygitals: volume **$4.4M (Jul) → $26.7M (Sep)**, rising. Fees are ~0 or negative, which suggests heavy incentives.
- Gacha TCG (Abstract): fees **$0.34M (Mar) → $4.27M (Aug) → $2.0M (Sep)**.
- What's driving it: The **gacha pack-opening loop** (buy a pack, sell it back instantly at a set % of value; exact % unverified) earns the fees. Secondary marketplace trading earns much less. That's the mechanism to copy.
- Metropolis fit: Track 03, idea 06 ("A TCG marketplace with real-time onchain order books…"), idea 08 ("Automated market makers designed specifically for the long-tail of collectible assets…") and idea 09 ("Rental and lending markets for high-value cards…").
- Risk: Category fees peaked in June. The leaders need physical vaulting and grading partners that a hackathon team can't replicate. Use a mock vault.

### 2.7 Compute markets: EMERGING
- CME lists Silicon Data H100 and B200 Rental Index futures on **2026-10-05**. Each contract = 730 GPU-hours, cash-settled ([CME PR, 2026-08-11](https://www.cmegroup.com/media-room/press-releases/2026/8/11/cme_group_and_silicondatatolaunchcomputefuturesonoctober5tounloc.html)). ICE and Ornn are launching GPU compute futures on the Ornn Compute Price Index ([ICE PR](https://ir.theice.com/press/news-details/2026/ICE-and-Ornn-to-Launch-GPU-Compute-Futures-Contracts/default.aspx)).
- Onchain: USD.AI TVL **$230M** (DefiLlama 2026-09-29). The project claims $585M, up 72% since its April TGE ([X article](https://x.com/i/article/2101980548067696830)) (unverified). GAIB is $18.9M.
- Why it matters for us: The official index and contract spec exist now, and the CME launch lands **during the hackathon**. A team can cite a real reference rate instead of inventing one.
- Metropolis fit: Track 01, idea 08: "Compute Spot Exchange — an onchain CLOB for standardized compute contracts (e.g. '1 H100-hour, region X, delivered week N')". Also ideas 09–11.

## 3. What the judges' firms are backing (2026)
Only deals we found with a named source. DefiLlama `/raises` is paywalled, so this list is **incomplete**.

| Firm | 2026 activity found | Category |
|---|---|---|
| Paradigm | Co-led **Morpho $175M** with a16z crypto and Ribbit ([Fortune, 2026-06-09](https://fortune.com/2026/06/09/morpho-fundraise-a16z-crypto-paradigm-ribbit-capital-175-million/)). Led the seed for **Liquid**, a leveraged-trading app for stocks, crypto, commodities, prediction markets and private secondaries (amount unclear: $7.6M seed vs $18M Series A in reports) ([Yahoo](https://finance.yahoo.com/markets/crypto/articles/exchange-startup-liquid-raises-18-120000483.html)). Raised a new **$1.2B fund for the "technical frontier", incl. AI/robotics** ([TechCrunch, 2026-07-08](https://techcrunch.com/2026/07/08/crypto-vc-firm-paradigm-raises-1-2b-to-invest-in-technical-frontier-startups/)) | Lending/curation, all-in-one trading, AI |
| Dragonfly | **Variational $50M** (RWA perps, May). **Mesh $75M** (payments, Feb). **Megapot $5M** (onchain lottery, Mar). **Rhythmic $4M** (stablecoin payments, Feb). Closed a $650M fund 4 with Polymarket and Rain as early bets ([Fortune](https://fortune.com/2026/02/18/dragonfly-term-sheet-venture-capital-blockchain-crypto-polymarket-rain/)) | RWA perps, payments, prediction, lottery |
| Castle Island | Led **Project Eleven $20M Series A** (quantum-resistant infra, Jan 2026) (unverified primary) | Security infra |
| Electric Capital | Led **Squads $10M Series A** (Jul 2026) (unverified primary) | Smart-account infra |
| Galaxy | Research: Q2 2026 VC report found **$5.6B across 384 deals, +31% QoQ** ([TechFlow summary](https://www.techflowpost.com/en-US/article/34085)). Also published an x402 agentic-payments research piece ([Galaxy](https://www.galaxy.com/insights/research/x402-ai-agents-crypto-payments)) (date unverified) | Payments/AI research |
| Pantera, CoinFund | No verified **2026** lead found (their Veda, STON.fi and Subzero deals are 2025) | n/a |

**Takeaway:** The judges' money is going to **RWA/TradFi perps, stablecoin payments, prediction markets, and lending curation**. Very little is going to creator coins or agent tokens.

## 4. Rejected / overhyped

| Narrative | Why we reject it (evidence) |
|---|---|
| **x402 "agent economy" volume** | Settlement volume **−93% YTD**, ~$41.8K/day ([Yahoo/Helios, 2026-08-13](https://finance.yahoo.com/markets/crypto/articles/x402-settlement-volume-plunges-93-105710906.html)). Only **$41.8M cumulative** across 188M txs, so most transactions are dust or tests ([agenteconomy.to](https://agenteconomy.to/x402), 2026-09-23). Transaction counts are hype and dollar value is tiny. Standards work (ERC-8004, 101K agents) is fine for Track 04, but not as a *traction* story. |
| **AI agent tokens (Virtuals etc.)** | Virtuals fees ~**$0.3–0.6M/month** in most of 2026, with a one-off spike to $2.2M in Jul (DefiLlama). |
| **Creator coins (Zora/Base App)** | ZORA Coins fees round to **$0.01–0.06M/month** in 2026 (DefiLlama). The only 2026 volume figure, **$1.6B cumulative by 2026-05-31**, is self-reported. Track 03 ideas push *attention/curation*, not coin-per-post. |
| **Pure memecoin launchpads** | Fees are real ($260M/month category), but it's a mania with an alleged $18.4M rug on the leader (Pons). The README rules out "pure memecoins", and Track 01 idea 01 excludes "another fair-launch meme bonding curve". Adapt the distribution, not the product. |
| **"Stablecoin supply boom"** | Supply is flat, $307.6B (Mar 1) → $311.5B (Sep 28) (DefiLlama). Pitch *usage* (cards/payments), not supply growth. |
| **Generic crypto perp DEX clones** | Category fees are flat to down ($136M → $123M, Mar→Sep). Aster's "50% share" headlines come from **Sep–Oct 2025** and are widely called wash volume. Don't cite them as 2026 data. |
| **Onchain Polymarket International** | Volume **halved Mar→Sep** ($4.79B → $2.22B) as flow moved to regulated US venues. |
| **ICO / "internet capital markets" platforms** | We found no verified 2026 volume data. Sonar's $175.5M cumulative and Legion's $44.1M (coinlaunch.space, date unclear) are small next to launchpad fees. Mark as **unverified / steady**. |
| **Courtyard specifically** | Fees fell **$6.3M → $2.3M** (Mar→Sep) while Collector Crypt held up. Don't copy Courtyard's marketplace-only model. |

## 5. So what for Metropolis
1. **Strongest data-backed lane (Track 01):** RWA perps and tokenized stocks, plus prediction/event underlyings. The official ideas (02, 05, 12), the metrics, and the judges' 2026 checks (Dragonfly→Variational, Paradigm→Liquid) all line up.
2. **Track 02:** Stablecoin card/neobank usage is compounding (2.5× YoY). "Yield-while-idle spend" (ether.fi Cash pattern) maps to official idea 06.
3. **Track 03:** TCG is real but past its peak. The fee engine is **gacha packs + instant buyback**, not the marketplace.
4. **Wildcard with timing:** compute futures. The CME launch on Oct 5 hands us a real index for official ideas 08–11.

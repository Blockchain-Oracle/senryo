# Deep dive: equity, commodity, FX and pre-IPO perpetuals ("RWA perps"), and what building them on Monad would take

Researched 2026-09-29. Method and evidence standard: [README.md](README.md). This expands candidates 1, 6 and 12 in [solana-hyperliquid.md](solana-hyperliquid.md) and #2 and #3 in [trend-radar.md](trend-radar.md). Track context: [../01-tracks/onchain-finance.md](../01-tracks/onchain-finance.md).
**Framing:** no time or effort limit. For each obstacle we report how existing venues got past it and which route this team can take. We use "risk" only where we found no known route.
Raw pulls (Hyperliquid API JSON, DefiLlama JSON, scraped pages, trade.xyz docs mirror) are in the session scratchpad under `research/deep-perps/`.

---

## 0. Verdict (short)

- **The market is real and very large, but most of it is not onchain, and the onchain part has one winner.** RWA perps traded **$799.5B in Aug 2026**, up from $105.2B in Jan. Centralised exchanges hold **87.2%** of that ([bit.com](https://www.bit.com/knowledge-hub/rwa-perps), Sep 2026). Onchain, **trade[XYZ] holds 70% of RWA-perp OI** ([DefiLlama RWA perps by venue](https://defillama.com/rwa/perps/venues), 2026-09-29) and **95%+ of HIP-3 volume/OI** ([Blockworks via 0xArchive](https://0xarchive.io/resources/research/addressing-hyperliquid-s-hip-3-deployer-bottleneck)).
- **A generic "RWA perp DEX on Monad" is not worth building.** Monad's entire perp OI is **$1.84M** ([DefiLlama Monad perps](https://defillama.com/perps/chain/monad), 2026-09-29). **LeverUp already lists 50 RWA pairs on Monad** (stocks, indices, gold, oil, FX, ANTH, OPENAI). It routes them cross-exchange to trade[XYZ] on Hyperliquid (`executionVenue: HYPERLIQUID`), listed 2026-09-16 ([LeverUp API](https://service.leverup.xyz/v1/pairs), pulled 2026-09-29). **HelloTrade** (Dragonfly, ex-BlackRock) is "Live in Alpha" with perps up to 50× across a claimed 10,000+ markets ([hello.trade](https://www.hello.trade/), 2026-09-29).
- **It is worth building if the product is a primitive or a wedge, not a venue clone.** The two routes that pass the evidence bar and the track's *"faster clone"* test:
  1. **A permissionless, session-aware RWA market layer on Monad** ("HIP-3 for Monad"). Deployers bond collateral, bring an oracle config, and list markets onto an onchain CLOB (Perpl, or our own). The protocol enforces external/internal pricing sessions, discovery bounds, OI caps and corporate-action settlement onchain. Nothing like this exists on Monad. Perpl lists **9 crypto markets only** and gives third parties no listing path ([Perpl `/v1/pub/context`](https://app.perpl.xyz/api/v1/pub/context), 2026-09-29).
  2. **A segment-specific front end on existing liquidity.** Examples: a Korean/AI-memory basket app, or a weekend-trader app that routes via Perpl builder codes or LeverUp brokers. Front ends are a proven business on Hyperliquid: Phantom routed **$867M**, Dreamcash **$568M** and MetaMask Perps **$206M** of HIP-3 flow in the Arrakis sample ([Arrakis](https://arrakis.finance/blog/who-is-trading-on-hip3)).
- **Everything that failed onchain failed on oracle or operations, not matching.** Ostium was drained of **$23.75M** through a compromised oracle-signer key (15 Jul 2026, [Galaxy](https://www.galaxy.com/insights/research/ostium-left-an-opening-for-exploiters-and-24m-went-out-the-door)). Its OI fell **$338M (Jan) → $10.6M (Sep)** (DefiLlama). trade[XYZ] paid back **~$60M** of liquidations caused by one thin Korean pre-market print (27 Jul 2026, [bitcoinfoundation.org](https://bitcoinfoundation.org/news/blockchain-news/tradexyz-cover-losses-from-60m-sk-hynix-liquidations/)). **The oracle and session design is the product.** This is where a new entrant can be visibly better.

---

## 1. Market: size, players, underlyings, users

### 1.1 Category size
| Metric | Value | Source, date |
|---|---|---|
| RWA-perp monthly volume (all venues incl. CEX) | $105.2B (Jan-26) → $279.4B (Mar) → $471.5B (Jun) → $792.2B (Jul) → **$799.5B (Aug)**. Cumulative $3.16T across 19 venues | [bit.com](https://www.bit.com/knowledge-hub/rwa-perps), Sep 2026 (secondary; cites DefiLlama/CryptoBriefing) |
| CEX share of RWA-perp volume | **87.2%** (Aug-26). DEX share was 51.4% in Dec-25 | same |
| Equities' share of volume | 62.3% (Aug-26). Equities overtook commodities in Jun-26 | same |
| Weekday vs weekend volume | $30–39B/day weekdays, **$3–5B/day weekends (<5% of volume since Jul-26)** | same |
| Onchain RWA-perp OI by asset group | Public equities $2.60B (48%), precious metals $0.97B (18%), equity indices $0.90B (17%), oil $0.39B (7%), FX $0.24B (4.5%), AI & compute infra $0.15B, **private equity & venture (pre-IPO) $0.06B (1.1%)** | [DefiLlama RWA perps by asset group](https://defillama.com/rwa/perps/asset-groups), 2026-09-29 |
| Gold + silver cumulative volume | $573.7B + $398.6B ≈ $972B, the largest RWA-perp contracts of 2026 | [bit.com](https://www.bit.com/knowledge-hub/rwa-perps) |

### 1.2 Players (numbers pulled 2026-09-29 unless noted)
| Venue | Model | OI | Volume | Fees / revenue | Trend | Source |
|---|---|---|---|---|---|---|
| **trade[XYZ]** (Hyperliquid HIP-3, by Unit) | CLOB on HyperCore; own oracle relayer | **$3.73B** (127 markets) | **$3.07B/24h** | 30d fees **$6.40M**; monthly $4.10M (Jan) → $9.54M (Jul peak) → $5.99M (Sep 1–28). DefiLlama page: revenue 30d $2.3M | OI $0.70B (Jan) → $3.74B (Sep) | [HL API](https://api.hyperliquid.xyz/info) `metaAndAssetCtxs dex=xyz`; [DefiLlama fees](https://api.llama.fi/summary/fees/tradexyz); [DefiLlama page](https://defillama.com/protocol/tradexyz) |
| **Variational** (Omni, Arbitrum) | **RFQ**: one in-house market maker (OLP), zero trading fees; the protocol keeps ~20% of OLP spread | $1.02B total; **$751M RWA** (122 RWA markets) | RWA $102.8M/24h | n/a (zero-fee) | OI $0.39B (Jan) → $1.02B (Sep). $50M round led by Dragonfly (May-26) | DefiLlama OI API; [DefiLlama RWA venues](https://defillama.com/rwa/perps/venues); [Bankless](https://www.bankless.com/read/variational-is-quietly-climbing-the-perps-leaderboard); [CoinDesk](https://www.coindesk.com/business/2026/05/21/peer-to-peer-trading-startup-variational-raises-usd50-million-for-real-world-perps-in-funding-round-led-by-dragonfly) |
| **Lighter Robinhood Perps** (Robinhood Chain) | CLOB (zk). USDG-quoted instance inside Robinhood Wallet | $225.1M (all assets) | 30d $7.79B (all assets) | Fees $0.01M (Jul) → $0.70M (Aug) → $1.67M (Sep) | New since 1 Jul 2026. Robinhood flow = ~17% of Lighter's daily volume ([The Defiant](https://thedefiant.io/news/defi/lighter-lit-perp-dex-token-rally-robinhood-volume)). Equity share of this volume **(unverified)** | DefiLlama OI/fees; [Robinhood](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading/) |
| Lighter (main) RWA | CLOB, 24/5 equity perps (Chainlink / Stork oracles) | $108.5M RWA | $61.1M/24h RWA | — | — | [DefiLlama RWA venues](https://defillama.com/rwa/perps/venues) |
| **Ondo Perps** (Ondo Global Panama) | P2P perps; **tokenized stocks accepted as collateral** | $86.7M | $13.5M/24h RWA | n/a | Launched 7 Jul 2026; OI $15M (Jun) → $95M (Aug) → $87M (Sep) | DefiLlama OI; [PR Newswire via Yahoo](https://finance.yahoo.com/markets/options/articles/ondo-perps-launches-first-equity-161200015.html) |
| **Polymarket Perps** | Perps inside Polymarket (crypto + stocks) | $75.5M | per-market $10K–$6M on [polymarket.com/perps](https://polymarket.com/perps) | n/a | Public launch 14 Aug 2026 ([DeFiRate](https://defirate.com/perp/polymarket/)); first launch Apr 2026 ([CNBC](https://www.cnbc.com/2026/04/21/polymarket-launches-trading-of-heavily-leveraged-perps-contracts.html)). Equity share **(unverified)** | DefiLlama OI |
| **EntropyIO** (`io` HIP-3 dex) | CLOB on HyperCore; RedStone oracle; pre-IPO focus | $57.0M (`io:ANTH` $37.0M) | $34.2M/24h (mostly `io:SNDK` $22.4M) | $0.05M (Aug) → $0.10M (Sep) | $14M seed led by Ribbit (Aug-26) | HL API; DefiLlama; [RedStone blog](https://blog.redstone.finance/2026/08/24/redstone-live-powers-entropy-pre-ipo-and-rwa-markets-on-hyperliquid/) |
| **Ostium** (Arbitrum) | **Oracle-priced pool** (OLP vault is the counterparty); Stork-operated in-house oracle; market-hours halts | **$10.6M** (DefiLlama OI API) / $19.7M (RWA venues page) | **$0/24h** on RWA venues page | Fees $4.39M (Jan) → $0.87M (Aug) → **$0.05M (Sep)** | Collapse after the 15 Jul 2026 exploit. Previously ~$95M OI and $4.7B/30d volume in May-26 ([Ostium blog](https://www.ostium.com/blog/perps-on-rwas-best-dex-for-rwa-perpetuals-2026-guide)). Raised $27M incl. $20M Series A (General Catalyst, Jump) ([docs](https://ostium-labs.gitbook.io/ostium-docs)) | DefiLlama fees/OI |
| **Dreamcash** (`cash` HIP-3 dex + mobile app) | Front end + USDT0-margined dex | `cash` dex **$0** | `cash` dex **$0/24h** | Interface fees ~$0.03–0.04M/month since Jul-26 | Tether strategic investment. As a front end it routed $568M of HIP-3 flow (Arrakis sample, cumulative) | HL API; DefiLlama `dreamcash-interface`; [The Block](https://www.theblock.co/post/389916/tether-invests-in-hyperliquid-frontend-dreamcash-offering-perps-markets-for-tsla-gold-and-more-using-usdt0-collateral) |
| Other HIP-3 dexes | flx, vntl, hyna, km, abcd, cash | $0 | $0/24h | Felix formally wound down ([Blockworks via 0xArchive](https://0xarchive.io/resources/research/addressing-hyperliquid-s-hip-3-deployer-bottleneck)) | — | HL API |
| **Monad today** | Perpl (CLOB, crypto only), LeverUp (oracle-pool; RWA pairs routed to HL), Drake | Chain total **$1.84M** (Perpl $1.76M, LeverUp $72K) | Perpl $14.1M/24h, LeverUp $7.9M/24h | Perpl fees $0.28M (Jul) → $0.20M (Sep); LeverUp $0.04M (Sep) | Weekly change −36% | [DefiLlama Monad perps](https://defillama.com/perps/chain/monad); DefiLlama fees |

Note: DefiLlama's RWA-venues page shows trade[XYZ] 24h volume as $312.8M, against $3.07B from the Hyperliquid API for the same day. The page probably uses a partial-day window. We use the HL API for volume and DefiLlama for OI.

### 1.3 Which underlyings drive volume (trade[XYZ], HL API snapshot 2026-09-29 05:17 UTC, 24h)
| Bucket | Share of 24h volume | Share of OI | Top markets |
|---|---|---|---|
| Commodities (oil, silver, gold, copper…) | **32.6%** | 20.8% | CL $317M, SILVER $293M, BRENTOIL $249M, GOLD $129M |
| AI / semis / memory (23 names) | **27.4%** | **37.3%** | SMSN $152M, SKHX $147M, NVDA $117M, SNDK $79M, INTC $68M, MU $61M, DRAM $58M |
| Equity indices / index ETFs | 24.7% | 16.1% | SP500 $354M, XYZ100 $279M |
| Pre-IPO / recent IPO | 3.6% (SPCX alone) | 3.2% | SPCX $110M (OI $118M), CBRS OI $40M, ZHIPU OI $22M |
| FX | **0.1%** | 1.4% | JPY $1.95M, EUR $1.3M, GBP $0.4M, KRW $0 |
| Other single stocks (74 names) | 11.6% | 21.2% | META $104M, TSLA $24M, AAPL $22M |
- **Korea is a distinct cluster:** SMSN, SKHX, SKHY, KR200, EWY, KORU and HYUNDAI = **$385M/24h (12.6% of trade[XYZ] volume), $585M OI**.
- **Concentration:** the top 10 markets = **70%** of volume, and **24 of 127** markets traded under $0.1M in 24h.
- **The AI/compute narrative drives volume:** AI/semis were **~53% of trade[XYZ] volume in Jul-26**, with SK Hynix and Micron each >20% of that basket ([Talos](https://www.talos.com/insights/trade-xyzs-role-in-hyperliquid)).
- **FX perps are nearly dead on the leading onchain venue.** FX is 7.1% of all RWA-perp 24h volume ([DefiLlama asset groups](https://defillama.com/rwa/perps/asset-groups)). That flow sits on CEX-style and pool venues, not on HIP-3.
- **Pre-IPO:** demand is real but concentrated. `xyz:SPCX` (SpaceX) did **>$1.3B around its IPO** ([Talos](https://www.talos.com/insights/trade-xyzs-role-in-hyperliquid)). Cerebras' pre-IPO perp priced its Nasdaq open **within 1.3%** ([Talos](https://www.talos.com/insights/state-of-the-network-367)). Ventuals (the first pre-IPO dex) is at $0. Pre-IPO is only 1.1% of onchain RWA-perp OI.

### 1.4 Who the users are
- **Arrakis classified 175,703 wallets / $161.4B** across 7 HIP-3 markets: market makers **1.1% of wallets / 11.8% of volume**, retail **28.4% / 12.8%**, stat-arb takers 1.7% / 4.2%, unclassified (mostly bots) **71.2%** of volume. **On weekends, retail's share of volume doubles from 12% to 28%** ([Arrakis](https://arrakis.finance/blog/who-is-trading-on-hip3)).
- **Distribution runs through front ends:** TreadFi $1.19B, Phantom $867M (6,569 wallets), Based One X $579M, Dreamcash $568M, Rabby $273M, MetaMask Perps $206M (1,610 wallets, 10 bp builder fee) (same source).
- **Geography (inference):** the Korean cluster above plus US-person geo-blocks on every venue point to Asian and non-US retail. We found no official user-geography data **(unverified)**.
- **Demand thesis (Blockworks Research):** retail uses 0DTE options for leveraged direction. That is ~**$48T/month** implied notional, ~40× all CEX crypto perps in Sep-25. And ~95% of US companies report earnings outside regular hours ([Blockworks equity-perps report](https://app.blockworksresearch.com/unlocked/equity-perpetuals-landscape-report)).

---

## 2. How each design works, and which is proven vs failing

### 2.1 Matching model
| Model | Who | Status (evidence) |
|---|---|---|
| **CLOB, builder-deployed markets on a shared engine** | trade[XYZ] and other HIP-3 dexes | **Proven for the winner, failing for everyone else.** trade[XYZ] has 70% of onchain RWA OI. Non-XYZ HIP-3 deployers earn <1% on bonded HYPE (Kinetiq 4.2%, Dreamcash 2.7% vs XYZ 74%). The median non-XYZ auction payback is **4 years**. Felix wound down ([Blockworks/0xArchive](https://0xarchive.io/resources/research/addressing-hyperliquid-s-hip-3-deployer-bottleneck)) |
| **CLOB, single venue** | Lighter (incl. Robinhood instance), Perpl on Monad | Proven for Lighter (Robinhood OI $0→$225M in 3 months). Perpl has no RWA markets |
| **RFQ, in-house market maker** | Variational Omni, HelloTrade (RFQ + routed + books) | **Growing:** Variational RWA OI $751M, 122 markets, zero fees. OLP hedges on CEXs, DEXs and TradFi dealers ([Bankless](https://www.bankless.com/read/variational-is-quietly-climbing-the-perps-leaderboard)) |
| **Oracle-priced pool (vault is the counterparty)** | Ostium, gTrade, LeverUp (Monad) | **Failing for RWA.** Ostium: exploit, then OI −97%. Blockworks: Ostium's vault was "primarily under-collateralized for 85+ days", and the model "mandates weekend halts" to match off-chain hedging ([Blockworks](https://app.blockworksresearch.com/unlocked/equity-perpetuals-landscape-report)). gTrade RWA volume $0/24h (DefiLlama RWA venues) |
| **P2P with tokenized-stock collateral** | Ondo Perps | Early: $87M OI, flat Aug→Sep |

### 2.2 Oracle design for equities (the core engineering problem)
- **trade[XYZ]** ([docs](https://docs.trade.xyz/perpetuals/mechanics/oracle-price)):
  - A **relayer** publishes oracle, mark and external prices **~every 3 s** ([architecture](https://docs.trade.xyz/architecture)).
  - **External session:** the fair price comes from venues and institutional data. US stocks are priced 24/5 (Sun 20:00 → Fri 20:00 ET) across pre-market, regular, post-market and **Blue Ocean ATS overnight** ([US stocks](https://docs.trade.xyz/perpetuals/markets/stocks/us)). Index perps use Pyth futures feeds with a basis/discount-rate adjustment. KRW names are converted with Pyth USD/KRW.
  - **Internal session** (weekends, holidays, or any >30 s gap in external data): the oracle moves as a **continuous-time EMA (τ = 30 min)** of the order book's impact-price difference. Each step is capped at ~9.5%.
  - **Mark** = median of (oracle, oracle + 150 s EMA of basis, median of best bid/ask/last trade). Each relayer update is **clamped to ±50 bp**.
  - **Discovery bounds** hold the mark within **±1/max-leverage** of a reference (±5% at 20×). The bound re-anchors when 90% of the band is reached, up to a per-market number of resets, then becomes a hard cap until external pricing resumes ([discovery bounds](https://docs.trade.xyz/perpetuals/mechanics/discovery-bounds)).
  - **Pre-IPO perps** start from a discretionary reference price, run on internal pricing with **1% of the normal funding**, and convert to a normal equity perp after listing ([pre-IPO](https://docs.trade.xyz/perpetuals/markets/pre-ipo-perpetuals)).
- **Corporate actions (trade[XYZ]):** dividends are not paid; their effect runs through price and funding. **Splits force settlement of all positions and a reopen** on the new basis (e.g. the Kioxia split, 2026-09-28) ([corporate actions](https://docs.trade.xyz/perpetuals/corporate-actions)). Pyth announced corporate-action data "coming soon" ([Pyth blog list](https://www.pyth.network/blog/extended-hours-us-equity-data-moves-to-pyth-pro)).
- **Failure case:** on 27 Jul 2026 a single print on a thin Korean pre-market venue moved the SK hynix perp from ~$1,128 to $917 (−19%). About **$60M was liquidated** in two minutes. trade[XYZ] said the oracle "worked as intended" and reimbursed users ([bitcoinfoundation.org](https://bitcoinfoundation.org/news/blockchain-news/tradexyz-cover-losses-from-60m-sk-hynix-liquidations/); [bit.com](https://www.bit.com/knowledge-hub/rwa-perps)). Lesson: a feed can be correct and still read a venue too thin for the exposure resting on it.
- **Is weekend pricing good?** Yes. Across 614 market-weekends, weekend moves over 100 bp got the **direction right 94.9%** of the time and cut the median reopening error by 53%. Weekend median spread was 1.43 bp, similar to weekdays ([Blockworks via 0xArchive](https://0xarchive.io/resources/research/price-discovery-in-hyperliquids-weekend-markets)).
- **Ostium:** a pull-based in-house RWA oracle operated with Stork. Equity pairs halt outside market hours, overnight leverage is capped at 10×, and limit orders queue until reopen ([Ostium docs](https://ostium-labs.gitbook.io/ostium-docs/getting-started/ostium-explained-for-traders); [Blockworks](https://app.blockworksresearch.com/unlocked/equity-perpetuals-landscape-report)). **The exploit:** the verifier checked only that the signer was authorised, not whether the price was plausible or current. An attacker with a signer key plus a keeper (forwarder) role submitted **future-dated signed prices** and looped open/close ([Galaxy](https://www.galaxy.com/insights/research/ostium-left-an-opening-for-exploiters-and-24m-went-out-the-door)).
- **Stork:** the dangerous moments are the 09:30 and 16:00 ET transitions. Stork offers one continuous feed per ticker (e.g. `TSLA_24_5`) with transition behaviour configurable by the protocol ([Stork](https://www.stork.network/blog/equity-perps-oracle)).

### 2.3 Funding, liquidation, collateral
- **Funding:** HyperCore charges hourly funding. trade[XYZ] uses a 0.5 multiplier on HyperCore's clamped formula (0.005 for pre-IPO). The observed baseline is ~0.0006%/h on most xyz markets (HL API). **Ostium** uses rollover fees at real financing rates (SOFR-based). **Perpl** applies funding every **8,571 blocks** (`funding_interval_sec` 2,580, i.e. ~43 min at today's block time) with virtualized accumulators ([Perpl context](https://app.perpl.xyz/api/v1/pub/context)).
- **Liquidation:** HyperCore handles liquidation, a backstop and ADL. Per-market **OI caps** apply (e.g. `xyz:CL` $1B, `xyz:GOLD` $750M, most single names $25M) ([HL perpDexs](https://api.hyperliquid.xyz/info)). If a liquidation price lies outside the active discovery bound, the position cannot be liquidated until the bound moves.
- **Collateral:** USDC (xyz), USDT0 (Dreamcash), USDG (Lighter on Robinhood), **tokenized stocks** (Ondo Perps), AUSD (Perpl).

### 2.4 Market makers
- **HIP-3:** professional MMs quote on HyperCore. Arrakis found 2,016 MM wallets and noted trade[XYZ] itself runs "a multi-market quoting book" **(unverified detail)** ([Arrakis on X](https://x.com/ArrakisFinance/article/2049514473329959120)). Growth Mode cuts all-in fees by ≥90% (taker 0.009%, maker 0.003% at base tier) ([xyz fees](https://docs.trade.xyz/perpetuals/mechanics/fees)).
- **RFQ:** the MM is in-house (Variational OLP), so no outside MM needs to be bootstrapped for each listing.

### 2.5 Regulatory stance
- **Every venue geo-blocks US persons; none does KYC at the protocol level.**
  - trade[XYZ]: US persons prohibited ([disclaimer](https://docs.trade.xyz/legal-and-disclaimers/general-disclaimer)); also Canada and UK per [Datawallet](https://www.datawallet.com/crypto/tradexyz-explained) **(unverified)**.
  - Hyperliquid UI: US and Ontario ([terms](https://app.hyperliquid.xyz/terms)).
  - Perpl geo-blocks **BY, CU, GB, IR, KP, RU, SY, UA, US** ([Perpl context](https://app.perpl.xyz/api/v1/pub/context)).
  - Ondo Perps: offshore entity **Ondo Global Panama**, P2P, "outside the U.S. and other prohibited jurisdictions" ([PR](https://finance.yahoo.com/markets/options/articles/ondo-perps-launches-first-equity-161200015.html)).
- **Pre-IPO disclaimers:** trade[XYZ] states IPOPs are "not shares… not IPO allocations… not tokenized equity" ([pre-IPO](https://docs.trade.xyz/perpetuals/markets/pre-ipo-perpetuals)).

---

## 3. Monad specifics

### 3.1 Oracles that publish equity, commodity or FX data on Monad today (checked 2026-09-29)
| Provider | On Monad? | What's there for RWA | Access / cost |
|---|---|---|---|
| **Chainlink push feeds** | Yes, verified onchain via `latestRoundData()` | XAU/USD `0x61dD33A3…F1B4`, XAG/USD `0x29bEb7e7…7db4`, EUR `0x00D7E359…b99a`, GBP `0x1ffC8B75…5C30`, JPY `0xF64664Ea…8927`, CHF `0x6DBa7f3A…F6B8d`, CAD `0x3293eA56…97cA` (FX 240 s heartbeat). **6 "Calculated" tokenized-equity feeds, 24/5, 3,600 s heartbeat:** wNVDAx `0x03ffa467…06bf0`, wSPYx `0x2e2dA571…9006D`, wTSLAx `0xE42022cC…E9281`, wSPCXx `0x75771540…86d0b3` (read $145.795), wEWYx `0x54D1645F…AB25`, wQQQx `0x7CA45B17…02d9` | Free to read. The 1 h heartbeat is too slow for perp marks and fine for collateral or display ([directory JSON](https://reference-data-directory.vercel.app/feeds-monad-mainnet.json)) |
| **Chainlink Data Streams** | Yes: Router `0x33566fE5…CaDB`, VerifierProxy `0xEd813D89…48c8` ([chainlink-cre.md](../03-sponsors/finance-trading/chainlink-cre.md)); Perpl uses it for crypto | **RWA streams (v8 / v11 schema) with a `marketStatus` field.** Standard US equities, **24/5 US equities (Sun 20:00 → Fri 20:00 ET)**, APAC equities, FX majors, XAU/XAG, WTI ([market hours](https://docs.chain.link/data-streams/market-hours)). The 24/5 guide recommends **falling back to the tokenized-asset stream when the market is closed** ([guide](https://docs.chain.link/data-streams/rwa-streams/24-5-us-equities-user-guide)) | Credentials required; commercial pricing **(unverified)** |
| **Pyth** | Yes: Core contract `0x2880aB15…4B17B43` | Hermes lists **1,247 equity feeds** (US 1,074, HK 107, JP 22, KR 19…), 37 commodities, 39 FX, 11 metals. **30 "Equity.Index.* 24/7" feeds**, incl. US500, US100, NVDA, SNDK, SKHY, SAMSUNG, KR200, SPCX, **ANTHROPIC, OPENAI** ([Hermes](https://hermes.pyth.network/v2/price_feeds?asset_type=equity), 2026-09-29) | **Paid.** Since 31 Jul 2026, all Core access needs a Starter or Pro plan. Extended-hours `.PRE/.POST/.ON` equity feeds moved to **Pyth Pro: US Equities $5,000/mo, All Asset Classes $10,000/mo** ([Pyth](https://www.pyth.network/blog/extended-hours-us-equity-data-moves-to-pyth-pro)). Pyth Indices (24/7, Jun-26) and pre-IPO indices (17 Sep 2026, "indicative… from limited secondary-market data") are on **separate commercial terms** ([Pyth Indices](https://www.pyth.network/blog/24-7-finance-needs-24-7-price-infrastructure-introducing-pyth-indices); [Solana Compass](https://solanacompass.com/news/pyth-network-adds-anthropic-and-openai-as-first-pre-ipo-price-indices)). Hermes returned 401 without a key |
| **Stork** | Yes: `0xacC0a0cF…d4fd62` (mainnet and testnet; code present onchain) ([Stork EVM addresses](https://docs.stork.network/resources/contract-addresses/evm)) | Powers Ostium and Lighter RWA. Offers continuous 24/5 per-ticker feeds, and 24/7 "Perpetual Swap Oracle Price Feed" for nights and weekends ([The Block](https://www.theblock.co/news/business/2026-05-13-stork-24-7-price-discovery-401053)) | API key / commercial **(unverified)**. Which equity feeds are live on Monad **(unverified)** |
| **RedStone** | Yes, 50+ feeds, mostly crypto/LST ([RedStone](https://www.redstone.finance/blog/redstone-on-monad-the-real-time-data-layer-for-high-speed-defi/)) | "RedStone Live" RWA-perp streaming powers Entropy's pre-IPO markets. Also end-of-day equity feeds | Equity feeds on Monad **on request (unverified)** |
| **Chronicle** | Yes (custom oracles) | No equity evidence found **(unverified)** | — |

**Proof the stack already works on Monad:** LeverUp settles against **Pyth and Pyth Pro** on Monad (`OracleUpdateData{pythPriceUpdateData, pythProPriceUpdateData}`). Non-crypto pairs expose `nextOpen/nextClose` and revert with `MarketClosed` ([LeverUp dev docs](https://developer-docs.leverup.xyz/introduction/concepts.md)).

### 3.2 Can Perpl or Kuru list RWA markets?
- **Perpl:**
  - 9 markets, all crypto (BTC, MON, ETH, SOL, HYPE, ZEC, LIT, VVV, PUMP) ([context](https://app.perpl.xyz/api/v1/pub/context), 2026-09-29).
  - No public or permissionless listing process in the docs ([llms.txt](https://docs.perpl.xyz/llms.txt)). Exchange contracts are **not** in the public GitHub org; only the SDK (MIT), docs and examples are ([github.com/PerplFoundation](https://github.com/PerplFoundation)).
  - **Two design blockers for equities** ([price indices](https://docs.perpl.xyz/exchange/price-indices.md)):
    1. The mark is **clamped to ±25 bp of the Chainlink spot index**.
    2. **Settlement and liquidation revert if the spot index is stale.**

    With a regular-hours equity stream, the market would freeze every night and weekend. Perpl would need a session-aware index (the trade[XYZ] internal-EMA pattern, or the Chainlink 24/5 stream plus tokenized-asset fallback).
  - Perpl raised $9.25M led by Dragonfly ([Blockworks](https://blockworks.com/news/perpl-perpetuals-raise-funding-dragonfly-testnet)).
- **Kuru:** a spot CLOB, not perps. `deployTokenAndMarket` makes spot markets permissionless ([kuru.md](../03-sponsors/finance-trading/kuru.md)). Contract repos are public but have **no licence** (default: all rights reserved) ([Kuru-Labs](https://github.com/Kuru-Labs)).
- **LeverUp:** 77 pairs. **50 RWA pairs listed 2026-09-16** (30 stocks, 7 indices, 8 commodities, 3 FX, ANTH, OPENAI), all tagged `Cross-Exchange` with `executionVenue: HYPERLIQUID` / `venueSymbol: xyz:*`. The API reports $0 volume for all of them. Crypto did $12.4M in 30 days ([LeverUp pairs](https://service.leverup.xyz/v1/pairs?size=200&volume_time_range=THIRTY_DAY)). LeverUp has a broker (referral) id system for front ends ([brokers](https://developer-docs.leverup.xyz/introduction/brokers.md)).
- **HelloTrade:**
  - Seed: $4.6M led by Dragonfly (Nov-25) ([Fortune](https://fortune.com/2025/11/20/former-blackrock-employees-raise-4-6-million/)). Originally announced on MegaETH ([X](https://x.com/hellotradeapp/status/1991496917919101388)); moved to Monad per the Aug-26 ecosystem highlights ([ecosystem-map](../05-ecosystem/ecosystem-map.md)). Monad's X account welcomed it on 2 Sep.
  - Site: "**Perpetual Futures – Live in Alpha**, up to 50× leverage". Spot (fully backed tokenized equities) and Earn & Spend are "Coming Soon".
  - Claims **10,000+ markets** (US 3,200+, emerging markets 1,400+, FX 38, commodities 40+). Liquidity is **RFQ + routed + order books**. Chainlink and Stork logos appear on the site. The UI is in Portuguese, Spanish, Swahili, Chinese, Arabic, and more ([hello.trade](https://www.hello.trade/)).
  - Claimed 80,000+ waitlist ([X](https://x.com/hellotradeapp/status/2092263703928291581)) **(unverified)**. No DefiLlama listing, so volume is unknown.
- **XStable:** `xstable.xyz` is a parked domain for sale (GoDaddy, scraped 2026-09-29). Treat it as **inactive (unverified)**.
- **Tokenized stocks on Monad:** Anchored launched tokenized top-10 Nasdaq stocks on Monad via **Monday Trade** in Apr-26 ([Business Wire](https://www.businesswire.com/news/home/20260416940316/en/Anchored-Launches-US-Tokenized-Stocks-to-Expand-Global-Investor-Access)). This contradicts [monad-gap-check.md](monad-gap-check.md) ("None"). Monday Trade Spot fees are $552/30d (DefiLlama), so it's tiny. The Chainlink `w…x` feeds suggest wrapped xStocks on Monad; token deployment is **(unverified)**.

### 3.3 Do ~300 ms blocks or per-block funding materially help?
- **Funding per block: no material gain.** Funding is already accrued continuously through accumulators (Perpl), and HIP-3 charges it hourly. The observed rate is ~0.0006%/h. Settling it every 300 ms changes nothing economically.
- **What does matter, where Monad is at parity or better:**
  1. **Oracle and mark cadence.** trade[XYZ] updates every ~3 s. A Monad venue can verify a pull update (Pyth Pro / Data Streams / Stork) in the same transaction as each fill or liquidation.
  2. **Onchain session logic.** trade[XYZ]'s EMA, discovery bounds and ±50 bp clamps run in an off-chain relayer. On Monad they can be **enforced in the contract**, auditable by anyone. That is a real transparency gain given the SK Hynix incident.
  3. **Cheap MM cancel/replace.** Perpl targets under 100k gas per post+cancel ([perpl.md](../03-sponsors/finance-trading/perpl.md)).
  4. **Against Arbitrum pool models** (Ostium's two-step keeper fill), sub-second finality removes the pending state.

  Against HyperCore, speed is **not** a differentiator.

---

## 4. Open-source reference engines
| Repo | What | Licence | Activity | Use |
|---|---|---|---|---|
| [gmx-io/gmx-synthetics](https://github.com/gmx-io/gmx-synthetics) | GMX v2 synthetic perps (pool, oracle, keepers) | **BUSL-1.1 → GPL-2.0-or-later.** The change date is "the earlier of 31 August 2026 or a date specified at the ENS record", so it should be GPL as of 2026-09-29. **Check the ENS record before forking** | pushed 2026-08-27, 94★ | Market/pool accounting, price-impact, keeper model |
| [0xOstium/smart-contracts-public](https://github.com/0xOstium/smart-contracts-public) | Ostium V2 (oracle-priced pool, market hours, verifier) | MIT, but README says "adapted from the Gains v5 open-source codebase". Gains v5 licence **(unverified)** | pushed 2026-05-07 | **Anti-pattern study:** `OstiumVerifier` / `PrivatePriceUpKeep` is the exploited path |
| [Synthetixio/synthetix-v3](https://github.com/Synthetixio/synthetix-v3) | Perps v3 (cross-margin, async orders) | MIT | **archived** 2025-08 | Margin/liquidation modules |
| [dydxprotocol/perpetual](https://github.com/dydxprotocol/perpetual) | dYdX v1 Solidity perps | Apache-2.0 | stale since 2022 | Funding/index math |
| [dydxprotocol/v4-chain](https://github.com/dydxprotocol/v4-chain) | Cosmos appchain CLOB | NOASSERTION (custom) | active | Matching and liquidation design reference only |
| [velocity-exchange/protocol-v2](https://github.com/velocity-exchange/protocol-v2) (ex-Drift) | Solana perps + DLOB | Apache-2.0 | archived | Design reference |
| [PerplFoundation/dex-sdk](https://github.com/PerplFoundation/dex-sdk) | Perpl Rust SDK / CLI | MIT | active 2026-09-23 | Integration only. **Exchange contracts are not public** |
| [Kuru-Labs](https://github.com/Kuru-Labs) `Kuru-contracts-dex-public` | Monad spot CLOB | no licence | 2026-04 | Read-only reference unless Kuru grants rights |
| HIP-3 spec | [Hyperliquid docs](https://hyperliquid.gitbook.io/hyperliquid-docs/hyperliquid-improvement-proposals-hips/hip-3-builder-deployed-perpetuals) | spec, not code | — | Deployer staking/slashing, `haltTrading` settlement, fee share 0–300% |
| trade[XYZ] mechanics | [docs.trade.xyz](https://docs.trade.xyz/llms.txt) (58 pages, markdown) | docs | — | The most complete public spec for equity-perp oracles, discovery bounds, corporate actions and pre-IPO conversion |

Rules §4.1: forking must be disclosed in the README, and the majority of work must be new ([README.md](README.md)).

---

## 5. What it takes: obstacles and routes that work

### Components (full venue or market layer)
1. **Matching:** an onchain CLOB. Either Perpl (via partnership) or our own, with Kuru's public contracts as a design reference.
2. **Margin and risk engine:** isolated/cross margin, maintenance tiers by max leverage, per-market **OI caps**, insurance fund, ADL.
3. **Session-aware oracle module:** external session from a pull feed; internal session as an EMA of impact-price difference; discovery bounds with resets; per-update clamps; staleness and future-timestamp guards; multi-signer quorum.
4. **Funding:** premium-index funding with a per-market multiplier; reduced multiplier for pre-IPO.
5. **Corporate-actions handler:** split → settle and reopen; dividend handled through funding; delist/M&A → settle.
6. **Market-deployment layer (the "HIP-3 for Monad" part):** deployer bond, listing registry, fee share, slashing or insurance, `haltTrading`/settle.
7. **Keepers/relayer, indexer** (Envio/HyperSync), **front end** (mobile, AUSD, passkeys), MM API.
8. **Legal wrapper:** offshore operating entity, terms, geo-block list, risk disclosures.

### Obstacle 1: no suitable equity oracle on Monad
**Routes that work**
- **Pyth Pro pull, already proven on Monad by LeverUp.** Steps:
  1. Sign up at app.pyth.com.
  2. Take the US Equities plan ($5,000/mo), or All Asset Classes ($10,000/mo) for FX and commodities.
  3. Pass `pythProPriceUpdateData` into each fill or liquidation transaction against Core `0x2880aB15…`.

  Pyth Indices (24/7 equities, oil, metals, ANTHROPIC/OPENAI) are on separate commercial terms. Email **data@dourolabs.xyz** ([Pyth](https://www.pyth.network/blog/extended-hours-us-equity-data-moves-to-pyth-pro)).
- **Chainlink Data Streams RWA v11 (24/5 US equities) with the tokenized-asset fallback** when `marketStatus` is Closed ([guide](https://docs.chain.link/data-streams/rwa-streams/24-5-us-equities-user-guide)). Router and VerifierProxy are live on Monad. Step: request credentials via [Data Streams sign-up](https://docs.chain.link/data-streams/sign-up). Chainlink is a Metropolis sponsor (CRE $3K bounty), so ask at the event.
- **Stork**, already on Monad at `0xacC0…fd62`. It powers Ostium and Lighter and is on HelloTrade's partner row. Step: contact via [stork.network/contact](https://www.stork.network/contact) for `*_24_5` equity feeds on Monad.
- **Build the internal session ourselves** (trade[XYZ] pattern). The oracle only needs external data while the market is open. Nights and weekends run on the onchain EMA plus discovery bounds.
- **Hardening against the two known failures:**
  - Ostium: require signed prices with `publishTime ≤ block.timestamp` and within N seconds; accept multiple providers or a signer quorum; timelock role changes.
  - SK Hynix: add a venue-depth or volume filter and a per-update clamp; widen discovery bounds only on multi-source confirmation.

### Obstacle 2: Perpl lists only crypto, and no third party can deploy markets
**Routes that work**
- **Partner route:**
  - Perpl's co-founder PBJ is a Metropolis judge and gvan (Head of Growth) is a mentor ([perpl.md](../03-sponsors/finance-trading/perpl.md)). Ask through the `/mentors` channel ([official-announcements.md](../05-ecosystem/official-announcements.md)).
  - Pitch a concrete **RWA session-index contract** that Perpl's spot-index slot could read. It must be fresh 24/7 (external session → Data Streams/Pyth; internal → EMA of Perpl's own book), so Perpl's ±25 bp clamp and staleness guard keep working.
  - Precedent: Hyperliquid itself launched only 6 of 119 new 2026 markets. Deployers did the rest ([0xArchive](https://0xarchive.io/resources/research/addressing-hyperliquid-s-hip-3-deployer-bottleneck)).
- **Own market layer:** build the deployer-bond + listing registry + session-oracle on our own CLOB. Use the HIP-3 spec as the rulebook, with a lower bond and tiered permissions. Blockworks proposes exactly this for Hyperliquid: "tiered exchange model… lower HYPE requirements but restricted permissions, including OI caps, lower leverage" (same source). This addresses HIP-3's main weakness: a 500k HYPE (~$27M) bond ([Talos](https://www.talos.com/insights/trade-xyzs-role-in-hyperliquid)) and 4-year median payback for non-XYZ deployers.
- **Route through existing liquidity:** LeverUp broker ids (RWA pairs already routed to trade[XYZ]) or Perpl builder codes (max 0.1% fee). Builder attribution also produces traction evidence for judges.

### Obstacle 3: market hours, weekends, gaps, corporate actions
**Routes that work**
- **trade[XYZ] pattern:**
  - Keep trading 24/7 with an internal EMA oracle.
  - Clamp with discovery bounds; a position whose liquidation price is outside the bound cannot be liquidated during that session.
  - Settle and reopen on splits.
  - Proven by the weekend-accuracy evidence above.
- **Chainlink pattern:** switch streams by `marketStatus` (regular / extended / overnight / tokenized-asset fallback).
- **Ostium pattern:** halt outside hours, cap overnight leverage at 10×, queue orders to reopen. This works, but weekends are exactly when retail's share doubles, so a halt forfeits that segment.
- **Evidence for sizing:** weekends are <5% of volume ([bit.com](https://www.bit.com/knowledge-hub/rwa-perps)) but 28% retail ([Arrakis](https://arrakis.finance/blog/who-is-trading-on-hip3)). A weekend-first product serves a small but retail-heavy slice.

### Obstacle 4: market makers
**Routes that work**
- **In-house MM or vault (Variational OLP):** hedge on CEX RWA perps, trade[XYZ] and TradFi dealers. Keep the spread instead of charging fees. Proven: $751M RWA OI.
- **Kuru-style vaults or Perpl PLP vaults** as passive backstop liquidity; Perpl already has independently operated PLP vaults ([perpl.md](../03-sponsors/finance-trading/perpl.md)).
- **Fee design:** HIP-3 Growth Mode (≥90% fee cut) plus maker rebates.
- **Ready hedge venue:** trade[XYZ] itself; LeverUp already routes to it.
- **Named MMs:** Wintermute, GSR and SIG invested in Ostium ([Ostium docs](https://ostium-labs.gitbook.io/ostium-docs)); Selini Capital launched Dreamcash's RWA markets ([Cointelegraph](https://www.facebook.com/cointelegraph/posts/%EF%B8%8F-latest-dreamcash-tether-and-selini-capital-roll-out-hip-3-rwa-perpetuals-on-hy/1197899805850179/)). Auros is on the Metropolis mentor list ([official-announcements.md](../05-ecosystem/official-announcements.md)). **First step: ask Auros through `/mentors`.**
- **Start where hedging is easy:** gold, oil, US indices and top AI names (NVDA, MU, SK Hynix, Samsung), where external liquidity is deepest.

### Obstacle 5: regulation and geo-blocking
**Routes that work**
- **Industry-standard package:** an offshore operating entity (Ondo Global Panama; trade[XYZ] Terms of Use), geo-block US persons plus the sanctions list (copy Perpl's list: BY, CU, GB, IR, KP, RU, SY, UA, US), and product disclaimers modelled on trade[XYZ] ("not shares… no ownership… cash-settled").
- **No venue we checked does KYC at the protocol level.** Keep the contracts permissionless and restrict the interface.
- **Pre-IPO:** frame the market as an index or derivative of an indicative price (Pyth pre-IPO feeds are explicitly "indicative"), never as shares or allocations.
- **Risk with no clean route:** whether equity perps are offered to *retail in specific jurisdictions* (EU/MiCA, Korea) is a legal question with no public precedent in our sources. Get a legal opinion per target market. Concentration also creates a "clearer regulatory attack surface" ([0xArchive](https://0xarchive.io/resources/research/addressing-hyperliquid-s-hip-3-deployer-bottleneck)).

### Obstacle 6: HelloTrade (funded, Monad, live alpha) and LeverUp (RWA pairs already listed)
**What they do not cover (from their public pages; inference where marked)**
- **HelloTrade is a closed app with an RFQ/routed back end.** It offers no permissionless listing or deployer layer and no composable onchain book for other apps (inference from [hello.trade](https://www.hello.trade/)). **The market-layer route does not compete with it; HelloTrade could become a customer.**
- **LeverUp's RWA pairs execute on Hyperliquid, not on Monad,** and show $0 volume. No RWA liquidity lives on Monad itself.
- **Neither discloses a session/oracle methodology or onchain discovery bounds.** "Verifiable weekend pricing" is an open wedge after the SK Hynix and Ostium events.
- **Pre-IPO, AI-memory and Korean baskets are not HelloTrade's pitch** (its site leads with breadth: "10,000+ markets", EM stocks). trade[XYZ]'s data shows those niches carry disproportionate volume: Korea 12.6% of volume, AI/semis 37% of OI.
- **Tokenized-stock collateral (the Ondo Perps pattern) on Monad:** Anchored/Monday Trade stocks exist on Monad (small) and Chainlink wNVDAx/wSPYx feeds exist. A perp that accepts them as margin is not offered by HelloTrade or LeverUp (inference).

### Risks with no known route
1. **Liquidity concentration.** Every duplicate HIP-3 market loses to trade[XYZ] ("captures nearly 100% of trading volume" of duplicates, [Talos](https://www.talos.com/insights/trade-xyzs-role-in-hyperliquid)). There is no documented case of a second venue taking share on the same underlying without a distribution partner such as Robinhood for Lighter. **Mitigation, not a route:** pick underlyings or segments trade[XYZ] under-serves, or supply rather than compete.
2. **Untested crisis behaviour:** "How these liquidation systems behave when several underlying markets gap at the same open… is not yet known" ([bit.com](https://www.bit.com/knowledge-hub/rwa-perps)).

### Where a new entrant can win (ranked by evidence)
1. **Infrastructure: a session-aware RWA oracle and market-deployment layer on Monad**, with the rules (EMA, bounds, clamps, staleness and future-timestamp guards, split settlement) enforced onchain. It is novel on Monad and matches Track 01's *"new market structures"*. Its customers already exist here: Perpl (needs a 24/7-fresh index), LeverUp (routes RWA off-chain to HL), HelloTrade (RFQ app that "enables order books as liquidity grows"). The Chainlink CRE $3K bounty fits the index workflow.
2. **Segment front end:** Korean retail or AI-memory traders (SMSN, SK Hynix, Micron, SanDisk, DRAM, KR200), mobile with AUSD, routing through Perpl or LeverUp brokers. Front ends earned real flow on HIP-3 (MetaMask at 10 bp). This also fits the **Agora Mobile $10K** bounty (Mera + AUSD + Perpl), but it needs Perpl to list RWA markets, which loops back to route 1.
3. **Pre-IPO / IPO-conversion markets** (IPOP → listed-perp conversion as a contract). There is real attention (SPCX >$1.3B, CBRS priced within 1.3%). But category OI is $61M, oracles are "indicative" and commercial, and Ventuals shows liquidity goes to the leader. **Only as a feature, not the whole product.**
4. **Not recommended:** FX perps (0.1% of trade[XYZ] volume), a generic oracle-pool RWA venue (Ostium's collapse; LeverUp already occupies it on Monad), or compute perps (`xyz:H100` $0 volume, [solana-hyperliquid.md](solana-hyperliquid.md)).

---

## Corrections to earlier files
- [monad-gap-check.md](monad-gap-check.md) says tokenized-stock products on Monad: "None". In fact **Anchored × Monday Trade** tokenized Nasdaq stocks launched on Monad in Apr-26 (small), and Chainlink publishes wNVDAx/wSPYx/wTSLAx/wSPCXx/wEWYx/wQQQx feeds on Monad.
- The same file and [solana-hyperliquid.md](solana-hyperliquid.md) say Equity/RWA perps on Monad are "pre-launch only". In fact **LeverUp lists 50 RWA pairs (routed to Hyperliquid) since 2026-09-16**, and HelloTrade perps are "Live in Alpha".
- XStable (listed in [ecosystem-map](../05-ecosystem/ecosystem-map.md)): the domain is parked for sale. Treat it as inactive **(unverified)**.
- `xyz:SPCX` was described as pre-IPO in [solana-hyperliquid.md](solana-hyperliquid.md). SpaceX has since listed: Chainlink's `wSPCXx-USD` is a 24/5 US-equities feed, and Talos refers to "the SPCX IPO". The listing date is **(unverified)**.

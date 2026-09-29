# Breakout products on EVM L2s and payment chains (Base, Arbitrum, BNB, Ethereum, Abstract, MegaETH, Robinhood Chain, Plasma, Tempo, Arc, Stable)

Research date: **2026-09-29**. Method and evidence rules: [README.md](README.md). Track ideas quoted from [../01-tracks/](../01-tracks/README.md).

**How this was built.** I ranked every non-core-DeFi protocol on each chain by 30-day fees, using DefiLlama's fee overview endpoints (`api.llama.fi/overview/fees/{base,arbitrum,bsc,ethereum,megaeth,abstract,robinhood-chain,plasma,tempo,stable,arc}`). I also did an all-chain pass on the consumer categories: Crypto Card Issuer, Physical TCG, Payments, Insurance, Options, Interest Rate Derivatives, Uncollateralized Lending and SoFi. For each hit I pulled monthly fee and TVL history from `api.llama.fi/summary/fees/<slug>` and `api.llama.fi/protocol/<slug>`, then confirmed it with Paymentscan (onchain card analytics), press releases and news. "On Monad" was checked against DefiLlama's `chains` field, [../05-ecosystem/ecosystem-map.md](../05-ecosystem/ecosystem-map.md) and the Monad App Hub.

Unless noted, every DefiLlama number was pulled on 2026-09-29. "Fees" means DefiLlama fees. Monthly figures are calendar months, and September 2026 is partial (it runs to the 29th).

**Chain context (DefiLlama, 2026-09-29):**

| Chain | TVL | Stablecoins |
|---|---|---|
| Base | $6.22B | $5.15B |
| Arbitrum | $1.43B | $3.83B |
| BSC | $5.70B | $13.85B |
| Robinhood Chain (launched 1 Jul 2026) | $1.01B | $1.03B, plus **$55.8B 30-day DEX volume**, mostly memecoins on Uniswap |
| Plasma | $546M | $1.40B |
| Arc (mainnet 16 Sep 2026) | $524M | $459M |
| Tempo (mainnet 18 Mar 2026) | $57M | $349M |
| Stable | $30M | $21M |
| MegaETH | $22M | n/a |
| Abstract | $10M | n/a |
| Monad (for comparison) | $1.02B | $704M |

## Summary: ranked by strength of evidence

| # | Product (chain) | Headline metric | Track fit | On Monad? |
|---|---|---|---|---|
| 1 | ether.fi Cash card (Optimism/Scroll) | $119.3M card spend in Sep 2026, up from $24.1M in Sep 2025 (Paymentscan) | 02 | partial (MetaMask card + mUSD) |
| 2 | Onchain graded-card collectibles: Gacha (Abstract), Beezie (Base), DYLI (Abstract), Gemint (BSC), Monster (MegaETH) | Gacha fees went from $435K (Apr) to **$4.27M (Aug 2026)**. Sector: $230M gacha sales in May 2026 | 03 (TCG ideas 06/08/09) | partial: **Oripa** (pack gacha) is live on Monad; no card order book, AMM or rental market |
| 3 | Plasma One neobank + card (Plasma) | Card spend went from $0.13M (Jan) to **$23.37M (Sep 2026)**. Early cohorts keep 72–88% retention | 02 | no |
| 4 | Re onchain reinsurance (Eth/Base/Arb/Avax), with Ensuro as the parametric comparable | TVL went from $113M (Dec 2025) to **$390M (Sep 2026)** | 02 (micro-insurance) / 01 | no |
| 5 | Tokenized stocks: xStocks, Robinhood Chain, StockRip | xStocks: $25B volume and 80K+ onchain holders (Feb 2026). StockRip: $1.51M fees in 1 year | 01 (idea 12) | partial (HelloTrade and XStable exist, but nothing makes stocks "programmable") |
| 6 | Perps embedded in wallets: MetaMask Perps, Phantom Perps, Trust Wallet Perps | MetaMask Perps: $11.1M fees in 1 year, $1.49M in the last 30 days | 01 (idea 06) | no; Perpl's API is the Monad backend |
| 7 | USD.AI GPU-backed credit (Arbitrum) | $230M TVL, a $100M Bullish credit facility (Aug 2026), about $1.4–4.3M fees per month | 01 (ideas 09/10) | no |
| 8 | Wildcat undercollateralised credit lines (Ethereum, Plasma) | $18.7M fees in 1 year, steady at $1.3–1.8M per month | 01 | no (Accountable is adjacent) |
| 9 | Aethir decentralised GPU cloud (Arbitrum) | $72.5M fees in 1 year, but falling ($11.2M in Oct 2025, $4.4M in Sep 2026) | 01 (idea 10) | no |
| 10 | Exa card, backed by Exactly Protocol (Base/OP) | Protocol TVL went from $4M to $12M (Sep 2025 to Sep 2026). Card: $1.61M spend in Sep 2026 | 02 | no |
| 11 | Sport.fun player-share fantasy football (Base) | $90M volume and 20K lifetime users (Delphi). Fees have fallen since Nov 2025 | 01 (idea 02) / 03 (idea 03) | no |
| 12 | Boros funding-rate swaps by Pendle (Arbitrum) | $7.9M TVL. Fees fell from $88K (Oct 2025) to $34K (Sep 2026) | 01 (idea 03) | partial (Pendle V2 is on Monad; Boros is not) |
| 13 | Peer (formerly ZKP2P) P2P fiat onramp (Base) | Record $1M monthly onramp volume (Oct 2025); now about $26K fees per month. MIT licence | 02 (cross-border) | no |
| 14 | Bankr chat/social trading agent (Base) | $34.8M fees in 1 year, but very spiky | 01 (idea 06) | no (unverified) |

---

## Candidates

### 1. ether.fi Cash: non-custodial "borrow-to-spend" Visa card (Optimism, Scroll)
- **What it does:** You deposit crypto or stablecoins into a non-custodial "Cash" safe, earn yield on it, and spend with a Visa card. The card can spend by **borrowing against your collateral** instead of selling it, with 3% cashback in ETHFI.
- **Traction:**
  - Card spend was **$119.3M in Sep 2026, from 47,647 active addresses**. That compares with $24.06M in Sep 2025 and $62.6M in Mar 2026. All-time spend is $913.7M across 11.5M transactions (https://paymentscan.xyz/cards/etherfi, pulled 2026-09-29).
  - EtherFi Cash Liquid fees: **$33.0M over the last year**. Monthly fees went from $1.86M (Oct 2025) to $4.09M (Aug 2026). TVL is $240M (https://defillama.com/protocol/etherfi-cash-liquid, 2026-09-29).
  - The whole stablecoin-card market: **$1.134B spend in Sep 2026, up from $403.1M in Sep 2025**, across 27 programs (https://paymentscan.xyz, 2026-09-29).
- **Why it's working:** Users can spend without selling, so there is no taxable sale and no lost upside, while their idle balance earns yield. The card rail (Visa via an issuer) removes merchant adoption as a problem. Cashback is paid in the protocol token, which subsidises acquisition.
- **Open source?:** `etherfi-protocol/cash-v3` has 18 stars, no licence file and was pushed 2026-09-28 (https://github.com/etherfi-protocol/cash-v3). Treat it as source-available, not reusable.
- **On Monad already?:** Partial. The MetaMask Money Account (mUSD plus a Mastercard card) is on Monad ([ecosystem-map](../05-ecosystem/ecosystem-map.md), [judges-theses](../05-ecosystem/judges-theses.md)). There is no borrow-to-spend card.
- **Metropolis fit:** Track 02, closest to official idea 06: *"Salary streaming at the individual level… with idle balances earning yield in the background until you spend them."*
- **Monad angle:** Our research found no Monad-native borrow-to-spend credit line. You could build one on Monad lending (Aave, Euler and Morpho are all live), with the card authorisation modelled as an onchain debit. ~300 ms blocks let a demo settle the "authorisation → borrow → settle" loop in under a second. A Mera passkey plus AUSD gives the invisible-wallet onboarding the Agora bounty asks for.
- **Risks / why it might not port:** A real card needs an issuer (Rain, Bridge and others) and KYC, which you can't get in two weeks. The demo would need a simulated card rail or a virtual merchant flow. "Wallet with a card" risks the judges' line *"a wallet/payments app with new branding."*

### 2. Onchain graded-card collectibles on EVM: pack "gacha", vaulted cards, instant buyback (Abstract, Base, BSC, MegaETH)
- **What it does:** Real PSA-graded Pokémon and sports cards sit in a vault and are represented as NFTs. Users "rip" digital packs or claw machines, then keep the card, sell it back instantly (typically at 85–95% of value) or redeem the physical slab.
- **Traction:**
  - **Gacha (Abstract):** fees of **$14.61M over the last year**. Monthly: $435K (Apr), $1.05M (May), $1.88M (Jun), $2.83M (Jul), **$4.27M (Aug 2026)**. September to date is $1.86M (https://defillama.com/protocol/gacha-tcg, 2026-09-29).
  - **Beezie (Base, Flow, Solana):** $142M+ ARR, 540,000+ claw pulls and $100M+ in Base volume (GlobeNewswire, 2026-05-12: https://www.globenewswire.com/news-release/2026/05/12/3293136/0/en/beezie-brings-tokenized-collectibles-to-solana.html). It raised a $4M round led by Psalion VC Fund III in Jul 2026 (https://cryptorank.io/insights/deals/beezie-undisclosed-2026-07-27). Fees: $13.0M over the last year and $758K in the last 30 days (DefiLlama).
  - **DYLI (Abstract):** $2.37M fees over the last year, $362K in the last 30 days (+91% month on month).
  - **Gemint (BSC):** fees went from $80K (Jun) to $155K, $253K and then $315K (Sep 2026).
  - **Monster (MegaETH):** $2.0M fees over the last year. It moved to MegaETH on 27 Apr 2026 (https://x.com/megaeth/status/2047685044395745374).
  - **Courtyard (Polygon; covered in [consumer-social-and-web2.md](consumer-social-and-web2.md)):** $47.5M fees over the last year and a $30M Series A led by Forerunner.
  - **Sector:** the top seven tokenized-Pokémon platforms did **$230M of gacha sales in May 2026, up from $32M a year earlier** (Messari data via Decrypt, 2026-06-14: https://decrypt.co/370978/pokemon-cards-surging-crypto-platforms-gambling). Solana had about 64% of that.
- **Why it's working:** It wraps the variable-reward loop of a pack opening around a physical asset with an **instant exit**: the buyback puts a soft floor under every pull. Vaulting removes shipping and authentication friction, so a card can change hands in seconds. Decrypt's source calls gacha "the on-ramp", not just a sales mechanic.
- **Open source?:** All closed.
- **On Monad already?:** **Partial.** **Oripa** is live on the Monad App Hub: *"Buy digital packs, open them live, and pull authentic, PSA-graded collectibles like Pokémon cards. Keep what you pull or sell it back instantly"* (https://app.monad.xyz/app-hub/oripa). The pack-rip front end is taken. The **secondary market layer is not.**
- **Metropolis fit:** Track 03. Five of the 12 official ideas are about TCGs. The closest matches:
  - 06: *"A TCG marketplace with real-time onchain order books — transparent price discovery, instant settlement, and no platform taking a 10–15% cut"*
  - 08: *"Automated market makers designed specifically for the long-tail of collectible assets"*
  - 09: *"Rental and lending markets for high-value cards"*
- **Monad angle:** A Kuru-style CLOB for vaulted-card NFTs, or a pooled AMM per grade and set, becomes practical with sub-second blocks and cheap gas. Oripa's pulled cards would be natural first inventory, so a partnership could supply the traction.
- **Risks / why it might not port:** Real inventory needs a vault and grading partner. A demo would use mock-graded NFTs. There is gambling-regulation exposure (Decrypt: *"Just don't call it gambling"*). Gacha fees are volatile: Monster fell 83% month on month and Gacha is down in September after an August peak.

### 3. Plasma One: stablecoin neobank + Visa card (Plasma)
- **What it does:** A USD₮ account with gasless "Checking", a yield "Earn" balance (P1USD, up to 10% advertised), a Visa card in 180+ countries with 2–4% cashback in XPL (10% on AI and flights), and free USDT transfers.
- **Traction:**
  - Card spend: $127.9K (Jan 2026), $3.41M (May), $8.97M (Jun), $15.18M (Jul), $19.9M (Aug), **$23.37M (Sep 2026)**. Sep had 20,261 active addresses. All-time: $73.08M across 487,424 transactions (https://paymentscan.xyz/cards/plasma-one, 2026-09-29).
  - **Cohort retention:** the May 2026 cohort (1,840 users) kept 88%, 78% and 72% over the next three months. The Jun cohort (7,921) kept 84% and 76% (same page).
  - DefiLlama TVL went from $1.07M (2026-05-07) to $13.49M (https://defillama.com/protocol/plasma-one).
- **Why it's working:** The chain subsidises the whole stack: zero gas, free USDT sends and cashback in the chain's own token. Tiered cashback locks XPL, which aligns the token with card use. The target is spenders in dollar-scarce regions who already hold USDT.
- **Open source?:** Closed.
- **On Monad already?:** No Monad-native neobank with a card. The closest are MetaMask Money Account, UR and Cero ([ecosystem-map](../05-ecosystem/ecosystem-map.md)).
- **Metropolis fit:** Track 02. The spend-plus-save loop matches idea 06. The free cross-border sends are the Agora Cross-Border bounty's brief: *"send AUSD across borders using Mera passkey onboarding and instant settlement."*
- **Monad angle:** AUSD (gasless ERC-3009) plus Mera passkeys plus gas sponsorship reproduces Plasma's "no gas, no seed phrase" UX without a dedicated chain.
- **Risks / why it might not port:** Its growth is bought with XPL cashback, which a hackathon team can't match. It needs a card issuer (see #1). Remittance is crowded: [ecosystem-map](../05-ecosystem/ecosystem-map.md) lists 7+ public competitor repos.

### 4. Re: onchain reinsurance capital (Ethereum, Base, Arbitrum, Avalanche), with Ensuro as the parametric comparable
- **What it does:** Stablecoin deposits collateralise real reinsurance treaties through licensed reinsurers. Depositors receive tokenized receipts (reUSD, reUSDe) that earn underwriting premium plus onchain yield.
- **Traction:**
  - TVL went from $113M (Dec 2025) to $166M (Mar), $282M (May) and **$390M (Sep 2026)**.
  - Fees went from $230K/month (Oct 2025) to **$1.56M (Sep 2026)** (https://defillama.com/protocol/re, 2026-09-29).
  - *"$490M in premiums as of June 2026, policies covering nearly 1M households"* (Bankless: https://www.bankless.com/read/how-re-is-turning-reinsurance-into-a-stablecoin-yield-source).
  - Coinbase Ventures made a strategic investment in Jun 2026 (DefiLlama raises; https://www.reinsurancene.ws/onchain-protocol-re-secures-strategic-investment-from-coinbase-ventures/).
  - **Ensuro** (Ethereum/Polygon) is a parametric risk-capital protocol that grew out of flight-delay products. TVL $2.32M, $109K fees in the last 30 days. **Apache-2.0**, 22 stars, pushed 2026-09-13 (https://github.com/ensuro/ensuro).
- **Why it's working:** Insurance risk is uncorrelated with crypto, so it's a new source of stablecoin yield. Re sells *capacity* to real insurers instead of trying to win consumers directly.
- **Open source?:** Re is closed. Ensuro is Apache-2.0.
- **On Monad already?:** No (DefiLlama chains; not in the ecosystem map).
- **Metropolis fit:** Track 02, idea 07: *"Micro-insurance that turns on and off by the minute — cover your laptop for the next three hours, insure a specific journey, pay only for the moments of actual exposure."* Re and Ensuro prove the **capital side** works onchain. A consumer per-minute product on Monad would be the demand side feeding such a pool.
- **Monad angle:** Per-second premium accrual (streamed AUSD) with cover that switches on and off in a ~300 ms block is only economical with cheap gas.
- **Risks / why it might not port:** Re's traction is institutional and B2B. There is **no evidence yet of a consumer micro-insurance app with traction onchain**. The consumer side is an adaptation, not a port. Parametric triggers need an oracle (Chainlink CRE $3K bounty). There is regulatory exposure.

### 5. Tokenized stocks: xStocks, Robinhood Chain Stock Tokens, and StockRip "stock packs"
- **What it does:** 1:1 backed tokens for US equities trade 24/7 onchain. On Robinhood Chain, **StockRip** lets depositors wrap stock-token baskets into a pool. Buyers pay to draw a *random* stock position, and each position carries an ETH standing bid, so a winner can take 80–95% of its "grade" instead of the shares (https://stockrip.com/docs).
- **Traction:**
  - **xStocks:** $25B+ total volume, **$3.5B+ onchain volume, 80,000+ unique onchain holders**, and 8 of the top 11 tokenized equities by holders (Kraken, as of 2026-02-17: https://blog.kraken.com/product/xstocks/25-billion-in-total-transaction-volume).
  - rwa.xyz lists xStocks at $579.3M, Ondo at $869.2M and Robinhood at $148.8M tokenized-stock value (https://app.rwa.xyz/stocks, 2026-09-29).
  - **Robinhood Chain** mainnet launched on 2026-07-01 with Stock Tokens (https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading/). By 2026-07-25 *"a dozen tokenized stocks are now each clearing $500,000 a day"* (CoinDesk: https://www.coindesk.com/business/2026/07/25/robinhood-chain-s-real-world-assets-jump-fivefold-as-tokenized-stocks-start-trading-in-bigger-size).
  - **StockRip:** $1.51M fees over the last year, but only $98K in the last 30 days (−79% month on month) and $0.18M TVL (https://defillama.com/protocol/stockrip). "75,000 packs opened" is from a LinkedIn post (unverified).
  - **Bankr:** tokenized-stock pools on Aerodrome did $103M of volume (Business Insider wire, unverified date).
- **Why it's working:** 24/7 access for non-US users, plus composability. StockRip in particular applies the TCG gacha loop (#2) to equities, with a hard floor from the standing bid.
- **Open source?:** All closed.
- **On Monad already?:** Partial. HelloTrade (leveraged equities, pre-launch) and XStable (RWA DEX) are listed. We found no protocol that locks, streams, gifts or randomises stock tokens ([ecosystem-map](../05-ecosystem/ecosystem-map.md)).
- **Metropolis fit:** Track 01, idea 12: *"Tokenized equities as a programmable asset — a contract that locks, streams, conditions, or distributes the equity itself… No live tokenized equity required — build against a mock ERC-20."* A stock "pack", a stock gift that vests or unlocks on a condition (which also hits Track 02 idea 05, programmable gifts), or streamed equity would all be direct matches.
- **Monad angle:** Random draws with fast settlement, and per-second streaming of fractional shares, are cheap here. A mock ERC-20 is officially allowed.
- **Risks / why it might not port:** Robinhood Chain's volume is mostly memecoins, and StockRip's fees are falling fast, so its novelty may be fading. Securities law applies to any real equity.

### 6. Perps embedded in non-trading wallets: MetaMask Perps, Phantom Perps, Trust Wallet Perps
- **What it does:** Wallets add a native perps tab that routes orders to Hyperliquid through builder codes. The wallet earns a fee on every trade without running an exchange.
- **Traction (DefiLlama, 2026-09-29):**

| Product | Fees, last year | Fees, last 30 days | Month on month |
|---|---|---|---|
| **MetaMask Perps** | **$11.10M** | $1.49M | +202% |
| **Phantom Perps** | **$20.04M** | $1.20M | n/a |
| **Trust Wallet Perps** | $2.48M | $1.38M | +241% |
| fomo Perps | n/a | $946K | n/a |

  - MetaMask Predictions: $433K in the last 30 days.
- **Why it's working:** Distribution beats execution. Users already hold balances in the wallet, so a trade is one tap. The builder-code revenue share makes embedding free for the wallet.
- **Open source?:** Closed front ends. The Hyperliquid builder-code mechanism is public.
- **On Monad already?:** No embedded perps venue in a non-trading app. **Perpl** (onchain order-book perps) is live with an API and a $5K bounty.
- **Metropolis fit:** Track 01, idea 06: *"Embedded trading experiences inside wallets, games, or other apps that aren't trading-native."* It also pairs with Agora Mobile Trading $10K (Mera + AUSD + Perpl) and the Perpl API $5K.
- **Monad angle:** Perpl settles fully onchain in ~300 ms blocks, so an embedded widget can show real fills with no "pending" state (idea 04).
- **Risks / why it might not port:** The mechanism works because of huge existing wallet distribution. A hackathon team has no host app, so it would need to embed into a partner app. Perpl's liquidity is far thinner than Hyperliquid's.

### 7. USD.AI: stablecoin credit backed by GPUs (Arbitrum)
- **What it does:** A yield-bearing synthetic dollar whose reserves fund loans secured by GPUs and AI data-centre hardware (Permian Labs).
- **Traction:**
  - TVL is $230M. It peaked at $686M in Dec 2025 and fell to $160M in Jul 2026 before recovering.
  - Monthly fees ranged from $1.40M to $4.35M in 2026, with $1.69M in Sep (https://defillama.com/protocol/usd-ai, 2026-09-29).
  - **Bullish extended a $100M debt facility** to finance GPU-backed loans (CoinDesk, 2026-08-28: https://www.coindesk.com/business/2026/08/28/bullish-backs-usd-ai-with-usd100-million-gpu-stablecoin-financing).
  - Coinbase Ventures raise, Nov 2025 (DefiLlama raises).
  - There is also a $500M non-recourse facility for QumulusAI (Permian Labs on LinkedIn; unverified).
- **Why it's working:** GPU operators pay high rates because banks can't underwrite GPU collateral. Stablecoin holders get that spread.
- **Open source?:** Closed (no public repo found).
- **On Monad already?:** No. Our research found no compute project on Monad ([onchain-finance analysis](../01-tracks/onchain-finance.md)).
- **Metropolis fit:** Track 01. This is almost word for word the track text: *"Companies using compute as loan collateral pay a premium above 5% because lenders can't underwrite or hedge the risk."* It matches ideas 09 (*"Compute Structured Products — vaults routing LP capital into compute-backed strategies: financing providers"*) and 10 (*"Tokenized Compute Yield"*).
- **Monad angle:** A standardised compute contract on a CLOB (idea 08), or tranched USD.AI-style vaults, would give that collateral a hedge. Kuru's "new markets" bounty ($5K) fits.
- **Risks / why it might not port:** The real value is off-chain origination and underwriting, which a hackathon can't reproduce. TVL fell 66% from its peak, so demand is not proven to be stable.

### 8. Wildcat: undercollateralised credit lines for known borrowers (Ethereum, Plasma)
- **What it does:** Borrowers such as market makers and funds deploy credit-line markets with their own terms. Lenders deposit, and the terms are enforced by contract, with a withdrawal queue and penalty APR.
- **Traction:** Fees of **$18.68M over the last year**, steady at $1.3–1.8M a month through 2026 ($1.33M in Sep). TVL is $8.77M (https://defillama.com/protocol/wildcat-protocol, 2026-09-29).
- **Why it's working:** It targets the reputation-based lending institutional borrowers already do off-chain, with transparent terms and no overcollateralisation.
- **Open source?:** Yes, but under a **Commons Clause** licence (not commercial-reusable): https://github.com/wildcat-finance/v2-protocol (pushed 2026-09-28).
- **On Monad already?:** No. **Accountable** (verifiable-yield credit data) is on Monad with $0.54M TVL across chains. Its fees rose from $1K (Nov 2025) to $2.81M (Aug 2026) (https://defillama.com/protocol/accountable).
- **Metropolis fit:** Track 01, which the ecosystem map already flags as whitespace: *"Onchain credit history → undercollateralised lending."* There is no single official idea for it. It could also consume ERC-8004 reputation (Track 04 crowding note).
- **Monad angle:** It could read Monad-native repayment and trading history (Kuru fills, Morpho/Euler events) as underwriting data.
- **Risks / why it might not port:** The borrowers are institutions with legal agreements. A hackathon version has no real borrowers. The licence forbids forking.

### 9. Aethir: decentralised GPU cloud with onchain revenue (Arbitrum)
- **What it does:** Enterprise GPU compute rented out from a distributed fleet, with revenue recognised onchain.
- **Traction:** Fees of **$72.53M over the last year**, falling from $11.23M (Oct 2025) to $4.62M (Apr 2026) and $4.44M (Sep 2026) (https://defillama.com/protocol/aethir, 2026-09-29).
- **Why it's working:** It sells real GPU hours to AI and gaming clients. The onchain part is settlement and revenue distribution.
- **Open source?:** Closed.
- **On Monad already?:** No.
- **Metropolis fit:** Track 01, idea 10: *"Tokenized Compute Yield — fractionalized GPU fleets or reserved cloud commitments turned into yield-bearing, transferable tokens with onchain revenue distribution."* Also idea 11 (SLA insurance and bonds).
- **Monad angle:** Per-hour delivery attestations and SLA slashing settled every block.
- **Risks / why it might not port:** Revenue has fallen by more than half. The demand side is off-chain.

### 10. Exa card on Exactly Protocol: onchain credit card with fixed-rate "pay later" (Base, OP Mainnet)
- **What it does:** A Visa card that spends from a non-custodial account. Purchases can be split into fixed-rate instalments funded by Exactly's USDC pools. It is also distributed inside Uphold and the Base App.
- **Traction:**
  - Exactly TVL went from $4M (Sep 2025) to **$12M (Sep 2026)**. Fees went from $14K (Jun) to $23K, $62K and then **$72K (Sep 2026)** (https://defillama.com/protocol/exactly).
  - Card spend was $1.61M in Sep 2026 from 1,490 addresses, and $22.13M all-time (https://paymentscan.xyz/cards/exa).
  - Raised $2M from Uphold (Mar 2025, DefiLlama raises).
- **Why it's working:** BNPL without a credit check: the collateral is the underwriting, and the rate is fixed by an onchain market.
- **Open source?:** Yes. https://github.com/exactly/protocol has 91 stars, pushed 2026-09-28, and uses **BUSL-1.1** (plus MIT parts).
- **On Monad already?:** No.
- **Metropolis fit:** Track 02. It's a consumer credit experience that uses onchain rails "as a design advantage". There is no exact official idea, though it's near 06.
- **Monad angle:** Instalment schedules settled per block, and pay-later against AUSD balances.
- **Risks / why it might not port:** The scale is small. It needs a card issuer. BUSL blocks forking the contracts.

### 11. Sport.fun: fractional football-player shares plus fantasy tournaments (Base)
- **What it does:** Users trade shares in real footballers priced in USDC-pegged "Gold". Shares pay out based on real match performance in five-player "Picks" tournaments.
- **Traction:**
  - *"Over $90mn in volume, 20,000 lifetime users, and an ARPU… of $232"* (Delphi Digital: https://members.delphidigital.io/reports/sport-fun-reimagining-the-fantasy-sports-frontier; report date not visible, so unverified).
  - Fees fell from $667K (Nov 2025) to $61K (Apr 2026), then recovered to $127K (Sep 2026). TVL is $2.47M (https://defillama.com/protocol/sport.fun).
  - It ran a World Cup 2026 contest with a $30K prize pool (Fantasy Football Scout, 2026-06-03).
- **Why it's working:** Fantasy sports already have about 40M US players. Tradeable, performance-paying shares add a market to a habit people already have.
- **Open source?:** Closed.
- **On Monad already?:** No. Levr Bet (sports prediction) and Kizzy (influencer betting) are adjacent.
- **Metropolis fit:** Track 01, idea 02: *"Options written on non-traditional underlyings: social attention, creator growth trajectories, real-world event outcomes verified by oracle."* Also Track 03, idea 03 (*"Attention futures"*).
- **Monad angle:** Live in-match pricing that updates every block.
- **Risks / why it might not port:** Fees fell about 80% from their peak, so engagement is seasonal. It needs a sports data oracle.

### 12. Boros by Pendle: margin trading of funding rates (Arbitrum)
- **What it does:** Turns perp funding rates into "Yield Units", so traders can pay fixed and receive floating (or the reverse). It's an interest-rate swap on funding.
- **Traction:**
  - TVL is $7.94M. Fees fell from $88K (Oct 2025) to $102K (Jan 2026) and then **$34K (Sep 2026)** (https://defillama.com/protocol/boros).
  - A podcast claims "$200M in open interest" (https://podcasts.apple.com/us/podcast/pendles-revenue-breakdown-and-why-boros-could-explode/id1671489227?i=1000746944888; unverified).
- **Why it's working:** Basis traders need to hedge funding. It's Pendle's yield-stripping logic applied to a new rate.
- **Open source?:** Pendle core v2 is public under Pendle's BUSL-style licence (https://github.com/pendle-finance/pendle-core-v2-public, 219 stars). Boros contracts: not found.
- **On Monad already?:** Partial. **Pendle V2 is on Monad** (DefiLlama). Boros is not.
- **Metropolis fit:** Track 01, idea 03: *"Yield stripping: separate the yield from the principal of any interest-bearing asset and trade each leg independently."* A Monad version could strip **Perpl's per-block funding** or shMON/aPriori LST yield.
- **Monad angle:** Perpl funding settles onchain. Pairing it with a per-block funding swap is native to Monad.
- **Risks / why it might not port:** Fees are falling. Pendle may simply deploy Boros on Monad itself.

### 13. Peer (formerly ZKP2P): trust-minimised P2P fiat onramp using zkTLS (Base)
- **What it does:** A buyer pays a seller over Venmo, Revolut, Wise and similar apps. A zkTLS proof of that payment releases escrowed USDC onchain, with no custodian or KYC'd exchange in between.
- **Traction:**
  - *"ZKP2P reached new all-time highs with $1M in monthly onramp volume"* (https://x.com/zkp2p/status/1973338132155355362, 2025-10-01).
  - Fees were $21K in Aug 2026 and $26K in Sep 2026, $0.05M over the last year. TVL is $0.09M (https://defillama.com/protocol/peer). Small but live.
- **Why it's working:** It reuses payment apps people already have. LPs price above market and earn the spread.
- **Open source?:** Yes, MIT. https://github.com/zkp2p/zkp2p-contracts was pushed 2026-09-28, and zkp2p-v1-monorepo has 340 stars.
- **On Monad already?:** No. Mercuryo is the on/off-ramp sponsor.
- **Metropolis fit:** Track 02, specifically the cross-border and Agora bounty (*"send AUSD across borders"*). The receive side needs a local cash-out, and P2P zkTLS provides one.
- **Monad angle:** Escrow release in ~300 ms after proof verification, with AUSD as the settlement asset.
- **Risks / why it might not port:** Usage is low, so the evidence is weak. zkTLS proof generation adds UX friction for non-crypto users.

### 14. Bankr: trading agent you talk to in social feeds (Base)
- **What it does:** You tag an agent on X or Farcaster ("buy $10 of X") and it executes swaps, limit orders and token launches from a custodial or embedded wallet.
- **Traction:** Fees of **$34.79M over the last year**, but extremely uneven: $5.53M (Jan 2026), $11.07M (Feb), $1.57M (Mar), $7.68M (May), $1.90M (Sep) (https://defillama.com/protocol/bankr, 2026-09-29). An earlier case study reported 30K wallets (0x: https://0x.org/case-studies/bankr; undated).
- **Why it's working:** Trading sits where attention already is (the feed), so there's no app switch.
- **Open source?:** Closed.
- **On Monad already?:** No Bankr deployment found (unverified). Monad has Telegram and terminal bots (Mona bot, GMGN).
- **Metropolis fit:** Track 01, idea 06 (embedded trading inside non-trading apps).
- **Risks / why it might not port:** Fees are driven by token launches (the spikes line up with launch manias), so this is close to the memecoin rejection line. "AI trading agent" is already crowded among Metropolis repos (4+ public repos, [ecosystem-map](../05-ecosystem/ecosystem-map.md)).

---

## Rejected

| Product (chain) | Reason (with data) |
|---|---|
| Zora Coins (Base) | Collapsing. Fees went from $2.12M (Oct 2025) to $11K (Sep 2026) (DefiLlama `zora-coins`). |
| Pons V2 / Pons V1 (Robinhood Chain), Flap.sh and four.meme (BSC), BaseStonk and o1 Launchpad (Base), Argus World (Arc) | Large fees (Pons V2: $138M in 30 days; Flap: $39.5M in 30 days), but these are **memecoin launchpads**, which the README excludes. Pons V2 is −60% month on month. |
| TokenWorks / NFTStrategy (Ethereum) | $41M fees over the last year, but $27.9M came in a single month (Oct 2025). A reflexive token-buyback mechanic, not a product with repeat users. |
| Veranta (Base perps on equities/FX) | Fees fell from $4.23M (Oct 2025) to $0.30M (Sep 2026). |
| Superfluid, Sablier Flow/Lockup (streaming, multichain) | No breakout. Superfluid TVL is $5.5M and Sablier Lockup $2.4M. Sablier is **already on Monad** and idle there. Salary streaming as an official idea has no EVM traction to point to (Superfluid contracts are MIT if needed). |
| PoolTogether V5 (prize savings) / Ample | PoolTogether: $12K fees in the last 30 days (−77%). Ample (yield lottery) is **already on Monad**. |
| Accountable (verifiable-yield credit) | Strong growth (fees from $1K to $2.8M a month), but **already on Monad**. Useful as a data partner for #8, not a port. |
| Stable (Tether's USD₮ chain) | $21M of stablecoins and no app with fees on DefiLlama. Nothing to port. |
| Arc (Circle, mainnet 2026-09-16) | Two weeks old. Fees are almost all launchpads (Argus World). No consumer product with a track record yet. |
| Tempo (Stripe) apps | The chain is real: 3.9M transactions from 177K addresses in its first 10 weeks (The Defiant via https://www.datawallet.com/crypto/tempo-explained) and $349M of stablecoins. But **no consumer app on it has published metrics**. Its Machine Payments Protocol belongs in [ai-agents-tools-and-demand.md](ai-agents-tools-and-demand.md). |
| x402 on Base | Real: 230M+ transactions and $54M+ volume (https://www.coinbase.com/developer-platform/discover/launches/c4a-equities-x402, Sep 2026). But it's infrastructure, it's **already on Monad** (Monad facilitator, see `../04-standards/x402-and-agent-payments.md`), and it's covered by the agents file. SolanaFloor reports Solana flipped Base on weekly x402 transactions (https://x.com/SolanaFloor/status/2095485302563623237). |
| SoSoValue Indexes (Base) | $18.9M fees over the last year, but a spot index product doesn't match any official idea, and index products are commoditised. |
| Spiko (tokenized EU/US T-bill funds, Arbitrum) | Fees jumped from $0.26M (Jun) to $4.09M (Sep 2026), but the product is institutional and business treasury, not consumer, and it's regulated issuance you can't port. |
| Predict.fun and OPINION (BSC), Limitless (Base) | Prediction markets work (Predict.fun: $5.6M fees in 30 days), but they're crowded on Monad (Levr Bet, Kizzy, CRSH, Blinq, Nad.fun) and are covered in [trend-radar.md](trend-radar.md). |
| Unlock Protocol (payments) | An $880K fee week with −99% month on month is an unexplained one-off, not sustained usage. |
| Stablecoin social payments, commitment/savings apps, programmable gifts, per-minute consumer insurance (EVM) | Searched and **found no EVM product with hard metrics** in 2026. The official Track 02 ideas for these are unproven onchain. The Web2 analogues (StepBet, Splitwise, Cover Genius) are in [consumer-social-and-web2.md](consumer-social-and-web2.md). |
| MegaETH, Abstract, Berachain and Sonic ecosystems in general | Tiny chain TVL ($10–36M). The only standouts are the TCG apps (Monster, Gacha, DYLI), which are covered in #2. |

## Takeaways for the shortlist
1. **Money that spends is compounding.** Stablecoin cards grew about 2.8× in a year ($403M to $1.134B a month; Paymentscan). ether.fi and Plasma One are the EVM leaders, but a real card can't be built in two weeks. The portable part is **borrow-to-spend or earn-while-idle logic with passkey onboarding**, shown with a simulated card or merchant.
2. **TCG gacha is the hottest consumer-culture loop on EVM** (Gacha on Abstract grew about 10× Apr→Aug). On Monad, **Oripa already does pack rips**. The Track 03 whitespace is the **market layer**: an order book or AMM for vaulted cards, or card rental and lending (official ideas 06/08/09), possibly with Oripa inventory.
3. **Compute-backed credit (USD.AI) and GPU revenue tokens (Aethir)** are the only real-money evidence for the Track 01 compute ideas. Both are shrinking from their peaks, so pitch them as "the market exists, the hedging tool doesn't."
4. **Programmable equity** (idea 12): xStocks and Robinhood Chain prove holders exist. StockRip shows a gacha-style distribution mechanic for stocks can earn fees, though it's fading. A stock gift, stream or conditional unlock on a mock ERC-20 is unclaimed on Monad.
5. **Embedded perps via wallets** are proven revenue (MetaMask, Phantom). On Monad this lines up with the Perpl + Agora Mobile bounties.

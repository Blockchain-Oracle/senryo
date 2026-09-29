# Deep dive: tokenized graded trading cards on Monad

Researched 2026-09-29. Covers vaulting, tokenization, packs, secondary trading, pricing, lending and rental. This file follows the evidence standard in [README.md](README.md). Every number has a source and a date, and anything not directly confirmed is marked **(unverified)**. There is no time or effort constraint on this analysis, so it reports what each piece would actually take. For each obstacle it gives the routes existing platforms already use ("Routes that work"). It uses the word "risk" only where no known route exists.

Builds on: [consumer-social-and-web2.md](consumer-social-and-web2.md) (candidates 1, 2, 3, 5, 10, 13), [evm-l2s-and-payment-chains.md](evm-l2s-and-payment-chains.md) (candidate 2) and [../01-tracks/social-culture.md](../01-tracks/social-culture.md) (official ideas 06–10; five of the twelve are about TCGs).

---

## Verdict

**Worth building, but only as a layer on top of inventory that already exists. It is not worth building your own vault or pack machine.** The evidence gives three reasons:

1. **The money is in packs, and nearly all of it is bought back.** Onchain secondary trading is a rounding error. Collector Crypt's Q2 2026 GMV was 97% packs, and 90.5% of GMV was paid back out as buybacks ([Blockworks CC Q2 report, Sep 2026](https://x.com/Blockworks/status/2095542851006308449)). The five largest platforms sold only **$7.9M** of cards on their own marketplaces in July 2026, against **$702.6M** of card resale across the whole market (1.12%) ([Blockworks Research, 2026-08-20](https://app.blockworksresearch.com/research/who-is-winning-the-onchain-gacha-trade)). A card order book with no inventory behind it would have no evidence of demand.
2. **The obstacles are solved problems.** Vaults, grading, redemption, pricing and randomness are all handled today, and several are sold as services. The most important find is that **Collector Crypt already runs a partner API** for machine adoption, custom machines, invoiced fiat and an EVM lane. **Its NFT contract is already deployed on Monad** at `0x1FFd5353aE2F29758B811fa9F9146c1F59E6e9e7` (chain 143). Its total supply there was **0** on 2026-09-29, and bridging from Base to Monad is live over Chainlink CCIP ([CC docs](https://docs.collectorcrypt.com/cross-chain/supported-chains); supply checked via `rpc.monad.xyz`). A Monad team can therefore get real, redeemable, PSA-graded inventory without touching a card.
3. **The crypto-native gacha peaked in June 2026. The collector market did not.** Onchain gacha spend fell from a record $354.8M in June to $290.3M in July ([Blockworks newsletter, 2026-08-07](https://blockworks.com/newsletter/0xresearch/issue/post_9b62a9d1-1c4b-41cb-9635-f00448175314)). Over the same period, off-chain card resale held at an all-time high of about $695M a month (same source), and Courtyard, the least crypto-native platform, set a record month. The durable customer is the collector who pays by card, not the whale who rotates in from memecoins.

**Where a new entrant can win on Monad (details in §6):**
- **(A)** A collector-grade market layer: a consumer app with passkey sign-in, AUSD or card payments, and zero-fee peer-to-peer trading on Collector Crypt EVM inventory bridged to Monad.
- **(B)** "SKU-fungible" vault receipts: one token per SKU and grade, redeemable for any cert of that SKU. This is the only design under which a Kuru-style order book or an AMM makes sense, because individual slabs are one-of-one.
- **(C)** Lending against tokenized cards, with liquidations routed into an existing platform's standing buyback bid.

**Rental of graded slabs should be rejected.** You can't play a slab, and the only proven rental market is digital (MTGO).

---

## 1. Market

### 1a. Onchain platforms (DefiLlama "Physical TCG" category plus Gacha; pulled 2026-09-29 via `api.llama.fi/summary/fees/<slug>`)

DefiLlama's definitions differ from adapter to adapter. "Revenue" below always means **retained after buybacks** (the `dailyRevenue` series). For Gacha (Abstract), DefiLlama's "fees" figure is **gross pack spend**, not revenue.

| Platform (chain) | Revenue Sep 2026 (to 29th) | Peak month (revenue) | Last 12 months | Notes |
|---|---|---|---|---|
| Collector Crypt (Solana) | $11.21M | $16.12M (Jun 2026) | $87.9M (1y fees) | Revenue is net of buybacks. It also sells through 14 partner surfaces |
| Courtyard (Polygon) | $2.12M | $6.73M (May 2026) | $47.5M | DefiLlama shows revenue falling, yet Blockworks recorded its gross pack spend at an all-time high of $85.3M in July (below) |
| Beezie (Base/Flow/Solana) | $0.74M | $2.21M (Mar 2026) | $13.0M | Fee = 6% on swap-backs and marketplace sales |
| Gacha (Abstract) | $0.45M net / $1.86M gross | $0.79M net / $4.27M gross (Aug 2026) | $14.6M gross | The platform keeps about 18.5% of gross (Aug: $0.79M of $4.27M) |
| Phygitals (Solana) | $0.26M | $4.35M (Sep 2025) | $10.9M | Revenue turned negative in Aug 2026 (−$0.08M) |
| DYLI (Abstract) | $0.36M | $0.63M (Nov 2025) | $2.37M | 5% marketplace fee, 2.5% P2P fee |
| Gemint (BSC) | $0.31M | still rising (Jun $0.08M → Sep $0.31M) | $0.78M | Estimated as 6% of paid volume |
| Monster (MegaETH) | $0.07M | $0.77M (Jun 2026) | $2.0M | 97.9% buyback ratio |
| Pumpbox (Base/Robinhood) | $0.15M | rising | $0.23M | Blind boxes |
| **Sector total (18 protocols, revenue)** | **$15.8M** | **$26.0M (Jun 2026)** | | Jul $17.5M, Aug $16.5M |

Source: DefiLlama API, pulled 2026-09-29. Monthly sums were computed from `totalDataChart`.

**Gross activity (a different lens), from Blockworks Research, "Who Is Winning the Onchain Gacha Trade" (2026-08-20):**
- The five largest platforms had **$344.4M** of gross gacha activity in June and **$284.3M** in July (down 17.5%). Buybacks returned **$249.4M (87.7%)**, which left **$34.9M** of revenue after buybacks in July.
- Courtyard earned "nearly twice" Collector Crypt's revenue after buybacks on just over half the volume. Its net gacha margin was **24.4%**, and its realized buyback ratio was 75.6% against 92.9% at Collector Crypt and Beezie and 97.9% at Monster.
- Only Courtyard's secondary market clears at retail scale: **$5.3M** of marketplace volume in July, 80,888 transactions, an average sale price of $65 and a **0% fee**. At Beezie, **85.5%** of "secondary" volume was the team buying back its own inventory.
- Users: Courtyard had **6,556 DAU** spending $458 per day each and **2,382 new users a day**. Collector Crypt had **871 DAU** spending **$6,069** per day each and 235 new users a day. Monster had 51 DAU at $8,877 per day each.
- Credit cards were **34.2%** of Courtyard's July gacha spend, 11.9% of Phygitals' and about 1% of Collector Crypt's, Beezie's and Monster's.

**Collector Crypt Q2 2026 (Blockworks token-holder report, published Sep 2026):**
- GMV was **$406.1M**, up 175% quarter on quarter. Gacha was **$395.1M (97%)**, secondary was $6.2M and buyback expense was **$367.5M (90.5% of GMV)**.
- Net revenue was $32.2M, a 7.9% net take. Constructed gross profit after redemption COGS was $20.3M (5.0% of GMV).
- The whole company is **8 people**.
- Spend is concentrated: wallets above $100K are 3.7% of users and 87% of spend, and 195 wallets above $1M (0.65% of users) account for 58%.
- 12-month user retention is 9.8% at Collector Crypt, 2.0% at Courtyard and 1.3% at Phygitals.
- Pokémon packs priced $1,000–2,500 made up **54.4%** of Pokémon gacha spend.
- Partner storefronts brought in $14.1M in Q2. Solflare alone did $6.3M.

**Bitquery onchain audit of Collector Crypt's gacha wallet (7 Dec 2025 – 13 Jul 2026; [bitquery.io](https://bitquery.io/investigations/collector-crypt-jupiter-gacha)):**
- $622.6M went in and $586.6M came back out, leaving roughly $36M for the house.
- 17,544 wallets played, and **78% lost money**. The median loss was $50.
- **714 wallets (spend above $100K) made up 88% of volume. 46 wallets made a third of all pulls.**
- 68% of wallets sold back essentially everything they pulled. Only 5.9% never sold a card.

### 1b. Web2 incumbents

| Company | Metric | Source (date) |
|---|---|---|
| eBay (card singles) | $2.62B of single-card sales on eBay in 2025 | GemRate via [Yahoo/cllct](https://sports.yahoo.com/articles/more-2-6-billion-spent-154500186.html) (2026) |
| eBay fee | 13.25% final value fee on trading cards, about $347M/yr implied card fee revenue | Blockworks (2026-08-20), [eBay fees](https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4822) |
| Card resale overall | $694.7M (Jul 2026) against $695.6M (Jun), close to an all-time high (Card Ladder dashboard) | Blockworks newsletter (2026-08-07) |
| Whatnot | 2025 GMV $8B. "More than $8B in first-half 2026". Revenue outlook above $1B for 2026. $545M Series G at $20B. Commission 8% plus 2.9% + $0.30. 0% on the portion of a sale above $1,500 since 2026-01-14 | [Auction Compass](https://getauctioncompass.com/blog/whatnot-growth-history), [Sacra](https://sacra.com/c/whatnot/), [Whatnot help](https://help.whatnot.com/hc/en-us/articles/27912945518733-Reduced-Commission-on-High-Value-Orders) (2026) |
| TCGplayer (eBay-owned) | 10.75% + 2.5% + $0.30 seller fees | [TCGplayer fees](https://help.tcgplayer.com/hc/en-us/articles/201357836-TCGplayer-Fees) |
| PSA / Collectors | Graded more than 19M cards in 2025, 72% share of the grading market. $4.3B valuation. Revenue is "roughly $300–350M" **(unverified, from Reddit)** | [NYT Athletic 2026-05-14](https://www.nytimes.com/athletic/7279405/2026/05/14/psa-card-grading-investment/), [Sportico/Yahoo](https://sports.yahoo.com/collectors-100m-raise-4-3b-095504610.html), GemRate via Phantom Display |
| GameStop | Collectibles net sales +47.7% to $1.06B (FY2025). Launched **Power Packs** (the same gacha model, with PSA slabs and no blockchain) on 2026-04-15 | Blockworks (2026-08-20), [GameStop IR](https://investor.gamestop.com/news-releases/news-details/2026/GameStop-Launches-Power-Packs-for-Digital-Trading-Cards/default.aspx) |
| Alt | Vault, auctions and lending. Up to $40M credit facility from Trinity Capital (2025-07-18). $31M raised in 2021 | [PR Newswire](https://www.prnewswire.com/news-releases/trinity-capital-inc-provides-alt-platform-inc-with-up-to-40-million-asset-based-credit-facility-302508483.html) |
| Goldin (eBay) | Record quarterly GMV in Q1 2026, anchored by the $16.5M PSA 10 Pikachu Illustrator sale (2026-02-16) | [Digital Commerce 360](https://www.digitalcommerce360.com/2026/05/01/ebay-sales-gmv-ai-q1-fy26/amp/), [CMC Academy](https://coinmarketcap.com/academy/article/tokenization-pokemon-cards-nfts-rwas) |

### 1c. Where the revenue actually comes from

- **Onchain, it comes from the buyback spread on packs.** An "expected value" above the pack price is advertised, but the buyback pays 85–93% of it. Bitquery measured players getting back **94.2%** of what they spent on the $50 pack, which puts the house edge at about 6%. Collector Crypt posts sellback rates of 85% on smaller packs, 90% mid-tier and 93% at $1,000 and above (Blockworks Q2). Courtyard pays 90% of FMV minus a 6% fee, so **84.6% effective** (Blockworks 2026-08-20).
- **Onchain secondary fees are close to zero.** Collector Crypt's Q2 marketplace fees were **$0.11M**. Courtyard charges 0% on purpose, to steer exits away from its own balance sheet.
- **Web2 earns its revenue from commissions on real peer-to-peer trades:** eBay at 13.25%, Whatnot at about 8% plus processing, and TCGplayer at about 13%. That is the "10–15% cut" in official idea 06.

### 1d. Why the onchain category peaked in June 2026

1. **One whale product.** Collector Crypt's $2,500 Pokémon pack launched on 10 June and did **$82.9M in three weeks**, about 40% of its June volume ([CMC Academy, Sep 2026](https://coinmarketcap.com/academy/article/tokenization-pokemon-cards-nfts-rwas), citing Blockworks).
2. **Subsidies ended.** June included a quarterly airdrop and a $500K giveaway. Collector Crypt has given away 141,000 free packs worth $12.2M in total (Blockworks Q2 and 2026-08-20).
3. **Channel decay.** The Jupiter Gacha integration launched on 13 July, did $26.2M, then fell **68% within three weeks**, from $1.66M a day to $525K a day (Blockworks 2026-08-20).
4. **Crypto-native capital rotated back into memecoins.** Collector Crypt's daily spend fell 39% across July while Pump.fun volume rose 21% (Blockworks 2026-08-07).
5. **Pokémon prices softened in September.** Generous pull rates in the *30th Celebration* set (released 2026-09-16) flooded supply and hit resale prices ([Yahoo Finance/Moneywise, Sep 2026](https://finance.yahoo.com/markets/commodities/articles/pok-mon-card-scalpers-crushed-104500578.html)). Pokémon was 80.8% of Collector Crypt's July pack spend, so this matters directly.

### 1e. What is still growing

- **Off-chain collector demand:** card resale near an all-time high at about $695M a month (Jul 2026), Whatnot at more than $8B GMV in H1 2026, GameStop collectibles up 47.7%, and PSA's 19M cards graded in 2025.
- **The retail, card-paying onchain customer:** Courtyard grew pack units 22.8%, DAU 59% and new users 128% in July while the rest of the category fell (Blockworks 2026-08-20).
- **Small EVM platforms:** Gemint (BSC) revenue rose every month from June to September, and DYLI grew +91% month on month in September (DefiLlama).
- **B2B distribution of inventory:** Collector Crypt feeds 14 partner surfaces (Jupiter, Solflare, Rarible Gacha Station, Slabz, ComicBook.com and others) ([solana.com, 2026-07-31](https://solana.com/news/tokenized-cards-and-physical-collectibles)).

---

## 2. How they work

| Element | How the leaders do it |
|---|---|
| **Vault** | Courtyard uses **Brink's** ([Polygon blog](https://polygon.technology/blog/tokenization-spotlight-courtyard-io-puts-analog-collectibles-like-pokemon-cards-onchain)). Collector Crypt ships from "PSA Vault, OmniVault, and others". It moved vaulting in-house in spring 2026 and bought a facility of roughly 25–28K sq ft in Montana ([Jupiter docs](https://docs.jup.ag/user-docs/trade/gacha/providers), [Decrypt 2026-06-14](https://decrypt.co/370978/pokemon-cards-surging-crypto-platforms-gambling)). Phygitals uses **PSA Vault, Fanatics Vault and Alt Vault**, and says the cards are insured through those partners (Jupiter docs). Oripa uses an unnamed "third-party vault custody" ([Oripa ToS](https://docs.oripa.cards/terms-of-service)). |
| **Token standard** | Collector Crypt uses Metaplex NFTs on Solana. On EVM it uses the ERC-721 `CollectorCrypt`/`COLLECTOR`, which is UUPS-upgradeable with a 2-day admin timelock. Courtyard uses ERC-721 on Polygon. Phygitals uses Solana NFTs. Beezie uses Base/Flow NFTs plus Metaplex Core on Solana. All of them are **1:1 with a specific cert number**. Collector Crypt writes the **insured value into the metadata** ([CC metadata docs](https://docs.collectorcrypt.com/metadata)). |
| **Redemption** | You burn the NFT and pay shipping plus a fee. Courtyard charges about $2 per card plus shipping ([Plisio](https://plisio.net/nft/courtyard)), and about 4% of Courtyard items are ever redeemed ([CBNT, 2026-05-10](https://cbnt.co.jp/en/reports/6a0152ced45278a7592f0dec)). Collector Crypt redeemed 6,126 cards worth $2.94M insured in July 2026 (Blockworks), and 22,805 burns worth $11.62M insured in Q2 (2.86% of GMV). |
| **Pricing** | Courtyard uses a proprietary FMV built from recent sales, category trends and cross-grader comparables ([Courtyard help](https://intercom.help/courtyardio/en/articles/11955231-understanding-buyback-offers)). Collector Crypt uses an "insured value" mark that it writes onchain. Oripa's "market price is determined by us at our discretion, drawing on third-party market data sources" (Oripa ToS). **No platform uses an independent onchain price oracle.** |
| **Buyback** | Collector Crypt pays 85–93% of insured value within 72 hours of a pull, and has run a standing "lifetime" marketplace bid since 2026-05-01. Courtyard pays 90% of FMV minus a 6% fee. Beezie offers up to 90% for 15 minutes. Jupiter pays at least 85% of insured value for 3 days. Oripa pays 85% for one hour. |
| **Randomness** | Collector Crypt uses onchain VRF plus an inspectable pool wallet. Phygitals and Oripa use commit–reveal. Courtyard mints on open and publishes no pre-spin pool (Blockworks Q2). |
| **Wallet UX** | Courtyard uses thirdweb email wallets with fiat, Apple Pay and Google Pay (CBNT). Privy is used by Courtyard ([Privy](https://www.privy.io/insights/inside-the-stack-how-courtyard-is-reinventing-the-collectibles-marketplace)), Collector Crypt and Oripa (found in the Oripa JS bundle, 2026-09-29). |

**What fails:**
- **Long-tail liquidity.** Buybacks fund 87.7% of exits, and all but Courtyard "mostly bid on their own inventory" (Blockworks).
- **Trust.** "90% of people [at card shows] say 'That's a fraud… a rug-pull'" (Collector Crypt CEO, Decrypt 2026-06-14). There is a Reddit report of a redeemed Courtyard card "could not be produced" ([r/sportscards](https://www.reddit.com/r/sportscards/comments/1plko62/warning_when_using_courtyardio/)) **(unverified single report)**. There are reports of a fake slab found in the PSA Vault **(unverified)**.
- **Pool draining.** On open-pool machines, bots pull when expected value rises. The top Collector Crypt wallet made 73,496 pulls for about $951K profit (Bitquery), and third-party "live EV" tools exist for Courtyard ([Pulld post](https://x.com/Youkhna/status/2029256252078080418)).
- **Channel rental.** Partner volume decays quickly (Jupiter fell 68% in three weeks).
- **Whale concentration.** 88% of volume comes from 714 wallets (Bitquery).

---

## 3. Infrastructure available to a new entrant

### 3a. Inventory-as-a-service (the key finding)

**Collector Crypt partner stack** ([docs.collectorcrypt.com](https://docs.collectorcrypt.com), read 2026-09-29):
- **Gacha API with an `x-api-key`.** It supports three per-key capabilities, all off by default, and "ask us to enable them":
  - `can_adopt`: attach a per-pack fee to a Collector Crypt machine. The cap is **10% of pack price**, and the player's EV falls by the size of the fee.
  - `can_build_machines`: build your own machines on the shared inventory.
  - `can_edit_hashlists`: curate which cards are active.
- **Invoiced API:** a partner with its own accounts and fiat checkout sells packs, and Collector Crypt holds the cards. Nothing is paid onchain; there is a monthly net invoice.
- **EVM API:** pay in an ERC-20 and receive an ERC-721 card. Buybacks are paid in the same token. Production currently serves **Base (8453) and Robinhood Chain (4663)**; `gacha.collectorcrypt.com/api/evm/chains` was queried on 2026-09-29.
- **Monad:** the contract is at the same address (`0x1FFd…e9e7`), with `name()` = CollectorCrypt and `totalSupply()` = 0 on 2026-09-29. Base had 135 cards. The **EVM→EVM bridge lane Base↔Monad↔Ethereum is live over Chainlink CCIP**. EVM cards currently trade on OpenSea, and "native in-app EVM trading is in development".
- **Marketplace API:** unsigned transaction builders for list, buy, buy-with-swap and offers, plus a public metadata API. No key is needed.
- A starter demo exists at [github.com/daxherrera/gacha-starter](https://github.com/daxherrera/gacha-starter) (TypeScript, updated 2026-09-28, 1 star, no licence).
- Contact: info@collectorcrypt.com, discord.gg/CollectorCrypt.

**Other inventory providers:**
- **Phygitals** also supplies Jupiter Gacha ([Jupiter docs](https://docs.jup.ag/user-docs/trade/gacha/providers)).
- **Beezie** lets "resellers and brands… host their own" claw machines ([BusinessWire, 2024-12-11](https://www.businesswire.com/news/home/20241211940529/en/Beezie-Revolutionizes-Collectibles-Industry-with-Innovative-Platform-Secure-Vaulting-and-Gamification)). The terms are not public **(unverified)**.
- **Phygitals repackages Collector Crypt-originated slabs** into its own products (Blockworks), so cross-platform inventory reuse is already happening.

### 3b. Vault and custody services that accept third parties

Fees are from [cardgrading.app, 2026](https://cardgrading.app/card-vaulting), an aggregator; treat them as **(unverified against primary fee pages)**.

| Vault | Access for a platform | Economics |
|---|---|---|
| PSA Vault (bought eBay's vault in May 2024) | Every PSA customer gets a Vault ID. Vault-to-vault transfers are possible ([Reddit r/psagrading](https://www.reddit.com/r/psagrading/comments/1s84hvf/direct_private_deal_on_card_in_psa_vault/)). Cards are "100%-insured" ([PSA](https://www.psacard.com/info/psa-vault)). Used by Collector Crypt and Phygitals | Storage 0.37%/yr of list price on listed cards. $1 per card intake on PSA-direct. $100 minimum |
| Fanatics Collect Vault | Personal vault address. **Peer-to-peer transfer of vault ownership** is supported ([Fanatics help](https://support.fanaticscollect.com/en_us/peer-to-peer-transfer-of-vault-item-ownership-ryfvwpyxg)). Used by Phygitals | Free storage. 6–12% sell fee |
| Alt Vault | Used by Phygitals. Free intake above $50 of Alt Value | 1–3% withdrawal |
| Brink's | Courtyard's partner; enterprise contract | Not public |
| Collector Crypt's Montana vault | "Competitors… plugging directly into our… liquidity pool that's being stored in our vault" (CEO, Decrypt) | Through the partner API |

### 3c. Card price data

| Source | Access | Notes |
|---|---|---|
| **PSA Public API** | Free login-based key at `api.psacard.com/publicapi/` ([docs](https://www.psacard.com/publicapi/documentation)) | Cert verification and population data. Useful to prove a slab exists and what grade it is |
| **Card Ladder** (owned by PSA/Collectors) | Pro plan $20/month. There is no official API. A third-party scraper is sold via Parse.bot for $0–1,000/month **(unverified legality)** | "Every public sale… back to 2000" |
| **PriceCharting API** | Paid subscription, about $50/month per Reddit **(unverified)** ([docs](https://www.pricecharting.com/api-documentation)) | Has graded prices (grade 1–10 fields) |
| **JustTCG** | API key, commercial licence on paid plans ([justtcg.com](https://justtcg.com/)) | 279K+ cards. v2 beta has PSA/BGS/CGC graded variants |
| **eBay Marketplace Insights** | Restricted and needs business approval (eBay dev forum) | This is the sold-comps source most people want, and it's hard to get |
| **130point** | Scrapes eBay sold listings. There's a developer programme, but its terms are unclear **(unverified)** | Reliability complaints from users |
| **Collector Crypt insured value** | Public, onchain, in the NFT metadata | The only onchain mark available today. It is the issuer's own number, so it isn't independent |

### 3d. Legal: gacha, lottery and securities

- **US federal:** there is no classification of mystery boxes as gambling. The FTC Section 5 posture is to disclose odds accurately and avoid misleading claims. At state level, **Washington is the strictest**, with heightened scrutiny in Michigan and New Jersey ([track360, mid-2026](https://track360.io/blog/loot-box-vs-mystery-box-gambling-regulation-map-2026)).
- **Belgium:** paid random rewards have been treated as gambling since 2018, and that applies to physical prizes too. Geo-block it.
- **Netherlands:** heightened scrutiny. The 2020 EA fine was overturned in 2022, but the KSA still targets cash-out mystery boxes.
- **UK:** no licence is required today, but the UKGC could reinterpret. Operators use an age gate and KYC.
- **Japan:** the online oripa sector is under pressure. On 2026-09-07, law firm Hibiki asked the Consumer Affairs Agency to investigate five large online oripa operators under the Specified Commercial Transactions Act. It cited about 460 complaints and about ¥3.1B of claimed losses ([Tokyo Shimbun, 2026-09-12](https://www.tokyo-np.co.jp/article/515010)).
- **Securities:** the SEC/CFTC joint interpretation of 2026-03-17 (Release 33-11412) places **digital collectibles in the not-a-security bucket**, but "fractionalized digital collectibles may still be securities" ([bitfinance summary](https://bitfinance.substack.com/p/pokemon-cards-cracked-tokenization)) **(verify against the release text)**.
- **Oripa's own posture:** 20+ age requirement, KYC, geo-blocking of 17 jurisdictions (including Thailand, China, Hong Kong and Macau), and an invite-only beta "pending… MOI advisory opinion and SEC licensing applications" in Thailand ([Oripa T&C, updated 2026-06-20](https://docs.oripa.cards/terms-and-conditions)).

---

## 4. Monad specifics

### Oripa (oripa.cards), listed on the Monad App Hub on 2026-09-06, marked "onlyOnMonad"
- **Operator:** The Concept Labs Company Limited (Thailand) (Oripa ToS). X handle [@OripaOnChain](https://x.com/OripaOnChain).
- **Mechanism:** a finite-pool oripa, not an infinite gacha. Results are committed onchain before a box goes live, then revealed per pack. Payment is USDC or Coinflow card. The card is a "Digital Title Asset" NFT on Monad. **Buyback is 85% of market price for one hour.** Redemption burns the NFT. There is P2P listing, offers and card-for-card swaps.
- **Traction from its public API** (`api.oripa.cards/boxes`, queried 2026-09-29): **2 live boxes**, both published 2026-09-09, each with 300 packs at $99.90. **91 packs sold** in total (48 and 43), which is about **$9.1K gross in 20 days**. Each box has 5 named PSA prizes; the top prize is a PSA 4 2001 Birthday Pikachu insured at $1,900. `/marketplace/listings` returned **0**. `/config` returned `shipping_enabled: false`.
- **Contract addresses:** not published in its docs or its frontend bundle. The only Monad contract found in the bundle was USDC `0x7547…b603`, and minting appears to run server-side through Privy wallets. **(unverified: no NFT contract found)**.
- **Takeaway:** Oripa is a small, early partner with real PSA certs but no liquidity. It is a possible inventory or UX partner, not a traction source.

### Other collectibles on Monad
- **Collector Crypt EVM contract** at `0x1FFd5353aE2F29758B811fa9F9146c1F59E6e9e7`: deployed, total supply 0 (2026-09-29). This is the biggest latent opportunity (§3a).
- **PlayKami** (App Hub listing, first published 2026-02-11): "gamified marketplace… Pokemon and One Piece TCG cards to luxury watches… sold back instantly, or redeemed". **playkami.io returned a Cloudflare error 1000 on 2026-09-29**, so treat it as likely inactive **(unverified)**.
- **Omnia**, an action TCG pet battler, is a digital game, not physical cards.
- There was no DefiLlama Physical TCG listing on Monad as of 2026-09-29.

### Would an order book, collectible AMM, card lending or rental improve on what exists?

| Mechanism | Evidence | Assessment |
|---|---|---|
| **Kuru-style CLOB on individual slab NFTs** | Each slab is a unique cert, so a book per cert holds one unit. Onchain secondary is only 1.12% of resale (Blockworks). Courtyard's P2P marketplace works as fixed-price listings at 0% fee, not an order book | **Doesn't fit as a design.** A CLOB needs fungibility |
| **CLOB or AMM on SKU-fungible receipts** (one token = any PSA 10 of card X) | Precedents: RipzGG fulfils with "a sourced physical slab of the same identity and grade" ([solana.com](https://solana.com/news/tokenized-cards-and-physical-collectibles)). The $SV151 "Dynamic Asset" is a sealed-product reserve on Meteora (same source). CardZ Marketcap ranks cards by verified PSA 10 population ([cardzmarketcap](https://cardzmarketcap.com/faq)) | **This is where Monad's ~300 ms blocks and Kuru add something real.** Continuous bids and asks on liquid SKUs (modern Pokémon or One Piece PSA 10s with large populations) give real price discovery, and that becomes the oracle for lending. Each token is still one whole card, so it stays outside the fractionalization caveat |
| **Card lending** | Jupiter Offerbook (fixed-rate P2P, accepts Collector Crypt and Phygitals cards) has **$1.26M TVL and $0.50M borrowed across all asset types** (DefiLlama, 2026-09-29). First major card loan: $30K against a $60K card ([Phygitals on X](https://x.com/phygitals/status/2064059705841070474)). Web2: Alt lends up to 40% LTV at 9–10% plus SOFR with a 1% origination fee and a $25K minimum ([Alt help](https://support.alt.xyz/en/articles/9213544-alt-lending)). CFC lends up to 50% ([PSA article](https://www.psacard.com/articles/articleview/10574/defining-collateralized-loans)) | Demand exists in Web2 (Alt's $40M facility), but it is **small onchain so far**. Monad's edge would be loans under $25K with instant liquidation into a standing buyback bid |
| **Rental** | Graded slabs can't be played in tournaments. The proven rental market is **digital MTGO** (ManaTraders, Cardhoarder: [ManaTraders](https://www.manatraders.com/subscriptions)) | **Reject for physical slabs.** It only makes sense for purely digital TCG assets |

**Secondary trading versus packs:**
- Packs make up 97% of Collector Crypt's GMV. Onchain secondary was $7.9M against $702.6M off-chain resale (Jul 2026).
- Organic secondary in Q2 2026 was Courtyard $11.6M, Collector Crypt $4.1M, Phygitals $0.95M, Beezie $0.44M and Monster $0.03M (Blockworks Q2).
- **The demand for secondary trading is real, but it lives off-chain** (eBay, Whatnot, Fanatics). Courtyard shows that a 0% fee, a native mobile app and card payments can pull part of it onchain.

---

## 5. Obstacles and the routes that work

### 5.1 Physical vaulting and custody
**Routes that work:**
- **Use inventory that is already tokenized. Don't vault your own.** Collector Crypt's partner API supports adopting a machine for up to a 10% fee, building your own machines on shared inventory, and the invoiced fiat API. Jupiter, Solflare, Rarible, ComicBook.com and Slabz all do this (Blockworks Q2; solana.com 2026-07-31).
- **If you must hold cards yourself, use a vault account.** PSA Vault, Fanatics Vault or Alt Vault, as Phygitals does with all three (Jupiter docs). Brink's is Courtyard's route, but it needs an enterprise contract.

**First steps:**
1. Email info@collectorcrypt.com asking for a partner key with `can_adopt` and `can_build_machines`, and for the **Monad EVM lane** to be enabled on `gacha.collectorcrypt.com/api/evm/chains`. The contract is already deployed at the same address.
2. Build against `dev-gacha.collectorcrypt.com` (Base Sepolia) in the meantime, using [daxherrera/gacha-starter](https://github.com/daxherrera/gacha-starter).
3. Bridge a handful of Collector Crypt cards Base → Monad over CCIP to seed real inventory.

### 5.2 Grading and authentication
**Routes that work:**
- **Only accept cards that are already graded** (PSA, BGS or CGC), as every platform does.
- **Verify certs** with the free PSA Public API (`api.psacard.com/publicapi/`).
- **For intake,** Courtyard accepts direct intake from PSA, CGC, eBay and Fanatics Collect, meeting collectors inside their existing workflow (CBNT 2026-05-10).
- **PSA also runs "PSA Verified Repacks"** (PSA site nav), which is a route to third-party certification of pack contents **(terms unverified)**.

### 5.3 Redemption and shipping
**Routes that work:**
- **Collector Crypt runs a Shipping API and Invoiced Shipping** for partners ([docs](https://docs.collectorcrypt.com/vault/shipping-api)), so Jupiter redeems Collector Crypt cards straight from its own UI.
- **Burn-to-redeem is the universal pattern.** Expect about 3–4% of value to be redeemed (Courtyard about 4% of items; Collector Crypt 2.86% of GMV in Q2).
- **Oripa's model** quotes live carrier rates, has the user pay shipping and customs, and burns the NFT on claim.

### 5.4 Pricing data and oracles
**Routes that work:**
- **Short term:** use the insured value Collector Crypt already writes into the NFT metadata, plus PriceCharting or JustTCG graded prices as a cross-check.
- **Medium term:** make your own trades the oracle. Courtyard's independent buyers "generate real market prices that can improve future buyback underwriting" (Blockworks). An order book on SKU-fungible receipts (§4) creates a public price series.
- **Avoid depending on eBay sold data.** The API is restricted, and 130point and Card Ladder have no sanctioned API.

### 5.5 Long-tail liquidity
**Routes that work:**
- **A platform buyback as the floor bid:** Collector Crypt's lifetime bid at a percentage of insured value, and Courtyard's 84.6% effective buyback.
- **A 0% peer-to-peer fee** so exits go to other users rather than the balance sheet (Courtyard: $5.3M in July, 6.2% of its gacha volume).
- **Put liquidity where the population is deep.** Run order books only on liquid SKUs, and use the buyback for the long tail.
- **Official idea 08 ("AMM for the long tail") should be built as an AMM per SKU and grade**, seeded from buyback inventory. It should not be one AMM per unique NFT.

### 5.6 Gacha and lottery law
**Routes that work:**
- **Use finite pools with pre-committed results** (Oripa's commit–reveal, Collector Crypt's VRF and inspectable pool). **Publish odds and EV per pack**, since the FTC Section 5 posture is about disclosure.
- **Every pack contains a real item of stated value.** Courtyard's Vending Machine sets expected value equal to the pack price (CBNT).
- **Enforce 18+ (or 20+) and KYC,** and **geo-block** Belgium, Washington state and restricted jurisdictions. Oripa blocks 17 jurisdictions; Phygitals publishes a restricted-jurisdictions policy.
- **Frame it as shopping.** Collector Crypt's CEO calls it "gamified shopping" with a "positive expected value" (Decrypt).
- **Or skip packs entirely.** A pure market layer (§6 A/B/C) carries no gacha exposure at all.

### 5.7 Trust and fraud
**Routes that work:**
- **Borrow a trusted brand for custody:** Brink's (Courtyard), PSA Vault (Collector Crypt, Phygitals).
- **Make inventory verifiable onchain:** a public pool wallet plus insured value in the metadata (Collector Crypt).
- **Publish redemption data.** Collector Crypt got a critic to retract a claim by showing 587 wallets redeeming 4,660 items worth $2.41M in one month (CMC Academy).
- **Keep collectors' assets legally separate.** Oripa's ToS says vaulted cards "are not assets of The Concept Labs Company Limited".

### 5.8 Inventory capital (only if you run your own packs)
**Routes that work:**
- **Use shared inventory** (5.1), so you need no capital.
- **Raise capital, as the leaders did.** Courtyard raised $37.5M in total (CBNT), and Collector Crypt's "restock spend grew 3.5x" in Q2 (Blockworks Q2).
- **Recycle bought-back cards into new packs.** At Courtyard, each card cycles 6–15 times (CBNT).

### 5.9 Distribution
**Routes that work:**
- **Own a mobile app with card payments.** Courtyard has a 4.6-star iOS app and gets 34.2% of spend by card.
- **Use Mera passkeys plus AUSD or card checkout** so users never see a wallet.
- **Live commerce,** in the style of Whatnot and Drip Shop Live on Solana.
- **Wallet partners** like Solflare, which did $6.3M in its first weeks.

---

## 6. What it takes, and where a new entrant can win

| Option | What it actually takes | Moat and why it could win | Evidence of demand |
|---|---|---|---|
| **A. Monad collector app on Collector Crypt EVM inventory** (packs through `can_adopt`, 0% P2P market, redemption through Collector Crypt shipping, Mera passkey, AUSD/Coinflow checkout) | A Collector Crypt partner key and Monad lane enablement; a mobile-grade front end; KYC and geo-blocking; a fee of ≤10% of pack price as revenue | Owned distribution and a collector (not whale) audience, which is the Courtyard playbook that Blockworks ranks first. Monad-native speed for opening, trading and loan settlement | Courtyard: 2,382 new users a day, 24.4% net margin (Jul 2026) |
| **B. SKU-fungible vault receipts plus a Kuru order book** (one ERC-20 per SKU and grade, minted against whole slabs in a partner vault, redeemable for any cert of that SKU) | A vault partner (PSA, Fanatics or Collector Crypt) willing to hold pooled SKUs; redemption rules (cert substitution, as RipzGG does); SKUs picked by PSA population depth; market makers seeded from buyback inventory | **It fits official ideas 06 and 08 literally** and uses Kuru (Monad's top DEX at $2.87B in 30 days, see [ecosystem notes](../05-ecosystem/)). It creates a real price series, which becomes the oracle for option C | Unproven onchain; this is the novel bet. Off-chain demand is about $695M a month of resale |
| **C. Card-backed lending** (AUSD loans against Collector Crypt, Oripa or receipt NFTs, with liquidation routed to the platform's standing buyback) | A price feed (insured value, then B's order book); integration with the buyback as the liquidation venue; lender capital | Loans under $25K, which Alt won't write; instant liquidation | Alt's $40M facility (Web2). Jupiter Offerbook is small ($0.5M borrowed across all assets) |
| Own vault plus own gacha | Millions in inventory **(estimate, unverified)**, a buyback float, vault contracts, gambling counsel | None; Blockworks says the "core gacha product is easy to replicate" and GameStop copied it without a chain | Crowded (30+ platforms, per Decrypt) and declining after June |
| Slab rental | n/a | n/a | **Reject** (see §4) |

**Best category focus:** One Piece is Collector Crypt's second-largest IP at more than $50M in Q2, and it is less exposed to the 30th Celebration Pokémon price drawdown. Sports is Phygitals' and GameStop's lane. Pokémon was still 80.8% of Collector Crypt's July spend, so it is where the depth is.

---

## 7. Risks with no known route

- **Demand concentration and cyclicality.** Onchain pack volume depends on a few hundred whale wallets (88% of Collector Crypt volume from 714 wallets) who rotate with memecoin cycles. No platform has shown a way to replace them except Courtyard's slow retail funnel. This is a demand risk, not an engineering one.
- **Regulatory reclassification.** A US state, the UKGC or Japan's Consumer Affairs Agency could reclassify cash-out mystery boxes as gambling. Geo-blocking reduces the exposure but doesn't remove it. Options B and C avoid it because they don't involve packs.
- **Single-provider dependency.** Several platforms share the same graders, vaults and payment processors, so one provider disruption hits all of them (Blockworks). Using inventory from more than one provider (Collector Crypt and Phygitals, as Jupiter does) spreads this but doesn't remove it.
- **Pokémon price drawdown.** It cuts inventory value and the buyback quotes a platform can support in the same month (Blockworks). There is no hedge instrument yet, and B would be the first.

## Rejected
- **Slab rental.** Slabs can't be played, and the proven rental demand is digital MTGO.
- **Fractional shares of single high-value cards.** They may be securities under the 2026-03-17 SEC/CFTC interpretation (bitfinance summary).
- **A standalone order book with no inventory partner.** No liquidity source exists, and onchain secondary is only about 1% of resale.

## Sources (all accessed 2026-09-29 unless dated otherwise)
- DefiLlama API: `api.llama.fi/summary/fees/{collector-crypt,courtyard,beezie,gacha-tcg,phygitals,dyli,gemint,monster,pumpbox,…}` and `api.llama.fi/protocol/jupiter-offerbook`
- Blockworks Research, "Who Is Winning the Onchain Gacha Trade" (2026-08-20): https://app.blockworksresearch.com/research/who-is-winning-the-onchain-gacha-trade
- Blockworks 0xResearch, "Gacha Cools Off" (~2026-08-07): https://blockworks.com/newsletter/0xresearch/issue/post_9b62a9d1-1c4b-41cb-9635-f00448175314
- Blockworks, Collector Crypt Q2 2026 token-holder report (Sep 2026): https://x.com/Blockworks/status/2095542851006308449
- Bitquery, Collector Crypt gacha audit (window Dec 2025 – Jul 2026): https://bitquery.io/investigations/collector-crypt-jupiter-gacha
- Collector Crypt docs (cross-chain, EVM API, gacha API, invoiced API, metadata, contact): https://docs.collectorcrypt.com
- Jupiter Gacha providers docs: https://docs.jup.ag/user-docs/trade/gacha/providers
- Solana.com, "Inside Solana's Growing Market for Tokenized Cards" (2026-07-31): https://solana.com/news/tokenized-cards-and-physical-collectibles
- CMC Academy, "Tokenized Pokemon Cards Beat Bitcoin in 2026" (Sep 2026): https://coinmarketcap.com/academy/article/tokenization-pokemon-cards-nfts-rwas
- Decrypt (2026-06-14): https://decrypt.co/370978/pokemon-cards-surging-crypto-platforms-gambling
- CBNT, "Inside Courtyard.io" (2026-05-10): https://cbnt.co.jp/en/reports/6a0152ced45278a7592f0dec
- CoinDesk (2026-08-11): https://www.coindesk.com/business/2026/08/11/pokemon-cards-are-becoming-multibillion-dollar-market-crypto-wants-to-fix-how-they-trade
- Oripa: https://app.monad.xyz/app-hub/oripa, https://docs.oripa.cards, `https://api.oripa.cards/boxes`, `/config`, `/marketplace/listings`
- Monad RPC `rpc.monad.xyz` (eth_call name, symbol and totalSupply on `0x1FFd5353aE2F29758B811fa9F9146c1F59E6e9e7`); Base RPC `mainnet.base.org`
- track360 regulation map (mid-2026): https://track360.io/blog/loot-box-vs-mystery-box-gambling-regulation-map-2026
- Tokyo Shimbun (2026-09-12): https://www.tokyo-np.co.jp/article/515010
- bitfinance, "Pokemon Cards Cracked Tokenization's Problem": https://bitfinance.substack.com/p/pokemon-cards-cracked-tokenization
- cardgrading.app vault fees (2026): https://cardgrading.app/card-vaulting
- PSA Vault: https://www.psacard.com/info/psa-vault; PSA Public API: https://www.psacard.com/publicapi/documentation
- Alt Lending: https://support.alt.xyz/en/articles/9213544-alt-lending
- Whatnot: https://sacra.com/c/whatnot/, https://getauctioncompass.com/blog/whatnot-growth-history
- GameStop Power Packs IR (2026-04): https://investor.gamestop.com/news-releases/news-details/2026/GameStop-Launches-Power-Packs-for-Digital-Trading-Cards/default.aspx

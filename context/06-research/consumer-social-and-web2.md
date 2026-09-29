# Consumer, Social and Web2 Products Worth Adapting to Monad

> Direction: consumer and social products outside the big DeFi chains, plus fast-growing Web2 consumer fintech and social products whose weak spot (fees, trust, slow settlement, custody, cross-border) onchain rails fix.
> Researched 2026-09-29. Method and evidence standard: [README.md](README.md). Tracks: [../01-tracks/](../01-tracks/README.md).
> DefiLlama figures were pulled from `api.llama.fi/summary/fees/<slug>` on **2026-09-29** (monthly sums of daily revenue). "30d" means the 30 days to 2026-09-29.
> For Web2 products, "Traction" means users, revenue, GMV or funding.

## Summary: ranked by evidence strength

| # | Product | Hardest metric | Track fit |
|---|---|---|---|
| 1 | Collector Crypt (Solana) | $11.0M revenue in 30d; $99.2M all-time (DefiLlama) | 03 (ideas 06, 08, 09) |
| 2 | Courtyard (Polygon) | $63.2M all-time revenue (DefiLlama); $30M Series A led by Forerunner | 03 (ideas 06, 08) |
| 3 | Whatnot (Web2 live collectibles) | $8B GMV in 2025; $545M Series G at $20B | 03 (idea 06) |
| 4 | StepBet / DietBet (Web2 money-stake fitness) | 1.32M + 1.04M players; $148.9M + $101.1M paid to winners | 02 (ideas 02, 03) |
| 5 | Beezie (Base/Flow) | $11.4M all-time revenue (DefiLlama); $4M raise July 2026 | 03 (ideas 06, 08) |
| 6 | Earned wage access (DailyPay, EarnIn) | DailyPay $25B payments volume; EarnIn Live Pay 1M transactions | 02 (idea 06) |
| 7 | Splitwise (Web2 bill splitting) | 10M+ Play downloads; ~700K downloads/month (Sensor Tower est.) | 02 (idea 01) |
| 8 | Opal + Forfeit (screen time and habit stakes) | Opal 1M DAU, $10M ARR; Forfeit 20K+ users | 02 (idea 02) |
| 9 | Moonwalk Fitness (Solana) | $3.4M seed (Hack VC); #2 most-used Seeker dApp | 02 (ideas 02, 03) |
| 10 | Phygitals (Solana) | $15.7M all-time revenue (DefiLlama); $180M claimed volume | 03 (ideas 06, 08) |
| 11 | Patreon / Ko-fi (creator tipping) | Patreon $10B+ paid to creators, $2B+/yr | 02 (idea 01), 03 (idea 04) |
| 12 | Graze (Bluesky custom feeds) | $1M pre-seed; acquired by Flipboard Aug 2026 | 03 (ideas 01, 02) |
| 13 | Alt (card vault, cash advance) | Up to $40M credit facility (Trinity Capital) | 03 (idea 09) |
| 14 | DICE (fan-first ticketing) | $238M raised; acquired by Fever 2025 | 03 (idea 04), whitespace |
| 15 | Telegram collectible gifts (TON) | 166K unique users, FDV >$100M (May 2025, secondary) | 02 (ideas 01, 05) |
| 16 | Cover Genius (embedded micro-insurance) | $100M at $1.9B valuation | 02 (idea 07) |

**Pattern:** the strongest evidence clusters in two places. (1) **Physical trading cards with instant liquidity** (Collector Crypt, Courtyard, Beezie, Phygitals, and Whatnot in Web2). This is exactly the TCG cluster that makes up 5 of Track 03's 12 official ideas. (2) **Money-stake behaviour change** (StepBet/DietBet with $250M paid out across 2.3M players, Opal, Forfeit, Moonwalk). This maps word for word to Track 02 ideas 02 and 03. Onchain *social* (Zora, Farcaster, Base App social) is the weakest area: see Rejected.

---

## Candidates

### 1. Collector Crypt (Solana)
- **What it does:** Tokenizes PSA-graded Pokémon and other cards held in a vault. Users buy "gacha" packs that pull a real card, then keep it, trade it as an NFT, sell it back instantly, or redeem it for shipping.
- **Traction:**
  - Revenue 30d = $11.03M; all-time = $99.2M; monthly revenue Jun 2026 = $16.1M, Sep 2026 (to 29th) = $11.2M ([DefiLlama API](https://defillama.com/protocol/collector-crypt), 2026-09-29).
  - ">$530M cumulative gacha spending" and ">$1B total transaction volume" ([SolanaFloor](https://solanafloor.com/news/collector-crypt-hits-1-b-volume-as-solana-s-trading-card-frenzy-accelerates), 2026).
  - Company claim of "165M in volume this month. 85M in revenue" ([X](https://x.com/Collector_Crypt/status/2050228853524590752)). **(unverified: it conflicts with DefiLlama's revenue definition)**
- **Why it's working:** Instant buyback at a fixed share of fair value turns an illiquid physical card into a liquid position, so each pack pull is a small, bounded bet. Wallet distribution helps: Solflare added card-pack trading in-wallet ([The Defiant](https://thedefiant.io/news/regulation/collector-crypt-fees-jump-129-in-a-week-as-solflare-brings-card-pack-trading-into-the-wallet)). It also rides the broader card boom: $2.62B of card singles were sold on eBay in 2025 ([cllct/GemRate via Yahoo](https://sports.yahoo.com/articles/more-2-6-billion-spent-154500186.html)).
- **Open source?:** Closed.
- **On Monad already?:** **Partial.** [Oripa](https://app.monad.xyz/app-hub/oripa) is on the Monad App Hub: "Japanese-style trading-card gacha, fully on-chain… pull authentic, PSA-graded" cards. It has no DefiLlama listing, so its traction is unknown.
- **Metropolis fit:** Track 03. Idea 06: *"A TCG marketplace with real-time onchain order books — transparent price discovery, instant settlement, and no platform taking a 10–15% cut"*. Idea 08: *"Automated market makers designed specifically for the long-tail of collectible assets"*. Idea 09: *"Rental and lending markets for high-value cards"*.
- **Monad angle:** The gacha itself is already cloned on Monad (Oripa). The open layer is the *secondary market*: a per-card order book or long-tail AMM with ~300 ms blocks, so bids and asks on thousands of individual card NFTs are cheap to post and cancel. Lending against vaulted cards is the other open layer. Passkey (Mera) plus AUSD removes the "this is crypto" step for card collectors.
- **Risks:** You need a real vault and grading partner. A hackathon can only use a mock vault or partner with Oripa. The gacha mechanic carries gambling and regulatory risk. DefiLlama shows revenue down from $16.1M (Jun) to about $11M/month.

### 2. Courtyard (Polygon)
- **What it does:** A marketplace for vaulted, graded cards, comics and watches, sold as ERC-721s. It sells mystery packs, buys back at 90% of fair market value, charges 0% seller fees, and lets owners redeem the physical item.
- **Traction:**
  - All-time revenue = $63.2M; 30d = $2.16M; May 2026 = $6.73M/month ([DefiLlama API](https://defillama.com/protocol/courtyard), 2026-09-29).
  - $30M Series A led by Forerunner Ventures, with NEA and YC ([Fortune](https://fortune.com/2025/07/24/exclusive-forerunner-leads-30-million-round-in-collectibles-marketplace-courtyard/), 2025-07-24).
  - Sales grew from about $50K/month (Jan 2024) to about $50M/month (Jul 2025), per the CEO in the same Fortune piece.
  - $78M of Pokémon NFT secondary sales in August 2025 ([MagicBlock research](https://www.magicblock.xyz/blog/state-of-onchain-collectibles)).
  - Android app rated 4.3 across 3,178 ratings ([Google Play](https://play.google.com/store/apps/details?id=io.courtyard.app), 2026-09).
- **Why it's working:** Forerunner, quoted in Fortune: *"the first collectibles marketplace that's actually designed to be liquid."* The 90% buyback caps the downside of every pack, and 0% seller fees undercut TCGplayer's 10.75% + 2.5% + $0.30 ([TCGplayer fees](https://help.tcgplayer.com/hc/en-us/articles/201357836-TCGplayer-Fees)). Privy provides the embedded wallet, so users never see crypto ([Privy case study](https://www.privy.io/insights/inside-the-stack-how-courtyard-is-reinventing-the-collectibles-marketplace)).
- **Open source?:** Closed.
- **On Monad already?:** Partial (Oripa, as above).
- **Metropolis fit:** Track 03, ideas 06 and 08 (quoted above).
- **Monad angle:** Same as Collector Crypt. The "zero-fee marketplace" pitch in idea 06 is realistic only when gas per trade is negligible. Privy is also a $5K all-tracks sponsor.
- **Risks:** Momentum is fading: DefiLlama monthly revenue fell from $6.7M (May 2026) to $2.1M (Sep 2026). Physical custody cannot be built in two weeks.

### 3. Whatnot (Web2 live-shopping for collectibles)
- **What it does:** Sellers go live on video and auction cards, sneakers and collectibles in real time. Buyers bid in chat.
- **Traction:**
  - 2025 GMV = $8B, up from $3B in 2024. 2025 revenue estimated at $1B ([Sacra](https://sacra.com/c/whatnot/); [Auction Compass timeline](https://getauctioncompass.com/blog/whatnot-growth-history)).
  - $545M Series G at a $20B valuation, led by ICONIQ, Lightspeed and Avra ([valueaddvc](https://valueaddvc.com/blog/whatnot-545m-series-g-20b-valuation-live-shopping-tiktok), 2026-08-07). Previous round: $225M Series F at $11.5B ([Crunchbase News](https://news.crunchbase.com/venture/ecommerce-unicorn-whatnot-raises-seriesf/), Oct 2025).
  - Ranked #1 Shopping app in the US and UK in 2025 (Sacra).
- **Why it's working:** Live auctions create urgency and entertainment, and TCG is its core category. Commission is 8% on TCG, falling to 6–6.5% at top tiers, plus processing fees ([Whatnot fees](https://help.whatnot.com/hc/en-us/articles/4847069165965-Whatnot-seller-fees)).
- **Weak spot onchain fixes:** An 8% cut plus processing, delayed seller payouts, and no portable proof of provenance or price history per card.
- **Open source?:** Closed.
- **On Monad already?:** No.
- **Metropolis fit:** Track 03, idea 06: the "10–15% cut" is literally the Whatnot/TCGplayer/eBay take rate.
- **Monad angle:** A live stream where each bid is an onchain bid with ~300 ms inclusion, and the winner settles in AUSD instantly. That works only with tokenized (vaulted) cards, so it pairs with #1 and #2.
- **Risks:** Live video, seller acquisition and shipping make this very hard to build. Build only the auction and settlement layer. CRSH Market already does livestream *prediction* markets on Monad ([ecosystem map](../05-ecosystem/ecosystem-map.md)).

### 4. StepBet / DietBet (WayBetter, Web2)
- **What it does:** Users bet money (typically $40) that they'll hit step or weight goals, verified by wearable or weigh-in photos. Winners split the pot of those who failed.
- **Traction:**
  - StepBet counter: 1,317,766 players, $148,873,781 paid out to winners ([stepbet.com](https://www.stepbet.com/), scraped 2026-09-29).
  - DietBet counter: 1,039,224 players, $101,121,996 paid to winners ([dietbet.com](https://www.dietbet.com/), scraped 2026-09-29).
  - A peer-reviewed study of StepBet's real-world effects exists ([PMC9982638](https://pmc.ncbi.nlm.nih.gov/articles/PMC9982638/)).
- **Why it's working:** Loss aversion plus social pots. You get your stake back and a profit only if you succeed, and device data verifies automatically.
- **Weak spot onchain fixes:** Trust in the house cut. A user on Reddit reported one game where the operator kept $5,452 of a $7,480 pot ([r/weightwatchers](https://www.reddit.com/r/weightwatchers/comments/1fs83vf/anyone_do_stepbet/), **unverified** anecdote). Payouts and cash-out are also slow. An onchain pot makes the rake and redistribution auditable and pays out instantly.
- **Open source?:** Closed.
- **On Monad already?:** **Partial.** [LootGO](https://app.monad.xyz/app-hub/lootgo) is a free walk-to-earn app (rewards, no stakes). No staked step pools were found.
- **Metropolis fit:** Track 02. Idea 02: *"Commitment contracts that put real money behind behavioural goals — … hit a step count … — verified automatically by device-native signals, with stakes redistributed to those who follow through"*. Idea 03: *"Accountability pools where groups collectively commit to a shared goal: those who fail fund the rewards of those who succeed."*
- **Monad angle:** Cheap per-day check-in transactions and AUSD stakes. A Chainlink CRE workflow (the $3K bounty) can attest HealthKit/Google Fit data. Mera passkeys keep it invisible to non-crypto users.
- **Risks:** Real-money skill contests are regulated state by state in the US. Device-data spoofing is a real risk, and the oracle is the hard part.

### 5. Beezie (Base, Flow, Solana)
- **What it does:** A "digital claw machine" for vaulted collectibles, plus a marketplace, running on Base and Flow and expanding to Solana.
- **Traction:**
  - All-time revenue = $11.36M; 30d = $758K; Jun 2026 = $1.91M/month ([DefiLlama API](https://defillama.com/protocol/beezie), 2026-09-29).
  - $4M raise led by Psalion VC in July 2026 ([Preqin](https://www.preqin.com/data/profile/asset/beezie/768820); [Dealroom](https://app.dealroom.co/news/note/beezie-raises-4m-to-turn-shopping-into-a-game-of-chance)). Dealroom also reports "$170M facilitated, 30,000+ active users since Jan 2026".
  - Company press release: "$142M+ ARR, 540,000+ claw pulls, $100M+ in Base volume" ([National Law Review press release](https://natlawreview.com/press-releases/beezie-brings-tokenized-collectibles-solana)). **(company claim)**
- **Why it's working:** The same liquid-vault mechanic as Courtyard, wrapped in an arcade-style UX.
- **Open source?:** Closed.
- **On Monad already?:** Partial (Oripa).
- **Metropolis fit:** Track 03, ideas 06 and 08.
- **Monad angle:** It went multichain quickly (Flow, then Base, then Solana), which suggests it could be persuaded onto Monad. As a hackathon build, it is weaker than #1 and #2.
- **Risks:** Revenue is falling (Jun $1.9M, then Sep $0.72M). Gambling-style mechanics.

### 6. Earned wage access: DailyPay, EarnIn (Web2)
- **What it does:** Workers withdraw pay they've already earned before payday. EarnIn "Live Pay" streams it in real time.
- **Traction:**
  - DailyPay: "$25 billion in payments volume" and a $200M asset-backed securitization ([DailyPay press release](https://www.dailypay.com/press-center/press-releases/dailypay-completes-inaugural-asset-backed-securitization-powering-its/); [FinTech Global](https://fintech.global/2025/07/01/dailypay-completes-200m-securitisation-to-fuel-growth/), 2025-07-01).
  - EarnIn: more than 1M Live Pay transactions since July 2025, a 600K+ waitlist, and active users opening the app 50+ times/month ([Forbes](https://www.forbes.com/sites/ilonalimonta-volkova/2026/03/11/earnin-hits-one-million-live-pay-transactions-as-real-time-pay-moves-from-novelty-to-norm/), 2026-03-11).
  - Market data: employer-partnered EWA grew from 43.2M to 83.4M transactions between 2021 and 2022 ([CFPB](https://www.consumerfinance.gov/data-research/research-reports/data-spotlight-developments-in-the-paycheck-advance-market/)).
- **Why it's working:** Paycheck-to-paycheck workers pay small fees to avoid overdrafts. The "50 logins a month" figure shows people like watching earnings accrue.
- **Weak spot onchain fixes:** EWA providers pre-fund advances. Their capital cost is why DailyPay needs securitizations. Instant-transfer fees fall on the worker, and cross-border workers aren't served.
- **Open source?:** Closed. The onchain primitive Sablier is open and live on Monad.
- **On Monad already?:** **Partial.** Sablier Lockup is deployed on Monad, but its Monad TVL is about $0.02 (DefiLlama `chainTvls.Monad`, 2026-09-29; about $2.4M across all chains). The [ecosystem map](../05-ecosystem/ecosystem-map.md) says no consumer product sits on top of it. One public competitor repo: icaluwu/Coffee-by-the-Second.
- **Metropolis fit:** Track 02, idea 06: *"Salary streaming at the individual level — get paid every second rather than bi-weekly, with idle balances earning yield in the background until you spend them"*.
- **Monad angle:** Per-second AUSD streams with no pre-funding, because the employer escrow streams directly. Mera passkey onboarding. Idle balance can go into a yield vault (MetaMask mUSD exists on Monad).
- **Risks:** You need an employer-side customer. A demo can target gig or freelance platforms, or DAO contributors. The regulatory status of EWA is still moving ([Federal Register, Dec 2025](https://www.federalregister.gov/documents/2025/12/23/2025-23735/truth-in-lending-regulation-z-non-application-to-earned-wage-access-products)).

### 7. Splitwise (Web2 bill splitting), plus Venmo Groups
- **What it does:** Tracks shared expenses among friends and roommates and computes who owes whom. It doesn't move money natively.
- **Traction:**
  - 10M+ downloads, rated 4.0 across 194,559 ratings on Android ([Google Play](https://play.google.com/store/apps/details?id=com.Splitwise.SplitwiseMobile)). iOS rated 4.5 across 116,971 ratings ([Sensor Tower](https://app.sensortower.com/overview/458023433?os=ios), 2026-09).
  - Sensor Tower estimate for the last month: 700K downloads and $600K revenue (Sensor Tower snippet, Sep 2026; **unverified** estimate).
  - "Surpassed 10 million monthly active users; about $30M raised" ([10x Venture Partners LinkedIn](https://www.linkedin.com/posts/10x-venture-partners_were-proud-to-share-the-progress-of-one-activity-7351700573760413698-WmK_); **unverified**, investor post).
  - PayPal shipped **Venmo Groups** as a Splitwise competitor ([PayPal newsroom](https://newsroom.paypal-corp.com/2023-11-14-Introducing-Venmo-Groups), 2023-11-14).
- **Why it's working:** Every group trip, flat and dinner creates a debt graph. Splitwise owns the ledger but not the payment.
- **Weak spot onchain fixes:** Settling up happens off-app (Venmo is US-only, and bank transfers are slow cross-border). Groups spanning countries have no shared rail. Splitwise's own users complain about ads and paywalls ([Reddit](https://www.reddit.com/r/ProductManagement/comments/191pr62/lets_discuss_monetization_strategies_a_case_study/)).
- **Open source?:** Close clones: [spliit-app/spliit](https://github.com/spliit-app/spliit) (2,960 stars, MIT, pushed 2026-09-26) and [oss-apps/split-pro](https://github.com/oss-apps/split-pro) (1,458 stars). Forking must be disclosed (rules §4.1).
- **On Monad already?:** **No.** The [ecosystem map](../05-ecosystem/ecosystem-map.md) lists "shared wallets and group settle-up" as whitespace. The nearest is the Savitura/settle repo (family wallets, Nigeria).
- **Metropolis fit:** Track 02, idea 01: *"Payments embedded in social gestures — splitting a bill, sending a gift, tipping a creator — where the financial action feels like a message, not a transaction"*. It can also claim the Agora Cross-Border $10K bounty if it's mobile, uses Mera, and settles in AUSD.
- **Monad angle:** One-tap "settle all" in AUSD across countries, with gasless ERC-3009 transfers and a group escrow that pays out on a vote. Settlement in ~300 ms makes it feel like sending a message.
- **Risks:** The ledger is easy to copy. Differentiation has to come from actual settlement and the cross-border wedge.

### 8. Opal + Forfeit (screen-time and habit commitment)
- **What it does:** Opal blocks distracting apps. Forfeit charges you money if you don't submit proof that you completed a habit.
- **Traction:**
  - Opal: "past 1 million DAUs and $10 million in ARR". High school and college students are two-thirds of DAU ([RevenueCat Sub Club](https://www.revenuecat.com/blog/growth/kenneth-schlenker-sub-club-podcast-2026), 2026). It raised a $4.3M seed led by Adjacent ([ISAI](https://www.isai.vc/news/opal-the-digital-wellbeing-app-raises-43m-in-a-seed-round)).
  - Forfeit: "Used by 20k+ people, with a 94% success rate across 75k+ goals" ([Google Play listing](https://play.google.com/store/apps/details?id=app.forfeit.forfeit), 2026-09). **(company claim)**
  - Beeminder (older, pledge-based): the founders say it is "pledge-focused", so revenue comes from derailment penalties ([Beeminder blog](https://blog.beeminder.com/focus/)).
- **Why it's working:** Opal shows mass demand for screen-time control. Forfeit and Beeminder show people will pay penalties to keep commitments.
- **Weak spot onchain fixes:** The operator keeps your forfeited stake, which is a conflict of interest. Stakes aren't redistributed to peers, and friends can't co-sign.
- **Open source?:** Closed.
- **On Monad already?:** No.
- **Metropolis fit:** Track 02, idea 02 explicitly names *"reduce screen time"*. Idea 08: *"Savings products where your yield rate is gated by behavioural goals you set and your social graph verifies."*
- **Monad angle:** Screen-time data from iOS Screen Time or Android UsageStats, signed on the device (P256 passkey key) and posted daily. Failed stakes go to the group pool (idea 03) instead of the house. Cheap daily transactions.
- **Risks:** iOS restricts reading Screen Time data from third-party apps (the Family Controls entitlement), and on-device attestation can be spoofed. **(unverified; check before building)**

### 9. Moonwalk Fitness (Solana)
- **What it does:** Step challenges where users stake SOL, USDC, BONK or $MF. People who complete every day get their deposit back plus a share of the missed deposits. Private group contests are supported.
- **Traction:**
  - $3.4M seed led by Hack VC, with Binance Labs and Solana co-founder Raj Gokal ([Fortune](https://fortune.com/crypto/2024/10/24/fitness-app-moonwalk-that-pays-crypto-for-step-tracking-raises-3-4-million-from-hack-vc/), 2024-10-24).
  - #2 among the top 20 most-used dApps on Solana Seeker ([Solana Mobile on X](https://x.com/solanamobile/status/1993375627404058820)).
  - "11,000 daily active users", with the team paying 15 SOL/day in transaction costs ([Solana Compass](https://solanacompass.com/projects/moonwalk)). **(unverified; date not given)**
  - Terms of service state a 10% service fee on certain contests ([moonwalk.fit ToS](https://moonwalk.fit/terms-of-service)).
- **Why it's working:** It is the onchain StepBet: stakes in real assets rather than an inflationary move-to-earn token, and it ships through the Seeker dApp store.
- **Open source?:** Closed.
- **On Monad already?:** Partial (LootGO, free walk-to-earn only).
- **Metropolis fit:** Track 02, ideas 02 and 03.
- **Monad angle:** This is the direct crypto precedent for #4. Monad adds EVM tooling, AUSD, and passkeys, so there is no Solana wallet step. The fee burden Moonwalk reportedly carries argues for Monad's cheap sponsored gas.
- **Risks:** Launching the $MF token confuses the "invisible blockchain" story. Don't copy that.

### 10. Phygitals (Solana)
- **What it does:** Tokenized Pokémon cards, "claw machine" packs, and buyback at 85–90% of market value. It is integrated with Fanatics Collect.
- **Traction:** All-time revenue = $15.7M ([DefiLlama API](https://defillama.com/protocol/phygitals), 2026-09-29), but the 30d figure is only $272K. It claims $180M+ total volume and 100K+ cards tokenized ([Genfinity](https://genfinity.io/2026/04/27/phygitals-fanatics-collect-solana-tokenized-trading-cards/), 2026-04-27).
- **Why it's working:** The same liquidity mechanic as #1 and #2. The Fanatics Collect integration is a Web2 distribution channel.
- **Open source?:** Closed. **On Monad already?:** Partial (Oripa).
- **Metropolis fit:** Track 03, ideas 06 and 08.
- **Risks:** Very spiky revenue (Sep 2025 $4.3M, then Sep 2026 $0.26M). Reddit complaints about deceptive "claw machine" ads ([r/solana thread list](https://www.reddit.com/r/CryptoCurrency/comments/1n83mwp/gotta_catch_em_all_tokenized_pok%C3%A9mon_cards_are/)). Mainly useful as a comparison point for #1.

### 11. Patreon / Ko-fi (Web2 creator tipping and memberships)
- **What it does:** Fans pay creators through tips, monthly memberships or shop sales.
- **Traction:**
  - Patreon: more than $10B paid to creators since 2013 and over $2B/year now ([Axios via Skillademia](https://www.skillademia.com/statistics/patreon-statistics/), Aug 2025).
  - Patreon's fee is a flat 10% for creators who joined after 2025-08-04 ([Patreon help](https://support.patreon.com/hc/en-us/articles/36426991446797-A-standard-platform-fee-for-new-creators-effective-after-August-4-2025)).
  - Ko-fi: "over $200 million to creators" ([The Podcast Host](https://www.thepodcasthost.com/monetisation/ko-fi-vs-buy-me-a-coffee/); **unverified**, secondary source). Its fee is 0–5% ([Ko-fi features](https://ko-fi.com/features)).
- **Why it's working:** Direct fan-to-creator money.
- **Weak spot onchain fixes:** Card fees on small tips (a $5 pledge loses about 19% all-in per [CartMango](https://cartmango.com/patreon-fees/), **unverified**). Payouts are slow and region-limited. There is no portable proof of who was an early supporter.
- **Open source?:** Closed. **On Monad already?:** Partial. MUKU (creator/fan) and The Arena (SocialFi) are listed in the [ecosystem map](../05-ecosystem/ecosystem-map.md), with traction unknown.
- **Metropolis fit:** Track 02, idea 01 ("tipping a creator"). Track 03, idea 04: *"Early-supporter registries that cryptographically prove — and financially reward — fans who were there before the audience arrived."*
- **Monad angle:** Sub-dollar AUSD tips with near-zero fees, plus a timestamped supporter registry that later pays out a share of creator revenue, streamed automatically.
- **Risks:** Creator acquisition is the whole game, and Zora-style speculative "creator coins" have failed (see Rejected). Keep it tips and memberships, not tokens.

### 12. Graze (Bluesky custom feeds)
- **What it does:** A no-code feed builder for Bluesky/ATProto. Feed builders earn from contextual ads on a 70/30 split in the creator's favour.
- **Traction:**
  - $1M pre-seed led by Betaworks and Salesforce Ventures ([TechCrunch/Yahoo](https://finance.yahoo.com/news/bluesky-feed-builder-graze-raises-160000977.html), 2025-04-16).
  - Acquired by Flipboard ([TechCrunch](https://techcrunch.com/2026/08/26/flipboard-acquires-graze-the-feed-builder-working-to-monetize-the-open-social-web/), 2026-08-26).
  - "2.3 million people have seen feeds powered by its software" ([GeekWire](https://www.geekwire.com/2025/portland-startup-graze-raises-1m-to-help-people-build-bluesky-feeds/), 2025).
  - Bluesky has 46.7M registered users ([bsky.jazco.dev](https://bsky.jazco.dev/), 2026-09), but its active base is shrinking ([TechCrunch](https://techcrunch.com/2026/08/11/blueskys-active-user-base-is-shrinking-as-its-focus-expands-beyond-the-app/), 2026-08-11).
- **Why it's working:** Open protocols let third parties compete on ranking, and Graze monetised that with ads.
- **Open source?:** Graze itself is closed. The reference [bluesky-social/feed-generator](https://github.com/bluesky-social/feed-generator) has 2,067 stars (MIT) and was pushed 2026-09-25.
- **On Monad already?:** No. Farcaster is on the Hub, but no algorithm marketplace exists. The ecosystem map lists a "beneficiary-paid curation feed" as whitespace.
- **Metropolis fit:** Track 03, idea 01: *"An algorithm marketplace where communities publish, sell, and compete on feed ranking strategies — creators migrate to the feeds that reward them"*. Idea 02: community-governed recommendation.
- **Monad angle:** Onchain feed registry, subscriber staking, and per-impression revenue splits settled cheaply. You could index Bluesky or Farcaster content as the source.
- **Risks:** Weak proof of consumer demand, since this is a single small exit. Needs an existing social graph to bootstrap.

### 13. Alt (Web2 card vault, marketplace and cash advances)
- **What it does:** Vaulted graded cards with auctions, fixed-price sales, and instant cash advances on consigned cards.
- **Traction:**
  - Up to $40M asset-based credit facility from Trinity Capital (NASDAQ: TRIN) ([PR Newswire](https://www.prnewswire.com/news-releases/trinity-capital-inc-provides-alt-platform-inc-with-up-to-40-million-asset-based-credit-facility-302508483.html), 2025-07-18).
  - $31M early raise ([Crunchbase News](https://news.crunchbase.com/startups/alt-raises-31m-to-buy-and-sell-sports-cards/)).
  - Total raised of $346M across 7 rounds ([Clay](https://www.clay.com/dossier/alt-funding)). **(unverified)**
- **Why it's working:** Collectors want liquidity without selling. The credit facility shows that lenders will underwrite card-backed loans.
- **Open source?:** Closed. **On Monad already?:** No.
- **Metropolis fit:** Track 03, idea 09: *"Rental and lending markets for high-value cards — letting competitive players access what they need without the capital outlay, and collectors earn yield on idle assets"*.
- **Monad angle:** Loans against tokenized cards (Courtyard/Oripa-style NFTs) in AUSD, with price oracles taken from order-book trades (candidate #1's secondary market).
- **Risks:** You need a price oracle for thinly traded cards. No Web2 *rental* product for competitive players turned up in search.

### 14. DICE (Web2 fan-first ticketing)
- **What it does:** A mobile-only ticketing app with all-in pricing. Resale works only through an in-app waitlist at face value, so a fan who can't go gets a full refund when someone on the waitlist buys.
- **Traction:**
  - Acquired by Fever ([Fever newsroom](https://newsroom.feverup.com/en-US/250537-fever-and-dice-join-forces-to-build-a-live-entertainment-tech-powerhouse/); [Variety](https://variety.com/2025/music/news/fever-acquires-dice-securing-100-million-funding-1236419015/), 2025).
  - $238M raised over 8 rounds ([Tracxn](https://tracxn.com/d/companies/dice/__ix_-YAO-d2ich_O5OQ4_fOHaBeF9OjwsIrRMTgT9nWo)).
  - "41% of tickets sold via DICE are prompted by Discovery" ([DICE partners](https://dice.fm/partners/ticketing)). **(company claim)**
- **Demand context:** The FTC sued Ticketmaster over hidden fees "as high as 44%" and broker ticket harvesting ([FTC](https://www.ftc.gov/news-events/news/press-releases/2025/09/ftc-sues-live-nation-ticketmaster-engaging-illegal-ticket-resale-tactics-deceiving-artists-consumers), 2025-09-18).
- **Why it's working:** Tickets are person-bound, and face-value resale defeats scalpers.
- **Open source?:** Closed. **On Monad already?:** No. The ecosystem map lists "person-bound ticketing" as whitespace, with StageFun as a hackathon precedent.
- **Metropolis fit:** Track 03, idea 04 (early-supporter registries: attendance history as proof of fandom).
- **Monad angle:** A passkey-bound ticket (P256) with a waitlist-resale contract and instant AUSD refunds. Attendance proofs feed an early-supporter registry.
- **Risks:** The previous onchain attempt, GET Protocol/OPEN, shows ~$0 fees on DefiLlama since 2025 (see Rejected). Distribution through venues is the bottleneck.

### 15. Telegram collectible gifts (TON)
- **What it does:** Gifts sent in Telegram chats (bought with Stars) can be upgraded into fixed-supply collectibles recorded on TON and traded as NFTs.
- **Traction:**
  - Launched in October 2024, with TON-backed collectibles from 2025-01-24 ([Telegram blog](https://telegram.org/blog/collectible-gifts-and-more); [DropsTab](https://news.dropstab.com/research/what-are-telegram-gifts)).
  - "FDV of the Telegram gifts market exceeds $100 million, unique users 166,000" as of May 30 ([ForkLog](https://forklog.com/en/creator-of-major-launches-zero-commission-gift-marketplace-on-telegram/), 2025). **(secondary source)**
  - Dune notes that "most of the volume is generating on offchain marketplaces" ([Dune](https://dune.com/rdmcd/telegram-gifts)).
  - Telegram Wallet revenue 30d = $211K ([DefiLlama](https://defillama.com/protocol/telegram-wallet), 2026-09-29).
- **Why it's working:** A gift is a social gesture that turns into a collectible with resale value, with distribution built into the chat.
- **Open source?:** Closed. **On Monad already?:** No.
- **Metropolis fit:** Track 02, idea 01 ("sending a gift") and idea 05: *"Programmable gifts that unlock on conditions."*
- **Monad angle:** Gifts that carry AUSD value plus a condition (a date or event), sent as a link and claimed with a passkey.
- **Risks:** Telegram's distribution cannot be copied, and most trading happens off-chain.

### 16. Cover Genius (Web2 embedded micro-insurance)
- **What it does:** Embedded protection (travel, purchase, ticket cover) sold at checkout by partner brands.
- **Traction:**
  - $100M from Vista Credit Partners at a $1.9B valuation ([Cover Genius](https://covergenius.com/company/news/cover-genius-raises-100m-backed-by-vista-credit-partners/); date not shown in snippet, **unverified** date).
  - Earlier $80M round led by Spark Capital ([Cover Genius](https://covergenius.com/company/news/cover-genius-closes-80m-in-series-e-funding-as-investors-see-700-billion-opportunity-in-embedded-protection/)).
- **Why it's working:** Insurance sold at the moment of exposure, inside a flow the user is already in.
- **Cautionary precedent:** Trōv, the pioneer of per-item, on/off insurance, did not survive standalone. Travelers bought its technology assets ([Insurance Journal](https://www.insurancejournal.com/news/national/2022/02/23/655414.htm), 2022-02-23).
- **Open source?:** Closed. **On Monad already?:** No.
- **Metropolis fit:** Track 02, idea 07: *"Micro-insurance that turns on and off by the minute."*
- **Monad angle:** Per-second premium streaming (Sablier) and automatic payouts from an oracle-verifiable trigger, such as a flight delay.
- **Risks:** You need an insurance licence or a carrier partner. The standalone consumer version (Trōv) failed. This is the weakest-evidenced official idea in Track 02.

---

## Rejected

| Product | Why rejected | Evidence |
|---|---|---|
| **Zora creator/content coins (Base)** | Collapsed. Daily volume fell 99.8% from a $63M peak (Apr 2025) to $112K (2026-07-15), and daily creators fell from 32,286 to 512. Jesse Pollak called Base's social bet a failure | [BeInCrypto](https://beincrypto.com/jesse-pollak-base-zora-social-bet/), 2026-07-16; DefiLlama zora-coins revenue 30d = $5.3K |
| **Base App / Farcaster social mini-apps** | Base App pivoted to trading-first. Farcaster SoFi revenue 30d = $2.2K (DefiLlama, 2026-09-29). Base App's $1.46M fees in 30d are trading, not social | [BeInCrypto pivot](https://beincrypto.com/base-app-trading-strategy-pivot/); DefiLlama |
| **Fantasy Top (Blast then Base)** | DefiLlama revenue is $0 every month Apr–Sep 2026. Active users had already dropped 80% after the Blast airdrop | DefiLlama fantasy.top; [DL News](https://www.dlnews.com/articles/defi/blast-socialfi-fantasy-top-migrates-to-base-as-fees-drop/) |
| **Telegram tap-to-earn games (Hamster Kombat, Notcoin, Catizen)** | Huge registration numbers, but tokens fell about 50% at launch and there is no durable revenue model to adapt. Pure airdrop farming | [Decrypt](https://decrypt.co/284202/hamster-kombat-catizen-telegram-tokens-plummet); [Delphi](https://members.delphidigital.io/reports/a-ton-of-gaming-hype) |
| **GET Protocol / OPEN Ticketing** | Onchain ticketing claims (5.5M NFT tickets historically), but DefiLlama fees are about $0 since 2025. Token-centric | DefiLlama get-protocol; [Medium report](https://medium.com/@Syotoshi/compact-research-report-on-get-protocol-get-c77497f65589) |
| **PoolTogether / prize-linked savings (Yotta)** | PoolTogether revenue is about $3.7K/month (DefiLlama, Sep 2026). Yotta (1M+ users claimed) left depositors stuck in the Synapse collapse | DefiLlama pooltogether; [Yahoo Finance](https://finance.yahoo.com/markets/crypto/articles/put-thousands-savings-app-promised-101500624.html) |
| **PumpBox (Physical TCG)** | Too small: $240K all-time revenue | DefiLlama pumpbox, 2026-09-29 |
| **On Me (programmable gift cards)** | Funding only ($6M seed), no usage metrics found | [TechCrunch](https://techcrunch.com/2025/12/11/on-me-raises-6m-to-shake-up-the-gift-card-industry/), 2025-12-11 |
| **ROSCA / tanda apps** | No product with published users, revenue or credible funding surfaced in search. Revisit if another researcher finds one | Search 2026-09-29 |
| **Card rental for competitive players (Web2)** | No live Web2 product found (searches returned only photo booths). Idea 09 is supported only through Alt's lending, #13 | Search 2026-09-29 |
| **Sui / Aptos consumer apps** | No single consumer app with app-level metrics found. Chain-level stats only | Search 2026-09-29 |
| **Brick (screen-time device)** | Search rate-limited, so no data was collected. Opal (#8) covers the demand signal | n/a |

---

## Takeaways for the shortlist
1. **Track 03 TCG secondary market** (order book, long-tail AMM or card lending on tokenized cards) has the hardest onchain evidence: Collector Crypt plus Courtyard have $162M+ all-time revenue on DefiLlama. It lines up with 4 official ideas, and on Monad only the *gacha* part (Oripa) exists. **Caution:** the leaders' revenue peaked in May–Jun 2026 and is declining.
2. **Track 02 money-stake habits** (StepBet/DietBet: 2.36M players and $250M paid; Opal 1M DAU; Moonwalk as the onchain proof) matches ideas 02 and 03 almost verbatim. Nothing staked exists on Monad. The build risk is the device-signal oracle.
3. **Track 02 group settle-up** (Splitwise with 10M+ downloads, Venmo Groups as validation, MIT-licensed Spliit to build on) is open whitespace on Monad, and it can also claim the Agora Cross-Border $10K bounty.

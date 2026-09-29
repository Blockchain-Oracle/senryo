# Monad Mainnet Ecosystem Map, by Metropolis Track

Data pulled 2026-09-28. Sources:
- DefiLlama chain API (`api.llama.fi/v2/chains`, `/protocols`, `/overview/dexs/monad`)
- Monad App Hub, https://app.monad.xyz/app-hub (142 apps listed)
- Monad's "Ecosystem Highlights: August 2026" post, https://monad.xyz/blog/monad-ecosystem-highlights-august-2026

TVL figures are Monad-chain TVL from DefiLlama. "Hub" means the app is listed on app.monad.xyz/app-hub.

## 0. Network snapshot

| Metric | Value | Source |
|---|---|---|
| DeFi TVL (DefiLlama) | **$1.017B**. 140 protocols list Monad | llama.fi/v2/chains |
| TVL + borrows | $1.96B+ | Aug-2026 highlights |
| Active wallets | 4.2M+ | Aug-2026 highlights |
| Transactions | 701.7M+ | Aug-2026 highlights |
| Stablecoin market cap | $767M+ | Aug-2026 highlights |
| Distributed RWA value | $400M+. Monad is the #3 chain for active RWAs in DeFi | Aug-2026 highlights |
| DEX volume | 30d: **$4.20B**. 24h: $86M. August 2026: $3.64B (record). Record day: $362M (31 Aug) | DefiLlama, Aug-2026 highlights |
| Perps volume | $2.5B+ in August 2026 (record) | Aug-2026 highlights |
| Live apps | 170+ | Aug-2026 highlights |
| Chain specs | Chain ID 143, 300ms blocks, 600ms finality, 10k TPS, ~200 validators | monad.xyz/developers, Aug-2026 highlights |

**TVL by DefiLlama category on Monad:**

| Category | TVL | Protocols |
|---|---|---|
| Lending | $889M | 13 |
| Risk curators | $699M | 16 (overlaps with lending, since they are Morpho/Euler vault curators) |
| Yield | $206M | 7 |
| RWA | $121M | 5 |
| CDP | $60M | 2 |
| DEXs | $56M | 46 |
| Liquid staking | $15M | 5 |
| Derivatives | $7.8M | 7 |
| Prediction markets | $2.0M | 2 |
| Launchpads | $0.7M | 5 |
| Uncollateralised lending | $0.09M | 1 |
| Payments | ~$0 | 1 (Sablier) |

**What the numbers say:**
- Monad is a lending and yield chain by TVL: Aave, Euler, Morpho, Curvance and Pendle.
- By volume it is a CLOB chain. **Kuru CLOB did $2.87B of the $4.20B 30-day DEX volume (68%).**
- Consumer, payments and social apps barely register on DefiLlama. They exist as apps, but they do not hold TVL.

---

## Track 1: Onchain Finance & Trading

### Spot CLOBs and DEXs
| App | What it is | Monad TVL | Notes |
|---|---|---|---|
| **Kuru** (kuru.io) | Fully onchain CLOB plus launchpad | $1.06M | **30d volume $2.87B, #1 DEX by volume.** Sponsor: two $5K bounties (consumer trading app on Kuru; new assets/markets on Kuru). CEO Vaibhav is a mentor |
| Clober (clober.io) | Onchain order book ("CEX on DEX") | $48K | Hub |
| **Crystal** | "Fully onchain order book on Monad" | n/a | Featured as NEW on the App Hub (Sep 2026) |
| Hanji Protocol (hanji.io) | Order-book DEX | $131K | 30d volume $170M |
| Capricorn | "DEX with HFT-grade liquidity" | $504K | Prop-AMM style |
| Nabla Finance | Open "Prop AMM" | $5K | |
| Metric V2 | DEX | $134K | 30d volume $165M |
| Uniswap V2/V3/V4, PancakeSwap, Curve, Balancer V3, LFJ, SushiSwap, WOOFi | Blue-chip AMMs | Uni V4 $32.6M, Curve $8.3M, Balancer $4.7M | |
| Aggregators: KyberSwap, Matcha, 1inch, OpenOcean, Monorail, Dirol, Relay, Jumper | Routing | | |
| Terminals: GMGN, MevX, UniversalX, Mona bot, Definitive, Infinex, o1 exchange ("onchain everything exchange", NEW), Glider (automated investing, NEW) | Trading UIs and bots | | |

### Perps and leverage
| App | What it is | Monad TVL | Notes |
|---|---|---|---|
| **Perpl** (perpl.xyz) | Fully onchain perps (order book) | $3.96M | #3 most active app by gas. Sponsor: $5K "Best use of Perpl API" and $3K "Best Analytics/Risk tool". Co-founder PBJ is a bounty judge |
| **LeverUp** (leverup.xyz) | "LP-free perps, 1001x leverage" | $3.01M | Founder Lark Lee is a mentor |
| Drake Exchange | "People's Perp DEX" | $202K | #5 most active app by gas |
| Monday Trade | Perps and spot | $580K / $99K | |
| Bean Exchange | Perps plus DLMM | $5K | |
| Narwhal, Pingu, OBSDN, Chainpro | Smaller perps | <$3K | |
| Trendle | "Trade the world's attention" (attention perps) | n/a | Also relevant to Track 3 |
| XStable | RWA DEX: gold, FX (leverage) | n/a | |
| **HelloTrade** | Mobile-first leveraged equities/ETFs/commodities. Ex-BlackRock founders, $4.6M seed led by Dragonfly | pre-launch | Migrated from MegaETH to Monad and plans "10,000 assets" on Monad (Aug-2026 highlights). Co-founder Kevin Tang is a mentor |

### Lending, credit and yield
| App | Monad TVL | Notes |
|---|---|---|
| Aave V3 | $302M | |
| Euler V2 | $263M | |
| Morpho Blue | $187M | Curated by K3 ($384M), Hyperithm ($197M), Steakhouse ($54M), Gamma, Clearstar and others |
| **Curvance** (Monad-native) | $129M | |
| Pendle V2 | $199M | Yield trading |
| Reservoir (CDP) | $60M | |
| **Neverland** (Monad-native) | $7.6M | Self-repaying loans, ve-tokenomics |
| TownSquare, Gearbox, Folks, Covenant, Sumer, Peridot, K613 | $0–$0.26M | |
| **Accountable** (uncollateralised lending / "verifiable yield") | $93K | The only DefiLlama "Uncollateralized Lending" entry on Monad |
| Huma (RWA / PayFi credit) | $2.1M | |
| Travessia Credit (RWA credit) | $12K | |
| Valos (RWA) $106M, Theo thBill $13M, Midas (mWIN with Wellington), Multipli, Saturn, Solv, StakeStone | | RWA and tokenised credit |
| Vaults: Veda $34M, Upshift $26M (AUSD), Agua $9M, Yuzu $7.6M, Beefy $6.8M, Mellow, Lagoon, Strata, Spectra | | |

### Liquid staking and MEV / orderflow
| App | Monad TVL | Notes |
|---|---|---|
| **FastLane / shMonad** | $10.5M | #1 most active app by gas. Founder Alex Watts is a mentor |
| Kintsu | $2.5M | |
| Magma | $1.0M | |
| **aPriori** | $0.7M | "Intelligent order-flow coordination" plus LST |

### Gaps and whitespace (Track 1)
- **Per-block funding perps.** Perpl and LeverUp exist, but no public design markets "funding settles every block" as its core primitive. Perps TVL on Monad is only about $7.8M, against Kuru's $2.9B/month spot. A per-block-funding market on a niche underlying (FX, RWAs, attention, validator yield) is still open. Build on Perpl's API if you want its bounty.
- **Onchain credit history → undercollateralised lending.** There is essentially nothing here: Accountable holds $93K and Huma is RWA/PayFi. No protocol reads Monad-native repayment or trading history (Aave/Euler/Morpho events, Kuru fills) to produce a credit score. Clear whitespace, and it fits the track prompt word for word.
- **New markets on Kuru.** Kuru has the volume but not many long-tail or structured markets. Examples: options-like payoffs, RWA/FX pairs, and "market-maker in a box" vaults. Kuru pays $5K for this.
- **Risk tooling.** Visible competitor repos already include PerpGuard, a Perpl liquidation monitor (see below). Expect crowding on "Perpl risk dashboard".
- Saturated areas to avoid unless you have real edge: another AMM, another aggregator, another Telegram/terminal bot, and "AI trading agent that trades for you". At least 4 public Metropolis repos already do the last one.

---

## Track 2: Consumer Products & Payments

| App | What it is | Notes |
|---|---|---|
| **MetaMask Money Account / mUSD** | Yield-bearing money account. 1M+ gasless transactions on Monad | Hub. MetaMask also shipped an Agent Wallet with spending limits |
| **Agora (AUSD)** | Stablecoin issuer ("digital dollars are public goods") | Sponsor: $10K Best Mobile Trading App and $10K Best Cross-Border Payments App. CEO Nick van Eck and CTO Drake Evans are mentors |
| **PingMe / PingBusiness** | "Send stablecoins like messages" | Hub. Sponsor: PingBusiness merchant rebate of up to $20K |
| UR | Unified crypto and fiat bank account | Hub |
| Axal | "The wealth app" | Hub |
| Abound | Financial super-app, $500M+ remittance volume | Aug-2026 highlights |
| Meru | Stablecoin fintech for 150+ countries | Aug-2026 highlights |
| Cero | Spending, rewards, credit-building | Aug-2026 highlights |
| AnomaPay | Private payments | Hub, NEW |
| Bidali | Buy gift cards with crypto | Hub |
| SoFiUSD | First US national-bank stablecoin, available via BitGo | Aug-2026 highlights |
| Mercuryo | On/off-ramp | Sponsor: $10K credits. CBO Arthur is a mentor/judge |
| **Mera** (Category Labs) | Free open library for passkey account creation "in two clicks" | Monad Foundation bounties: $2.5K "Best Mera-powered UX" and $2.5K "One Passkey, Many Keys" |
| Sablier Lockup | Token streaming | DefiLlama TVL ~$0. Effectively unused on Monad |
| fomo, MemeTok | Mobile social trading ("scroll-trading") | |
| **Blink.cash** | Tap-the-chart price prediction. ERC-7715 permissions plus Pimlico AA, so no signatures and no gas for users | Co-founder Stephen Edvi is a mentor. A model of "invisible blockchain" UX |
| Glider | Automated investing app for anyone | NEW |

### Gaps and whitespace (Track 2)
- **Per-second subscriptions.** Sablier is deployed but idle, and no consumer subscription product exists. A merchant plus subscriber app with AUSD streaming, passkey onboarding (Mera) and cancel-anytime settlement is wide open. One public repo, Polaris (payment links, pay-in-4 and subscriptions), is going after part of this.
- **Shared wallets and group settle-up.** Nothing live on the Hub. One public competitor repo (Savitura/settle: Nigerian family wallets plus remittance) is adjacent.
- **Cross-border remittance.** This is crowded: public repos include homeward, Kirogi (earmarked remittance), settle, and ping-pong-pay. Real incumbents Abound and Meru also exist. Agora's $10K bounty will attract many entries, so you need a sharp wedge such as one corridor, earmarked spend, or a merchant side.
- **Mobile trading app.** Agora's $10K bounty plus Kuru's $5K. Incumbents are fomo, MemeTok and HelloTrade (coming). A mobile Kuru front end with passkeys and AUSD is a natural fit for both bounties.
- Judges and prompts favour "never mentions blockchain" (Blink.cash is the in-ecosystem reference). Aim for passkey sign-in, gasless or sponsored transactions, and AUSD.

---

## Track 3: Social, Attention & Culture

| App | What it is | Notes |
|---|---|---|
| **Nad.fun** | Memecoin launchpad plus prediction ("Launch. Trade. Predict.") | V2 $517K TVL. Hosted the $200K Moltiverse agent hackathon |
| **CRSH Market** (CRSHMARKET) | "The first livestream prediction market" | CEO Evan Rama is a mentor. Launched livestream markets in Aug 2026 |
| Kizzy | Social-media / influencer betting | DefiLlama $70K. **Won 2nd at Monad Madness Bangkok 2024** |
| Levr Bet | Sports prediction | $1.9M TVL |
| Blinq | "Trading terminal for opinions" (prediction markets) | |
| Hyperstitions | "Manipulate the future" (prediction/entertainment) | |
| Trendle | Attention trading | |
| Farcaster | Social protocol | Hub |
| The Arena | SocialFi (connect, engage, earn) plus launchpad | Hub |
| Collective Memory | "Decentralized memory layer" | Hub, among the top apps |
| MUKU | Creator/fan ("Be the Star. Be the Voice.") | |
| ACO Labs | AI video creation | |
| Clanker World, Flap, BONAD, Token Mill, Printr, NOXA | Launchpads ("earn from attention") | |
| **Poply** | NFT marketplace plus launchpad with AI-generated art (testnet-era community app) | (unverified whether it is still active on mainnet; not on Hub) |
| Games and collectibles | LootGO, Oripa, Omnia, PlayKami, Lumiterra, Bro.fun, Grimmy's, Valor Quest, Rug Rumble, Narbet, Call of Odin's Chosen | |
| Monad Cards | Crypto Twitter "cards" mint by the Monad Foundation | app.monad.xyz |

### Gaps and whitespace (Track 3)
- **Beneficiary-paid curation feed.** Nothing like it exists. Farcaster and The Arena are feeds, but none pays curators from the people who benefit, such as token issuers, creators or advertisers.
- **Person-bound ticketing and access.** No live ticketing app. The closest precedent is **StageFun** (2nd place at evm/accathon: crowdfund events, repay via tickets). Pairs well with passkeys/Mera plus ERC-8004-style identity.
- **Markets on cultural outcomes.** CRSH (livestreams), Kizzy (influencers), Levr (sports), Blinq and Hyperstitions cover part of this. Open niches: awards shows, charts, fandom and creator milestones, settled by a credible oracle or jury, because resolution is the hard part.
- The track asks for teams "who have grown a community." Judges will want real users or waitlist numbers. This track also has the fewest dedicated voices on the judging panel (see judges-theses.md).

---

## Track 4: Trust, Identity & AI Infrastructure

| App/infra | What it is | Notes |
|---|---|---|
| **ERC-8004 registries** (Identity / Reputation / Validation) | Deployed as singletons on Monad mainnet. Monad docs have a guide: https://docs.monad.xyz/guides/erc-8004 | Envio indexed 366,903 agents across Monad plus BSC (https://github.com/enviodev/hyperindex/issues/1659). An earlier source counted 128 on Monad (unverified/dated) |
| **Mera** (Category Labs) | Passkey (P256/WebAuthn) account library | Plus a draft MIP for changeable, post-quantum authentication without changing address (Aug-2026 highlights) |
| MetaMask Agent Wallet, ERC-7715 permissions | Scoped agent spending | MetaMask $2.5K "Best Agent Wallet Plugin" bounty |
| Agentic Payments Alliance | 26-company agent-commerce standards coalition | Aug-2026 highlights |
| Agent apps on Hub | KINETK (track/detect/protect, a content-protection agent), aarna (agentic treasury), FereAI, INFINIT, CoinFello (DeFi agents), Kinic (AI memory agent), Noah AI (build dapps by chat), Nubila, dFusion AI, PrismaX (robot teleop) | |
| BTX encrypted mempools | Running on 2 nodes (anti-MEV) | Aug-2026 highlights |
| Privacy: PLabs, Murk Finance, Ghost Protocol, Unlink SDK | | Unlink x Monad privacy hackathon, Feb 2026 |
| Chainlink CRE, Envio, Nansen API/MCP, Zerion API, Tenderly, Quicknode | Infra sponsors | Each has a bounty or perk |

### Gaps and whitespace (Track 4)
- **Provenance for generated media that survives re-encoding.** No Monad app does it. KINETK is the nearest (content tracking). Perceptual-hash or watermark-to-onchain registries are open, and very few public Metropolis repos target this.
- **Passkey-native accounts.** Mera gives you the library, so the gap is in products that use it: multi-device recovery, "one passkey, many keys" and session keys for agents. Monad is paying $5K across two Mera bounties.
- **ERC-8004 agent identity and reputation is the most crowded idea in the whole hackathon.** Public repos include metropolis-agent-passport, agent-passport (zuemen), aegis-on-monad (x2), agent-pay-monad, agent-cert-monad, pod ("agents get paid only when work is re-runnable"), agent-jobs (escrow plus portable reputation), agentproof-monad and monadlens-ai. Winning here needs a real consumer of the reputation, for example a lending market or a job market that reads it, rather than another registry UI.

---

## Visible competitor Metropolis repos (public GitHub, created Sep 2026)
Source: `gh search repos` for "metropolis"/"monad metropolis", created after 2026-08-20.

| Repo | Track | Idea |
|---|---|---|
| tima-t/deltamon | 1 | Delta-neutral yield vaults |
| yigenfeng0707-netizen/metrix-ai | 1 | Autonomous trading agent |
| vincent-lxc/pulse-on-monad | 1 | Auditable trading agent plus receipts |
| 0xMigzy/PerpGuard | 1 | Perpl liquidation alerts, stress tests, kill switch |
| yotrade/yotrade | 1/3 | Community trading tournaments |
| DhruPtel/...Alpha-Agents | 1 | NFT agents with skill NFTs managing portfolios |
| YieldShield/yieldshield-monad | 1 | Protected positions plus first-loss liquidity |
| norbert351/afterhours | 1 | Tokenised-stock intelligence |
| Savitura/settle | 2 | Shared family wallets plus remittance (Nigeria) |
| icaluwu/Coffee-by-the-Second | 2 | Per-second payments |
| pauleke65/accrue | 2 | Escrowed job payment on verified completion |
| HYBLOCK-LAB/torna | 2 | Instant card refunds via collateral pool |
| precious-akpan/monad-metropolis-merchant-rails | 2 | Non-custodial invoice settlement |
| nickthelegend/polaris-monad | 2 | Payment links, pay-in-4 and subscriptions in AUSD with passkeys |
| choiaewoooon/monad-metropolis (Kirogi) | 2 | Earmarked remittance |
| neromtoobad/homeward | 2 | Passkey AUSD remittance |
| mandaputtra/ping-pong-pay | 2 | Payment links |
| zk1123/Mosaic | 3 | Address → personality profile |
| Richway17/metropolis-agent-passport, zuemen/agent-passport, Cubiczan/aegis-on-monad, filip-study/agent-pay-monad, ktb-devteam/agent-cert-monad, nel349/pod, grmkris/agent-jobs, acg0606/agentproof-monad, ProtocolForge770/monadlens-ai, Alarm2024/metropolis-desk-sentinel | 4 | Agent identity, reputation, receipts, certification |
| nickthelegend/ripar-wallet | 4 | Air-gapped hardware signer (thumb pulse) |

**Crowding:**
- Heaviest: Track 4 agent identity/ERC-8004, then Track 2 remittance/payment links, then Track 1 AI trading agents.
- Lightest: Track 3 (almost no public repos), media provenance, onchain credit scoring, and group settle-up.

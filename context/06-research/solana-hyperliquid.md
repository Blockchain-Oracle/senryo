# Breakout products on Solana and Hyperliquid (2026)

Researched 2026-09-29. Method and evidence standard: [README.md](README.md). Track ideas quoted from [../01-tracks/](../01-tracks/README.md). Monad presence checked against DefiLlama `/protocols` + `/overview/fees/monad` (pulled 2026-09-29) and [../05-ecosystem/ecosystem-map.md](../05-ecosystem/ecosystem-map.md).

## Data sources used (all pulled 2026-09-29 unless noted)
- DefiLlama fees by chain: `https://api.llama.fi/overview/fees/solana`, `/overview/fees/hyperliquid`, `/overview/fees/monad`. Solana apps earned **$411.4M** fees in 30d. Hyperliquid apps earned **$151.6M**.
- DefiLlama DEX volume: `https://api.llama.fi/overview/dexs/solana` (30d **$76.6B**), `/overview/dexs/hyperliquid` (30d **$10.5B**, spot and HyperEVM only).
- DefiLlama monthly fee history per protocol: `https://api.llama.fi/summary/fees/<slug>?dataType=dailyFees`. "Sep-26" means 1–28 Sep 2026 (partial month).
- Hyperliquid public API: `POST https://api.hyperliquid.xyz/info` with `{"type":"perpDexs"}` and `{"type":"metaAndAssetCtxs","dex":"<dex>"}`. This gives live 24h notional volume and open interest (OI) per HIP-3 market. Snapshot taken 2026-09-29 04:29 UTC.

**How to read the ranking:** candidates are ordered by strength of evidence first (hard onchain numbers plus growth) and portability to Monad second. Ratings are ours.

---

## Candidates

### 1. trade[XYZ]: HIP-3 equity, commodity and FX perps (Hyperliquid)
- What it does: a builder-deployed (HIP-3) perp DEX on Hyperliquid with 127 markets (US and Korean stocks, indices, oil, metals, FX, even `DRAM` and `H100`). It runs on HyperCore's order book and margin engine.
- Traction:
  - 24h volume = **$3.08B**, OI = **$3.73B** across 127 markets. Top markets: SP500 $356M, CL (oil) $316M, SILVER $296M ([Hyperliquid API](https://api.hyperliquid.xyz/info) `metaAndAssetCtxs dex=xyz`, 2026-09-29).
  - Interface fees, 30d = **$6.40M**. 1y = $63.3M. Monthly fees went from $4.1M in Jan-26 to $9.5M in Jul-26 ([DefiLlama](https://api.llama.fi/summary/fees/tradexyz), 2026-09-29).
  - Q2-2026 volume $202B, up 79% QoQ ([CryptoTimes](https://www.cryptotimes.io/2026/09/01/tradexyz-q2-volume-jumps-79-to-202b-as-equities-surge/), 2026-09-01). Cumulative $540.9B, **(unverified)**, search-snippet figure ([Hyperliquid Guide](https://hyperliquidguide.com/guides/trading/hyperliquid-xyz-explained)).
- Why it's working: it trades 24/7 against assets whose home venues close, with leverage and USDC margin in the same account as crypto. Commodities made up 67.7% of Q1 volume, so weekend and overnight macro hedging is a real use case.
- Open source?: closed (it's a HyperCore deployment, not a contract repo).
- On Monad already?: **partial**. Perpl (crypto perps), LeverUp and XStable (RWA, gold, FX) exist. HelloTrade (mobile leveraged equities, $4.6M seed led by Dragonfly) is pre-launch on Monad ([ecosystem-map](../05-ecosystem/ecosystem-map.md)). No Monad venue shows equity-perp volume on DefiLlama.
- Metropolis fit: Track 01, *"new underlyings"* in the track summary. Also idea 05: *"Mobile-first or simplified trading experiences built for a specific segment (… a specific asset class …)"*.
- Monad angle: HIP-3 needs HyperCore's native matching. On Monad the equivalent is a perp on Perpl's API (Perpl API $5K bounty) or a Kuru spot market for a tokenized-stock ERC-20. 300 ms blocks make onchain funding and marking per block feasible.
- Risks: we can't build a new perp engine in 2 weeks, so it must sit on Perpl. The oracle for equities off-hours is the hard part. Regulatory exposure.

### 2. Collector Crypt: tokenized graded-card gacha + marketplace (Solana)
- What it does: users buy "packs" and instantly receive a tokenized, vaulted, graded Pokémon or One Piece card as an NFT. They can take an instant buyback, trade it onchain, or redeem the physical card.
- Traction:
  - Fees, 30d = **$11.03M**. 1y = $88.0M. Monthly fees: Jan-26 $4.4M, Apr-26 $7.2M, Jun-26 **$16.1M** (peak), Sep-26 $11.2M ([DefiLlama](https://api.llama.fi/summary/fees/collector-crypt), 2026-09-29).
  - DEX-category volume, 30d = $128.3M ([DefiLlama dexs/solana](https://api.llama.fi/overview/dexs/solana)).
  - Record 215K packs opened in one week. ~4.5M packs cumulative across ~22K users. $50.9M cumulative protocol fees. More than 30% of users redeemed physical cards ([Solana Compass](https://solanacompass.com/news/collector-crypt-sets-weekly-pack-record-with-215k-opens-crosses-50m-in-revenue), Jun 2026).
- Why it's working: the loop is open → instant buyback at a known % → reopen. It's a slot-machine loop backed by real vaulted inventory. Physical redemption proves the asset is real, and the house edge sits in the buyback spread.
- Corroboration, same mechanism: **Beezie** "digital claw machine" (Base, then Solana from May 2026). ~$70M sales in Q1-2026, 540K+ claw pulls, ~90% instant-buyback rate ([Sporting Crypto](https://newsletter.sportingcrypto.com/p/beezie-hit-70m-sales-in-q1-2026); [Decrypt](https://decrypt.co/367592/beezie-brings-tokenized-collectibles-to-solana)). DefiLlama fees, 30d = $0.39M, down from a Mar-26 peak of $2.2M. **Phygitals** 30d fees = $0.45M (volatile).
- Open source?: closed.
- On Monad already?: **partial (unverified)**. "Oripa" (oripa.win, "Pokemon Card NFT Gacha & Trading Platform") is listed under Monad games in the ecosystem map, but we couldn't confirm its chain or usage. DefiLlama shows no "Physical TCG" protocol on Monad.
- Metropolis fit: Track 03. Idea 06: *"A TCG marketplace with real-time onchain order books — transparent price discovery, instant settlement, and no platform taking a 10–15% cut on every trade"*. Also idea 08, *"AMMs … for the long-tail of collectible assets"*, and idea 09, *"Rental and lending markets for high-value cards"*.
- Monad angle: the secondary market is the weak part of Collector Crypt (its buyback is a platform-set price). A Kuru order-book market per card grade or set, plus sub-second settlement for pack opening and instant resale, is the adaptation the track literally asks for. Pack randomness would come from a VRF (verifiable random function), for example Pyth Entropy or Chainlink.
- Risks: needs real vaulted inventory and a custodian (PSA or vault partner). For the demo, a mock-inventory vault is fine but must be labelled. Gambling and loot-box regulation.

### 3. StonkFun: launchpad where coins are paired against tokenized stocks (Solana)
- What it does: a bonding-curve launchpad where each new token's quote asset is an xStock (SPYx, NVDAx…), a pre-IPO token, or a crypto asset instead of SOL. It graduates to Raydium via LaunchLab.
- Traction:
  - Fees, 30d = **$24.81M**, from **$0 before 26 Jul 2026**. Monthly: Aug-26 $1.25M, Sep-26 $24.7M ([DefiLlama](https://api.llama.fi/summary/fees/stonkfun), 2026-09-29).
  - DEX volume, 30d = $648.8M ([DefiLlama dexs/solana](https://api.llama.fi/overview/dexs/solana)).
  - Moved launches onto Raydium LaunchLab on 2 Sep 2026. STONK up 250% to ~$140M market cap. 78 tokens bought back and burned ([The Block](https://www.theblock.co/news/defi/2026-09-06-stonk-surges-250-to-140-million-market-cap-as-stock-paired-solana-launchpad-stonkfun-pulls-volume-to-raydium-and-jupiter-413621), 2026-09-06).
  - Knock-on effect: Raydium LaunchLab fees rose from $0.06M in Aug-26 to $8.87M in Sep-26 ([DefiLlama](https://api.llama.fi/summary/fees/launchlab)).
  - Launch mix: 42% xStocks, 41% crypto, 10.5% SOL, 6.6% PreStocks **(unverified**: search-result summary of [Coinmonks/Medium](https://medium.com/coinmonks/stonkfun-api-track-stock-paired-solana-launches-in-real-time-d21777fc7412)).
- Why it's working: memecoin speculation gets a floor that tracks a real asset. Holders keep S&P or NVDA exposure while speculating. Buybacks and burns are spread across the quote assets. It turns tokenized stocks, which otherwise sit idle, into active liquidity.
- Open source?: closed.
- On Monad already?: **no** (no stock-paired launchpad found in DefiLlama or the ecosystem map; Nad.fun, NOXA Fun, Printr and Monad Grid are MON-paired).
- Metropolis fit: Track 01. Idea 01: *"Next-generation launchpads built around a specific emerging asset class (not another fair-launch meme bonding curve)"*. Idea 12: *"Tokenized equities as a programmable asset … build against a mock ERC-20"*. Kuru "Bring New Assets and Markets" $5K.
- Monad angle: Kuru's `deployTokenAndMarket` creates a token, a market and a vault in one transaction, so graduation needs no LP migration. Caveat: Kuru markets are MON-paired by default, so check whether it supports an arbitrary quote asset. Cheap gas makes per-trade buyback of the quote asset viable.
- Risks: needs a tokenized-stock supply on Monad (we found no confirmed xStocks or Ondo deployment on Monad; a mock ERC-20 is allowed by idea 12). The "not another meme bonding curve" wording means we must pitch the asset class, not the memes. Meme-driven volume may fade.

### 4. fomo: social, gasless mobile trading app (Solana + multichain, including Monad)
- What it does: an iOS/Android app with a social feed, copy trading and one-tap Apple Pay onramp. It supports gasless swaps across Solana, Base, BNB and Monad, and HL perps via "fomo Perps".
- Traction:
  - Fees, 30d = **$11.97M**. Monthly: Jun-26 $2.3M, Jul-26 $7.4M, Aug-26 $16.4M, Sep-26 **$32.5M** ([DefiLlama](https://api.llama.fi/summary/fees/fomo-wallet), 2026-09-29).
  - Solana swap volume, 30d = **$7.68B**, +163% ([DefiLlama dexs/solana](https://api.llama.fi/overview/dexs/solana)).
  - fomo Perps fees: Jun-26 $0.1M → Sep-26 $0.9M ([DefiLlama](https://api.llama.fi/summary/fees/fomo-perps)).
  - 625K+ traders, 68K first-time buyers via Apple Pay (June 2026). $75M Series B backed by Index Ventures **(unverified**: secondary sources, e.g. [insights4.vc](https://insights4.vc/blog/fomo-behind-the-75-series-b/)).
- Why it's working: onboarding is a card or Apple Pay, never a seed phrase. Watching friends' trades in a feed drives discovery. Gasless swaps remove the "buy gas first" step.
- Open source?: closed.
- On Monad already?: **yes**. DefiLlama lists fomo on Monad, but Monad fees are only $13.2K/30d vs $12.0M on Solana ([DefiLlama fees/monad](https://api.llama.fi/overview/fees/monad)).
- Metropolis fit: Track 01. Idea 05 (*"Mobile-first or simplified trading experiences built for a specific segment"*) and idea 04 (*"no 'pending' states"*). Kuru Consumer $5K, Agora Mobile $10K.
- Monad angle: port the design to a **narrow segment** fomo doesn't serve on Monad, for example a Kuru limit-order social app with passkeys (Mera) and AUSD. fomo proves the loop; Monad's 300 ms confirmation removes pending states.
- Risks: fomo is already on Monad, so originality is weak unless the segment is sharp. Copy-trading liability.

### 5. HIP-4 outcome markets / Outcome.xyz (Hyperliquid)
- What it does: HIP-4 (live on mainnet since 2 May 2026) adds fully collateralized binary contracts, settling at 0 or 1, to HyperCore's order book, with shared margin alongside perps. Outcome.xyz is the main builder front end (crypto, sports, World Cup).
- Traction:
  - Outcome.xyz volume, 30d = **$28.9M**, +1,635% vs the prior 30d. Monthly: Jun-26 $6.2M, Jul-26 $14.1M, Aug-26 $3.4M, Sep-26 $27.2M ([DefiLlama](https://api.llama.fi/summary/dexs/outcome.xyz), 2026-09-29).
  - Permissionless deployment opened 29 Aug 2026. Daily HIP-4 volume went from ~$545K (August average) to ~$2.75M. Outcome had ~85% share. Deployers post a 500K HYPE bond, slashable for bad settlement. Growth was "supported by trading incentives" (a $1M rebate campaign) ([crypto.news](https://crypto.news/hyperliquid-hip-4-volume-triples-after-open-rollout/), 2026-09-03).
  - Cumulative HIP-4 volume > $350M **(unverified**, [The Merkle](https://themerkle.com/hyperliquids-outcome-markets-are-compounding-fast-hip-4-volume-tops-350-million)).
- Why it's working: prediction contracts sit on the same order book and margin account as perps, with zero fees plus rebates. Short-dated crypto binaries (for example daily BTC) give repeat flow.
- Open source?: closed.
- On Monad already?: **partial**. There are pool/AMM-style prediction apps: Levr Bet ($1.9M TVL), Kizzy, CRSH Market ($6.6K fees/30d), Nad.fun "Predict", Hermes Trade. **No order-book binary markets on Kuru found.**
- Metropolis fit: Track 01. Idea 02 (*"Options written on non-traditional underlyings … real-world event outcomes verified by oracle"*). Kuru New Assets explicitly lists prediction contracts. Also Track 03 cultural-outcome markets.
- Monad angle: binaries as ERC-20 YES/NO pairs trading on Kuru's CLOB. 300 ms blocks make short-dated (5–60 min) crypto binaries viable, which is where HIP-4's volume concentrates.
- Risks: much of the volume is incentive-driven. Resolution and oracle design. Crowded category on Monad for sports.

### 6. Pre-IPO perps: EntropyIO, trade[XYZ] SPCX (Hyperliquid HIP-3)
- What it does: perps on private-company valuations (Anthropic, OpenAI, SpaceX), priced from secondary and oracle feeds (RedStone for Entropy).
- Traction:
  - EntropyIO (`io` dex): 24h volume **$34.0M**, OI **$57.1M**. `io:ANTH` OI $37.1M ([Hyperliquid API](https://api.hyperliquid.xyz/info), 2026-09-29).
  - trade[XYZ] `xyz:SPCX`: 24h volume **$109.6M**, OI $118.1M (same source).
  - EntropyIO raised **$14M led by Ribbit Capital** and launched 24 Aug 2026 ([Crypto Briefing](https://cryptobriefing.com/entropyio-pre-ipo-perps-hyperliquid/)). Anthropic perps traded at a ~100% average premium to the last priced round ([CoinGecko](https://www.coingecko.com/learn/crypto-pre-ipo-trading-anthropic-openai-perps)).
- Counter-evidence: **Ventuals** (the first pre-IPO HIP-3 dex: SPACEX, OPENAI, ANTHROPIC) shows **$0 24h volume** on all 15 markets (Hyperliquid API, 2026-09-29), and DefiLlama fees are ~$0 since Mar-26. Demand exists, but liquidity concentrates in one or two venues.
- Why it's working: retail can't access these companies any other way. A perp needs no share custody.
- Open source?: closed.
- On Monad already?: **no**.
- Metropolis fit: Track 01, *"new underlyings"*. Idea 12 is about equities as programmable assets, which is adjacent.
- Monad angle: a Perpl market or a Kuru-traded synthetic. The real work is the oracle (secondary-market index). Chainlink CRE $3K could run the index workflow.
- Risks: oracle manipulation, thin liquidity (Ventuals shows the downside), legal exposure.

### 7. pump.fun mobile app (Solana)
- What it does: pump.fun's native iOS/Android app for discovering, launching and trading coins.
- Traction: fees ramped from $0.03M (May-26, launch 22 May) to $1.94M (Jul), $5.42M (Aug) and **$6.98M (Sep-26)**. 30d = $7.55M. 30d volume = $422M ([DefiLlama](https://api.llama.fi/summary/fees/pump.fun-mobile-app), 2026-09-29). The iOS app returned to the US and India in Sep 2026 **(unverified**, [CMC AI summary](https://coinmarketcap.com/cmc-ai/pump-fun/latest-updates/)).
- Why it's working: on mobile, trading happens where attention already is (feeds, livestreams). It's an existing brand plus a push-notification loop.
- Open source?: closed.
- On Monad already?: **partial**. Nad.fun (web), MemeTok and fomo (mobile social trading) are on Monad ([ecosystem-map](../05-ecosystem/ecosystem-map.md)).
- Metropolis fit: Track 01 idea 05 (mobile). Track 03 only if tied to creators or communities.
- Monad angle: marginal. It shows mobile-native beats web-terminal for retail, which supports candidates 3 and 4.
- Risks: pure memecoin trading is on the README's slop list. Only useful as a UX pattern.

### 8. Social copy-trading layers on Hyperliquid: Legend, HyperDash, Senpi-style
- What it does: **Legend** is a social app (feed, clans, arenas, "Autocopy" traders) over Hyperliquid perps, including trade[XYZ] equities. **HyperDash** is analytics plus copy trading.
- Traction: fees, 30d: Legend **$136K** (+117%), HyperDash **$255K** (+147%). HyperDash monthly fees rose from ~$0.1M in Jun-26 to $0.3M in Sep-26 ([DefiLlama fees/hyperliquid](https://api.llama.fi/overview/fees/hyperliquid), 2026-09-29). Legend charges 0.05% on perps ([legend.trade how it works](https://legendtrade.com/how-it-works)).
- Why it's working: builder codes let any front end charge a fee on HyperCore flow without owning liquidity. Copy trading and leaderboards turn traders into distribution.
- Open source?: closed.
- On Monad already?: **no dedicated copy-trading layer found** for Perpl or Kuru. Crowding: `yotrade` (Metropolis repo: community trading tournaments) ([ecosystem-map](../05-ecosystem/ecosystem-map.md)).
- Metropolis fit: Track 01 (idea 05, idea 07 order types through a better interface). Perpl API $5K. Perpl Analytics $3K names hyperscreener.asxn.xyz as a reference.
- Monad angle: Perpl has an API, and per-trade gas is cheap enough to mirror small copy positions.
- Risks: modest absolute traction ($0.1–0.3M/month). The AI-agent variant is crowded and unproven (see Rejected: Senpi).

### 9. Valhalla: copy-LP for Meteora DLMM (Solana)
- What it does: watches wallets you choose and mirrors their concentrated-liquidity (DLMM) positions into your wallet, entries and exits, within ~4 s ([valhalla-bot](https://valhalla-bot.vercel.app/)).
- Traction: fees Jul-26 $0.30M, Aug-26 $0.47M, Sep-26 **$0.92M**. 30d = $0.95M, +113% ([DefiLlama](https://api.llama.fi/summary/fees/valhalla), 2026-09-29). Adjacent LP automation: LP Agent 30d $0.68M (+96%), HawkFi $0.62M (+233%) (same source).
- Why it's working: active LPing on bin-based AMMs is profitable but needs constant attention. Copying proven LPs outsources the skill. It's non-custodial.
- Open source?: closed. The DefiLlama adapter PR describes its fee mechanics ([PR #9396](https://github.com/DefiLlama/dimension-adapters/pull/9396)).
- On Monad already?: **no** (no liquidity-automation protocol listed on Monad in DefiLlama). Monad has LFJ (Liquidity Book), Uniswap V3/V4 and Kuru vaults.
- Metropolis fit: Track 01, idea 07 (*"New order types or execution strategies … surfaced through a genuinely better trading interface"*).
- Monad angle: mirroring in the same or next block (300 ms) instead of ~4 s cuts slippage between leader and copier.
- Risks: Monad's CLMM TVL is small (DEXs total $56M), so there are few leaders to copy.

### 10. ORE-style grid mining and "Attention Mine" (Solana)
- What it does: ORE's 5×5 grid runs every 60 s. Miners deploy SOL on squares, one square wins the pot from the other 24 plus newly minted tokens, and a 10% fee funds buybacks. **Attention Mine** (by District) adds advertisers bidding to put a message on a square, turning the grid into an attention and ad market, and is run by an agent.
- Traction: ORE fees 1y = **$40.2M**, Sep-26 $2.26M/month ([DefiLlama](https://api.llama.fi/summary/fees/ore-protocol)). ORE weekly revenue was ~$600K vs a $3.2M peak at the v3 launch in Nov 2025 ([search summary](https://coinmarketcap.com/cmc-ai/ore-new/what-is/), unverified). Attention Mine: **$0.40M fees in its first ~3 weeks** (since 9 Sep 2026) ([DefiLlama](https://api.llama.fi/summary/fees/attention-mine)). Clones BidGrid ($0.91M/30d, launched 17 Aug) and Sat Rush ($0.53M/30d).
- Why it's working: a 60 s round is a short, social, lottery-like loop with real yield (the SOL pot) plus token emissions and buybacks.
- Open source?: ORE is open source: [github.com/regolith-labs/ore](https://github.com/regolith-labs/ore) has 823 stars, was last pushed 2026-09-25, and has no license detected by GitHub (checked via `gh api`, 2026-09-29).
- On Monad already?: **yes (small)**. **GuessOne**, "price-prediction and gamified mining protocol on Monad" with price-range grids, earned $8.0K fees in 30d ([DefiLlama fees/monad](https://api.llama.fi/overview/fees/monad)).
- Metropolis fit: Track 03 idea 03 (*"Attention futures"*) only for the advertiser-bid variant. Otherwise nothing fits.
- Monad angle: rounds could be seconds rather than 60 s. The advertiser-square mechanic is the only non-gambling angle.
- Risks: it's a casino (Pantera's "end of the casino era" thesis in [judges-theses](../05-ecosystem/judges-theses.md)). GuessOne already occupies the base mechanic.

### 11. Risk tranching and yield stripping: Exponent, Reflect Tranches (Solana)
- What it does: Exponent is Solana's Pendle (principal/yield split, fixed rates). In 2026 it added **risk tranching**: a senior tranche (protected, ~6.4% target) and a junior tranche (levered, ~31.4% target) on the same yield asset. Reflect Tranches does the same.
- Traction: Exponent Yield Exchange TVL $67.8M. Exponent Risk Tranching TVL **$14.5M** (listed 15 Jul 2026). Exponent Strategy Vaults $12.0M. Reflect Tranches $1.49M (listed 2 Sep 2026) ([DefiLlama /protocols](https://api.llama.fi/protocols), 2026-09-29). Exponent 30d fees $0.49M (+280%).
- Why it's working: different depositors want different risk on the same RWA or DeFi yield. Tranching sells safety to one and leverage to the other without borrowing.
- Open source?: Exponent says its yield-stripping core is open source ([Crypto Briefing](https://cryptobriefing.com/exponent-finance-risk-tranching-solana-defi/)); repo not located **(unverified)**.
- On Monad already?: **partial**. Pendle V2 has $199M TVL on Monad, which covers yield stripping. **No tranching protocol found on Monad.**
- Metropolis fit: Track 01 idea 03 (*"Yield stripping…"*). Pendle already covers it, so pitch the tranching variant, e.g. senior/junior slices of AUSD or Upshift vault yield.
- Monad angle: none specific to speed; cheap gas helps small tranches.
- Risks: DeFi-infra judges will ask "why not Pendle". Hard to show traction in 2 weeks.

### 12. Dreamcash: consumer mobile app for HIP-3 stock perps with USDT (Hyperliquid)
- What it does: an iOS/Android app for Hyperliquid spot, perps and HIP-3 stocks, commodities and indices, with its own USDT0-margined `cash` dex.
- Traction: **Tether strategic investment** plus a $200K weekly incentive program ([The Block](https://www.theblock.co/post/389916/tether-invests-in-hyperliquid-frontend-dreamcash-offering-perps-markets-for-tsla-gold-and-more-using-usdt0-collateral)). 100K+ installs on Google Play ([Play Store](https://play.google.com/store/apps/details?id=xyz.dreamcash.app&hl=en_US)). **But** DefiLlama "Dreamcash Markets" fees are $0 in the last 30d (1y $1.70M), and the `cash` dex shows **$0 24h volume** (Hyperliquid API, 2026-09-29). Usage looks incentive-dependent.
- Why it matters: it's the closest real product to the **Agora Mobile Trading $10K** brief (mobile + stablecoin balance + perps), and it shows the risk of such a product.
- On Monad already?: **partial**. HelloTrade is pre-launch.
- Metropolis fit: Track 01 idea 05. Agora Mobile $10K (Mera + AUSD + Perpl).
- Risks: evidence of sustained usage is weak. Include as a design reference, not proof of demand.

### 13. MetaDAO: futarchy-governed "ownership coin" raises (ICM, Solana)
- What it does: a fundraising launchpad where raised funds sit in a market-governed treasury (futarchy: spending decisions pass only if conditional token markets price them positively). High float, no private allocations.
- Traction: 23 sales raising **$624.7M** in total subscriptions, with MetaDAO retaining $45.4M **(unverified**: [KuCoin flash summary](https://www.kucoin.com/news/flash/metadao-raises-625m-in-23-sales-faces-challenge-of-filtering-quality-projects)). Futarchy AMM TVL **$14.1M**, 30d volume $31.1M, 1y fees $3.28M ([DefiLlama](https://api.llama.fi/protocols), 2026-09-29).
- Why it's working: investors get treasury-backed downside protection and a vote by market, which answers the "team dumps the raise" problem of 2024–25 launchpads.
- Open source?: yes: [github.com/metaDAOproject/programs](https://github.com/metaDAOproject/programs) was last pushed 2026-09-25, with license NOASSERTION (checked via `gh api`, 2026-09-29).
- On Monad already?: **no** (no futarchy or ownership-coin launchpad found).
- Metropolis fit: Track 01 idea 01 (a launchpad for an emerging asset class, where "ownership coins" is the asset class). Track 03 community governance.
- Monad angle: conditional markets could run on Kuru order books. Fast blocks help the TWAP (time-weighted average price) decision windows.
- Risks: the headline number comes from one secondary source. Complex to demo. Securities-law questions.

### 14. KAST: stablecoin neobank + Visa card (Solana-first)
- What it does: a stablecoin account with a Visa card, virtual US/EU account details, cashback and yield on idle balances.
- Traction: raised **$80M at a $600M valuation**, ~1M users in 170+ countries ([bex.co](https://bex.co/blog/2026/03/12/kast-80m-series-a-stablecoin-payments), 2026-03-12). "$5B annualized volume" **(unverified**, search summary).
- Why it's working: dollar access for users in emerging markets, card acceptance, no bank account needed.
- On Monad already?: **partial**. UR, Cero, Axal, MetaMask Money Account, Meru and Abound are on Monad ([ecosystem-map](../05-ecosystem/ecosystem-map.md)).
- Metropolis fit: Track 02. Idea 06: *"Salary streaming at the individual level … with idle balances earning yield in the background until you spend them"*.
- Risks: card issuing isn't buildable in 2 weeks, and Monad already has several neobanks. Useful only as the segment reference for a narrower Track 02 feature.

---

## Cross-cutting findings
1. **Asset-class markets beat meme markets in 2026.** The fastest-growing things are HIP-3 equities and commodities (trade[XYZ] $3.1B/day), stock-paired launches (StonkFun, $0 → $24.8M fees in 2 months) and tokenized collectibles (Collector Crypt $11M/month). All three map to official Track 01 and 03 ideas.
2. **Mobile + social + gasless wins distribution.** fomo's fees grew ~14× from Jun-26 to Sep-26, and pump.fun Mobile went from 0 to $7M/month in 4 months.
3. **Compute perps exist but are dead.** `xyz:H100` (mark $2.60) and `para:H100` (mark $2.56) both show **$0 24h volume and $0 OI** (Hyperliquid API, 2026-09-29). This is evidence against the track's compute-market ideas (08–11) as a volume play: onchain compute prices have been listed, but nobody trades them yet.
4. **Many HIP-3 dexes are empty.** Felix (`flx`), Ventuals (`vntl`), HyENA (`hyna`), Kinetiq (`km`), `abcd` and Dreamcash (`cash`) all show $0 24h volume. trade[XYZ] holds the vast majority of volume. Deploying markets is easy; getting liquidity is the hard part.

## Rejected
| Product | Chain | Reason |
|---|---|---|
| Senpi (AI trading agents for HL) | Hyperliquid | Claims "$100M+ volume", but DefiLlama "Senpi Perps" fees are **$2.9K/30d** (1y $174K) ([DefiLlama fees/hyperliquid](https://api.llama.fi/overview/fees/hyperliquid)). Also, "AI agent that trades for you" is the most crowded Metropolis idea. |
| Minara AI | Hyperliquid | DefiLlama "Minara AI Perps" fees $1.5K/30d. No traction. |
| Ventuals (pre-IPO HIP-3) | Hyperliquid | 15 markets, all $0 24h volume on 2026-09-29. Superseded by EntropyIO and trade[XYZ]. |
| H100 / compute perps | Hyperliquid | $0 volume and $0 OI on both listings (see finding 3). |
| Pacifica Perps | Solana | Strong (30d fees $3.48M, +86%), but it's "another perp DEX", and Monad already has Perpl, LeverUp, Drake and Monday. Fails the track's *"faster clone"* test. |
| Axiom, Terminal, GMGN, Photon, Trojan (terminals/bots) | Solana | Big fees (Axiom $29.5M/30d), but GMGN, MevX, UniversalX, Mona and o1 are already on Monad, and the ecosystem map calls terminals and bots saturated. |
| BONK.fun, Graphite, Meteora DBC (meme launchpads) | Solana | September fee spikes (BONK.fun $0.17M → $7.9M) are memecoin-cycle driven. Pure meme bonding curves are excluded by idea 01's wording. |
| BidGrid, Sat Rush | Solana | ORE clones with no independent coverage found. Gamified gambling. |
| Bounce.Tech (leveraged ERC-20 tokens) | HyperEVM | Fees −41% (30d), TVL $0.85M. Declining. |
| Hypercall (fractional options) | Hyperliquid | TVL $1.01M. No volume data on DefiLlama. Insufficient evidence. |
| Senpi-style / Co-Invest agents, "Byreal agent DEX" | Solana/HL | No usage metrics found. |
| Ample (prize-linked savings) | Multichain | Already on Monad (DefiLlama lists Monad, TVL $2.73M total). |
| Kinetiq Markets (`km`/`mkts` HIP-3) | Hyperliquid | Fees ~$0.1–0.2M/month, flat. `mkts` shows $30.8M/24h, mostly US500. Weak relative to trade[XYZ]. |

## Open checks for `monad-gap-check.md`
- Confirm whether "Oripa" on Monad is a live card gacha, with volume.
- Confirm whether any tokenized stock (xStocks, Ondo, Dinari) is deployed on Monad. This decides whether StonkFun-style launches need a mock ERC-20.
- Confirm whether Kuru supports non-MON quote assets in `deployTokenAndMarket`.

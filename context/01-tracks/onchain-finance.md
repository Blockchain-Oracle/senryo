# Track 01: Onchain Finance & Trading

> **Source of truth:** the logged-in portal (`_portal/api/catalog.json`, captured 2026-09-29). Everything above **Our analysis** is copied verbatim. Page capture: [../_portal/tracks/onchain-finance.md](../_portal/tracks/onchain-finance.md)

**Prize:** $30,000 USD (Split evenly among 3 winners - $10,000 each)

**Summary:** New asset primitives, market structures, and the trading experiences that make them usable — all made possible by fast, cheap settlement.

## What this track is for (official)
Financial markets onchain have matured enough to ask what should exist here that couldn't exist anywhere else. This track is for builders working on the asset layer itself — new instruments, new underlyings, new market structures — as well as the trading infrastructure and trading experiences that make them accessible. At 400ms blocks and 800ms finality on Monad, fully onchain markets that compete with centralised venues on execution quality are within reach, and that same speed opens up trading interfaces and interaction patterns that weren't previously possible.

Compute is emerging as one of the most important commodities in the world, yet GPU capacity still trades on opaque, bilateral terms — no real spot markets, no hedging tools. Companies using compute as loan collateral pay a premium above 5% because lenders can't underwrite or hedge the risk. That's starting to change: CME and ICE have both announced compute futures, and compute contracts are seeing real volume on prediction markets. Monad's throughput and sub-second settlement make it a strong candidate for where compute markets get built onchain.

Tokenized equities are arriving onchain fast, and once an equity is a programmable asset rather than just a static holding, a lot becomes possible: divisible to a cent, transferable without a broker, and actionable by any contract that touches it. This track wants to see the equity actually doing something — locked, streamed, conditioned, or distributed by a contract — not just held as another balance.

Core question: Where are the missing asset primitives — and what new trading experiences and financial products become possible when settlement is fast enough to stop being the bottleneck?

Belongs here if: the core output is a financial instrument, market, asset primitive, or trading experience — and the primary user is a trader, protocol, or financial product builder.

## Judging criteria (official, from this track's page)
- Technical Execution (20%) — does the trading/market mechanism work end-to-end onchain? Real settlement and pricing/matching logic, not a UI mockup over static data.
- Design & Craft (20%) — is the trading experience trustworthy and legible? Clear pricing, clear risk disclosure, an interface a trader would actually trust with capital. Financial products live or die on whether users trust the UI.
- Originality & Track Insight (15%) — does this introduce a genuinely new asset primitive or market structure that couldn't exist without fast settlement, or is it a faster clone of an existing DeFi product?
- Founder & Market Readiness (25%) — does the team understand who the trader, protocol, or counterparty is and why this market doesn't already exist? Can they name a specific first user beyond "crypto traders"?
- Traction & Path Forward (20%) — any evidence of real usage or testing (even simulated volume or a handful of test trades), and a specific next step — a TVL/volume target, a liquidity partner plan, or a concrete fundraising/launch plan.

> ⚠️ The **official rules** (`_portal/pages/rules.md` §5.2) give a *different* main-track rubric: Product Quality & Completeness, Technical Excellence, Monad Integration, Track Fit & Problem Relevance, Innovation & Impact (20% each). Plan for both; ask organizers which one applies.

## Deliverables (official)
- Project Logo/Graphic: uploaded in JPG, JPEG, PNG, or WEBP format (maximum size 3MB)
- Public GitHub Repository: fully accessible by metropolis@hackathon.monad.xyz
- Technical Demo Video: maximum 3 minutes, via YouTube, Loom, or Vimeo — must show the live working product, not slides or a code walkthrough
- Pitch Video: maximum 2 minutes, introducing the team, the problem being solved, and why you're building it
- Live Product Link: deployed on Monad Mainnet or Testnet, accompanied by clear access instructions and any necessary test login credentials for judges
- Product Advertisement (Optional): maximum 30 seconds, via YouTube, Loom, or Vimeo — a short, punchy promotional clip of the product. Not factored into judging; used for post-event social promotion and marketing

## Suggested ideas (official, all 12)
01. Next-generation launchpads built around a specific emerging asset class (not another fair-launch meme bonding curve) — the moment a new asset class becomes liquid and tradeable onchain for the first time, it creates room for a launchpad purpose-built around it
02. Options written on non-traditional underlyings: social attention, creator growth trajectories, real-world event outcomes verified by oracle
03. Yield stripping: separate the yield from the principal of any interest-bearing asset and trade each leg independently
04. Execution-aware trading interfaces that expose Monad's sub-second finality directly to the user — real-time fills, live order books, no ""pending"" states
05. Mobile-first or simplified trading experiences built for a specific segment (new traders, a specific asset class, a specific region)
06. Embedded trading experiences inside wallets, games, or other apps that aren't trading-native
07. New order types or execution strategies (TWAP, grid, limit variants) surfaced through a genuinely better trading interface, not just backend logic
08. Compute Spot Exchange — an onchain CLOB for standardized compute contracts (e.g. "1 H100-hour, region X, delivered week N")
09. Compute Structured Products — vaults routing LP capital into compute-backed strategies: financing providers, market-making compute contracts, or basis trades on a compute index
10. Tokenized Compute Yield — fractionalized GPU fleets or reserved cloud commitments turned into yield-bearing, transferable tokens with onchain revenue distribution
11. SLA Insurance & Performance Bonds — markets underwriting compute delivery (uptime, latency, delivery guarantees) with onchain slashing and payouts
12. Tokenized equities as a programmable asset — a contract that locks, streams, conditions, or distributes the equity itself, not just holds it. Must be genuinely impractical offchain (due to access or minimum size) and not already common onchain. No live tokenized equity required — build against a mock ERC-20 standing in for a tokenized stock.

## Bounties tied to this track (official)
The Tracks & Bounties page says: *"Each one names its track, and the ones marked All tracks pair with any."* These are only open to projects entered in this track:

| Sponsor | Bounty | Prize | Split | What it asks for (verbatim summary) | Full text |
|---|---|---|---|---|---|
| Agora | Best Mobile Trading App on Monad (Agora Onchain Trading Bounty) | $10,000 USD | $10,000 USD — single prize | Build a mobile app authenticating via Mera, holding an AUSD balance, and executing trades through Perpl. | [open](../_portal/bounties/agora-best-mobile-trading-app-on-monad-agora-onchain-trading-bount.md) |
| Kuru | Build the Next Consumer Trading App on Kuru | $5,000 USD | $5,000 USD — single prize | Build a focused spot trading product routing trades through Kuru's onchain order book on Monad. | [open](../_portal/bounties/kuru-build-the-next-consumer-trading-app-on-kuru.md) |
| Kuru | Bring New Assets and Markets to Kuru | $5,000 USD | $5,000 USD — single prize | Build a new class of tradable markets on Kuru's spot order book, including the infrastructure to make them viable. | [open](../_portal/bounties/kuru-bring-new-assets-and-markets-to-kuru.md) |
| Perpl | Best Analytics / Risk Tool | $3,000 USD | 3 winners, $1,000 USD each | Build a real-time analytics, risk-monitoring, or portfolio intelligence dashboard focused on Perpl. | [open](../_portal/bounties/perpl-best-analytics-risk-tool.md) |
| Metamask | Best Agent Wallet Plugin | $2,500 USD | $2,500 USD — single prize | Build a plugin that gives the MetaMask Agent Wallet a new trading superpower via its plugin architecture. | [open](../_portal/bounties/metamask-best-agent-wallet-plugin.md) |

Plus the **12 All-tracks bounties**, which pair with any track. See [../00-hackathon/prizes-and-bounties.md](../00-hackathon/prizes-and-bounties.md).

---

## Our analysis (not official; each claim cites its source)

### The launchpad idea you remembered
It's **official idea #01**: *"Next-generation launchpads built around a specific emerging asset class (not another fair-launch meme bonding curve)."* It asks for a launchpad for **a new asset class** (compute contracts, tokenized equities, royalties, loyalty points…), **not** a memecoin bonding curve. It does **not** say every launched token must be instantly swappable; that part is our inference.
- The natural pairing is **Kuru "Bring New Assets and Markets to Kuru" ($5K, Track 01 only)**. Its official ideas include tokenized RWAs, loyalty points, revenue/royalty-linked assets and prediction contracts. Its criteria demand more than a UI: *"issuance/redemption mechanism, legal/operational viability, and liquidity strategy."*
- Mechanism: Kuru's SDK has `MonadDeployer.deployTokenAndMarket`, which creates a token + a MON-paired order-book market + a seeded vault in **one transaction**, so the asset is tradeable immediately. Source: docs.kuru.io/sdk/deploy-market, see [../03-sponsors/finance-trading/kuru.md](../03-sponsors/finance-trading/kuru.md).

### What the judges score (track page rubric)
The biggest weight is **Founder & Market Readiness (25%)**: *"Can they name a specific first user beyond 'crypto traders'?"* Traction counts too (20%): *"even simulated volume or a handful of test trades."* Pick a specific customer and show real trades.

### Bounty combinations that are actually valid for Track 01
| Build | Bounties it can claim | Watch out |
|---|---|---|
| Mobile trading app | **Agora Mobile $10K** (requires **Mera** login + **AUSD** balance + trades via **Perpl**; judged on *"creative use of the three integrations together"*) + Perpl API $5K (All-tracks, 2 × $2.5K) + Mera UX $2.5K (All-tracks) | Agora's bounty needs **Perpl**, not Kuru |
| Consumer spot trading app | **Kuru Consumer $5K**. Its submission form asks for *Target users* and *Evidence of demand*, plus more fields ([full text](../_portal/bounties/kuru-build-the-next-consumer-trading-app-on-kuru.md)) | Needs evidence of user demand |
| New-asset-class launchpad / market | **Kuru New Assets $5K** + Chainlink CRE $3K (oracle/issuance workflow) + Aurora $5K (any-chain deposits) | Must cover issuance, redemption and liquidity |
| Perpl dashboard | **Perpl Analytics $3K** (3 × $1K; *"fast, modern, dark-mode UI"*, protocol view ↔ wallet drill-down) + Nansen $5K + Envio $1K | Reference designs named in the bounty: stats.nado.xyz, hyperscreener.asxn.xyz, lighterdash.lol |
| Agent trading plugin | **MetaMask Agent Wallet $2.5K** (Track 01 only; *"working, installable plugin… no bypass of signing, policy, or MFA"*) | Must route every transaction through the Agent Wallet |

### Where competition is thin (from our research in [../05-ecosystem/ecosystem-map.md](../05-ecosystem/ecosystem-map.md); unverified competitor counts)
- **Compute markets** (official ideas 08–11): we found no Monad project doing this. Sponsors don't cover it directly, but it's novel and the track text pushes it hard.
- **Tokenized equity as a programmable asset** (idea 12): a mock ERC-20 is explicitly allowed.
- Crowded: "AI agent that trades for you" (4+ public repos) and yet another AMM or aggregator.

### Monad facts that matter here
- Live mainnet block time **measured on 2026-09-29: ~302 ms/block** (101 blocks in 30.5 s). The track text's "400ms blocks and 800ms finality" is out of date. Finality is ~2 blocks later (docs).
- Gas is charged on the **gas limit**. Public RPC `eth_getLogs` covers ~100 blocks, so use an indexer. See [../02-monad/differences-from-ethereum.md](../02-monad/differences-from-ethereum.md).

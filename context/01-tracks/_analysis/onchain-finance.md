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

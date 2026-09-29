# Shortlist v2: proven products to adapt to Monad

> Rebuilt 2026-09-29. **Version 1 was withdrawn** because it ranked by "buildable by 14 Oct" and "easiest traction before the deadline", and cut the strongest trends as "too big". This version has **no time or effort criteria**, and every obstacle comes with the route others used to get past it. Sources: the five direction files, three deep dives (`deep-dive-*.md`) and [monad-gap-check.md](monad-gap-check.md). Every entry is an **existing product with verified traction elsewhere**, not an invented idea.


> **Corrections (2026-09-29, from Codex's independent evaluation, [../07-decision/codex-evaluation.md](../07-decision/codex-evaluation.md)):**
> - **#2 card:** "the loan finalises onchain inside the 1.6 s authorisation window" is **unproven**, not an established fact. The 1.6 s (Reap) covers the whole round trip; Rain's timing is under NDA; ether.fi and Gnosis Pay approve first and settle onchain after. Treat "finalise before approve" as an experiment to measure. The safe route is an atomic credit reservation, then approve, then an onchain borrow.
> - **#1 perps:** "per-block funding" is a **weak** advantage (accrue continuously, settle on position change). The real Monad angles are fast final execution and liquidation, plus contract-enforced session, freshness and gap rules. Perpl can't list markets permissionlessly, so the layer needs its own execution engine or a Perpl agreement.

## Ranking criteria (all weighted equally)
1. **Evidence:** how big the proven market is, and whether it's growing, steady or fading.
2. **Monad gap:** what's missing on Monad today (verified).
3. **Monad makes it better:** a real mechanical advantage from ~300 ms blocks, ~600 ms finality, cheap per-block writes, the P256 precompile or ERC-8004, not just "it can run here".
4. **Official track fit:** matches the portal's track text or ideas.
5. **Room to win:** competition on Monad and a defensible angle.

---

## 1. Open listing layer for real-world-asset perps ("HIP-3 for Monad") → Track 01
**Copying:** Hyperliquid's HIP-3, where outside teams post a bond to deploy markets; trade[XYZ] is the proof.
- **Evidence:** RWA perps traded **$105.2B (Jan) → $799.5B (Aug 2026)**, but centralised exchanges hold 87.2%. Onchain, trade[XYZ] holds ~70% of OI ($3.73B) and ~29% of Hyperliquid's daily volume. [deep-dive-rwa-perps](deep-dive-rwa-perps.md), [solana-hyperliquid](solana-hyperliquid.md) #1.
- **Monad gap:** all Monad perp OI is **$1.84M**. LeverUp's 50 RWA pairs route to trade[XYZ] and show $0 volume; HelloTrade perps are in alpha. **No permissionless, bonded market-listing layer exists.** Perpl lists crypto only and has no third-party listing path.
- **Monad makes it better:** marking and funding every block (~300 ms) costs next to nothing; the known failures (Ostium's $23.75M oracle-key theft, trade[XYZ]'s ~$60M refund after one thin SK hynix print) are **oracle and operations** failures. Those can be fixed with rules enforced in the contract: market hours, weekend pricing, gap handling.
- **Routes (from deep dive):** Chainlink already publishes free gold/silver/FX feeds and six 24/5 tokenized-stock feeds on Monad; Pyth has 1,247 equity feeds (paid); Stork is deployed. Perpl could become the first venue on the layer, and **Perpl's co-founder (PBJ) is a Metropolis bounty judge** (portal Prizes page), not a main-track judge.
- **Official fit:** Track 01 summary: *"New asset primitives, market structures…"*; the description says *"new instruments, new underlyings, new market structures."*
- **Room to win:** the layer (infrastructure) instead of another venue; or one segment the deep dive names (Korean retail, AI/memory-chip traders).

## 2. Borrow-to-spend card on Monad collateral → Track 02
**Copying:** ether.fi Cash (plus the self-custodial authorisation model of Gnosis Pay and Exa).
- **Evidence:** stablecoin cards spent **$1.116B in Aug 2026** (vs $380M a year earlier). ether.fi did **$115M in September**, ~$2,450 per active address, and $11.7M revenue over 12 months (DefiLlama). KAST: 1M+ users. [deep-dive-stablecoin-cards](deep-dive-stablecoin-cards.md).
- **Monad gap:** MetaMask Money Account covers "spend from a yield balance". **Nobody offers borrowing against MON / sUSDe / earnAUSD at the swipe**, and **no card spends AUSD** (AUSD has $150M on Monad).
- **Monad makes it better:** a card authorisation must be decided within **1.6 s** (Reap: *"the card network does not wait, and there is no retry"*). Monad finalises in ~600 ms, so the borrow can be **executed and finalised onchain inside the authorisation window**, not approved on credit and reconciled later. Slower chains can't do this.
- **Routes:** **Rain has issued cards on Monad since 12 May 2026** (Visa principal member, runs the KYC); Avici and Rhythmic are already building on it. Rain has a startup programme; Gnosis Pay gives partner IDs self-serve; Reap and Rain publish their authorisation-webhook contracts, so the onchain half can be built and tested against them. Lesson from Kulipa's July shutdown: design for **multiple issuers**.
- **Official fit:** Track 02, *"consumer-facing financial products that use onchain rails as a design advantage"*; near idea 06 (idle balances earning yield until you spend).
- **Room to win:** the borrow-at-swipe mechanic plus AUSD spend. Different from MetaMask.

## 3. Money-stake commitment pools → Track 02
**Copying:** StepBet/DietBet (WayBetter), Moonwalk (Solana), Forfeit/Opal.
- **Evidence:** WayBetter ~2.36M players and $250M paid out (company counters, unverified independently); Moonwalk raised $3.4M. [consumer-social-and-web2](consumer-social-and-web2.md) #4, #8, #9.
- **Monad gap:** none. LootGO is free walk-to-earn with no stakes.
- **Monad makes it better:** transparent pools and instant, automatic payouts; global participation in AUSD. The advantage is real but modest: speed isn't central here.
- **Routes:** step and habit verification through Strava / Google Fit / HealthKit (native app), orchestrated by a Chainlink CRE workflow.
- **Official fit:** **word-for-word** Track 02 ideas 02 and 03.
- **Room to win:** open field on Monad; smaller market than #1 and #2.

## 4. Collector app on existing card inventory → Track 03
**Copying:** Collector Crypt / Courtyard / Whatnot, **built on top of the inventory they already hold**, not a new vault.
- **Evidence:** Collector Crypt Q2 2026 GMV **$406.1M** (+175% QoQ) and $11.4M fees in the last 30 days. **But packs were 97% of it, and 90.5% was bought back.** Secondary trading between platforms is only ~1% of resale. The onchain peak was June; 714 wallets made 88% of volume. [deep-dive-collectibles](deep-dive-collectibles.md).
- **Monad gap:** Oripa is tiny (91 packs, ~$9.1K in 20 days, 0 marketplace listings). **Collector Crypt's contract is already on Monad with 0 cards**, and the Base↔Monad bridge (Chainlink CCIP) is live.
- **Routes:** Collector Crypt's **partner API** (resell packs for up to a 10% fee, build custom packs on its inventory, fiat invoicing). First step: ask them to enable Monad pack sales.
- **Honest note:** the official Track 03 idea (an order-book card market) has **little demand evidence**. The money is in packs. An order book works only if cards are made interchangeable (one token per card and grade, redeemable for any matching copy). Real risks with no known route: whale concentration, gambling law around packs, a Pokémon price drop.
- **Official fit:** Track 03 ideas 06 and 08.

## 5. User-owned AI memory keyed to a passkey → Track 04
**Copying:** Mem0 (186M API calls per quarter, $24M raised) and the MCP memory servers (~563K npm downloads/month). [ai-agents-tools-and-demand](ai-agents-tools-and-demand.md).
- **Monad gap:** none.
- **Monad makes it better:** access grants onchain (cheap per grant), passkey signatures verified by the P256 precompile, Mera-derived encryption keys that work across devices.
- **Full scope, no longer cut down:** match Mem0's retrieval quality, not just a store. Ship as an MCP server so other teams can integrate it, which is how Track 04 measures traction.
- **Official fit:** Track 04 idea 04, word for word; Mera "Many Keys" names this use case.
- **Weakness:** crypto-agent usage is small (AgentKit 34K downloads/month; x402 volume down 93% this year). The demand is for memory, not for its onchain part.

---

## Also reinstated (were cut for deadline or effort reasons)
| Candidate | Evidence | Why it's lower |
|---|---|---|
| Undercollateralised credit (Wildcat) → Track 01 | $18.7M fees/year, steady; Accountable on Monad $0.14M | No portal idea names it; credit data on Monad is thin |
| Risk tranching (Exponent) → Track 01 idea 03 | Tranching TVL $14.5M in ~2 months | Pendle ($199M on Monad) already covers yield stripping; tranching is a narrower add-on |
| Programmable tokenized stocks → Track 01 idea 12 | Tokenized-stock holders +63% in 30 days | Tokenized stocks exist on Monad (Anchored/Monday Trade) but trade ~$552/month in fees; the launchpad version (StonkFun) was a 3-week spike |
| Group split / settle-up → Track 02 idea 01 | Web2 demand (Splitwise 10M+ downloads) | No crypto product has shown traction |

## Still rejected on evidence (not on effort)
Compute markets (live GPU perps: $0 volume) · generic prediction markets (growth is offchain at Kalshi; the onchain venue halved) · x402 agent payments (−93% YTD) · creator coins · tap-to-earn · ticketing tokens.

## What decides between #1–#3
- **#1** is the biggest, fastest-growing market, with the clearest Monad advantage (it's infrastructure; Perpl's co-founder is a bounty judge). It suits a team with trading, protocol or oracle depth.
- **#2** has the most concrete Monad-only technical edge (finalising inside the authorisation window), and a live issuer on Monad. It suits a team that can do partnerships and consumer product.
- **#3** matches an official idea word for word with an open field. It suits a product-and-community team.
The track-page rubric puts **Founder & Market Readiness at 25%**, so the deciding input is the team.

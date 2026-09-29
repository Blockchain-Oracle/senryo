# 06: Idea Research (find, don't invent)

**Method (the user's rule):** we don't invent ideas. We **find products that already work** somewhere else (another chain, or Web2), verify their traction, and adapt the best one to Monad for a **main track** (bounties are secondary). Started 2026-09-29; submission deadline 14 Oct 03:59 UTC.

## Evidence standard (every research file follows this)
A product makes a shortlist **only** if it has at least one of:
- **Usage metrics** with a named source and date: volume, TVL, fees/revenue, DAU/MAU, transactions, downloads (DefiLlama, Dune, Token Terminal, Artemis, app stores, official dashboards, x402scan, etc.)
- **Credible funding** (named lead investor, amount, date) **plus** a live product
- **Real developer adoption** (GitHub stars/forks and recent commits, npm downloads, integrations by other teams)

**Reject as slop:** token-price hype without usage, hackathon demos, "AI wrapper" apps without users, vaporware, pure memecoins, anything whose only evidence is its own marketing. Rejected items go in a **Rejected** section with the reason.

Mark anything not directly confirmed as **(unverified)**. Never invent numbers. Every number has a source URL and date.

## Per-candidate schema
```
### <Product> (<chain / platform>)
- What it does (1–2 lines):
- Traction: <metric> = <value> (<source URL>, <date>)
- Why it's working (mechanism, not adjectives):
- Open source?: <repo URL + license> / closed
- On Monad already?: yes (<link>) / no / partial (unverified)
- Metropolis fit: Track 0X, matching official idea "<quote from 01-tracks/…>" if any
- Monad angle: what Monad's ~300 ms blocks / cheap gas / P256 / ERC-8004 would change (only if real)
- Risks / why it might not port:
```

## Official track context
Read `../01-tracks/*.md` (official ideas + judging) and `../00-hackathon/overview.md` (rules). Judging weights on track pages: Founder & Market Readiness 25%, Technical 20%, Design 20%, Traction 20%, Originality 15%.
Rules §4.1: pre-existing code is allowed only if identified in the README and the majority of work is new. Adapting a *design* is fine; forking code must be disclosed.

## Files
| File | Direction |
|---|---|
| `trend-radar.md` | Cross-chain narratives right now, ranked by hard metrics |
| `solana-hyperliquid.md` | Breakout products on Solana and Hyperliquid |
| `evm-l2s-and-payment-chains.md` | Base, Arbitrum, BNB, Ethereum L1, Stripe Tempo / Plasma / Stable and other payment chains |
| `consumer-social-and-web2.md` | Telegram/TON, Farcaster, Zora, Sui, and Web2 consumer fintech/social |
| `ai-agents-tools-and-demand.md` | What tools agents call most + what users want agents to do |
| `deep-dive-rwa-perps.md` | Equity/commodity/FX/pre-IPO perps: market, designs, Monad oracles, routes past each obstacle |
| `deep-dive-collectibles.md` | Tokenized graded cards: pack vs secondary economics, vault/inventory-as-a-service (Collector Crypt partner API, contract already on Monad), Oripa traction, order book/lending/rental fit, routes past each obstacle |
| `deep-dive-stablecoin-cards.md` | Stablecoin cards and neobanks: spend and revenue, borrow-to-spend mechanics, issuers (Rain live on Monad since May 2026), authorisation timing vs Monad finality, routes past each obstacle |
| `monad-gap-check.md` | Is each shortlisted product already on Monad? |
| `SHORTLIST.md` | Final synthesis: candidates ranked with evidence |

# Track and bounty fit: strict check

> Checked 2026-09-29 against the **official portal text** (`_portal/api/catalog.json`, `_portal/pages/rules.md`). Every verdict quotes the requirement it's based on. A bounty is listed as a fit **only if our product naturally meets its requirements**, not merely because it's open to our track.

**Our product (as discussed):** a mobile app (iOS + Android). Sign-in **and** transaction confirmation with Face ID passkeys (Mera). One collateral vault. **Trading of real-world markets (gold, stocks, FX perps) is the core**, and a card spends the collateral that trading hasn't committed. No Privy, no Dynamic (the team's choice).

## Tracks (official "Belongs here if…")
| Track | Official text | Our product |
|---|---|---|
| 01 Onchain Finance & Trading | *"the core output is a financial instrument, market, asset primitive, or trading experience — and the primary user is a trader, protocol, or financial product builder."* | ✅ **Fits.** Core output = a trading experience and markets; primary user = a trader |
| 02 Consumer Products & Payments | *"the primary user is a consumer… and the core value is a financial experience, **not a trading or market-making product**."* | ❌ **Excluded while trading is the core.** Fits only if the card is the core and trading is removed or minor |
| 03 Social, Attention & Culture | *"the core user value is social connection, cultural participation, or community"* | ❌ Our core value isn't social |
| 04 Trust, Identity & AI Infrastructure | *"the primary output is a protocol, primitive, or infrastructure layer that other applications build on — **not a standalone consumer product**."* | ❌ We're a standalone app |

Rules §2.5: *"Each submission must compete in only one track."* The Tracks page: bounties tied to a track *"pair"* only with that track; "All tracks" bounties pair with any.

## Bounties that FIT (Track 01, trading-first)
| Bounty | Official requirement (quoted) | Our fit |
|---|---|---|
| **Agora: Best Mobile Trading App** ($10,000, Track 01) | *"must build a mobile application that authenticates users via Mera…, holds and displays a stablecoin balance in AUSD, and executes trades through Perpl."* Demo: *"placing at least one trade on Perpl."* | ✅ Mobile ✅, Mera ✅, AUSD ✅. **Condition:** Perpl lists crypto perps only (BTC, ETH, SOL, MON, HYPE, ZEC), so the app must also offer **crypto perps routed through Perpl** alongside our gold/stock markets |
| **Monad Foundation: Best Mera-Powered UX** ($2,500, All tracks) | *"Mera is the entire account layer. No seed phrase. No wallet extension. No custody backend."* Plus *"one-prompt onboarding"*, *"prompt-free signing via Mera signing sessions with a clearly scoped session"*, and the *"stateless test"*: identity must rebuild from the passkey on a fresh device | ✅ This is exactly our Face ID plan. Design decision: which actions are prompt-free inside a session and which ask for Face ID again |
| **Aurora Intents: Bring Any-Chain Liquidity** ($5,000, All tracks) | *"Deposit & execute in one flow… open a position the moment funds land"*; *"demoed live — not mocked"* | ✅ Solves a real problem: funding the vault from any of 31+ chains. **Condition:** on Monad, Aurora supports MON, USDC and USDT0, not AUSD (our earlier research), so deposits arrive as USDC and the vault must accept USDC |
| **Envio: Best Use of Envio** ($1,000, All tracks) | *"meaningfully use… HyperIndex… actually driving a feature"*; judged on *"non-trivial schema design, derived/aggregated entities"* | ✅ The app needs an indexer anyway (positions, fills, funding, liquidations, card holds). That is a non-trivial schema |

**Total if all four are won: $18,500.** On top of the Track 01 prize ($10,000 per top-3 place).

## Bounties that DON'T fit (removed, with the reason)
| Bounty | Why it doesn't fit our product |
|---|---|
| Kuru: Consumer Trading App ($5K) | Requires *"a focused **spot** trading product"* through Kuru. We trade perps |
| Kuru: New Assets and Markets ($5K) | Markets must be *"on Kuru using its **spot** order book"*. Our markets run on our own perp engine |
| Perpl: Best use of Perpl's API ($5K) | Requires *"a production-ready trading **bot or automation system**"*, not an app |
| Perpl: Analytics / Risk Tool ($3K) | Requires *"a… **dashboard**… focused on Perpl"* |
| MetaMask: Agent Wallet Plugin ($2.5K) | Requires *"a **plugin**… for the MetaMask Agent Wallet"* |
| Mera: One Passkey, Many Keys ($2.5K) | Requires a use that *"is **NOT** signing blockchain transactions from a wallet account"*. We have no genuine non-wallet need for it |
| Chainlink: Best workflow with CRE ($3K) | Requires a **CRE workflow** as an *"orchestration layer"*. Using Chainlink **price feeds** is a different product and doesn't qualify |
| Nansen ($5K) | Requires Nansen wallet intelligence *"as part of a core product feature"*. Not our core |
| Privy ($5K), Dynamic ($5K) | We use Mera for accounts (team choice) |
| Kimi, Qwen, Hunyuan (credits) | Require an AI model to power a core feature. We have no AI feature. Qwen is also Track 04 only, Hunyuan Track 03 only |
| Alchemy ($1K credits) | Only fits if we pick Alchemy as a provider anyway. It isn't a real product feature, so it's not counted |
| Cleanverse ($2K) | Track 04 only |
| Agora: Cross-Border Payments ($10K) | Track 02 only |

## Depends on the team, not the product
| Bounty | Condition |
|---|---|
| Monad Foundation: Best Community Team Project ($5K, All tracks) | *"Team must indicate their campus group… Community must be on the list of onboarded groups."* Only if a team member belongs to one of the listed community partners |

## If the card were the core instead (Track 02)
Track 02 would require trading **not** to be the core value. The fitting bounties would be **Agora Cross-Border** ($10K; requires *"send AUSD to another person or across borders"* with Mera onboarding, so a send-money feature must exist), plus the same All-tracks trio: Mera UX, Aurora and Envio. **Agora Mobile Trading would be lost**, because it's Track 01 only.

# Track 02: Consumer Products & Payments

> **Source of truth:** the logged-in portal (`_portal/api/catalog.json`, captured 2026-09-29). Everything above **Our analysis** is copied verbatim. Page capture: [../_portal/tracks/consumer-payments.md](../_portal/tracks/consumer-payments.md)

**Prize:** $30,000 USD (Split evenly among 3 winners - $10,000 each)

**Summary:** Consumer-facing financial products that use onchain rails as a design advantage, for users who don't identify as crypto users.

## What this track is for (official)
The infrastructure for onchain consumer finance has quietly crossed a threshold — near-instant settlement, gasless accounts, programmable money that can respond to behaviour in real time. This track is for builders who want to close the gap between what those rails make possible and what people can actually use. The products that make crypto feel obvious to someone who never wanted to think about blockchains are still largely unbuilt.

Core question: What does a financial product look like when onchain rails are leveraged as an advantage to design?

Belongs here if: the primary user is a consumer — someone who may not identify as a crypto user — and the core value is a financial experience, not a trading or market-making product.

## Judging criteria (official, from this track's page)
- Technical Execution (20%) — do the payment/behavioral mechanics actually execute onchain with real conditional logic and settlement, not simulated?
- Design & Craft (20%) — would a non-crypto user complete the core flow without confusion or help? This track's central bar is an invisible blockchain — judge harshly on any point of friction that reveals "this is crypto."
- Originality & Track Insight (15%) — is this a genuinely new consumer financial experience enabled by onchain rails, or a wallet/payments app with new branding?
- Founder & Market Readiness (25%) — is there a specific, named consumer segment this serves, and does the team show real understanding of that user's behavior or pain point — not just "everyone needs payments"?
- Traction & Path Forward (20%) — evidence of user testing (even five friends trying it), and a concrete distribution plan — how would the next 100 users actually find this?

> ⚠️ The **official rules** (`_portal/pages/rules.md` §5.2) give a *different* main-track rubric: Product Quality & Completeness, Technical Excellence, Monad Integration, Track Fit & Problem Relevance, Innovation & Impact (20% each). Plan for both; ask organizers which one applies.

## Deliverables (official)
- Project Logo/Graphic: uploaded in JPG, JPEG, PNG, or WEBP format (maximum size 3MB)
- Public GitHub Repository: fully accessible by metropolis@hackathon.monad.xyz
- Technical Demo Video: maximum 3 minutes, via YouTube, Loom, or Vimeo — must show the live working product, not slides or a code walkthrough
- Pitch Video: maximum 2 minutes, introducing the team, the problem being solved, and why you're building it
- Live Product Link: deployed on Monad Mainnet or Testnet, accompanied by clear access instructions and any necessary test login credentials for judges
- Product Advertisement (Optional): maximum 30 seconds, via YouTube, Loom, or Vimeo — a short, punchy promotional clip of the product. Not factored into judging; used for post-event social promotion and marketing

## Suggested ideas (official, all 8)
01. Payments embedded in social gestures — splitting a bill, sending a gift, tipping a creator — where the financial action feels like a message, not a transaction
02. Commitment contracts that put real money behind behavioural goals — reduce screen time, hit a step count, quit a habit — verified automatically by device-native signals, with stakes redistributed to those who follow through
03. Accountability pools where groups collectively commit to a shared goal: those who fail fund the rewards of those who succeed
04. Income share agreements as a consumer product — fund a friend's course, career move, or creative project in exchange for a programmatic share of future earnings, settled automatically onstream
05. Programmable gifts that unlock on conditions — "here's $500 when you graduate", "here's your share when the company exits" — financial commitments that execute automatically without anyone having to remember or chase
06. Salary streaming at the individual level — get paid every second rather than bi-weekly, with idle balances earning yield in the background until you spend them
07. Micro-insurance that turns on and off by the minute — cover your laptop for the next three hours, insure a specific journey, pay only for the moments of actual exposure
08. Savings products where your yield rate is gated by behavioural goals you set and your social graph verifies

## Bounties tied to this track (official)
The Tracks & Bounties page says: *"Each one names its track, and the ones marked All tracks pair with any."* These are only open to projects entered in this track:

| Sponsor | Bounty | Prize | Split | What it asks for (verbatim summary) | Full text |
|---|---|---|---|---|---|
| Agora | Best Cross-Border Payments App on Monad (Agora Payments Bounty) | $10,000 USD | $10,000 USD — single prize | Build a mobile app letting users send AUSD across borders using Mera passkey onboarding and instant settlement. | [open](../_portal/bounties/agora-best-cross-border-payments-app-on-monad-agora-payments-bount.md) |

Plus the **12 All-tracks bounties**, which pair with any track. See [../00-hackathon/prizes-and-bounties.md](../00-hackathon/prizes-and-bounties.md).

---

## Our analysis (not official; each claim cites its source)

### What the judges score (track page rubric)
*"This track's central bar is an invisible blockchain — judge harshly on any point of friction that reveals 'this is crypto.'"* Founder & Market Readiness is 25%: name a specific consumer segment. Traction: *"even five friends trying it"* plus *"how would the next 100 users actually find this?"*

### Bounty combinations that are valid for Track 02
| Build | Bounties it can claim | Watch out |
|---|---|---|
| Cross-border payments app | **Agora Cross-Border $10K** (Track 02 only; *"mobile app letting users send AUSD across borders using **Mera passkey onboarding** and instant settlement"*; judged on implementation, real-world usability, business viability) + Mera UX $2.5K + Aurora $5K (any-chain deposits) | Must be **mobile**, use **Mera** and **AUSD**. Our research found 7+ public competitor repos in remittance ([ecosystem-map](../05-ecosystem/ecosystem-map.md), unverified count) |
| Any consumer money app | Privy $5K (*"login-only integrations will not qualify"*) **or** Dynamic $5K (needs a ≤3-min demo link of the Dynamic flow) + Mera ×2 ($2.5K each) + Aurora $5K + Envio $1K + Alchemy credits | Privy and Dynamic both require going beyond basic login |

**Note:** Agora **Mobile Trading** ($10K) is **Track 01 only**. It's not available in Track 02.

### Mapping the official ideas to tools
| Official idea | Monad building blocks (see sponsor files) |
|---|---|
| Salary streaming / pay every second | Sablier is deployed on Monad mainnet: [../03-sponsors/wallets-payments/payment-patterns.md](../03-sponsors/wallets-payments/payment-patterns.md) |
| Payments as social gestures, programmable gifts | AUSD (gasless ERC-3009 transfers) + passkey login (Mera/Privy) + gas sponsorship |
| Commitment contracts / accountability pools | Escrow contracts + an attestation/oracle source; Chainlink CRE ($3K) could run the verification workflow |
| Micro-insurance by the minute | Per-second accounting is cheap on Monad; needs an oracle for the insured event |
| ISAs, behaviour-gated savings | Streaming + conditional payout contracts |

### Monad traps for consumer UX
- EIP-7702-delegated accounts can't drop below **10 MON**, so hold user balances in stablecoins ([../02-monad/differences-from-ethereum.md](../02-monad/differences-from-ethereum.md)).
- Show success at the fast confirmation state and settle at finalized ([../02-monad/architecture-for-builders.md](../02-monad/architecture-for-builders.md)).

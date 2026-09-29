# Track 04: Trust, Identity & AI Infrastructure

> **Source of truth:** the logged-in portal (`_portal/api/catalog.json`, captured 2026-09-29). Everything above **Our analysis** is copied verbatim. Page capture: [../_portal/tracks/trust-identity-ai.md](../_portal/tracks/trust-identity-ai.md)

**Prize:** $30,000 USD (Split evenly among 3 winners - $10,000 each)

**Summary:** Protocol-level primitives for trust, provenance, and user-owned data that make AI genuinely useful without any single platform capturing the value.

## What this track is for (official)
AI has shifted the default assumptions the internet runs on — about identity, provenance, and what's real. At the same time, the personal context that makes AI genuinely useful tends to accumulate in platforms people don't own. This track is for builders working on the trust and data ownership layer: the primitives that need to exist at the protocol level for the rest of it to work. Monad provides specific building blocks — a native P256 precompile for WebAuthn verification, ERC-8004 as a first-class trustless agent registry, and BTX encrypted mempools — that make this space more tractable than it's been elsewhere.

Core question: What does the trust and data ownership layer look like for an AI-native internet — built in a way that is privacy-preserving, composable, and impossible for any single platform to capture?

Belongs here if: the primary output is a protocol, primitive, or infrastructure layer that other applications build on — not a standalone consumer product.

## Judging criteria (official, from this track's page)
- Technical Execution (20%) — is the trust/identity/data primitive implemented correctly and securely — correct use of WebAuthn/P256, sound key derivation, no leaked secrets?
- Design & Craft (20%) — is the primitive usable by the developers who'd build on it — clear docs, clean interface or API — even without an end-user-facing UI? Design here means developer experience, not just visuals.
- Originality & Track Insight (15%) — does this solve trust, provenance, or data ownership in a way that's privacy-preserving and not capturable by a single platform, or does it just centralize the problem differently?
- Founder & Market Readiness (25%) — does the team know which specific applications or developers would adopt this primitive, and why they'd choose it over rolling their own?
- Traction & Path Forward (20%) — any evidence of developer interest (even one other team integrating it during the hackathon), and a specific plan to get more integrations post-event.

> ⚠️ The **official rules** (`_portal/pages/rules.md` §5.2) give a *different* main-track rubric: Product Quality & Completeness, Technical Excellence, Monad Integration, Track Fit & Problem Relevance, Innovation & Impact (20% each). Plan for both; ask organizers which one applies.

## Deliverables (official)
- Project Logo/Graphic: uploaded in JPG, JPEG, PNG, or WEBP format (maximum size 3MB)
- Public GitHub Repository: fully accessible by metropolis@hackathon.monad.xyz
- Technical Demo Video: maximum 3 minutes, via YouTube, Loom, or Vimeo — must show the live working product, not slides or a code walkthrough
- Pitch Video: maximum 2 minutes, introducing the team, the problem being solved, and why you're building it
- Live Product Link: deployed on Monad Mainnet or Testnet, accompanied by clear access instructions and any necessary test login credentials for judges
- Product Advertisement (Optional): maximum 30 seconds, via YouTube, Loom, or Vimeo — a short, punchy promotional clip of the product. Not factored into judging; used for post-event social promotion and marketing

## Suggested ideas (official, all 7)
01. Mobile-native proof of personhood using WebAuthn/P256 — no invasive biometrics, no centralised issuer, verified in a single tap on existing hardware
02. Content passports: every AI-generated asset carries a cryptographic certificate of origin and a tamper-evident audit trail that survives platform migration
03. A personal data locker that earns revenue when AI companies query your interaction history — you set the price, they pay per call
04. Cross-application AI memory: a user-owned context layer that persists across products so your AI assistant isn't amnesiac every time you switch apps
05. A marketplace where domain experts license their decision-making patterns to train specialised models — compensated per training run, not per data upload
06. Onchain credential attestations for real-world skills that any application can verify without a centralised middleman
07. Decentralised data labelling networks for physical AI — contributors earn stablecoin rewards for annotating robotics and sensor data, with onchain micropayments making global participation practical at scale

## Bounties tied to this track (official)
The Tracks & Bounties page says: *"Each one names its track, and the ones marked All tracks pair with any."* These are only open to projects entered in this track:

| Sponsor | Bounty | Prize | Split | What it asks for (verbatim summary) | Full text |
|---|---|---|---|---|---|
| Cleanverse | Best Integration of Cleanverse Verified Identity & Assets | $2,000 USD | $2,000 USD cash — single prize | Build an app that gates CVA asset movement behind on-chain CVI identity verification. | [open](../_portal/bounties/cleanverse-best-integration-of-cleanverse-verified-identity-assets.md) |
| Alibaba Cloud | Best Builds with Qwen 3.8 Max | $5,000 in credits | $5,000 in credits split across the top 3 Track 4 winners. | Push Qwen 3.8 Max into genuinely agentic territory on Monad. | [open](../_portal/bounties/alibaba-cloud-best-builds-with-qwen-3-8-max.md) |

Plus the **12 All-tracks bounties**, which pair with any track. See [../00-hackathon/prizes-and-bounties.md](../00-hackathon/prizes-and-bounties.md).

---

## Our analysis (not official; each claim cites its source)

### Important: this track wants infrastructure, not an app
*"Belongs here if: the primary output is a protocol, primitive, or infrastructure layer that other applications build on — not a standalone consumer product."* Design is judged as **developer experience** (docs, clean API). Traction means *"even one other team integrating it during the hackathon."* Consider recruiting another Metropolis team to integrate your primitive.

### Building blocks the track names, and what we verified
| Named in track text | Status | Where |
|---|---|---|
| Native **P256 precompile** for WebAuthn | At `0x0100`, 6,900 gas (Monad docs) | [../04-standards/passkeys-p256-webauthn.md](../04-standards/passkeys-p256-webauthn.md) |
| **ERC-8004** trustless agent registry | Identity + Reputation registries deployed on Monad mainnet (addresses verified live by our research agent); no Validation Registry found | [../04-standards/erc-8004-trustless-agents.md](../04-standards/erc-8004-trustless-agents.md) |
| **BTX encrypted mempools** | **Not researched yet.** It appears only in the portal text; we have no docs on it | To do |
| Mera (passkey → keys) | `@category-labs/mera` v0.2.0, open source | [../02-monad/mera.md](../02-monad/mera.md) |

### Bounties valid for Track 04
| Bounty | Key requirement (official) |
|---|---|
| **Cleanverse $2K** (Track 04 only) | Gate CVA asset movement behind onchain CVI identity. *"Identity verification is structurally coupled to asset movement, not added as an optional layer"* |
| **Qwen 3.8 Max $5K credits** (Track 04 only) | Credits **split across the top 3 Track 4 winners**, so you must place in the track to get them. Needs *"real agentic use"*: planning, tool use, multi-step |
| **Mera: One Passkey, Many Keys $2.5K** (All-tracks) | *"The further from 'passkey wallet,' the better."* Must pass the **cross-device test** live. Ideas include *AI agent memory encrypted to the user's passkey*, which lines up with the track's "cross-application AI memory" idea |
| **Mera-Powered UX $2.5K** (All-tracks) | Time-to-first-transaction, session design, the "stateless test" |
| Other All-tracks | Privy/Dynamic, Aurora, Envio, Nansen, Kimi, Chainlink CRE, Alchemy, Perpl API, Community |

**Note:** the MetaMask Agent Wallet bounty is **Track 01 only**, even though it mentions x402 and ERC-8004.

### Where official ideas and research overlap
- **User-owned AI memory encrypted to a passkey:** hits official idea 04 + the Mera "Many Keys" bounty + Qwen/Kimi if the agent uses them.
- **Mobile proof of personhood with WebAuthn/P256:** official idea 01, built on the P256 precompile.
- **Content passports for AI media:** official idea 02. Our research found no Monad project doing media provenance ([../04-standards/media-provenance.md](../04-standards/media-provenance.md)).
- Crowded: our research counted 10+ public repos building ERC-8004 agent identity or reputation (unverified count). Note that ERC-8004 reputation **isn't one of the 7 official ideas** here.

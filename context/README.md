# Metropolis Hackathon: Context Base

> ✅ **Portal captured 2026-09-29** (logged-in hackathon.monad.xyz, via Codex): [_portal/INDEX.md](_portal/INDEX.md). The hackathon rules, tracks, bounties and dates in `00-hackathon/` and `01-tracks/` now come from the portal. Research files in `02-05` were written before the capture and may be out of date on bounty specifics; **where they differ, `_portal/` wins.** Differences found: [_portal/DIFF.md](_portal/DIFF.md).

Knowledge base for **Monad's Metropolis hackathon** (1 Sep – 13 Oct 2026, $250K+, 4 tracks). Built 2026-09-28 from official sites, docs, GitHub, and Context7 + Firecrawl research. Facts not confirmed are marked **(unverified)**; every file lists its sources at the bottom.

## Start here
1. [00-hackathon/overview.md](00-hackathon/overview.md): what it is, rules, what judges want
2. [01-tracks/README.md](01-tracks/README.md): the 4 tracks side by side, then open your track file
3. [00-hackathon/prizes-and-bounties.md](00-hackathon/prizes-and-bounties.md): every prize and bounty, and how to stack them
4. [02-monad/differences-from-ethereum.md](02-monad/differences-from-ethereum.md): read before writing any contract

## Where to look for…
| I need… | Go to |
|---|---|
| Dates, deadline, submission checklist, city events | [00-hackathon/timeline-and-submission.md](00-hackathon/timeline-and-submission.md) |
| Judges, and which mentor to ask about what | [00-hackathon/judges-and-mentors.md](00-hackathon/judges-and-mentors.md) · [05-ecosystem/judges-theses.md](05-ecosystem/judges-theses.md) |
| Track deep dives (ideas, whitespace, tools, gotchas) | [01-tracks/](01-tracks/): `onchain-finance` · `consumer-payments` · `social-culture` · `trust-identity-ai` |
| RPCs, chain IDs, explorers, faucet | [02-monad/network-and-endpoints.md](02-monad/network-and-endpoints.md) |
| Deploy/verify with Foundry, Hardhat, viem, wagmi | [02-monad/dev-quickstart.md](02-monad/dev-quickstart.md) |
| Token and contract addresses (WMON, USDC, AUSD…) | [02-monad/contracts-and-tokens.md](02-monad/contracts-and-tokens.md) |
| How Monad works (async exec, finality states) | [02-monad/architecture-for-builders.md](02-monad/architecture-for-builders.md) |
| WebSockets, events, indexing | [02-monad/realtime-data-and-indexing.md](02-monad/realtime-data-and-indexing.md) |
| Mera (Monad passkey library, 2 bounties) | [02-monad/mera.md](02-monad/mera.md) |
| Monad MCP / AI dev tooling | [02-monad/ai-and-dev-tooling.md](02-monad/ai-and-dev-tooling.md) |
| Trading/DeFi sponsors: Kuru, Perpl, Agora, Aurora, Chainlink, Nansen, oracles | [03-sponsors/finance-trading/](03-sponsors/finance-trading/README.md) |
| Wallets/payments: Privy, Dynamic, MetaMask, Mercuryo, Zerion, Cleanverse, AA | [03-sponsors/wallets-payments/](03-sponsors/wallets-payments/README.md) |
| Infra: Envio, Alchemy, QuickNode, RPCs, Tenderly, ack3 security | [03-sponsors/infra-data/](03-sponsors/infra-data/README.md) |
| AI models (Kimi, Qwen, Hunyuan) and agent frameworks | [03-sponsors/ai-models/](03-sponsors/ai-models/README.md) |
| ERC-8004, passkeys/P256, x402, media provenance, identity | [04-standards/](04-standards/README.md) |
| What already exists on Monad; gaps per track | [05-ecosystem/ecosystem-map.md](05-ecosystem/ecosystem-map.md) |
| Past Monad hackathon winners | [05-ecosystem/past-winners.md](05-ecosystem/past-winners.md) |
| Extra official details (rules, events, announcements) | [05-ecosystem/official-announcements.md](05-ecosystem/official-announcements.md) |
| Idea research: proven products to adapt (shortlist, evidence) | [06-research/SHORTLIST.md](06-research/SHORTLIST.md) |
| Raw scrapes (official page, llms.txt) | [_sources/](_sources/) |

## The 10 facts that matter most (portal-verified unless marked)
1. ⚠️ **Registration and team formation close 6 Oct, 23:59 UTC.** Submissions open 2 Oct. **Deadline: 13 Oct 11:59 PM ET = 14 Oct 03:59 UTC**, no late entries.
2. **Must be open source, in a public GitHub repo** (MIT/Apache/GPL), accessible to `metropolis@hackathon.monad.xyz`, with a commit history covering the build window. **Disclose AI coding tools** in the README.
3. **Deliverables:** live product on Monad mainnet or testnet, **tech demo ≤3 min** (live product, no slides), **pitch video ≤2 min**, logo, docs.
4. **Teams of 1–5; one project per person; one track per project.** Age 18+; sanctioned jurisdictions excluded; prizes are paid in USDC and **KYC may be required**.
5. **Tracks:** $30K each ($10K × top 3), plus a $25K grand champion. Track-page rubric: **Founder & Market Readiness 25%**, Technical 20, Design 20, Traction 20, Originality 15. ⚠️ The rules show a different 5×20% rubric.
6. **21 sponsor bounties** (≈$87.5K incl. credits). **12 pair with any track**; the rest are **track-locked** (e.g. Agora Mobile, Kuru, MetaMask → Track 01 only). See [00-hackathon/prizes-and-bounties.md](00-hackathon/prizes-and-bounties.md).
7. **Perks:** QuickNode `METROPOLISQN` (new accounts), Zerion `METROPOLIS100`, Tenderly via the Monad form.
8. **Monad:** chain 143 / testnet 10143; **~300 ms blocks measured live on 29 Sep** (the track text's "400ms" is outdated); gas is charged on the **gas limit**; 10 MON reserve balance; ~100-block `eth_getLogs` on public RPC.
9. **Track 04 wants infrastructure** (protocols/primitives other apps build on), not a consumer app.
10. ⚠️ **Judging and winner dates conflict** (rules: 27 Oct / 3 Nov; dashboard: 3 Nov / 4 Nov). Ask organizers.

## Known gaps
- The **submission form** stays locked until a project is created, so re-check its fields afterwards.
- **BTX encrypted mempools** (named in Track 04) haven't been researched yet.
- Rubric and date conflicts inside the portal need an organizer answer (ask in Support or Discord).
- Sponsor/tool files in `02-05` came from public docs; competitor counts and judge theses are unverified.

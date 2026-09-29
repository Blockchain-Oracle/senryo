# Finance & Trading sponsors: index

> ⚠️ **Bounty details here were researched before the portal was captured.** For official bounty requirements, eligible tracks, prize splits and judging criteria, use [prizes-and-bounties.md](../../00-hackathon/prizes-and-bounties.md) and the full texts in `_portal/bounties/`. Where they differ, **the portal wins**. Known corrections: Agora Mobile requires **Mera + AUSD + Perpl** and is **Track 01 only**; Agora Cross-Border requires **Mera + AUSD, mobile**, and is **Track 02 only**; Kuru ×2, Perpl Analytics and MetaMask Agent Wallet are **Track 01 only**; Hunyuan is **Track 03 only**; Cleanverse and Qwen are **Track 04 only** (Qwen credits go to the top 3 Track 4 winners).


Metropolis (Monad): build window 1 Sep–13 Oct 2026, judging 14–27 Oct, winners 3 Nov. Submission = working product + public project profile (demo, short write-up, code link). Bounties are paid on top of track prizes ($30K per track, $25K grand champion). Full bounty rubrics sit behind login at hackathon.monad.xyz. This folder uses public docs and sponsor X posts. Research date: 2026-09-28.

Total in this area: **$51,000** across 9 bounties (Kuru $10K, Perpl $8K, Agora $20K, Aurora $5K, Chainlink $3K, Nansen $5K).

| Sponsor | Bounty | $ | What to build (one line) | Key doc |
|---|---|---|---|---|
| Kuru | Build the Next Consumer Trading App on Kuru | 5,000 | Consumer trading app that routes orders through Kuru's onchain CLOB (TS SDK / Flow API / WS), not just the aggregator | https://docs.kuru.io/llms-full.txt |
| Kuru | Bring New Assets and Markets to Kuru | 5,000 | Infra that lists new asset classes (cross-chain, RWA/FX, LST, pre-market) with bootstrapped liquidity (Router.deployMarket, Backstop AMM, flip orders) | https://docs.kuru.io/sdk/deploy-market |
| Perpl | Best use of Perpl's API | 5,000 | Terminal, mobile app, bot or agent trading via REST+WS (Ed25519 API keys), attributed with a builder code | https://docs.perpl.xyz/resources/for-developers/overview.md |
| Perpl | Best Analytics / Risk Tool | 3,000 | Isolated-margin liquidation radar, oracle/funding observatory, portfolio stress test | https://docs.perpl.xyz/llms.txt |
| Agora | Best Mobile Trading App on Monad | 10,000 | Native mobile app with AUSD as cash: Kuru spot + Perpl perps, embedded wallet | https://docs.agora.finance/llms.txt |
| Agora | Best Cross-Border Payments App on Monad | 10,000 | AUSD remittance/payroll/merchant app: gasless ERC-3009, any-chain funding via Aurora, FX feeds | https://docs.agora.finance/developer/contract-deployments.md |
| Aurora Intents | Bring Any-Chain Liquidity to Monad | 5,000 (split 3 ways) | Swap API, Intents Deposits or (best) Intents Connect: one signature from any chain into an action on Monad | https://docs.intents.aurora.dev/llms.txt |
| Chainlink | Best workflow with CRE | 3,000 | CRE TS/Go workflow (cron/HTTP/log trigger → HTTP with consensus → signed report → Monad consumer) | https://docs.chain.link/cre/llms.txt |
| Nansen AI | Best use of Nansen | 5,000 (2K/1.5K/1K/500) | Product driven by Nansen API/MCP/CLI data on `monad` (credit scores, copy-trading, x402-paying agent) | https://docs.nansen.ai/llms.txt |

Files: [kuru.md](kuru.md) · [perpl.md](perpl.md) · [agora-ausd.md](agora-ausd.md) · [aurora-intents.md](aurora-intents.md) · [chainlink-cre.md](chainlink-cre.md) · [nansen.md](nansen.md) · [pyth-and-oracles.md](pyth-and-oracles.md) · [monad-defi-primitives.md](monad-defi-primitives.md)

## Shared building blocks
- AUSD `0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a` (6 dec) is Perpl's collateral, a quote asset on Kuru (MON-AUSD `0x131a2e70a5b31a517a74b8c567149bc294470da9`), and has Chainlink + Pyth feeds. One AUSD-denominated app can touch 3–4 sponsors.
- Monad mainnet chain 143, RPC `https://rpc.monad.xyz`. Testnet 10143, `https://testnet-rpc.monad.xyz`, testnet AUSD `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` (faucet `0xd236c18D274E54FAccC3dd9DDA4b27965a73ee6C`, `requestFunds(address)`).
- Any-chain entry: Aurora Intents only supports **MON, USDC, USDT0** on Monad, so enter as USDC and swap to AUSD on Kuru or Uniswap.
- Prices: Chainlink push feeds, Data Streams and SVR; Pyth pull plus sponsored push. Perpl's own spot index uses Chainlink Data Streams.

## Stacking strategy (one build, several bounties)
| Concept | Bounties hit |
|---|---|
| **AUSD mobile trading app**: Kuru spot + Perpl perps (builder code) + Nansen smart-money feed + Aurora one-tap funding from any chain | Agora mobile (10K), Kuru #1 (5K), Perpl API (5K), Nansen (5K), Aurora (5K) + Finance track |
| **Credit-scored lending**: Nansen PnL, labels and counterparties go into a CRE workflow (Confidential HTTP) that writes a signed score on Monad; a Morpho market or custom pool sets LTV | Chainlink CRE (3K), Nansen (5K) + track example "undercollateralised lending" |
| **Any-chain remittance in AUSD**: persistent Intents Deposit address per user, USDC swapped to AUSD, gasless ERC-3009 payout, Chainlink FX quotes | Agora cross-border (10K), Aurora (5K) + Consumer/Payments track |
| **Oracle-anchored new markets**: a CRE cron reads Chainlink FX/XAU and writes flip-order ladders for new Kuru markets | Kuru #2 (5K), Chainlink CRE (3K) |
| **Perpl risk radar**: onchain state rebuild, liquidation heatmap, per-block funding simulator | Perpl analytics (3K) + track example "funding that updates every block" |
Check each bounty's rules on the platform for any limits on submitting one project to several bounties or both Perpl categories (unverified; a Perpl follower asked and got no public answer).

## Key people (mentors/judges)
Kuru: Vaibhav (CEO). Perpl: PBJ (co-founder, **judge**), gvan (growth). Agora: Nick van Eck (CEO), Drake Evans (CTO). Aurora: Armand Didier, Chris Gutkowski (mentor+judge). Chainlink: Darb (DevRel). Nansen: Alex Svanevik (CEO, **main judge**), Hurcan Polat (API/CLI growth).

## Open questions to ask sponsors
- Agora: sandbox access to Public API routes / Instant Settlement whitelist for hackathon teams? Must the app be native mobile or is a PWA acceptable?
- Kuru: are the new v2 contracts (`@toxicflow-labs/ts-sdk`, relay.testnet.kuru.io) in scope or preferred? Is a Flow API key available?
- Perpl: builder-code registration for hackathon teams; can one project enter both categories?
- Chainlink: is deploy access granted for Metropolis teams, or is simulation plus `--broadcast` enough?
- Aurora: does direct 1Click usage count, or must it go through intents-api.aurora.dev / Intents Connect?

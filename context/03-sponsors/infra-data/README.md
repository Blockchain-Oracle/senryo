# Infra, RPC, Indexing, Dev Tooling & Security Sponsors — Metropolis (Monad)

> ⚠️ **Bounty details here were researched before the portal was captured.** For official bounty requirements, eligible tracks, prize splits and judging criteria, use [prizes-and-bounties.md](../../00-hackathon/prizes-and-bounties.md) and the full texts in `_portal/bounties/`. Where they differ, **the portal wins**. Known corrections: Agora Mobile requires **Mera + AUSD + Perpl** and is **Track 01 only**; Agora Cross-Border requires **Mera + AUSD, mobile**, and is **Track 02 only**; Kuru ×2, Perpl Analytics and MetaMask Agent Wallet are **Track 01 only**; Hunyuan is **Track 03 only**; Cleanverse and Qwen are **Track 04 only** (Qwen credits go to the top 3 Track 4 winners).


> Knowledge base for Monad Metropolis (build window 1 Sep–13 Oct 2026; judging 14–27 Oct; winners 3 Nov). Researched 2026-09-28 from official docs and llms.txt files. Items marked **(unverified)** could not be confirmed from a primary source. **Perk claim mechanics are not public**: the hackathon site says details are "listed in full on the platform". Check the Metropolis application platform and the Monad Dev Discord (https://discord.gg/monaddev) first.

## Files

| File | Covers |
|---|---|
| [envio.md](envio.md) | HyperIndex V3 (config/schema/handlers for a Monad contract), HyperSync, HyperRPC, Envio Cloud, bounty ideas |
| [alchemy.md](alchemy.md) | Monad RPC, `monadNewHeads`/`monadLogs`, Wallet APIs (ex-Account Kit) + Gas Manager, Webhooks |
| [quicknode.md](quicknode.md) | Monad RPC + Debug, Streams (filter code), Webhooks, MCP, plan limits |
| [rpc-providers.md](rpc-providers.md) | Chainstack, Crouton Digital, Spectrum Nodes, Dwellir + public endpoints, limits, failover setup |
| [tenderly.md](tenderly.md) | Simulation (`tenderly_simulateTransaction`), Virtual Environments, Foundry verify, Alerts, Monad Node RPC |
| [ack3-security.md](ack3-security.md) | ack3 AI scan perk, Wake detectors/fuzzing, security checklist, Foundry/Hardhat on Monad, Safe, Blockaid |
| [other-indexers.md](other-indexers.md) | Goldsky, The Graph, Ponder, Allium, thirdweb Insight, SQD/Ghost/Sentio etc. |

## Sponsor table

| Sponsor | Prize / perk | Use it for | Link |
|---|---|---|---|
| **Envio** | **$1,000 "Best Use of Envio"** bounty + **$5,000** free Envio Cloud hosting for winners | Main indexer/backend (GraphQL), fast history (HyperSync), traces, fast read RPC (HyperRPC) | https://docs.envio.dev |
| **Alchemy** | **$1,000 in credits**, "Best Projects using Alchemy" | RPC, gasless smart wallets (Wallet APIs + Gas Manager on Monad), early-block WSS subs, webhooks | https://www.alchemy.com/docs/chains/monad/llms.txt |
| **QuickNode** | Participant perk: **3 months Build plan free** (80M credits, 50 RPS, trace/debug) | Primary RPC + WSS, Streams → Postgres/webhook, debug traces | https://www.quicknode.com/docs/monad |
| **Chainstack** | **$10,000**: annual Pro plans for the **Track 01 winner** and the **overall winner** | Pro RPC (400 RPS, dedicated nodes) after winning; free Developer plan now | https://docs.chainstack.com/reference/monad-getting-started |
| **Crouton Digital** | **$10,000**: 3 months unlimited RPC for winners | Post-hackathon production RPC; nothing to do during the build | https://crouton.digital |
| **Spectrum Nodes** | **$3,000** prize (Business month per track winner, Enterprise for champion) + participant perk **2 months Business free** (1.15B credits, 200 RPS) | Fallback RPC, unified data API (`getPortfolio`, `traceTransaction`), webhooks, testnet faucet | https://spectrumnodes.com/docs/chains/monad.md |
| **Dwellir** | Participant perk: **3 months Developer plan free** (25M responses, 100 rps) | Flat-priced fallback RPC; trace/debug at 1 credit each | https://www.dwellir.com/networks/monad |
| **Tenderly** | Participant perk: **free Pro license** | Tx simulation previews, debugger/gas profiler, Virtual Environments for demo/CI, alerts | https://docs.tenderly.co |
| **ack3** | **$15,000**: an AI security scan for every winning team (ack3's post: every *finalist*) + mentor Michal Převrátil | Wake detectors + fuzzing before submission; scan-ready repo | https://ack3.ai |

Other (non-sponsor) tools covered: Goldsky, The Graph, Ponder, Allium, thirdweb Insight, Blockaid, Safe, Foundry, Hardhat.

## Monad infra facts every teammate should know
- Chain IDs: **143** mainnet, **10143** testnet. viem ships `monad` and `monadTestnet` in `viem/chains`.
- Public RPCs (dev only):
  - `https://rpc.monad.xyz` (QuickNode, 25 rps)
  - `rpc1` (Alchemy, 15 rps)
  - `rpc2` (Goldsky)
  - `rpc3` (Ankr)
  - `rpc-mainnet.monadinfra.com` (MF)
  - Testnet: `https://testnet-rpc.monad.xyz`
- Blocks every **~300–400 ms**. Block tags map to Monad states: `latest` = Proposed (speculative), `safe` = Voted, `finalized` = Finalized. Settle value on `finalized`.
- **`eth_getLogs` ranges are small**: 100–1,000 blocks depending on provider. Use Envio HyperSync or HyperIndex, or QuickNode Streams, for history.
- `debug_trace*` **requires** the tracer options object (`{}` means `callTracer`). There are no struct-log traces.
- No pending-tx queries or `newPendingTransactions` subscriptions. `eth_maxPriorityFeePerGas` is a hardcoded 2 gwei.
- Tooling:
  - Foundry ≥ v1.8: `forge test --network monad`, `anvil --network monad`.
  - Hardhat 3: `evmVersion: "osaka"`, solc 0.8.31.
  - Contract size limit 128 KB.
- WMON (mainnet): `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A`.

## Recommended default stack

```
Contracts      Foundry v1.8+ (network = "monad") + Wake detectors & a fuzz/invariant test
               → owner = Safe multisig; verify on MonadVision/Monadscan (+ Tenderly for debugger)
RPC (reads)    viem fallback([QuickNode Build (perk), Alchemy, Dwellir/Spectrum (perks), rpc.monad.xyz])
RPC (writes)   Alchemy Wallet APIs + Gas Manager (gasless, EIP-7702, batching)  ← Alchemy bounty
Realtime UI    Alchemy `monadNewHeads`/`monadLogs` WSS (speculative) + HyperIndex for confirmed state
Backend/data   Envio HyperIndex on Envio Cloud (GraphQL) — dynamic contracts, Effect API, onBlock
               + HyperSync for one-off backfills/snapshots/traces                ← Envio bounty
Pipelines      (optional) QuickNode Streams → webhook for notifications
Pre-sign UX    Tenderly `tenderly_simulateTransaction` "preview" panel
Monitoring     Tenderly Alerts → Discord/Telegram
Security       `wake detect all`, invariant fuzzing, README Security section → ack3 scan if finalist
```

**Why this combination.**
- It stacks three sponsor angles that are actually judged: the Envio bounty, the Alchemy bounty, and the ack3 scan, which is automatic for finalists and winners.
- It uses every free participant perk: QuickNode, Dwellir, Spectrum and Tenderly.
- It avoids Monad's two biggest infra pitfalls: log-range limits and speculative `latest` data.

## Action items (do this week)
1. Claim the perks now: QuickNode Build, Dwellir Developer, Spectrum Business, Tenderly Pro. Some need manual activation, and Tenderly VEs need a paid plan.
2. Create an Envio API token (https://envio.dev/app/api-tokens) and scaffold the indexer against a testnet deployment.
3. Redeploy the Envio Cloud dev deployment **close to 13 Oct**. Free dev deployments die after 30 days, 100k events, or 7 idle days, and judging runs to 27 Oct.
4. Add `forge test --network monad` + `wake detect all` to CI. Write a README "Security" section.
5. Name each sponsor tool in the submission write-up and state what it does in the product (for example "Envio HyperIndex powers the feed/leaderboard; endpoint: …").

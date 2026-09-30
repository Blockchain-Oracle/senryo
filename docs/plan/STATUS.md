# STATUS — updated 2026-09-30 by claude (lead; wave A merges)

Current stage: **Wave A (in-progress)** — S0 done (user registration pending) · S1 merged (web shell + brand) · S2 merged (contracts; testnet deploy blocked on funding) · S5 mobile in progress
Last green commit (gate passed): d80a701 "chore(S0.1/plan): bootstrap plan system, tooling and invariants"      Last commit: d80a701
In-flight: S5 mobile (wt stage/S5-mobile, agent, resumed after a stall) · S2 testnet deploy waits for a funded deployer; chain side-effects: none yet
Done: — | Milestones: M0 repo builds [ ] · M1 testnet passkey trade [ ] · M2 mainnet end-to-end [ ] · M3 submitted [ ]
Clock: registration closes 06 Oct 23:59Z (registered: [ ] — **user**) · code freeze 13 Oct 12:00Z · submit target 13 Oct 18:00Z · deadline 14 Oct 03:59Z
Blockers: none on the critical path (StarterDrip testnet MON float needs ~10+ MON more later — optional)
Pending user OKs: OK-2 buy senryo.xyz (pre-approved only if ≈ $2)
Env readiness (presence only): FIRECRAWL_API_KEY [x] · DEPLOYER_PK [ ] · SPONSOR_PK [ ] · OPERATOR_PK×2 [ ] · KEEPER_PK [ ] · AURORA_API_KEY [ ] · LITHIC_SANDBOX_KEY [ ] · ENVIO_API_TOKEN [ ] · EXPO_TOKEN [ ] · APPLE_TEAM_ID [ ]
Networks: testnet addresses packages/contracts/src/addresses/10143.json (12 contracts, all Sourcify exact_match, start block 66856078) · mainnet — none · indexer config — none
Coolify: not touched (read-only baseline 29 Sep: 4.0 GiB available, 8 GiB swap; see context/09-product/deployment-coolify.md)
Next action: merge S5 when it reports; open wave B — S3 services (keeper mirror relay for MirrorXAU/XAG), S4 indexer (10143 from block 66856078), S6 auth on rpId senryo.xyz (DNS records [OK?]).

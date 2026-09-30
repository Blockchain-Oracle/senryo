# STATUS — updated 2026-09-30 by claude (lead; wave A merges)

Current stage: **Wave A done** — S0 done (user portal registration pending, closes 6 Oct 23:59 UTC) · S1 merged (web shell + brand + domain) · S2 merged + testnet deployed & verified · S5 merged (mobile foundation, b5ad23f) · next: wave B
Last green commit (gate passed): d80a701 "chore(S0.1/plan): bootstrap plan system, tooling and invariants"      Last commit: d80a701
In-flight: none · chain side-effects: testnet deploy only (see ids-and-txs.md)
Done: — | Milestones: M0 repo builds [ ] · M1 testnet passkey trade [ ] · M2 mainnet end-to-end [ ] · M3 submitted [ ]
Clock: registration closes 06 Oct 23:59Z (registered: [ ] — **user**) · code freeze 13 Oct 12:00Z · submit target 13 Oct 18:00Z · deadline 14 Oct 03:59Z
Blockers: none on the critical path (StarterDrip testnet MON float needs ~10+ MON more later — optional)
Pending user OKs: OK-2 buy senryo.xyz (pre-approved only if ≈ $2)
Env readiness (presence only): FIRECRAWL_API_KEY [x] · DEPLOYER_PK [ ] · SPONSOR_PK [ ] · OPERATOR_PK×2 [ ] · KEEPER_PK [ ] · AURORA_API_KEY [ ] · LITHIC_SANDBOX_KEY [ ] · ENVIO_API_TOKEN [ ] · EXPO_TOKEN [ ] · APPLE_TEAM_ID [ ]
Networks: testnet addresses packages/contracts/src/addresses/10143.json (12 contracts, all Sourcify exact_match, start block 66856078) · mainnet — none · indexer config — none
Coolify: not touched · read-only 30 Sep: 3.0 GiB available, swap 3.7/8 GiB used, akashi live → D-102: all on the user's server, deploy small-first + measure; Envio Cloud is the free fallback
Next action: wave B — S3 services (capacity decision on Coolify first), S4 indexer (10143 from block 66856078), S6 auth on rpId senryo.xyz (DNS [OK?]). User: `eas init` + `eas credentials` (Android SHA-256 for assetlinks) and dev builds on device.

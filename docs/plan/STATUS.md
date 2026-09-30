# STATUS — updated 2026-09-30 by claude (lead; wave B launched)

Current stage: **Wave B running** in three worktrees — `stage/S3-services` (chain, api-client, services, ledger, images, drive) · `stage/S4-indexer` (indexer/, indexer-client) · `stage/S6-auth` (account, sign-in/onboarding web+mobile, .well-known; S11a folded in, D-103) · S3.1 foundation (`@senryo/config` + `@senryo/core`) on main · Wave A done (S0 user registration pending, closes 6 Oct 23:59 UTC)
Last green commit (gate passed): 1b3a0e5 "feat(S3.1/packages): @senryo/config + @senryo/core foundation; apps consume them"      Last commit: see git log
In-flight: wave B agents (worktrees under .claude/worktrees/, branches stage/S3-services · stage/S4-indexer · stage/S6-auth; merge each when its report arrives) · chain side-effects: testnet deploy only (see ids-and-txs.md)
Done: — | Milestones: M0 repo builds [ ] · M1 testnet passkey trade [ ] · M2 mainnet end-to-end [ ] · M3 submitted [ ]
Clock: registration closes 06 Oct 23:59Z (registered: [ ] — **user**) · code freeze 13 Oct 12:00Z · submit target 13 Oct 18:00Z · deadline 14 Oct 03:59Z
Blockers: none on the critical path (StarterDrip testnet MON float needs ~10+ MON more later — optional)
Pending user OKs: none open (senryo.xyz bought, D-100)
Env readiness (presence only): FIRECRAWL_API_KEY [x] · DEPLOYER_PK [ ] · SPONSOR_PK [ ] · OPERATOR_PK×2 [ ] · KEEPER_PK [ ] · AURORA_API_KEY [ ] · LITHIC_SANDBOX_KEY [ ] · ENVIO_API_TOKEN [ ] · EXPO project linked @0xabu/senryo (dc2f824) · EXPO_TOKEN [ ] · APPLE_TEAM_ID [x] 86C6ZFJ6V6 (public)
Networks: testnet addresses packages/contracts/src/addresses/10143.json (12 contracts, all Sourcify exact_match, start block 66856078) · mainnet — none · indexer config — none
Coolify: not touched · read-only 30 Sep: 3.0 GiB available, swap 3.7/8 GiB used, akashi live → D-102: all on the user's server, deploy small-first + measure; Envio Cloud is the free fallback
Next action: merge wave B branches as they report (lockfile: regenerate on conflict) · user: finish iPhone device registration (EAS shows 0 devices, 0 builds), Android dev build + paste the keystore SHA-256 (assetlinks), `21st login` (S6), Envio account + API token → `~/.config/senryo/envio.env` (S4 sync), portal registration · then [OK?] DNS + senryo-web deploy (S6), deploy small-first per D-102.

# Decisions and open questions

The plan (`00-plan.md`) changes **only** through entries here. Format: `- **D-###** date · decision · evidence · approval`. Q-items: `### Q-###` with owner, blocks, default, status.

## Decisions
- **D-001…D-042** 2026-09-29 · the full decision table in `00-plan.md` §1 (D-001 track … D-042 card demo), including D-037 (Face ID default: practice OFF, mainnet ON above threshold) and D-038 (practice never geo-gated) · evidence per row in §1 · **approved by user (plan approval, 2026-09-29)**.
- **D-043** 2026-09-29 · pnpm **11.24.0** pinned (the user's toolchain in Agari/akashi; 12.8.1 exists but is not adopted mid-hackathon) · `pnpm -v`, `npm view pnpm dist-tags` · planner (S0 decision delegated by plan §4).
- **D-044** 2026-09-29 · `design/preview`'s nested `.git` (only a Create Next App commit, no remote) moved to the session scratchpad so the preview is tracked as plain files · `git log` in design/preview · planner.
- **D-045** 2026-09-29 · Node: services target Node 24 LTS in Docker; local dev runs Node 25 (installed) — `engines: ">=24"` · `node -v` · planner.
- **D-046** 2026-09-29 · TypeScript pinned `~6.0.3` in the catalog (7.0.2 is the native Go compiler; Expo SDK 57 and Agari use 6.0.3) · `npm view typescript`, Agari package.json · planner.
- **D-047** 2026-09-29 · Biome 2.5.14 is the only linter/formatter (`noMagicNumbers`, `noExcessiveLinesPerFile` confirmed in Biome docs via Context7 `/biomejs/website`); no ESLint · Context7 · planner.
- **D-048** 2026-09-29 · `context/_portal/` (login-gated portal capture incl. account views/screenshots) is gitignored — kept local for agents, never published in the public repo · privacy · planner.
- **D-049** 2026-09-29 · Brand **Senryo 千両** confirmed; domain **senryo.xyz** (user: buy via namecheap-cli only if ≈ $2; .app too expensive) — rpId = `senryo.xyz`, frozen once the first account is created · user · approved.
- **D-050** 2026-09-29 · GitHub repo `Blockchain-Oracle/senryo` created **public** (rules §7.2); judges' account can read it without an invite · https://github.com/Blockchain-Oracle/senryo · user OK-1.
- **D-051** 2026-09-29 · Namecheap API calls route through the Coolify server's static IP `84.46.247.92` via `ssh -D` SOCKS tunnel (user whitelists that IP once in Namecheap API Access) · namecheap-cli error 1011150 · planner.
- **D-052** 2026-09-30 · Foundry `via_ir = true` (legacy codegen hits "stack too deep" on the 14-field `PositionUpdated` and the liquidation waterfall); SenryoCore stays one unit at 40.6 KB runtime (< 128 KB) · `forge build --sizes` · S2 agent.
- **D-053** 2026-09-30 · POOL / INSURANCE / CARD_FLOAT are per-token books (AUSD, USDC); user ↔ book settlement is at par in usd6, debiting AUSD first, then USDC; LP redeem pays AUSD only · keeps I1 exact per token · S2 agent.
- **D-054** 2026-09-30 · `SAFETY_BUFFER_USD6` (B) applies only while the account carries risk (positions, holds, envelope or card debt), so an idle account can withdraw in full · risk-math.md Withdrawable = min(FreeToTrade, balance) · S2 agent.
- **D-055** 2026-09-30 · Testnet `MirrorAggregator` seeds XAU 3,800 / XAG 45 (8 dec) as placeholders; the keeper's first real mirror push trips the clamp and self-confirms (≥ 3 in-band rounds over ≥ 300 s) · no mainnet reads in S2 · S2 agent.
- **D-056** 2026-09-30 · CIRCUIT confirmation is stateless: walk back ≤ `CONFIRM_LOOKBACK_ROUNDS` (8) consecutive valid rounds within `CONFIRM_BAND_BPS` of the latest answer; confirmed at ≥ 3 rounds spanning ≥ `CONFIRM_SECONDS` — so `peek` and `observe` always agree · oracle scenario checks · S2 agent.
- **D-057** 2026-09-30 · Funding and borrow accrue lazily on `N_entry`; funding accrues under the market status at accrual time (keepers `poke` markets at session edges); view risk accrues borrow virtually, not funding · risk-math.md funding/borrow · S2 agent.
- **D-058** 2026-09-30 · Price impact applies only to increases; reduces/closes/liquidations never pay impact (reduce-only must always execute). A profitable reduce inside `MIN_HOLD_BLOCKS` (20 blocks ≈ 6 s) reverts `MinHoldNotElapsed` rather than capping · risk-math.md · S2 agent.
- **D-059** 2026-09-30 · LP valuation: mint (pool-favourable) = cash + funding/borrow receivables − trader PnL; redeem (conservative) = cash − max(trader PnL, 0); both floor at 0 · specs/contracts.md LpVault · S2 agent.
- **D-060** 2026-09-30 · Hours closed (closed-session spread) = age of the last accepted round, rounded up to whole hours; age spread uses the same age · XAU feed stops updating while closed (D-020) · S2 agent.
- **D-061** 2026-09-30 · Collateral stable feeds: an invalid/stale feed values the token at 0 for initial checks and at par for liquidation (never liquidate on a broken stablecoin feed); testnet mocks have no feed (par) · risk-math.md collateral · S2 agent.
- **D-062** 2026-09-30 · Constants chosen where the spec is silent: `LP_TVL_CAP` 1,000 AUSD · skew cap 60 % pool · funding factor ≈ 0.01 %/h at full skew, max 0.1 %/h · borrow 5 % + 15 % APR × util · B = $1 · liquidator 50 % of penalty capped $5 · 10 % of fees → INSURANCE · `FEED_GRACE` 600 s · `REOPEN_WINDOW` 300 s · `LP_REDEEM_DELAY` 1 d · `HOLD_RELEASE_GRACE` 1 d · `MAX_VOUCHERS` 25 · testnet drip 0.05 MON (budget 2 MON/day) · all in `Constants.sol` / `SeedConstants.sol`, PARAM_ADMIN-tunable · S2 agent.
- **D-063** 2026-09-30 · `CollateralSwapper` is deployed on mainnet only (no Uniswap v4 AUSD/USDC pool for mocks on 10143; `swapCollateral` reverts `SwapUnavailable` on testnet). Encoding follows docs.uniswap.org (V4_SWAP + SWAP_EXACT_IN_SINGLE/SETTLE_ALL/TAKE_ALL, 5-field `ExactInputSingleParams`); v4-periphery `main` adds `minHopPriceX36`, so S3 must confirm the struct against Universal Router 2.1.2 on a mainnet fork before enabling · Context7 `/uniswap/docs`, `/uniswap/v4-periphery` · S2 agent.
- **D-064** 2026-09-30 · Testnet admin = the deployer (ADMIN, GUARDIAN, PARAM_ADMIN with the 6 h execution delay); the Safe 2-of-3 handover and deployer renounce happen at the S8 mainnet deploy · no Safe on 10143 yet · S2 agent.
- **D-065** 2026-09-30 · Deploy drift check = recorded init-code hash (bytecode + constructor args) per contract in `addresses/<chainId>.json`; mismatch reverts `Drift`, missing/code-less entries are (re)deployed; mainnet requires `SENRYO_MAINNET_OK=true` · ensure-style spec · S2 agent.
- **D-066** 2026-09-30 · Card: allowance days are UTC days (`block.timestamp / 86400`); capture allowed until `expiry + HOLD_RELEASE_GRACE`; release-only is per issuer id and ADMIN-set; refunds are bounded by Σ captured − Σ refunded per user and repay card debt first · D-032/D-036 · S2 agent.
- **D-067** 2026-09-30 · Deposit source tagging: ADMIN-tagged callers (StarterDrip → VOUCHER), inbox addresses via `InboxFactory.inboxOf` → INBOX, self → DIRECT, any other payer → AURORA · specs/contracts.md `Deposited.source` · S2 agent.
- **D-068** 2026-09-30 · `forge lint` runs as its own gate step (`lint_on_build = false`) · build noise · S2 agent.

## Open questions
| Q | Owner / ask | Question | Blocks | Default | Status |
|---|---|---|---|---|---|
| Q-001 | organizers (Discord/Support) | Which rubric applies (track page vs rules §5.2)? Judging/winner dates? Mainnet + testnet split OK? | pitch emphasis | plan for both | open |
| Q-002 | Agora / Perpl (gvan) | Testnet AUSD drip (faucet empty; Perpl testnet needs 100 AUSD) | practice Perpl | mainnet demo | open |
| Q-003 | Perpl | Builder code; web-origin whitelist; native key enrollment (profile prerequisite); geo-block enforcement | Path A, TP/SL on Perpl | Path B | open |
| Q-004 | Aurora mentor | Custom Actions for persistent addresses; refunds target; fee stacking; EVM signer with non-EVM origin | F21 | inbox sweep | open |
| Q-005 | Monad / Mera | Session-design review; Safari PRF `get()` status | F01/F08 | our policy + 7702 spike | open |
| Q-006 | Envio (Denham) | Self-hosted OK for judging; HyperSync limits | S4 | self-host | open |
| Q-007 | Immersve | Own test partner credentials | S10 | public sandbox | open |
| Q-008 | Chainlink (Darb) | Data Streams credentials (FX, equities, sub-minute XAU/XAG) | D-020 | gold + silver on push feeds | open |
| Q-009 | **user** | Name + domain | S1, S6 | — | **answered → D-049** (purchase pending IP whitelist) |
| Q-010 | **user** | Apple Developer membership | S6 iOS | — | **answered: user has one** |
| Q-011 | **user** | Team members, contact wallet, geofence list | registration | solo | open |
| Q-012 | **user** | Mainnet budget (≈60 MON keys, ≈400 AUSD seeds/demo/vouchers, ≈$30 Aurora, Laso ≈$105+, Apple $99, VPS €5–10/mo) | S7–S10 | ask per spend | open |
| Q-013 | **user** | "Shazam" reference repo | — | — | **dropped** (user unaware; Agari is the reference) |
| Q-014 | Chainlink / Pyth | Data Streams creds or Pyth trial for live XAU/XAG | D-020 | push + honest age | open |
| Q-015 | **user** | Any team member in a listed community partner? (Community bounty $5K) | bounty | not targeted | open |
| Q-016 | **user** | Tester communities you can reach (S-GTM) | traction | ask at S6 | open |

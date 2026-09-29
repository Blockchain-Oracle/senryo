# S0 — Bootstrap: plan system, tooling, invariants (M0)

**Goal:** a repo that survives context clears and enforces the user's rules from the first commit.
- **Plan:** `00-plan.md` §3, §4 (S0 row). **Open first:** Agari `s5a/CLAUDE.md` + `docs/plan/*`, Agari `scripts/invariants/**`, akashi `turbo.json`.
**D-number range:** D-043…D-050.

## Steps
- [x] `git init -b main`; nested `design/preview/.git` moved to scratchpad (D-044)
- [x] Transcribe the approved plan → `docs/plan/00-plan.md`
- [x] `CLAUDE.md` (read order, rules, gates), `STATUS.md`, `decisions.md` (D-001…D-045, Q-001…Q-016), `acceptance.md`, `parity.md`, `ids-and-txs.md`, `references.md`
- [x] Specs transcribed from the design agents: `specs/{contracts,risk-math,services,client,flows,deploy-runbook}.md`
- [x] Root tooling: `package.json` (pnpm 11.24, D-043), `pnpm-workspace.yaml` (catalog; TypeScript ~6.0.3 per Expo 57), `turbo.json`, `tsconfig.base.json`, `biome.json` (Biome 2.5.14 incl. `noMagicNumbers`, `noExcessiveLinesPerFile` 400 — no ESLint needed)
- [x] Port invariants runner from Agari (SHA `661a24ee`) + new Senryo rule table (26 rules)
- [x] `scripts/env-check.mjs` (presence only)
- [x] Foundry scaffold `contracts/` (forge 1.8.3, solc 0.8.31, osaka, `network = "monad"`; forge-std + OpenZeppelin v5.7.0 as submodules; bytecode_hash ipfs for Sourcify)
- [x] `.github/workflows/ci.yml` (fast gate + contracts)
- [x] First commit (gate green) — `d80a701 chore(S0.1/plan): bootstrap plan system, tooling and invariants`
- [x] OK-1: GitHub repo `Blockchain-Oracle/senryo` created **public** + pushed (public = readable by the judges' account)
- [ ] **(user)** register in the portal + form the team (closes 6 Oct 23:59 UTC; target 5 Oct)
- [ ] Context7 library IDs recorded in `references.md` as each stage first uses a library (Biome: `/biomejs/website` ✓)

## Gate
`pnpm lint && pnpm invariants && pnpm typecheck` green; `pnpm contracts:check` green; first commit on `main`.

## Findings
- Research template keys `metadata`/`metadata_hash` are not valid in forge 1.8.3 (real keys: `bytecode_hash`, `cbor_metadata`); defaults kept for Sourcify exact match.
- Latest TypeScript is 7.0.2 (native Go); pinned ~6.0.3 to match Expo SDK 57 and Agari (D-046 pending record).
- pnpm latest is 12.8.1; kept 11.24.0 (D-043).

## Handoff
Next stage files to create when starting them: `stage-01-brand-design.md`, `stage-02-contracts.md`, `stage-05-mobile-foundation.md` (wave A, parallel after OK-1). S1 is blocked on Q-009 (name + domain) and Q-010 (Apple Developer) — ask the user.

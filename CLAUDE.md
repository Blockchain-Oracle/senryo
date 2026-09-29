# Senryo 千両 — agent guide

Mobile-first RWA + crypto trading app with the Kinpaku card on Monad (Metropolis hackathon, Track 01). Plan of record: `docs/plan/00-plan.md`.

## Read order (every session, before editing)
1. This file.
2. `docs/plan/STATUS.md` — the single resume pointer. **Never trust memory over STATUS.md.**
3. The current stage file `docs/plan/stage-NN-*.md` — first unchecked box, then `## Handoff`.
4. The last 10 `D-` entries and all open `Q-` in `docs/plan/decisions.md`.
5. Only the `00-plan.md` sections the stage names, then the stage's "Open first" sources (`docs/plan/specs/*`, `context/**`, `references/**`).
6. `git status && git log --oneline -5`; confirm HEAD matches STATUS; run the fast gate.

## Rules
- **Package manager:** pnpm 11.24 only (`pnpm add`, `pnpm dlx`); no npm/npx/yarn/bun lockfiles.
- **Files ≤ 400 lines** (TS/TSX/MJS/CSS/SOL); target 300.
- **No magic numbers:** named constants (`packages/config`, `contracts/src/libraries/Constants.sol`, per-module `constants.ts`).
- **Money:** integer base units only (`usd6`, 1e18 prices/sizes, bps). Never floats.
- **Boundaries:** only `packages/chain` sends transactions and imports viem clients; `packages/account` (Mera) signs, never sends; `packages/core` is pure; ethers/web3/wagmi are banned; services never import `packages/account` (no custody).
- **Monad:** explicit `gas` on every send (gas limit is charged); economic decisions at `finalized`; no timestamp equality (use block numbers); keys that send value keep > 10 MON; wait 3 blocks after funding.
- **Tests are not a deliverable.** Only targeted checks where money/security correctness is uncertain (Foundry invariants, oracle scenarios, card concurrency, session policy). **No UI tests.**
- **Docs first:** read Context7 / `references/` before using any library; follow the documented usage.
- **UI:** 21st.dev first (`21st search` → preview → `get` → `add` → re-tokenize). Mobile RN pieces are ports of chosen 21st designs, recorded in `apps/mobile/.21st/design.json`. Mediocre design is never accepted.
- **[OK?] steps** (money, mainnet actions, server/deploy/DNS, accounts, outbound messages) wait for the user's explicit OK *at that moment*.
- **Secrets:** never printed or committed. Keys live in `~/.config/senryo/` or Coolify runtime env.
- **Deadlines never justify a mediocre choice. Don't block yourself: research the route.**
- **Commits:** `<feat|fix|chore|docs|refactor|wip>(S<n>[slice].<step>/<area>): <summary>` + trailers `Stage: S<n>` and `Parity: F-xx|—`. Tick the stage checkbox in the same commit. Never end a session dirty (use `wip(...)`). Push after each gate.

## Gates
- **Fast:** `pnpm typecheck && pnpm lint && pnpm invariants`
- **Contracts:** `pnpm contracts:check` (forge build, fmt --check, lint, solhint; invariant suites when `contracts/` changed)
- **Web:** `pnpm --filter @senryo/web build` · **Mobile:** `pnpm --filter @senryo/mobile exec expo export -p ios -p android`
- **Indexer:** `cd indexer && pnpm envio codegen && pnpm tsc --noEmit`
- **Deploy:** container healthy + smoke request + `.well-known` check (web)

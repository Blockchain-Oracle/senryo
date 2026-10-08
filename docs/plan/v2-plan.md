> **SUPERSEDED by the prediction-market pivot (D-256, [pivot-2026-10-08.md](pivot-2026-10-08.md)).** Kept for history only; don't build from it.

# Senryo v2 — fix the practice loop, runtime Practice↔Mainnet, real identity, the reference-led redesign, social, full market breadth, mainnet

> **2 October authority update (D-234–236):** The user approved implementation of the [reference-led mobile rebuild](mobile-rebuild-2026-10-02.md). Its complete-journey hierarchy, total portfolio, native slide confirmation and original quiet sounds supersede conflicting remediation/design details below. The broader roadmap and exclusions remain. Historical checks are revision-specific; rebuilt phone acceptance is pending.

> For reviewers: this plan continues the existing plan system (`docs/plan/00-plan.md`, stage files, `decisions.md`). It does not
> restart it. Everything below either fixes what the phone test found, or pulls the user's reference study
> (`docs/design/reference-study-2026-09-30/`) in as the new design authority. Each piece of work has a home in a stage file
> and a D-entry. Evidence paths are given so every claim can be checked.

## 0. Context

**Why now.** The user ran the practice loop on their iPhone (30 Sep, after the S6.12 claim fix) and reported:
1. **The market order can't be placed.** After typing an amount the ticket shows "Adding gas to your account…" and "keeps
   refreshing and refreshing".
2. **Portfolio can't be used** ("I can see portfolio and everything, but…").
3. **The practice-funds prompt comes back** after a successful claim.
4. **They want a Practice (paper) ↔ Monad mainnet toggle.**
5. **Real logos everywhere.** Monad, our own Senryo mark, BTC, USDC, chains, venues and providers; no placeholder UI.

Separately, the user produced a **reference study** of Solflare, Phantom and Fomo:
- 97 screens and 18 motion clips;
- 44 component briefs (C01–C44), 38 identity entries (LG01–LG38), 116 features (FT001–FT116) and 18 opportunities (OP01–OP18);
- packaged as the `mobile-reference-study` skill, with `reference-product-fidelity` as its build contract.

**User decisions this session (latest, binding):**
- **D2 Desk is rejected.** "Even the colour will change… don't hold on to the old design." The study is the design
  authority. It is a *minimum baseline*, not inspiration.
- **Add-ons in scope:** @handles + avatar (OP11), leaderboard + follow (OP17), trade feed (FT077/FT070).
- **Don't cut the product short.** Markets go beyond gold and silver. The other reference capabilities are carried by a
  parity ledger, and nothing is dropped without the user's explicit decision.
- **Direction questions go to Codex, not the user.** The Codex CLI (gpt-6.1-sol, xhigh, read-only) produced the design
  direction in §5.

**Intended outcome:**
- The phone practice loop works end to end: claim → trade → TP/SL → close.
- The user can switch Practice ↔ Mainnet in one tap, and it's always obvious which mode they're in.
- Every entity shows its real mark.
- The app is rebuilt to the reference baseline as **"Living Lacquer"** (§5): Fomo's trading surfaces, dock and social; Phantom's action fan; Solflare's onboarding art. It covers navigation, sheets, ticket, motion, onboarding, funding and social.
- Markets span commodities (XAU, XAG) and FX majors on our engine, plus crypto via Perpl. Equities, indices and oil are listed and get a research route to tradability. Until a fast feed exists they show honest "indicative" prices, never fake tradability.
- Mainnet goes live through the existing [OK?] steps.

## 1. Authority record (reference-product-fidelity §1)

| Field | Value |
|---|---|
| Target | Senryo mobile app (`apps/mobile`), then web (`apps/web`) through the shared tokens and identity packages |
| Reference artifacts | `docs/design/reference-study-2026-09-30/**` (the recordings R1 Solflare, R2 Phantom and R3 Fomo; screen/motion/identity/feature registers); bundled copy in `~/.claude/skills/mobile-reference-study/assets/…` |
| Authority order | 1. the user's latest words; 2. the study's observed evidence (screens and motion); 3. the study's guides; 4. Senryo product rules in `00-plan.md` (money, passkeys, honesty). **D2 Desk (D-004), `design/DIRECTIONS.md` and the `d2-*` screenshots are superseded** and kept only as history. |
| Baseline strength | Minimum baseline for every journey the references show. Senryo-specific money semantics are *Adapted*, never faked. |
| Allowed deviations | Brand name and our own logo (the 千 seal; its colour treatment may change). Product rules: passkeys not OAuth, the practice/mainnet split, oracle-priced RWA engine, no custody, D-041 no fiat ramp at launch (it becomes **Blocked B3**, not dropped; see §7). |
| Additions | Handles/avatars, leaderboard/follow, trade feed. These are *observed* in Fomo, so they are Adapted rather than Additive. Also: the Practice↔Mainnet toggle, the Kinpaku card, the LP vault, TP/SL. |
| Missing evidence | Passkey ceremony, text password, successful funding/order/SL save, settings menu, send result (study `06-capture-gaps.md`). Senryo builds these journeys to its own spec. The *completed-outcome* claim (FT115) stays **Blocked B1** until our own finalized lifecycles are recorded in `acceptance.md`. |
| Provenance | Evidence crops are **not** production logos. Every mark comes from a first-party brand kit or authoritative metadata, with a recorded source, licence, date and sha256 (§4). |
| Task boundary | This document is the plan. Implementation follows stage by stage. [OK?] steps (money, mainnet, deploys, outbound messages) wait for the user's OK at that moment. |

## 2. Root causes of the phone bugs (read-only traces, file:line)

**B1a — "Adding gas…" can never clear on practice.**
- `apps/mobile/src/features/trade/useTicket.ts:86-89` needs `positionGasLimit("increase", n) × eth_gasPrice`: 620,000 × 102 gwei = **0.0632 MON**. But the practice drip is **0.05 MON** (live `StarterDrip.config()` on 10143 and `SeedConstants.sol:76`).
- This is a regression: the check passed at the old 450k cap and broke at 540k (S8.6), then 620k (S8.18).
- Nothing adds gas:
  - The api has no top-up route.
  - The keeper `topups` job is off by default (`services/keeper/src/env.ts:38`).
  - When on, that job only serves users with an open position (`jobs/maintenance.ts:117`), and its floor (0.02 MON, `constants.ts:58`) sits below what the ticket needs.
- `blockers.ts:111` shows "Adding gas…" with no action, and `Ticket.tsx:110` disables hold. The result is a permanent dead end.
- Worse, the check uses the wrong formula. Monad consensus rejects a transaction whose gas fees exceed the sender's balance/reserve ([Monad reserve-balance docs](https://docs.monad.xyz/developer-essentials/reserve-balance)). The docs don't define whether that's `limit × maxFee` or `limit × effective price`; S8.16d settles it with one testnet send. We sign `maxFee = 2×base + 2 gwei ≈ 202 gwei` (`packages/chain/src/fees.ts:58`). At that price 0.05 MON covers ~247k gas, while a testnet increase needs ~437k. **So the practice drip allows zero trades.**

**B1b — "keeps refreshing" means the ticket unmounts.**
- `apps/mobile/src/components/kit/states.tsx:160-168` renders `{children}` at slot 0 when *fresh* and slot 1 (behind `StaleStamp`) when *stale*. React therefore discards the subtree on every flip.
- `TradeScreen.tsx:42` wraps the whole Ticket in the market `ReadingView`. Each flip wipes the amount, side, leverage, the hold in progress and the trace.
- The flips come from `refetchInterval == staleTime` (5 s, `packages/query/src/markets.ts:31`), from RPC errors, and from the post-trade `invalidateQueries(["market", chainId])` (`trace.ts:103`).
- The same remount hits all four portfolio sections.

**B3 — the claim prompt comes back.** `apps/mobile/src/lib/account/use-starter.ts:44-61` re-derives the phase on every mount, and:
- starts at `idle`;
- checks `lastRelay` before `claimed`, so an api row stuck at `proposed` means a 36 s poll then "didn't settle · Try again", even though the claim is onchain;
- falls back to the Claim button on any status error;
- never invalidates the account after a claim;
- never has `EngineSocket.watchAccount` called (`socket.ts:51`).

Also:
- The Account screen always shows the card (`app/account/index.tsx:55`, no `hideWhenClaimed`).
- The portfolio "Nothing here yet · Add money" state reads the finalized snapshot, which lags the claim.
- The per-device claim rate limit isn't scoped to the drip address, so a pre-D-164 claim still blocks the new drip (`routes/starter.ts:56-69`).

**B2 — portfolio unusable: no routing defect found.** The likely causes, in order:
1. The B1b remounts cancel taps mid-press.
2. `usePositionsSummary()` runs in `(tabs)/_layout.tsx:23`, so the whole NativeTabs tree re-renders on every price tick. expo-router's deferred focus leaves the new tab `pointerEvents: none` while it lags.
3. StarterCard pushes tab routes from a root-stack screen (`StarterCard.tsx:81`).

It gets confirmed on the phone after the fixes. A screen recording is requested only if it persists.

## 3. Workstreams and order

| # | Workstream | Stage home | Depends on | Parallel track |
|---|---|---|---|---|
| W0 | Plan-system integration: this plan → D-entries, stage files, STATUS, parity rows, `PROJECT-HANDOFF.md` | S8 + new S1b, S12b | — | lead |
| W1 | Unblock the practice loop (B1–B3 + gas economics) | S8.16a–e | — | lead |
| W2 | Runtime Practice ↔ Mainnet (F06/F49) | S8.22 | W1 | lead |
| W3 | Identity registry and real marks (`@senryo/identity`) | S1b.1–4 | — | agent A (worktree) |
| W4 | Design v2, reference-led rebuild (tokens, navigation, sheets, journeys, artwork) | S1b.5–n | W3 tokens; the Codex direction (§5) | lead + agents per journey |
| W5 | Social: handles, avatars, follow, leaderboard, feed, holders, search, send-to-@handle | S12b | api feed poller; W2 mode separation | agent B (api) + W4 screens |
| W6 | Market breadth: FX majors on our engine (in the mainnet deploy); equities/indices research; Perpl crypto (S7); spot tokens (later slice) | S8.23 + S7 | contracts track | agent C (contracts) |
| W7 | Mainnet: indexer consumer audit; cold start (inbox sweeper, vouchers, top-ups); TxRecovery; S8.17–S8.21 [OK?]; app rebuild with 143.json | S8.17–21 + S8.24 | user funding; W1; W2 | lead |

The W1 fixes land in the current code first, because the user tests practice today and the logic layers (`packages/core`
`reading`, `packages/query`, gas, starter) survive the redesign. W4 then rebuilds the UI on top of the fixed layers.
**The mainnet gate (S8.21, a hackathon requirement) runs on the W1/W2-fixed current UI as soon as the user funds it. It does
not wait for the redesign.** The redesign then lands on a working mainnet.

**Execution sequence.** This is ordering, never a reason to cut scope. Parallel tracks run in worktrees as in waves B/C, and each merges at its gate.

| Step | Lead (main) | Agent A (identity/design) | Agent B (social backend) | Agent C (contracts) |
|---|---|---|---|---|
| 1 | W0 docs, D-entries, ranges; W1 a/b/c/e | W3 registry, first-party marks + provenance, `EntityMark` | W5 migration + handle/profile/follow routes | W6 FX feed verification + params, folded into `Deploy.s.sol` `_coreInitCode`/`_feedInits` (fork) |
| 2 | Phone S8.16 with user; W1 d; W2 toggle; W7 cold start (sweeper, TxRecovery) | `PROJECT-HANDOFF.md` + ledger; token values swapped under the existing names; navigation-shell spike | Feed poller + leaderboard + moderation | Equities feed measurement (read-only) → D-entry; testnet FX via `AddMarkets.s.sol` (schedule → execute, 6 h delay) [OK?] |
| 3 | **W7 mainnet S8.17–S8.21 [OK?] on the fixed UI when funded**; rebuild the app with 143.json | Shell + J4 ticket + J3 markets | Search, holders, WS pill with caps | Keeper observe budget (poke on status edges/OI) |
| 4 | J6 Home, J5 positions, J2 add money | J1 onboarding + art (illustrator review first), J8 social screens | Social smoke, privacy/anti-farming checks | S7 Perpl crypto on the same ticket |
| 5 | J7 card, J9 You, J10 LP; fidelity acceptance per journey | J11 spot tokens; share cards; reduced-motion pass | — | — |

**Shared-file ownership**, to avoid merge collisions:

| Owner | Files |
|---|---|
| Lead | `(tabs)/_layout.tsx` and the shell, `TopStrip`/mode capsule |
| Agent A | `packages/tokens`, `packages/identity` |
| Agent B | api route registration + `packages/api-client` + migrations. The lead reviews migration numbering: `0004_starter_topup` (lead, W1) then `0005_social` (agent B). |
| Agent C | `packages/config` `ENGINE_MARKETS`, `indexer/config.yaml` feeds |

The fee multiplier and networks in `packages/config` belong to the lead.

## 4. Workstream detail

### W0 — Plan-system integration (first commit, `docs(S8/plan)`)
- **`decisions.md`:** D-168…D-179 and D-186…D-189 (§8), the new ranges, and Q-017…Q-019.
- **`00-plan.md`:**
  - §4 gains the rows **S1b Design v2** and **S12b Social**;
  - D-004 and D-033 get amendment pointers;
  - §2.5 flow ownership is updated: F06/F49 → S8.22; social flows → S12b; spot tokens → S1b J11.
- **`stage-08-rwa-mainnet.md`:**
  - new steps S8.16a–e (W1), S8.22 (W2), S8.23 (W6 FX), S8.24 (W7 cold start + TxRecovery);
  - S8.20 is rewritten (no id namespacing, a consumer audit instead);
  - the Findings section gets the phone-test root causes (§2).
- **New stage files:** `stage-01b-design-v2.md` (W3 + W4: steps, gate = the journey fidelity acceptance, Handoff) and `stage-12b-social.md` (W5).
- **`STATUS.md`:** the resume pointer and the corrected collision note. **`parity.md`:** new F-rows for social, the mode toggle, identity and market breadth. **`acceptance.md`:** a row for every phone/fork/mainnet run.
- **`docs/design/senryo-v2/direction.md`:** Codex's direction, verbatim. **`PROJECT-HANDOFF.md`** and the parity-ledger JSON (W4.1).
- **Commits** follow the established format: `<type>(S<n>.<step>/<area>)` with `Stage:` and `Parity:` trailers, and the stage checkbox ticked in the same commit. Push after each gate.

### W1 — Unblock the practice loop (S8.16a–e)

**S8.16a Stable readings (fixes B1b, most of B2).**
- `apps/mobile/src/components/kit/states.tsx`: `ReadingView` always renders `[stampSlot, children]` in fixed positions (the stamp slot is `null` when fresh). This one change stops remounts on every screen.
- `packages/core/src/reading.ts:51-64` (`fromQuery`) today returns `stale` whenever TanStack's `isStale` is true. Change it to `stale` = *refetch errored* or *data age > the query's own budget*.
  - The core stays pure: `fromQuery(query, { now, staleAfterMs })`. Each `packages/query` hook passes ~2× its `refetchInterval` and a shared low-frequency clock tick, so an age-based stale stamp can appear without a refetch.
  - `refreshing` keeps showing `isFetching` without changing the status.
- `apps/mobile/src/features/trade/TradeScreen.tsx`: the Ticket leaves the market `ReadingView`.
  - The ticket draft (side, amount, leverage, TP/SL) moves to a per-(mode, marketId) draft store.
  - **So does the in-flight send trace** (today it is `useSendTrace` state inside the Ticket, `trace.ts:88-116`).
  - Submit stays blocked while a journal entry for that market is non-final, so a remount mid-send can't re-enable the hold (no double submit).
  - It survives remounts, child sheets and the chart/keypad toggle (C41 fidelity).
- `(tabs)/_layout.tsx:23-36`: the layout keeps only a low-frequency `hasOpenPositions` flag to mount `BottomAccessory`. `usePositionsSummary()`, with its price-tick subscription, moves into `PositionsAccessory`, so the navigator stops re-rendering on ticks.
- `portfolio/index.tsx:139-141`: `PositionsTable` also renders on `stale` readings. Today it shows nothing unless the reading is fresh.

**S8.16b The gas check matches what the sender signs.**
- New pure helper in `packages/chain` (next to `fees.ts`/`planGas`): `gasBudgetWei(limit, feeQuote) = limit × maxFeePerGas`. It uses the same `FeeOracle` quote and the same limit rule as `planGas` (estimate × 1.1, capped by `gasCap`).
  - Monad consensus rejects a tx whose `gas_fees(tx)` exceed the sender's balance/reserve ([Monad docs: reserve balance](https://docs.monad.xyz/developer-essentials/reserve-balance)), but the docs don't say whether that uses maxFee or the effective price.
  - Budget the conservative `limit × maxFee`, and settle it with one tiny testnet send whose balance sits between the two (S8.16d).
- **Per-chain measured limits, not the mainnet cap.** 620k is the mainnet first-open budget; a testnet increase is ~397k × 1.1 ≈ 437k (D-185).
  - `useGasBudget` estimates once per (market, side, position count), never per keystroke (D-162), and falls back to the chain's calibrated value.
- **Correct numbers:** at 202 gwei, 0.05 MON covers ~247k gas, so today's practice drip allows **zero** trades, not one.
- `NO_GAS` becomes a generic blocker for every user send (close, TP/SL, LP, swap). It is evaluated **last**, only when every other blocker is clear (at hold time), so top-ups never fire for trades that would fail anyway.

**S8.16c Auto top-up** (the plan already says "no gas (auto top-up)", `specs/flows.md:25`).
- **New route** `POST /v1/starter/topup {chainId, deadline, signature}` in `services/api/src/routes/starter.ts`.
  - **Authorization:** an in-scope EIP-712 `TopUp(user, deadline)` signature, like `Claim`. It is signed by the unlocked session key, so there's no surprise Face ID/SIWE prompt while typing. The api verifies it off-chain.
  - Single-flight per (chain, user, kind) as in D-166.
  - Reads the balance and fee quote. The target is `GAS_TOPUP_ACTIONS × measuredLimit(chain, "increase", n+1) × maxFee`.
  - Sends `StarterDrip.topUp(user, target − balance)` from the sponsor, clamped to the per-day `topUpCapWei`.
  - The api sponsor already holds RELAYER_ROLE, covering `claimFor`/`redeemVoucher`/`topUp` (`Deploy.s.sol:169`, `RoleWiring._dripRelayer`). Confirm on 10143 with a read-only `hasRole` before the first send.
  - Migration `0004_starter_topup`: `starter_claims.kind` CHECK gains `'topup'` (`0002_api.ts:18`), so top-ups are recorded and rate-limited.
  - Practice: allowed after a claim.
  - Mainnet: allowed only for accounts with `equityInit ≥ MAINNET_TOPUP_MIN_EQUITY_USD6`. Real collateral is the anti-sybil cost, so no Turnstile is needed; this amends D-166 for top-ups, not drips.
- **The app** calls it at hold time when `NO_GAS` is the only blocker.
  - It shows staged progress ("Adding gas · finalizing · ready"), waits 3 blocks after funding (Monad rule), then continues the same hold.
  - On failure it gives an actionable reason: budget exhausted → next time; relayer down → retry. There is never an endless spinner.
- **Keeping positions manageable:** the keeper key has **no** RELAYER_ROLE, so its `topups` job would stop at `AccessManagedUnauthorized` (`maintenance.ts:152`). The floor loop moves into the **api**, which is the single process that holds the sponsor key (nonces are per process, `nonce.ts:16-40`).
  - It tops up users with open positions to their close budget (`measuredLimit("close", n) × maxFee`), not 0.02 MON.
  - The keeper `topups` job is deleted. No new role grant is needed.

**S8.16d Gas economics from data.**
- **Measure** 24 h of `baseFeePerGas` on 10143 and 143 (read-only RPC).
  - If it sits at the 100 gwei floor, a **user-send-only** multiplier of ~1.25× (maxFee 202 → 127 gwei, about −37 %) is safe.
  - `MAX_FEE_BASE_MULTIPLIER_BPS` becomes **per sender profile** (`gas.ts:160`, `fees.ts:58`); card, keeper and liquidation keep 2×.
  - Plus one tiny testnet send to settle "maxFee or effective price" for the consensus check. Record the outcome as a D-entry.
- Then **[OK?]** `StarterDrip.setConfig` on 10143 (drip, top-up cap, daily budget sized for N practice trades per day from the measured numbers), and **[OK?]** fund the drip float (≈0.35 tMON today).
  - Testnet MON is the constraint, so the user makes faucet claims now.
  - **Q-017 [OK?, outbound]** asks Monad devrel for a builder testnet-MON grant.
- **Follow-on, researched and not skipped: gasless practice through sponsored 7702 UserOps.** This removes gas from P1's journey ("never sees gas"). The spike must first settle three corrected facts:
  - Simple7702Account has **no code on 10143** (`delegation.ts:8`);
  - StatelessDeleGator is on EntryPoint **v0.7**;
  - the session policy only decodes raw transactions (`evaluate.ts:133-141`), so a UserOp policy path is new work.

  Spike → D-entry → S12 if it holds.

**S8.16e Claim state is authoritative (fixes B3).**
- **The starter query moves into `packages/query`** (`keys.starter(chainId, address)`) and serves **both apps**. The web app has the identical bug (`apps/web/src/lib/account/use-starter.ts:29-63`).
  - The initial state is `checking`, never `idle`, so the Claim button never paints first.
  - `claimed` wins over `lastRelay`.
  - An error shows "couldn't check · retry", never the Claim button.
  - On finalization it invalidates `keys.account` and the gas balance.
- **Live updates:** `EngineSocket.watchAccount` needs a SIWE token (`socket.ts:51`), and `ensureApiSession` signs through the scoped signer (`api.ts:49-57`). It is wired **only when a session already exists**. Otherwise the query polls, so a returning user never gets a surprise prompt (F02).
- **api:**
  - The status route reconciles non-terminal rows against `StarterDrip.claimed(user)` and the receipt.
  - A **boot-time reconciler** fixes rows orphaned when the fire-and-forget `confirmFinalized` (`starter.ts:102-104`) died on a restart.
  - The rate limit is scoped to the current drip with `block_number ≥ <StarterDrip deploy block>`. The column already exists (`0002_api.ts:24`), so no migration is needed.
- Account screen: compact "Practice funds claimed ✓". Portfolio: an "arriving" state while the claim finalizes, instead of "Nothing here yet".
- Navigation from Account into the tabs uses `router.navigate`/`dismissTo`, not `push`.

**Checks** (targeted, money-relevant; no UI tests):
- Extend `scripts/drive/src/ticket-e2e.ts` on a 10143 fork: fresh account → claim → gas budget below need → top-up route → wait 3 blocks → open → close → TP/SL.
- The user repeats S8.16 on the phone.

### W2 — Runtime Practice ↔ Mainnet (S8.22; flows F06 + F49)

Today the network is a source constant (`apps/mobile/src/lib/constants/auth.ts:7`). The query layer is already chain-aware (keys, `QueryEnvProvider`, socket, `PriceStore`). What must change:

1. **`NetworkProvider`** (MMKV `senryo.network.v1`, default Practice). `useNetwork()` replaces the 20+ direct `ACTIVE_NETWORK` reads. The main ones are:
   - `TopStrip.tsx:38`, `IdentityPanel.tsx:58`, `(sheets)/session.tsx:56`, `TradeHeader.tsx:44`, `markets/index.tsx:53`, `portfolio/index.tsx:62,81`;
   - `LpScreen.tsx:43,72`, `CollateralPanel.tsx:38`, `help.tsx:32`, `watch/[address].tsx:68`, `useTicket.ts:95`.
   It feeds `QueryEnvProvider chainId` (`src/lib/market-data.tsx:17`).
2. **`src/lib/account/sender.ts`** holds `read` + `nonces` **per chain** (`Map<chainId,…>`). `LocalNonceSource` is keyed by `(chainId, address)`: today it is address-only, which is the dangerous one.
3. **`src/lib/account/api.ts`**:
   - `policyContext` takes chainId from the provider, or every send is rejected `wrong-chain`;
   - the api session is cached per `(address, chainId)`;
   - server side, chain-scoped routes check the JWT `chainId` claim (`services/common/src/session.ts:40`).
4. **Face ID mode per network.**
   - A **versioned v2 settings schema** stores `faceId: { practice, mainnet }`, and a v1 parser migrates the old single value. Today `parseSettings` silently drops object values (`apps/mobile/src/lib/account/settings.ts:19`).
   - It touches ~13 mobile, 8 web and 4 `packages/account` files; synced prefs blobs are per address.
   - D-037's defaults are unchanged.
5. **Policy usage** (spend/rate, `policy/evaluate.ts:79,85,149-153`) is per session. Switching to Mainnet **resets usage and relocks**, so practice spend never counts against, or unlocks, real money.
6. **`use-starter`** gets chainId in its deps. Mainnet copy is "use a voucher, deposit, or bring MON" until a native bot check exists; D-166 blocks mainnet gas drips without Turnstile. Practice copy is test dollars.
7. **Per-chain keys and channels.**
   - MMKV `liquidationSeen`/`liquidationDismissed`.
   - `ws.ts:88-91` checks that the session's `chainId` matches the subscribed chain.
   - Push tokens and keeper notify payloads carry chainId.
8. **Gate.**
   - **Mainnet is always selectable; trading is gated.** Trading opens when the bundled address book has 143 (`isDeployed(143,"SenryoCore")`) and `/v1/config` `networks[].deployed` (`routes/info.ts:23`) agrees.
   - Before launch Mainnet is **live read-only**. Prices come through a feed-only read path: Chainlink proxies on 143 via `latestRoundData`, plus indexer 143 candles. Today `useMarket` reads through `addressOf(143,"SenryoCore")` (`markets.ts:30`), and the socket refuses `prices` on an undeployed chain (`ws.ts:85`), so the path is new. The screen says "Trading opens at launch".
   - The 143 address book ships in a **new app binary**: there's no expo-updates, and `runtimeVersion` follows the app version (`app.config.ts:75`). W7 includes rebuild + reinstall after S8.18 (EAS **[OK?]**; the user runs it, since EXPO_TOKEN is missing).
9. **UI and signalling (§5.6).** Today's `TopStrip` "MONAD" dot becomes the mode capsule ("Practice · Paper money" violet / "Mainnet · Real money" blue).
   - It opens the selector sheet, and entering Mainnet takes a deliberate "Switch to real money".
   - Practice amounts show `P$`. Mode is on every money surface, and receipts carry their own mode.
   - Drafts are keyed per (mode, market).
   - The redesign's dock header hosts the same capsule.
10. **Other chain-bound state:**
    - `EngineSocket.watchAccount` re-subscribes on the new socket;
    - deep links and push taps carry chainId (F41/F49), so the mode switches before routing;
    - the web app gets the same provider in S11b.

    **TxRecovery is net-new, not a tweak.** `_layout.tsx:59` says "Later: TxRecovery", and 00-plan schedules it in S12. W7 builds a per-chain TxRecovery host **before the mainnet gate**: it reconciles each journaled entry on its own chain and never resends. `kvJournal` gets a size cap (`sender.ts:57`).

**Check:** a drive script switches the chain in a policy context and asserts:
- a practice nonce is never reused on mainnet;
- a wrong-chain signature is rejected;
- sessions are per chain.

### W3 — Identity registry and real marks (S1b.1–4, new package `packages/identity`)

**Current state** (inventory, file:line in the trace):
- There are no third-party logos anywhere in the repo.
- Mobile renders every asset, chain, venue and provider as text.
- Three UIs fake the seal with a live-font 千 (`Onboarding.tsx:49`, `PrivacyPlate.tsx:20`, web `seal.tsx`), which `brand/README.md` forbids.
- `ASSET_HUE.AUSD` reuses Monad purple (`packages/tokens/src/marks.ts`).

**Build:**
- **Registry** (`src/registry.ts`) keyed by canonical entity:
  - `chain:eip155:143`, `token:143:0x0000…a012a` (AUSD), `native:143:MON`;
  - `market:senryo:143:0`, `market:perpl:143:1`;
  - `venue:perpl`, `provider:icloud-keychain`, …
- **Per entity** (08 "Asset-delivery contract"): role, instrument type, network/venue, **source URL, licence/usage, retrieval date, sha256**, variants (colour disc · mono-light · mono-dark · symbol · wordmark), viewBox/padding/contrast surface, and a separate badge layer.
- **Sources (first-party):**
  - Monad brand kit (`monad.xyz/brand-and-media-kit`: logomark, token, avatar);
  - Circle pressroom (USDC);
  - `monad-crypto/token-list` assets (AUSD and Monad tokens);
  - bitcoin.org (BTC), ethereum.org (ETH), Solana/Base/Arbitrum brand kits;
  - Hyperliquid (HYPE), Zcash (ZEC), Chainlink, Uniswap, Envio, Perpl, Aurora;
  - the **FIDO Alliance passkey icon** (free under its usage guidelines: ≥ 24 px, one flat colour, ≥ 3:1 contrast) for every passkey surface. iCloud Keychain / Google Password Manager marks appear only where the OS identifies the provider, under Apple's and Google's guidelines;
  - exchange marks for the exchange route (Coinbase, Binance, Kraken press kits);
  - flags (public domain) for FX pairs.
- **Codegen:** SVG → react-native-svg components and web components (`@svgr/core`, native template). It normalises packed arc flags (the iOS SVG decoder caveat in the Expo docs) and forbids `<text>`.
- **Invariant `identity-provenance`:** every registry entry has source, licence and sha. A known entity id can never render a generic glyph. The generated components live in `packages/identity`, which `design-literals` doesn't scan (it only scans `apps/*/src`, `rules.mjs:112-125`), so no exemption is needed.
- **`<EntityMark id size variant badge status/>`** for mobile and web. It has loading/failed/unidentified states: readable text plus a labelled neutral fallback, never a fake logo (08 §Acceptance).
- **Original art (§5.10):** XAU koban, XAG chōgin, FX flag-pair discs, the Senryo venue chip, onboarding scenes, completion foil, 12 default avatars. First-pass SVG/Skia masters are authored in code, so no placeholder ships. The user's design agent/illustrator reviews and replaces pieces (B12 stays open until reviewed). "XAU is not Tether Gold" (LG19/LG38).
- **Replace every placeholder** from the inventory:
  - MarketRow, UpcomingMarketRow, TradeHeader, Ticket, PositionDetail, PositionsTable, PositionsAccessory;
  - BucketRegister ("In Perpl"), CollateralPanel, LpScreen, fund families, add-money, StarterCard coins;
  - TopStrip ("MONAD" dot → Monad mark), recovery providers, help sources (Chainlink/Envio/DB-IP);
  - CardFace (real Kinpaku art);
  - web `TokenIcon` letter discs and `SealMark`.
- Delete `ASSET_HUE`/`CHAIN_HUE` once nothing reads them.

### W4 — Design v2: reference-led rebuild (S1b.5+)

**Process** (source-first, from the fidelity contract §5):
1. **`docs/design/reference-study-2026-09-30/PROJECT-HANDOFF.md`**, the Senryo adaptation packet the skill requires:
   - the authority record (§1);
   - selected journeys with their FT/C/M/LG IDs;
   - the Exact/Adapted/Additive/Blocked/Excluded ledger;
   - Senryo rules (passkeys, confirmation, success = finalized);
   - art tasks with provenance.

   Also:
   - A machine ledger `docs/design/senryo-parity-ledger.json`, fields per the fidelity contract §3. It covers FT, C, M and LG rows. Component rows mirror the FT decisions, e.g. C24 prediction cards → Excluded (D-194), C05 passcode → Excluded (D-195), C36 fiat ticket → B3.
   - Codex's direction stored verbatim at `docs/design/senryo-v2/direction.md`.
   - **"SUPERSEDED by D-168" banners** so no builder mistakes D2 for authority. They go on `design/DIRECTIONS.md`, the `d2-*` screenshots and **the study's own D2 references**: `README.md:82`, `05-components-and-agent-handoff.md:89` and the copyable brief `:104-105`, `10-redesign-opportunities.md:5`, and `reference-ledger.json` `target_design_authority`. These edits are recorded as declared adaptations in `COPY-MANIFEST.json`.
   - Then validate with `~/.claude/skills/mobile-reference-study/scripts/validate_study.py`.
   - **Git policy for the study (user decision):** it holds ~26 MB of recordings/frames of other companies' apps and is untracked in a public repo. Recommendation: commit the markdown, the JSON registers and `PROJECT-HANDOFF.md`, and keep the evidence media local (gitignored), referenced by path.
2. **D-entries:** D2 superseded (D-004). D-033 amended with the §5.11 wording. The `00-plan.md` §0 UI rule is updated to match (the root `CLAUDE.md` was deleted at the user's request). The `design-literals`/`design-json-present` invariants are updated for the new token files.
3. **Tokens rewrite** (`packages/tokens`: palette, type, radius, spacing, motion, material): the §5.2–5.4 tables.
   - **Step 1:** swap the *values* under the existing token names, so the live web app (`apps/web/src/app/globals.css`) and every screen keep compiling.
   - **Step 2:** introduce the new roles (practice/mainnet, fan, glass, materials) and retire the old names.
   - Emit CSS. Mobile `theme/` consumes it.
   - **Fonts:**
     - Inter, plus Inter Display (verify the static SemiBold family exists in the Inter 4 release);
     - Noto Sans JP, **subset** to the glyphs we use, or fall back to the system CJK font to avoid megabytes.
   - **Contrast fix:** the light text-3 `#746F82` on `#F5F4F8` is 4.42:1, below AA for 12 pt meta text, so darken it to ≥ 4.5:1.
   - Utility icons: `lucide-react-native`.
   - Web inherits the tokens immediately. Its layouts follow in S11b with the same route/state contracts; the desktop form of the dock is a declared adaptation.
4. **Navigation shell (spike first):**
   - Build the §5.5 five-tab floating dock on `expo-router/ui` headless tabs, and verify stack/scroll restoration on SDK 57 (the API is experimental). **Fallback if the spike fails:** keep NativeTabs on iOS 26 styled as an Adapted C15, with a custom capsule elsewhere.
   - Fan: expo-blur. Dock glass: expo-glass-effect on iOS 26. **Both are already installed.**
   - Sheets: `@gorhom/bottom-sheet` 5.2.14 plus formSheet per §5.5.
   - New native modules: expo-camera (QR scanner), expo-notifications (primer), and expo-sharing or a Skia snapshot for share cards. Install them with `pnpm --filter @senryo/mobile exec expo install`. That means **one new dev-client build** (EAS **[OK?]**, user-run while EXPO_TOKEN is missing), and the user reinstalls once.
   - **Route migration:** today's `(tabs)` Portfolio/Markets/Trade/Card/Fund → Home/Markets/Card/Social/You. Trade becomes the market-detail → ticket path; Fund becomes the Add-money hub reached from Home and the fan. Deep links and push routes (F41) are remapped.
5. **Journeys.** Each is one slice with every state and its evidence IDs. The screen list per journey is Codex's §5.13 inventory.

   | Journey | Covers | Order |
   |---|---|---|
   | J4 Ticket | margin vs size, ruler, keypad↔chart, candle settings, SL/TP child, liquidation info, eligibility (mainnet), 500 ms hold, trace, receipt + share | 1st (money path) |
   | J3 Markets | watchlist, categories incl. FX/crypto/equities, filters, search, market detail, Holders/Feed/About, history, alerts | 2nd |
   | J6 Home | balance + availability cells + details, positions, Kinpaku/LP tiles, Top Trades, mode capsule + selector | 3rd |
   | J5 Positions | own position detail, add margin/reduce/close, orders/triggers, activity, receipts | 4th |
   | J2 Add money | hub, practice claim, voucher, source-chain/asset selectors, other-chain primer/config/QR/status, Monad receive, exchange chooser + instructions, swap + route | 5th |
   | J1 Onboarding | story welcome, create passkey, sign-in, recovery guide, handle, follow, voucher code step (FT041/067 pattern), terms, biometric/notification primers, completion, account-required, step-up. **The illustrator/design-agent review of the hero and scene art comes before J1 starts** (the "no mediocre design" rule). | 6th |
   | J8 Social | feed + thesis detail/replies/compose, people, leaderboard, trader profile, followers, profile/avatar editor, global search, send recipient/contacts/scanner/review | 7th |
   | J7 Card | tutorial, home, reveal, allowance, freeze, wallet, activity, auth detail, simulation, availability | 8th |
   | J9 You | identity/addresses, security/passkeys, session policy, preferences, notifications, advanced, delete data, help, terms, status | 9th |
   | J10 LP | vault, deposit/redemption review, request history | with J6 |
   | J11 Spot tokens | token list, token detail, buy/sell ticket via the Uniswap route | after J1–J9 |

6. **Acceptance per journey** (05 fidelity matrix, no automated UI tests):
   - simulator screenshots at the 402×874 reference viewport, next to the reference frames;
   - motion recorded and compared against the M-clips (start, intermediate, settle, exit);
   - back/dismiss restores the parent with values kept;
   - loading, empty, error and retry states exercised;
   - reduced motion.

   Evidence goes into `acceptance.md`.

### W5 — Social (new stage S12b)

**Privacy first: one address on both networks.** The passkey account has the same address in Practice and Mainnet (`mode.tsx:36`), and the indexer's GraphQL is public. So a public practice handle can de-anonymise the holder's **real-money** account. Rules:
- `GET /v1/profile/:address` never reveals the handle of an account that isn't listed on the queried network.
- `@handle` resolves on Mainnet only for `listed_mainnet` profiles.
- The handle step says plainly: "Your Senryo address is the same in Practice and Mainnet. Anyone who knows it can see your onchain activity."
- "Nothing is shown without opt-in" applies to Senryo's screens. Onchain data stays public, and the copy says so.

**Data** (the api Postgres, new migration `services/common/migrations/0005_social.ts`; `0004` is W1's top-up kind):
- `profiles`:
  - address PK and `handle`:
    - case-insensitive unique; rules `[a-z0-9_]{4,20}` (§5.9);
    - reserved list (senryo, admin, support, monad, …) plus a blocked-words list;
    - a handle change keeps a 30-day tombstone so nobody can instantly re-squat or impersonate;
  - display name, bio (≤ 160), `avatar` (authored set id);
  - per-network visibility, each an explicit choice on the handle step:
    - `listed_practice`: pre-set on, visible toggle;
    - `listed_mainnet`: **off**, explicit opt-in with "Real money" copy;
    - `public_trades_practice` / `public_trades_mainnet`: same pattern.
- `follows(follower, followee, at)`.
- `posts(id, chainId, author, kind thesis|reply, parentId, positionId?, marketId?, text ≤ 280, at)`: theses and replies, with thread connectors in the feed.
- `likes(postId, address)`.
- **User-generated-content safety** (App Store 1.2):
  - `reports(targetKind post|profile, targetId, reporter, reason)`;
  - `blocks(blocker, blocked)` and `mutes`;
  - a content filter on handles, bios and posts;
  - a visible contact point.
  - Reports are weighted: claimed/funded reporters only. Auto-hide needs weighted reports **and** admin review, so sybils can't brigade it.
- `feed_events(chainId, cursor, …)`: an **api poller** ingests `Fill`/`Position` rows over indexer GraphQL after a cursor, with a `chainId` filter, for opted-in addresses only. The api database and the indexer are separate, so a SQL join is impossible. Follows are capped per account. The poller checks that the Hasura aggregates it needs are enabled, and falls back to paging.

**Routes** (SIWE session, single-flight, 429s per D-166; writes require a session for **the same address**):
- `GET /v1/handles/:h/available`;
- `PUT /v1/profile`, `GET /v1/profile/:handleOrAddress`;
- `POST/DELETE /v1/follow/:address`, followers/following;
- `GET /v1/leaderboard?chainId&period=24h|7d|30d|all&scope=all|following`;
- `GET /v1/feed?chainId&scope=global|friends&market?&cursor`;
- `POST /v1/posts`, `POST /v1/posts/:id/like|report`;
- `GET /v1/search?q&kind=markets|tokens|traders`;
- WS `feed:{chainId}` for the "New activity" pill.

**Source of truth** for performance is the indexer, with per-network datasets:
- **Leaderboard metric.** `UserDailyStats` has fees and funding but **no borrow** (`schema.graphql:577-591`). Two ways to make it honest:
  - add `borrow` to `UserDailyStats` in the indexer (it needs a re-index; do it with the mainnet re-sync) and publish "net realized PnL after fees, funding and borrow";
  - or name it exactly "realized PnL after fees and funding".
  
  Periods:
  - **24h is rolling**, computed from `Fill` rows (daily buckets are UTC days);
  - 7d/30d/All use daily buckets, labelled "UTC days".
  
  "Not ranked" is shown instead of 0.
- **Anti-farming.** The device id is client-supplied (`routes/starter.ts:32-36`), so ranking requires minimum trades and notional over the window. Only accounts above that bar become onboarding follow suggestions.
- `Fill`/`Position` feed events and Top Trades (verified weekly closes) come through the poller above.
- `Position` powers market Holders (FT098: leveraged positions, never "ownership").

The api computes leaderboard snapshots every 60 s (listed profiles only) and caches them. The feed is served from `feed_events` with cursor pagination. Nothing is ranked or shown on Senryo's screens without that network's opt-in.
- **Delete my data** (`app/account/delete-data.tsx`) also deletes profile, posts, likes, follows, blocks and reports.
- **WS caps** (per connection and per IP) land before `feed:` fan-out; D-166 deferred them to S14, and they move here.

**Screens** (W4 J8; reference C09/C11/C27–C31/C38; FT038/039/065/066/070/074–079/083/085/086/098):
- handle step in onboarding (skippable);
- "Follow top traders" (top of that network's 30d leaderboard, **none preselected**, a reason shown per row, Skip);
- profile, trader profile, profile/avatar editor, followers/following;
- People (Friends/Leaderboard + Your rank);
- Feed (Global/Friends, thesis detail with replies, compose, New activity pill);
- Holders/Feed tabs on market detail;
- global search;
- send-to-@handle with a review showing the resolved address.

**Depends on:**
- W2's per-network separation;
- the indexer consumer audit (W7 item 1): every document filters on `chainId`.

Indexer rows are already per chain (composite key), so no re-index is needed for social. The only re-index is the optional `borrow` column, which rides with the mainnet indexer change.

### W6 — Market breadth (S8.23 contracts track + S7)

- **Our engine gains FX majors:** EUR/USD, GBP/USD, JPY/USD, CHF/USD, CAD/USD on Chainlink push feeds (240 s heartbeat).
  - **Feed addresses.** EUR, GBP and JPY are in `context/03-sponsors/finance-trading/chainlink-cre.md:81-83`. CHF and CAD come from `deep-dive-rwa-perps.md:121` (truncated) and Chainlink's Monad feed directory. Every feed is verified on 143 with `description()`/`decimals()`/`latestRoundData` before use.
  - **Listing is timelocked.** `addMarket`, `setFeed` and `setWeek` are PARAM_ADMIN with a **6 h delay** (`RoleWiring.sol:40-55,77`).
    - Mainnet: FX goes into `Deploy.s.sol` `_coreInitCode`/`_feedInits` (`:190-205`), so the markets exist at construction inside the S8.18 [OK?] deploy, before admin moves to the Safe.
    - Testnet: an ensure-style `AddMarkets.s.sol` that **schedules, then executes** after the delay [OK?].
  - **Risk.** Per-market params (leverage, spread, OI caps) in `SeedConstants.sol` plus `packages/core` constants, with `risk-mirror-constants` kept green.
    - **Correlated exposure:** EUR, GBP and CHF all move against the USD, so an **aggregate USD-exposure cap** across FX is sized against the 250 AUSD LP seed. Per-market caps alone don't bound it.
    - **Max open positions:** gas grows +170k per extra open position on increase, +220k on `placeHold`, and liquidation is 350k + 180k·n (`gas.ts:114-130`). Decide the per-account maximum (D-entry), and let card holds, liquidation budgets and top-up targets use it.
  - **Keeper running cost.** `observe` pokes on every price change (`keeper/src/jobs/oracle.ts:34-38`) at 250k gas ≈ 0.0255 MON. With a 240 s heartbeat, 5 FX feeds would cost **≥ 46 MON/day on mainnet**, which isn't in the Q-012 budget.
    - Change it to poke **only on status edges, or when a market has open interest**, and budget per market.
    - The testnet mirror pushes (≥ 29/day/feed) are budgeted against the keeper's ~2.1 tMON.
  - An FX calendar (24/5) in `MarketCalendar`.
  - Indexer: the feeds are added to `indexer/config.yaml`.
  - The quote orientation matches the feed; JPY/USD is **never silently inverted**.
- **Crypto perps via Perpl (S7, unchanged plan).** BTC, ETH, SOL, MON, HYPE, ZEC with the Perpl venue badge, on the same ticket (Agora deliverable).
- **Equities and indices (NVDA, SPY, QQQ, TSLA, SPCX, EWY) and oil are listed, and default to Blocked B2 with a research route.** Fomo's Perps list shows this breadth (M09), so it is baseline.
  - They show as "Indicative · hourly calculated feed · trading unavailable". The "calculated" feeds price the **tokenized wrapper** (wNVDAx…), not the stock itself, so the label names it.
  - The SessionOracle treats a feed as fresh up to heartbeat + grace (`SessionOracle.sol:161`). That's another reason not to trade on it blindly.
  1. **Measure** the Chainlink "calculated" feeds on 143 (wNVDAx `0x03ffa467…`, wSPYx, wTSLAx, wSPCXx, wEWYx, wQQQx; 3,600 s heartbeat) over ≥ 1 US session, read-only. Find out whether they also update on a deviation threshold, and what it is.
  2. **If** updates are deviation-bounded, list them on our engine with:
     - spread ≥ the deviation threshold, so stale-price edge is priced out;
     - leverage ≤ 5×;
     - small OI caps;
     - an equities calendar (US session, with reduce-only outside it, per the 24/5 guidance);
     - SessionOracle STALE past heartbeat + margin.

     Record a D-entry with the numbers.
  3. **Else** keep them Blocked on Chainlink Data Streams (Q-008, credentials asked of Chainlink) or a Pyth plan (Q-014, **paid → user [OK?]**). Oil (WTI/Brent) is Streams-only.
- **Markets list categories:** All · Watchlist, then Commodities · FX · Crypto · Equities/Indices chips (FT072). Oil sits under Commodities.

### W7 — Mainnet, cold start and the indexer (S8.17–S8.21, S8.24)

1. **Indexer: no id namespacing is needed. Audit the consumers instead.** (An earlier draft of this plan had this wrong.)
   - `indexer/config.yaml:9` sets `disable_default_cross_chain: true` (Envio 3.12.1). With that flag, every entity table has a **composite `(id, chainId)` primary key**, so the same id on two chains is two independent rows (`references/envio-local-docker-example/.claude/skills/indexer-multichain/SKILL.md:24-28`). The "namespace ids with chainId" advice only applies without the flag.
   - The keeper maps `User.id` straight to an address (`indexer-documents.ts:27`), so prefixing would break it.
   - Instead, add an invariant: **every indexer document has a `chainId: { _eq` filter**, plus the §9 separation check.
   - Correct the stale collision notes in `STATUS.md:11` and stage-08 S8.11/S8.20. **No `envio start -r` on the live practice indexer.**
2. **Mainnet cold start** (without it, a new mainnet user has no way in):
   - Gas drips need Turnstile on mainnet (D-166), and native has none.
   - A top-up needs equity.
   - QR/inbox deposits are **never credited**: nothing calls `InboxFactory.sweep(user)` (`InboxFactory.sol:40`; the sweeper was scheduled for S9).

   The fix:
   - **A keeper `sweeps` job** calls the permissionless `InboxFactory.sweep`, driven by the indexer's inbox `Transfer` rows. The keeper pays gas; the user needs none.
   - **Vouchers**: `redeemVoucher` is sponsor-relayed and needs no user gas.
   - Either one creates equity, which then qualifies for gas top-ups (W1 S8.16c).
   - J2 and the fan's Receive show `inboxOf` on Mainnet only once the sweeper is live.
   - Copy: "Use a voucher, deposit to your Senryo address, or bring MON" until a native bot check exists (S12/S15).
3. **TxRecovery host** (W2.10) before the mainnet gate.
4. **Sequence**, each **[OK?]** at that moment:
   - S8.17 funding (user; Q-012 now also includes the keeper observe/sweep budget);
   - S8.18 deploy (**with the FX markets at construction**) + Safe;
   - S8.19 seed;
   - S8.20 indexer config for 143 + api `CHAIN_IDS=10143,143`;
   - **app rebuild + reinstall with 143.json** (EAS);
   - S8.21 gate on the fixed current UI.
5. **Deploy actions needing [OK?]:**
   - api deploys (top-up route, migrations 0004/0005, social);
   - keeper deploy (`sweeps` job, observe policy);
   - the indexer 143 config change;
   - the EAS build.

## 5. Design v2 direction: **"Living Lacquer"**

Source: Codex CLI, gpt-6.1-sol at xhigh, a read-only consult of `main@8f8acdd` using the `mobile-reference-study` and
`reference-product-fidelity` skills. The full text is kept verbatim in `docs/design/senryo-v2/direction.md` (W0).

Summary: **Fomo's rounded trading interface and dark violet surfaces + Phantom's contextual action fan + Solflare's
illustrated onboarding and material artwork. Senryo's seal, gold leaf and lacquer are the identity inside that language.**

**5.1 One reference authority per surface**

| Authority | Surfaces (evidence) |
|---|---|
| **Fomo** | Core colours, amount hierarchy, rounded controls (F09–F12, F37–F42) · floating dock (C15, M09/M10) · collapsing header + categories (C16) · funding selectors over dimmed parents with child back (C33/C34, M12/M16) · market detail (F32–F35) · shared position sheet (C25, F13/F14) · follow/leaderboard/feed (C27–C30) |
| **Phantom** | Quick actions: strong live blur, four circles staggering into a vertical right column (C18, P19, M06) · auth waiting with live art (P01/P04, OP10) · handle validation (C09, P05/P07/P08) |
| **Solflare** | Onboarding: six scenes, rounded clipped hero, fixed controls (C01, S01–S06, M01) · completion material (C08, S13, M18) |

**5.2 Tokens.** The light theme, exact fonts and springs are declared adaptations; the recordings don't establish them.

| Role | Dark (default) | Light |
|---|---|---|
| Background · raised · sheet | `#0A0911` · `#13121A` · `#191822` | `#F5F4F8` · `#FFFFFF` · `#FFFFFF` |
| Glass/dock tint · rim · divider | `#201E2BD9` · `#FFFFFF24` · `#2C2938` | `#FFFFFFD9` · `#FFFFFFB3` · `#DEDBE6` |
| Text 1 · 2 · 3 | `#F5F4FA` · `#B8B5C4` · `#8F8B9F` | `#17151F` · `#5F5B6B` · `#746F82` |
| Primary action · on-primary · link | `#414EF4` · `#FFFFFF` · `#8B95FF` | `#414EF4` · `#FFFFFF` · `#3643D8` |
| Up · down · warning · warning surface | `#25CF68` · `#FF5A48` · `#F2B85C` · `#332719` | `#087F3C` · `#C83225` · `#8A5800` · `#FFF0D5` |
| **Practice** accent · surface | `#B69DF8` · `#282038` (violet) | `#7049C8` · `#EEE7FF` |
| **Mainnet** accent · surface | `#8B95FF` · `#1B2040` (blue) | `#3643D8` · `#E8EBFF` |
| Fan circle · fan text | `#C3B5F6` · `#211A31` | `#D5C8FF` · `#211A31` |
| Gold UI · silver UI | `#D4AE5B` · `#C9D0DD` | `#89611F` · `#626D7E` |
| Sheet scrim · fan scrim | `#00000066` · `#0A091180` | `#17151F38` · `#17151F55` |

Material ramps (shadow/mid/highlight):
- gold leaf: `#886426`/`#D4AE5B`/`#FFF0BC`
- silver: `#697383`/`#C9D0DD`/`#F4F6FB`
- lacquer: `#17121B`/`#29212F`/`#514357`

Solflare's scene colours (`#FAF543 #7690ED #C4DA78 #F58CE1 #F1803A #B7BBC6`) are **onboarding artwork backgrounds only**.

**Gold identifies Senryo and Kinpaku.** It never means buy, profit, warning or mainnet.

**5.3 Type, geometry, icons**
- **Type:** Inter 400–700 for UI. Big numbers use **Inter Display SemiBold**: home balance 52/56, ticket margin 64/68, market price 40/44. Body 16/22, rows 16/20, meta 12/16. **Noto Sans JP** for Japanese. The seal stays vector.
- **Figures and case:** tabular lining figures for money. Sentence/title case; **no tracked uppercase**. Fonts load via expo-font (OFL).
- **Radius:** 8/12/16/24/32/pill (chips · inputs · rows · cards and sheet tops · onboarding hero · buttons/dock/fan/avatars).
- **Spacing and targets:** 4-pt spacing, screen inset 20, rows ≥ 64, touch targets ≥ 44.
- **Icons:** utility icons are **Lucide** (lucide-react-native, SVG). Real logos identify entities; Lucide identifies actions.
- **Materials:** content surfaces stay opaque and quiet. Glass is only on the dock; strong blur only behind the fan; ordinary sheets **dim** the parent.

**5.4 Motion families.** Ordinary transitions use `cubic-bezier(0.2,0.8,0.2,1)`.

| Interaction | Timing (spring = mass/stiffness/damping) |
|---|---|
| Press | 80–120 ms |
| Selection / validation | 160–180 ms |
| Page push | ~320 ms |
| Compact selector | ~420 ms, spring 1/260/30 (M02) |
| Tall detail / transaction | 420–480 ms, 1/240/30 (M07/M08/M13) |
| Parent → differently sized child | ~600 ms (M16) |
| Fan | 200 ms per item, 25 ms stagger, 1/420/30. Send leads with a small overshoot; backdrop 160 ms, plus→× 180 ms, exit ~180 ms reverse (M06) |
| Dock active region | 240–280 ms, 1/500/36 (M10) |
| Header collapse | Scroll-driven over the first ~120–144 pt (M09) |
| Ruler | Direct gesture, snap 1/500/40 (M14) |
| Numbers | 140–180 ms, only on real change |
| First chart reveal | 600–900 ms after data (M08) |
| Onboarding scene | ~850 ms (M01) |
| QR assembly | ~650 ms, final payload always valid (M04) |
| Ambient art | Independent 6–10 s loops |
| Completion foil | One 700–900 ms reveal **after the real outcome** (M18) |

Reduced motion uses static art and ~100 ms crossfades. Reduced transparency uses opaque equivalents. Haptics: selection ticks, one on submit, one on the confirmed outcome. No sound by default.

**5.5 Navigation**
- **Five-tab floating glass dock: Home · Markets · Card · Social · You** (C15):
  - capsule ~64 pt high with a 16 pt inset;
  - moving active region; visible labels;
  - tab state and scroll are preserved;
  - hidden during transaction entry;
  - content padded so actions never sit under it (Fomo's overlap is a defect we fix).
  - **NativeTabs is retired as the visual shell.** Expo Router stacks stay. The custom shell uses `expo-router/ui` headless tabs, which are documented as experimental: verify stack restoration on SDK 57 first (W4 spike).
- **Social** holds Feed (Global/Friends) and People (Friends/Leaderboard). **You** holds profile, account, activity, security, preferences and support.
- **Phantom fan** from a lower-right plus: **Send · Receive · Add money · Swap**. Circles ~48 pt with 72 pt spacing, labels on the left, live blur, plus→×. Long/Short entry belongs to a market.
- **Collapsing Home header** keeps the seal, compact balance and **mode**. Markets keeps its title, mode and category chips. Mode never scrolls away.
- **Sheet grammar:**
  - compact selector: content-sized, < 60 %, dim;
  - tall detail: 90–94 %, sticky actions;
  - full-height transaction: fixed identity/action zones and keypad/chart region;
  - nested child: explicit back, keyboard-aware.

  Market detail, profile edit, recovery and full receive instructions are **page pushes**.
- **Libraries:**

  | Use | Library |
  |---|---|
  | Simple selectors | expo-router `formSheet` (`fitToContents` with explicit sizing) |
  | Funding parent/child, detail, ticket, TP/SL | **@gorhom/bottom-sheet 5.2.14** (Reanimated 4 peer; verify keyboard/gesture/restoration on device). Never nest Gorhom inside a native formSheet. |
  | Fan blur (Android `blurTarget` API) | **expo-blur** |
  | Dock on iOS 26 | **expo-glass-effect**, gated by availability and reduced transparency |
  | Leverage ruler | Gesture Handler + Reanimated + Skia/SVG ticks, built for purpose |
  | Charts | victory-native/Skia stays |

  New native modules need a new dev-client build (EAS), and the user reinstalls.

**5.6 Practice ↔ Mainnet (W2's UI)**
- A persistent mode capsule sits top-right: **"Practice · Paper money"** (violet) / **"Mainnet · Real money"** (blue).
- Tapping it opens a compact selector with two explained rows. Fresh accounts start in Practice. Entering Mainnet takes a deliberate **"Switch to real money"**.
- Practice amounts render **`P$`** with "paper money".
- Mode appears in the ticket header and confirmation, receive/QR (mode + full network name + asset), and pending/receipt/share. A receipt carries **its own** mode and never infers it from the current mode.
- Rankings use separate datasets. Notifications carry the mode.
- Switching invalidates quotes. Drafts are keyed per mode (restored, or discard asked). In-flight transactions keep their mode.
- **Perpl practice (B10):** crypto practice needs a verified testnet lifecycle (Q-002: Perpl testnet needs 100 AUSD) or an explicitly labelled Senryo paper simulator. It is never implied.
- Mock collateral is labelled **Mock/Test**.

**5.7 Home and money semantics**
- Home order: Balance → **Free to trade / Free to spend / Locked as three availability cells, not an additive partition bar** → Positions → Kinpaku / LP vault → Top Trades.
- Free to trade and Free to spend are overlapping capacities (`specs/risk-math.md:20`).
- Balance details reconcile the headline without double-counting:
  - "At Perpl — move back to spend";
  - LP allocation plus redemption state;
  - unrealized gains kept separate from spendable money;
  - Locked broken down into margin and holds.
- The current `PartitionBar`/`BucketRegister` presentation is retired.

**5.8 Ticket.** Fomo anatomy (C39–C43, M14):
- margin dominant; leveraged size secondary;
- centred graduated ruler; keypad ↔ chart inside the ticket;
- presets; available, quantity, fees, liquidation, session and price freshness all visible;
- TP/SL as a keyboard-aware child with price/% fields and side-aware validation.

**The 500 ms hold stays.** C43 shows only a disabled slider; a successful slide was never recorded.
- The control is a pill, "Hold to open Long/Short", with linear progress. Early release cancels; an expired quote resets.
- An accessible explicit review/confirm alternative exists.
- Native auth and risk checks are distinct from submission.

**5.9 Social rules** (the approved add-ons):
- **Handles:** `[a-z0-9_]{4,20}`, case-insensitive unique.
- **Onboarding follows:** none preselected; each shows why it's suggested; Skip is always available.
- **Leaderboard:**
  - metric is net realized PnL after fees and funding, with the definition published;
  - 24h/7d/30d/All;
  - Practice and Mainnet ranked separately;
  - missing coverage shows "Not ranked", never 0.
- **Top Trades:** verified weekly, opt-in.
- **Feed:** separates fills, position changes and authored theses (with **replies**). Follow is not copy trading.
- **Holders:** indexed leveraged positions, never "token ownership".
- **Send to @handle:** resolves to an immutable address, and the review shows recipient + address + asset + network + mode. Picking a handle never sends.
- **Search:** All / Markets / Tokens / Traders, with loading, no-results, failure and recents states.

**5.10 Artwork.** SVG masters rendered with Skia + Reanimated. **No Rive/Lottie.** An engineer integrates it; authored material work is required.

| Asset | Direction |
|---|---|
| XAU | Original **gold koban** with embossed 千, edge thickness and restrained foil highlights (never Tether Gold, LG19) |
| XAG | Original **silver chōgin bar**, same viewpoint and optical scale |
| FX | Overlapping **flag-pair discs** (EU/US, UK/US, JP/US, CH/US, CA/US) with the pair text always present |
| Onboarding hero | Six scenes: one balance · passkeys · commodities/FX/crypto · LP liquidity · Kinpaku · Practice↔Mainnet. Lacquer card, koban/chōgin, passkey object, real market marks. Controls anchored; "Browse markets" as a secondary action. |
| Completion | Gold leaf flexes; highlight crosses the 千 seal, **after the real outcome** |
| Default avatars | 12 original illustrated portraits, stable per account, editable |

The seal geometry is kept and recoloured through the gold ramp.

**Authoring route:** I produce first-pass SVG/Skia masters in code, so no placeholder ships. The user's design agent or an illustrator reviews against the evidence and replaces any piece. The registry makes each swap one file. **B12 stays open until that review passes.**

**5.11 Component sourcing.** D-033 is amended to Codex's wording:

> "Reference evidence first; 21st.dev first among component sources that preserve that evidence. RN ports and reference-native reconstructions are recorded in `apps/mobile/.21st/design.json`, with evidence IDs, provenance and declared deviations."

- An available component never dictates layout or drops states; C40 is never a plain slider.
- Custom reconstructions are labelled, with no fake 21st attribution. The D2 manifest is superseded.
- The `00-plan.md` §0 UI rule is updated to match (the root `CLAUDE.md` was deleted at the user's request).

**5.12 Logo presentation per surface** (first-party files only; crops are evidence):

| Surface | Presentation |
|---|---|
| Market rows | 32–40 pt discs |
| Market detail | ~48 pt |
| Ticket, position, receipt | Asset + explicit venue chip (Senryo / Perpl). **Never Fomo's Hyperliquid badge** |
| Network selector | Authentic mono silhouettes + full names (Fomo F21) |
| QR | Source network, asset and destination are separate identities; a centre logo must keep the code scannable |
| Status | Checks, pending, stale and unavailable are distinct from logos |

Per entity:
- **Monad/MON:** colour disc for the asset; mono silhouette in network context.
- **USDC:** official token mark, ≥ 32 px (Circle rule). The mono symbol is used only where appropriate.
- **AUSD:** token art, not Agora's corporate wordmark.
- **BTC/ETH/SOL/ZEC/HYPE:** authentic discs.
- **Base/Arbitrum:** in source-chain rows.
- **Chainlink:** "Price source" in About. **Uniswap:** only when the route uses it. **Perpl:** the venue chip. **Aurora:** "Powered by Aurora" on routes it performs.
- **Passkeys:** the **FIDO passkey icon** (free under FIDO usage guidelines: ≥ 24 px, one flat colour, ≥ 3:1 contrast). iCloud Keychain / Google Password Manager marks appear only where the OS identifies the provider, and never as OAuth buttons.

**5.13 Screen inventory.** Codex lists ~95 surfaces; the full list goes into `PROJECT-HANDOFF.md`, each with states and parent restoration.
- **Blocked families stay reserved screens** in the inventory: fiat, referral, rewards, competitions, news/chat, clans, predictions, NFTs, dApp browser, X link, Shield/hardware, PIN/password.
- **Retire:**
  - D2 terminal identity (pure black, mono amounts, green/yellow primaries, 4 px corners, hairline grids, tracked caps);
  - the D2 manifest as authority; NativeTabs as the shell;
  - gold/silver-only discovery and blanket "FX soon";
  - additive balance partition;
  - generic coins and initials;
  - universal sheet blur, radial fans, flat-logo "material" wobble;
  - success flourishes on submit.
- **Keep:**
  - Senryo 千両, the seal geometry, Kinpaku;
  - passkeys, seedless accounts, Practice/Mainnet honesty;
  - correct money availability;
  - the full market scope, LP, TP/SL, funding families;
  - sound domain/risk/recovery/infra code;
  - Expo Router, Reanimated, Skia, SVG, charts;
  - every blocked baseline capability until completed or explicitly excluded.

## 6. Everything we are adding: the complete add-on list

These are the user's approved add-ons plus every reference capability the parity ledger carries in. Each item has a home (journey/stage).

**Approved by the user (30 Sep)**

| Add-on | What ships | Refs | Home |
|---|---|---|---|
| **@handles + avatar** | Optional handle step after passkey creation. It offers a suggested handle (FT065) with live states: checking / unavailable / invalid length / available / pending (FT039). The avatar comes from an authored default set. The handle is shown on profile, receipts, share cards, feed and leaderboard. It also enables send-to-@handle. | OP11, FT038/039/065/079, C09 | J1, J8 · S12b |
| **Leaderboard + follow** | Leaderboard of realized PnL per network: 24h/7d/30d/All × All/Following. Your rank card; follow/unfollow; Friends tab with recommendations; "Follow top traders" step in onboarding. | OP17, FT066/083/085, C11/C30 | J1, J8 · S12b |
| **Trade feed** | Global/Friends feed of opt-in public fills and position changes, plus authored **theses with likes and replies** (thread connectors). A New activity pill. Weekly Top Trades cards open the shared position sheet (chart, P&L, invested/entry, history, Follow). Follow is never copy trading. | FT070/074/075/076/077, C23/C25/C27 | J6, J8 · S12b |

**Carried in by fidelity (reference capabilities, Adapted to Senryo; not optional)**

| Area | Items |
|---|---|
| Navigation | Five-tab glass dock Home · Markets · Card · Social · You + collapsing header (FT073, C15/C16) · Phantom fan: **Send · Receive · Add money · Swap** (FT055/FT060, C18) · global search All/Markets/Tokens/Traders (FT086, C31) · parent restored after every sheet (FT061/FT112) · mode capsule (FT044) |
| Onboarding | Six-scene story with original layered art and a fixed CTA; Browse markets as a secondary action (FT001/FT035/FT062, C01/C02) · passkey ceremony with living art while pending (FT114, OP10) · Face ID primer (FT006/FT042) · handle → follow top traders → voucher code, with Paste / "I don't have one" (FT041/FT067 pattern, redeems a Senryo voucher) → terms (FT065/FT066/FT068) · gold-leaf completion after the real outcome (FT007, OP13) · notification primer (FT008/FT043) |
| Home | Balance + 24h + Add money header (FT069) · three availability cells + balance details (C19) · positions · Kinpaku / LP vault tiles (C20) · Weekly Top Trades (FT070) · watchlist + categories + skeletons (FT033/FT046/FT048) · profile periods chart (FT078) |
| Markets | Categories All · Commodities · FX · Crypto · Equities/Indices (FT071/FT072) · real asset mark + venue badge + leverage chip + OI (FT095) · candles, live price line, ranges (FT096) · watchlist star, share, activity (FT097) · **Holders** tab of opted-in handles (FT098) · **Feed / About** tabs (FT099) · sticky Short/Long (FT100) · "Go long or short" first-use card (FT072) |
| Ticket | Margin vs leveraged size (FT102) · centred leverage ruler (FT103) · presets + keypad (FT104) · keypad ↔ chart mode (FT105) · candle style (FT106) · Free to trade + quantity (FT107) · enter-amount / insufficient states (FT108) · liquidation info sheet (FT109) · SL/TP child with keyboard lift and % suggestions (FT110/FT111) · confirm per §5 → execution trace → receipt + share card (OP16) |
| Funding | Mode-aware method hub: practice claim · voucher · other-chain QR · Monad wallet · exchange · swap (FT087, C33) · network child with authentic mono chain marks and explicit back (FT088, C34) · animated QR receive with copy/share and a network/mode warning (FT011–FT013/FT057, C32) · **exchange route** (Coinbase/Binance/Kraken marks → exact "withdraw USDC on ⟨network⟩ to this address" instructions + pending tracking, FT094) · any-chain deposits: primer, route config, fee/time/expiry, QR, status timeline, error/retry (Aurora, S9; FT014–FT019, C35) · USDC↔AUSD swap ticket + route details with Uniswap attribution (FT056, C37) |
| Send / receive | Send to @handle or address; recents, contacts, QR scanner, review with recipient/address/asset/network/mode (FT058/FT059, C38) · receive sheet (FT057) · withdraw / cash-out review |
| Positions | Own position detail (chart, margin/exposure, fees/funding, TP/SL, reduce/close, history) · orders/triggers · activity history · receipt + share preview · alerts list/editor · service status |
| Card | First-use Kinpaku tutorial (C21) · card home, reveal, allowance, freeze, wallet provisioning, activity, authorization detail, sandbox simulation ("No charge"), availability (FT022–FT024) |
| LP | Vault, deposit review, redemption review, request detail/history (FT026 adapted to the real LP) |
| Mode | Mode capsule + selector with deliberate switch · `P$` for paper · mode on every money surface (FT044) · failure cards with Retry (FT045) |
| **Spot tokens** | Fomo's Tokens tab (FT071) and the "Tokens" search category: buy/sell Monad tokens (MON, WBTC, WETH… from `monad-crypto/token-list`, real logos) via the Uniswap v4 route we already use for USDC↔AUSD. Held in the user's Monad account and shown in Home. **Adapted, later slice** after J1–J6. |
| Education | First-use tips that dismiss into the real feature (FT023) · "Go long or short" markets card (FT072) · liquidation info (FT109) |
| Accessibility | Reduced motion/transparency, VoiceOver labels, 44 pt targets, restrained haptics (A01/A02, FT116) |

**Markets** (not only gold and silver), as in Fomo's Perps list (M09: crypto, stocks, commodities, indices):
- **Our engine:** XAU, XAG + FX majors EUR/USD, GBP/USD, JPY/USD, CHF, CAD.
- **Crypto on Perpl:** BTC, ETH, SOL, MON, HYPE, ZEC.
- **Equities/indices/oil:** NVDA, SPY, QQQ, TSLA, SPCX, EWY, oil. There is a research route to tradability (W6).

## 7. Parity-ledger triage (FT001–FT116) and **the exclusions decided on 1 Oct (D-194, D-195)**

Per the fidelity contract, an Excluded row without a recorded decision is a defect. This plan excluded nothing by itself;
the proposal list below was decided on 1 Oct: D-194 records the user's exclusions, and D-195 records the lead's
researched, reversible exclusion of a separate PIN or password, made after the user asked for that research. Everything
else is Exact, Adapted, Additive, or Blocked with an unblock path.
The machine version goes in `docs/design/senryo-parity-ledger.json`, one row per FT/C/M/LG with target module, data
authority, failure/recovery and acceptance evidence.

The full row-by-row table (FT001–FT116, class plus target treatment) is Codex's ledger, copied verbatim into
`docs/design/senryo-v2/direction.md` and machine-encoded in the parity ledger. Grouped:

| Class | FT IDs |
|---|---|
| **Exact** | 010 012 018 043 045 061 102 112 |
| **Adapted** | 001 002 006–009 011 013–017 019 022–024 026 033–035 038 039 042 044 046 048 055–059 062 065 066 068–079 083 085–088 094–101 103–111 |
| **Adapted, where our lead review corrected Codex** | **081**: our own 24-word export under step-up already exists (S6 `PhraseGrid`). · **041/067**: the code/Paste/"I don't have one"/skip pattern **redeems a Senryo voucher**, which already exists (`redeemVoucher` + the voucher route). The semantic difference is disclosed; the referral-*reward* branch stays B5. · **091/093**: minimum-deposit validation and retained amount + fee lines already exist in the Aurora/QR deposit (F17/F21 "below min") and swap tickets. · **092**: the identity-verification handoff pattern is used for **card KYC** (Immersve hosted KYC, S10/B11), not fiat. |
| **Partial rows** (the Adapted part ships; the named branch keeps its class) | **060** Add money → hub (its fiat "Add Cash" branch is B3) · **080** address disclosure (Google link X, X link B6) · **082** history/settings (Rewards B5) · **032** equity discovery (execution B2, competition B5) · **063** notification primer (its tracking-prompt branch is Excluded, D-194) |
| **Additive** | 114 (real passkey ceremonies), 116 (a11y/reduced motion/haptics) |
| **Blocked** (kept as reserved screens) | 003/036 private-key and hardware alternatives (B4) · 020/021/089/090 fiat purchase (B3) · 029 rewards campaign (B5) · 031/040/047/084 news/X/chat/clans (B6) · 115 until our own lifecycles are proven (B1) |
| **Excluded, decided 1 Oct** (no screen, no reserved placeholder) | D-194 (user): 025 travel/borrowing/virtual accounts and 030 cashback · 027 collectibles (NFTs) · 028 in-app web discovery (dApp browser) · 049–054 predictions and sports · the tracking-prompt branch of 063. D-195 (lead, researched, reversible): 004/005/113 PIN/password — the passkey falls back to the phone's own screen lock |
| **Excluded, binding** (existing product rules, not new decisions) | 037/064 Google/Apple/Privy OAuth (D-029) · the **recovery-phrase import** branch of 003/036. Its private-key/hardware siblings stay B4. |

**Blockers and what unblocks each:**

| Code | Scope | Unblocks when |
|---|---|---|
| B1 | FT115 completed lifecycles | Our own finalized deposits/orders/TP-SL/close/send/spend, with receipts and recovery (acceptance.md) |
| B2 | Equities/oil execution | W6 feed research passes, or Data Streams (Q-008) / Pyth (Q-014, paid → [OK?]) |
| B3 | Fiat purchase | User decision + provider (Coinbase Onramp / Transak / MoonPay with Monad USDC) + D-041 change + [OK?] |
| B4 | Hardware/private-key import (PIN/password: Excluded, D-195) | An explicit security model beside passkeys |
| B5 | Rewards, referrals, competitions, benefits | A defined programme (eligibility, accounting, payout) |
| B6 | News, chat, X link, clans | Real sources/services and moderation |
| B7 | ~~NFTs, dApp browser~~ — retired 1 Oct | Not applicable: D-194 excluded the rows |
| B8 | ~~Predictions~~ — retired 1 Oct | Not applicable: D-194 excluded the rows |
| B9 | ~~Tracking prompt~~ — retired 1 Oct | Not applicable: D-194 excluded the branch |
| B10 | Perpl practice + Perpl TP/SL | A funded testnet flow (Q-002) or a labelled paper adapter; Q-003 prerequisites |
| B11 | Real Kinpaku issuance/spend | S10 provider evidence |
| B12 | Production logos + authored art | First-party provenance plus material review (W3/§5.10) |

**Proposed exclusions** (Codex's list) and what was decided on 1 Oct:
- fiat purchase (B3) — kept Blocked with a path (D-194)
- predictions and sports (B8) — **excluded** (D-194)
- clans and competitions — kept Blocked with a path (D-194; B5/B6)
- NFTs — **excluded** (D-194)
- dApp browser — **excluded** (D-194)
- travel, borrowing, virtual accounts and cashback — **excluded** (D-194)
- campaign rewards and referrals — kept Blocked with a path (D-194; B5)
- organisation news and live chat — kept Blocked with a path (D-194; B6)
- X import/linking — kept Blocked with a path (D-194; B6)
- a separate PIN or text password — **excluded** (D-195, after research)
- the tracking prompt — **excluded** (D-194)

**Recommendation to the user** (closed 1 Oct by D-194 and D-195; kept for the record): exclude predictions/sports, NFTs, the
dApp browser, travel/borrow/cashback, the tracking prompt, and PIN/password, since each is a separate product. Keep fiat (B3)
and referrals (B5) Blocked-with-path, because both serve the "fund your account" and growth promises.

**Decided 1 Oct 2026 (D-194, D-195):**
- The user **excluded** predictions and sports, NFTs, the dApp browser, travel/borrowing/virtual accounts/cashback, and the
  tracking prompt. They get no screens and no reserved placeholders.
- A separate PIN or password is **excluded** after research (D-195). Phones without Face ID or a fingerprint use the passkey
  with the phone's own PIN, pattern or passcode.
- Kept for later (Blocked with a path): buying with a card or Apple Pay, invite rewards, competitions and clans, news and
  chat, X linking, and hardware/private-key import.

## 8. D-entries to record (lead range D-168…D-179)
| D | Decision |
|---|---|
| D-168 | **D2 superseded by "Living Lacquer"** (user decision 30 Sep). Authority record §1. D-004 and `design/DIRECTIONS.md` marked superseded. D-033 amended with the §5.11 wording; `00-plan.md` §0 UI rule updated; root `CLAUDE.md` deleted (user). |
| D-169 | Fidelity contract: the study is the minimum baseline. `PROJECT-HANDOFF.md`, `senryo-v2/direction.md` and the parity ledger JSON. Excluded rows need a recorded user decision. |
| D-170 | Identity registry and provenance, the `identity-provenance` invariant, the FIDO passkey icon, first-party sources only |
| D-171 | Gas: budget = limit × maxFee (same quote the sender signs); api top-up route (sponsor RELAYER_ROLE); mainnet top-ups need funded equity; fee multiplier from 24 h base-fee data; drip/top-up sizes |
| D-172 | Runtime Practice↔Mainnet: provider, per-chain read/nonce/session, Face ID per network, mode capsule + `P$`, mainnet read-only before launch, drafts per mode |
| D-173 | Indexer: rows are already per chain (`disable_default_cross_chain`, composite key), so no id namespacing. Add the invariant that every document filters on `chainId`. Correct the stale collision notes. |
| D-179 | Mainnet cold start: keeper `sweeps` job (permissionless `InboxFactory.sweep`), voucher path, top-ups gated on equity, mainnet copy until a native bot check exists; TxRecovery before the gate |
| D-174 | Social: handle rules, per-network opt-in visibility, leaderboard metric, posts/replies/likes/reports, data sources |
| D-175 | Market breadth: FX majors on the engine, the equities research route (or B2), Perpl crypto (S7), spot tokens slice |
| D-176 | Navigation: five-tab custom dock on `expo-router/ui` (NativeTabs retired as the shell), fan actions, sheet grammar + libraries (Gorhom 5.2.14, expo-blur, expo-glass-effect) |
| D-177 | Confirm mechanic: the 500 ms hold stays (C43 shows no successful slide), with an accessible explicit-confirm alternative |
| D-178 | Home money semantics: availability cells, not an additive partition (`risk-math.md:20`) |
| D-186…D-189 (contracts track) | FX markets at construction in `Deploy.s.sol` + a testnet `AddMarkets.s.sol` (schedule → execute); aggregate FX USD-exposure cap; max open positions per account; keeper observe policy (status edges / OI) and its budget |

**Number ranges** (the S8 lead range D-160…D-179 fills up here):

| Range | Owner |
|---|---|
| D-190…D-209 | S1b design v2 (lead + agent A) |
| D-210…D-219 | S12b social (agent B) |
| D-220…D-229 | contracts track, next |
| D-230…D-239 | W7/mainnet follow-ups |

Each stage file records its range.

**Q-entries to add:**
- Q-017: Monad devrel, testnet MON grant.
- Q-018: fiat on-ramp provider supporting Monad USDC (B3).
- Q-019: FIDO passkey icon download form.
- Also re-ping Q-008/Q-014 (fast equity feeds).

## 9. Verification
**Gates per commit:**
- the fast gate (`pnpm typecheck && pnpm lint && pnpm invariants`), including the new invariants `identity-provenance` and `indexer-docs-chain-filter`;
- the contracts gate when `contracts/` changes;
- the indexer gate (`envio codegen && tsc`) when `indexer/` changes;
- `expo export` for mobile, and the web build (the token swap must keep web green).

**Money and security checks** (targeted, no UI tests):
- **`ticket-e2e` on a 10143 fork:**
  - fresh account → claim → budget below need;
  - a signed `TopUp` → the api top-up → wait 3 blocks;
  - open → TP/SL → close;
  - a remount mid-send never re-enables submit.
- **Gas rule check:** one tiny testnet send with a balance between `limit × effective` and `limit × maxFee` settles the consensus rule. Record it in D-171.
- **Network switch** (drive script):
  - a practice nonce is never reused on mainnet;
  - a wrong-chain signature is rejected;
  - sessions and policy usage are per chain;
  - Face ID settings v1 → v2 migrate.
- **Cold start on a 143 fork:**
  - a transfer to `inboxOf(user)` → the keeper `sweeps` job credits the core;
  - voucher redeem (relayed);
  - an equity-gated top-up.
- **Markets:** `risk-mirror-check` with the FX markets; an aggregate-exposure cap test; the keeper observe policy fires only on status edges and OI.
- **Indexer:** the consumer audit invariant, plus a query check that a 10143 and a 143 row for the same address stay separate.
- **Social api smoke:**
  - a handle race (unique);
  - handle privacy (an unlisted mainnet handle isn't resolvable);
  - block/report;
  - leaderboard window math against `UserDailyStats`/`Fill`;
  - the anti-farming floor;
  - delete-data coverage.

**Phone:**
- the user runs S8.16: claim → trade → TP/SL → close. If Portfolio still misbehaves, ask them to finish "I can see portfolio and everything, but…" or send a screen recording;
- the toggle round-trip with `P$` and the mode capsule;
- every redesigned journey against the reference frames and clips at 402×874 (W4.6), recorded in `acceptance.md`: screenshots, motion start/settle/exit, parent restoration, and loading/empty/error/retry and reduced-motion states.

**Mainnet:** the S8.21 gate on the fixed current UI: deposit → XAU long → close from the phone, visible in the indexer; a closed session blocks opens. Repeat it on the redesigned UI when J4/J6 land.

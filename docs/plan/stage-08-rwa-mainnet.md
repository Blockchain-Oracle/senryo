# S8 — RWA mainnet: gold/silver trading on our engine (wave C, first)

**Goal:** a user trades gold and silver end to end on the phone — Markets with session badges and oracle age → risk
explainer → ticket (keypad, chips, leverage detents, gauge, live preview) → hold-to-confirm → Face ID per D-037 →
execution trace → position management (close, partial, TP/SL) → buckets from the chain — first on practice (10143),
then on **mainnet** after the D-024 assurance gate, the [OK?] deploy and the [OK?] seed. Charts come from indexed oracle
rounds (D-020); mainnet new risk is geofenced (D-023/D-038). Mobile is the surface here; the web desk variant is S11b and
reuses everything below `apps/`.
- **Plan:** `00-plan.md` §1 (D-005, D-009, D-010, D-020, D-021, D-023, D-024, D-028, D-037, D-038), §2.1 (contracts),
  §2.4 (clients), §2.5 (F10, F11, F12, F14, F24, F25, F26, F43, F44, F45, F95 + failure paths), §4 (S8 row + the hard
  money gate), §5 (operations), §6 (user actions).
- **Open first:** `specs/risk-math.md` (binding for the core mirror), `specs/client.md` (packages table, component
  mapping, data flow, lifecycle), `specs/flows.md` (F10 steps + blocker order), `specs/contracts.md` (deploy steps,
  seed constants, Monad specifics), `specs/deploy-runbook.md`, `specs/session-policy.md` (Face ID threshold), D-118
  (testnet relay economics), D-119 (gas calibration), D-121 (geo), D-122 (Universal Router 6-field params), D-155
  (7702 send), S3/S4/S5/S6 Handoffs (swap-in points: `useSample()` → real hooks).
- **Ownership:** `contracts/` (D-122 fix, assurance fixes, gas snapshot), `packages/core` (risk mirror, calendar display,
  blockers — additive), new `packages/query`, `apps/mobile` trading surfaces (markets, trade, positions, portfolio
  buckets, LP, banners), `services/api` additions (candles, geo lookup), keeper job config, mainnet addresses/indexer
  re-sync.
**D-number range:** D-160…D-179 (lead) · D-180…D-189 (contracts track).

## Steps
- [x] S8.1 Stage file
- [x] S8.2 **Practice prices live:** testnet keeper float (D-118 routes: faucets, deployer transfer) → **[OK?]** deploy
      `senryo-keeper` on Coolify (256m, `KEEPER_JOBS` incl. `mirror`) → XAU/XAG OPEN on 10143 with a fresh round
      — user faucet 5 MON split (ids-and-txs); keeper live 30 Sep (user OK), mirror XAU+XAG; XAG OPEN at once, XAU
      CIRCUIT on the 10.4 % catch-up push → self-confirms (D-118)
- [x] S8.3 **[OK?]** deploy the indexer compose (`indexer.senryo.xyz`, S4 Handoff) → api `INDEXER_GRAPHQL_URL` → candles +
      history live for 10143 — live 30 Sep (user OK), image from CI (D-160), api + keeper wired; XAU/XAG OPEN on 10143
- [x] S8.4 Contracts: `CollateralSwapper` → 6-field `ExactInputSingleParams` (`minHopPriceX36`, D-122); mainnet-fork
      swap check matches the Quoter
- [x] S8.5 Assurance (D-024): Slither + Aderyn + Wake on `contracts/`; every finding fixed or documented in
      `docs/security/assurance.md`; invariants I1–I7 green after fixes — contracts track (D-180…D-185)
- [x] S8.5b `security-review` on `services/` (lead) before the mainnet deploy — D-166, assurance.md §Services: 10 fixed, 2 accepted; keeper + migrations pass still owed before the mainnet keeper/card deploys
- [x] S8.6 Gas re-calibration (D-119): `forge snapshot --network monad` + fork/mainnet `eth_estimateGas` → `GAS_LIMITS`
- [x] S8.7 `packages/core` risk mirror (preview only; contract wins): execution price/spread, N, IM/MM, uPnL, liq price,
      FreeToTrade after the trade, caps (OI/skew/trade/min), session calendar display, `blockers.ts` in F10 order;
      differential check vs `SenryoCore.quote` on the fork — `risk-mirror-check` 6/6 mirror checks (D-162); its
      increase + partial-close steps reproduce the D-161 contract bug and re-run after S8.5a
- [x] S8.5a D-161 fix (contracts track) → **testnet core-set redeploy** (addresses, indexer, api, keeper) →
      `risk-mirror-check` fully green — D-164: redeployed + verified, api/keeper/web/indexer on sha-66679dd, indexer
      reset + resumed, check 9/9, live claim finalized; per-position gas wired (card, keeper, orders)
- [x] S8.8 `packages/query`: keys, hooks (markets, market ctx/candles/session, account buckets/positions/orders,
      starter, geo), engine WS client + `PriceStore` (rAF flush, stale after `PRICE_STALE_MS`), TxLifecycle store
      — `@senryo/query` (D-163): market/account/gas hooks, calendar, candles (mainnet feed), socket, send trace, order
      builders; starter/geo hooks stay in the apps' account layer (S6) until S8.15
- [x] S8.9 Mobile Markets live: watchlist (session badge, oracle age, sparkline, ▲▼ + sign), market detail with candles
      (victory-native Candlestick), holiday/STALE/CIRCUIT/HALTED banners (F43–F45)
      — live watchlist + trade header/candles (c6f2dda); ProtocolBanner (guardian pause countdown, settle-only) on
      Markets + Trade, HolidayBanner (≤ 7 days ahead), paused-price copy (F44 in RiskBanner)
- [x] S8.10 Mobile ticket (F10): risk explainer (3 cards, hold "I understand"), side, keypad + chips (MAX = Free to trade),
      leverage detents, margin gauge, live notional/fee/liq/"x% away", session chip, oracle age, blocker chain,
      `HoldToConfirm`, Face ID gate (D-037), execution trace on the lifecycle, receipt + share
      — done (c6f2dda, 66679dd); `pnpm --filter @senryo/drive ticket-e2e` 3/3 on a 10143 fork: fund in scope, open signs
      in scope with TradeContext (no prompt), trace checking→…→finalized, close finalized
- [x] S8.11 Positions (F11, F12, F14): list + detail (PnL with funding/borrow), close (hold), partial close, TP/SL via
      `TriggerOrders` (EIP-712 in session), liquidation-risk banner + post-mortem, reduce-only copy, `MIN_HOLD_BLOCKS`
      — done: list, detail (price/funding/borrow, liq, gauge), 25/50/75 %/all close by hold with previewDecrease,
      closed-session + anti-flash copy, live BottomAccessory mini-bar; TP/SL (sign in session, place/cancel, keeper
      executes; ticket-e2e 5/5 incl. SL → TRIGGER fill); liquidation-risk / paused-price banners + post-mortem card (F12, RiskBanner)
      · (corrected D-173: every entity already has an automatic `chainId` + composite key; documents filter on it)
- [ ] S8.12 Portfolio from the chain: buckets (Free to trade · Free to spend · Locked) at `finalized`, equity, activity
      from the indexer, BottomAccessory mini-bar; delete every `useSample()`/`PreviewBadge` on these screens
- [x] S8.13 LP (F24/F25): TVL, historical APR, utilisation, risks card, deposit, request redeem → countdown → claim;
      blocked while any market isn't OPEN (explained)
      — LP screen on chain reads (readLpVault: value, cap, sLP, wallet AUSD, pending redeems, all-open gate),
      historical 7-day APR (indexed pool days), utilisation from live books, practice faucet; ticket-e2e LP 6/6
- [ ] S8.14 Collateral swap (F26, mainnet): Quoter → `swapCollateral(minOut)` → trace; quote-moved + paused states
      — built: query useCollateralQuote (live mainnet Quoter: 100 USDC → 100.0172 AUSD, 100 AUSD → 99.9728 USDC) +
      swapCollateralRequest (10 bps min-out, per-position gas); portfolio CollateralPanel (mainnet only); the
      end-to-end swap runs with the S8.18 deploy (fork rehearsal first)
- [x] S8.15 Geofence (F95, D-038): api country lookup (DB-IP Lite, D-121) + mainnet blocker; practice never gated — D-165 (DB-IP Lite in the api, ticket + mainnet starter gated)
- [x] S8.16a Stable readings (v2-plan W1): `packages/core` `fromQuery` stale = errored or age > per-query budget (not
      TanStack `isStale`); `ReadingView` fixed child slots; Ticket out of the market ReadingView with a per-(mode, market)
      draft + in-flight trace store (no double submit on remount); tabs layout keeps only `hasOpenPositions`
      — done: `fromQuery(query, {now, staleAfterMs})` + `readingOf` (2× each refetch interval); ReadingView keeps one
      tree; ticket draft + keyed send trace survive remounts (no second submit while running); tabs layout reads only
      `hasOpenPositions`, the mini-bar computes its own summary
- [ ] S8.16b Gas budget = measured per-chain limit × the maxFee the sender signs (`gasBudgetWei`, `useGasBudget` per
      market/side/positions); NO_GAS generic and evaluated last (D-171)
- [ ] S8.16c Auto top-up: api `POST /v1/starter/topup` (EIP-712 `TopUp`, sponsor `StarterDrip.topUp`, migration
      `0004_starter_topup`), api keeps open-position holders at close budget, keeper `topups` job removed; app tops up at
      hold time, waits 3 blocks, continues the hold
- [ ] S8.16d Gas economics from data: 24 h base fee on 10143/143; consensus rule settled by one testnet send; per-sender
      fee multiplier; **[OK?]** `StarterDrip.setConfig` + drip float on 10143; Q-017
- [ ] S8.16e Claim state authoritative: starter query in `packages/query` for mobile + web (initial `checking`, `claimed`
      wins, no Claim button on error, invalidates account/gas); `watchAccount` only with a session; api boot reconciler +
      status reconciliation; drip-scoped rate limit by `block_number`
- [ ] S8.16 Practice gate: deposit → XAU long → partial close → TP/SL → close on 10143 from the phone; a CLOSED session
      blocks opens and allows reduce; txs in `acceptance.md`
- [ ] S8.17 **[OK?]** mainnet funding by the user (Q-012): deployer, sponsor, 2 operators, keeper MON; LP 250 AUSD,
      insurance 50 AUSD, card float 50 USDC (`SeedConstants.sol`)
- [ ] S8.18 **[OK?]** mainnet deploy (`Deploy.s.sol`, ensure-style) + Sourcify/Monadscan verify + roles + admin → Safe
      2-of-3 (owners from the user) + `143.json` export + `address-drift`
      — rehearsed on a 143 fork (D-167): deploy + SeedMainnet + mainnet-rehearsal 6/6 (deposit, XAU long/close,
      collateral swap, LP); procedure: throwaway worktree, `pnpm contracts:export` there, never commit its 143.json
- [ ] S8.19 **[OK?]** seed LP/insurance/card float + mainnet StarterDrip budget (D-030 relayed gas drip)
      — `contracts/script/SeedMainnet.s.sol` (real AUSD/USDC from the deployer, idempotent; card float opt-in;
      StarterDrip float via STARTER_FUND_WEI above the 10 MON reserve)
- [ ] S8.20 **[OK?]** indexer 143 config (addresses + `ENVIO_APP_LAUNCH_BLOCK_143`) + api `CHAIN_IDS=10143,143`
      redeploy. **Corrected (D-173):** rows are already per chain (`disable_default_cross_chain: true` → composite
      `(id, chainId)` keys), so no id prefixing and no reset of the practice indexer; add the invariant "every indexer
      document filters on `chainId`" and (optional, with this change) `borrow` on `UserDailyStats` for the leaderboard
- [ ] S8.21 Gate + Handoff: mainnet deposit → XAU long → close from the phone; indexer shows it; a closed session blocks
      opens; assurance findings closed
- [ ] S8.22 Runtime Practice↔Mainnet (F06/F49, D-172): NetworkProvider, per-chain sender/nonces/session/policy, Face ID
      per network (settings v2), usage reset + relock on entering Mainnet, mode capsule + `P$`, Mainnet read-only before
      launch (feed-only prices), push/deep links carry chainId, ws session chain check
- [ ] S8.23 FX majors on the engine (D-175, contracts track): EUR/GBP/JPY/CHF/CAD feeds verified on 143; risk params +
      aggregate FX USD-exposure cap; FX calendar; mainnet at construction in `Deploy.s.sol`; testnet `AddMarkets.s.sol`
      schedule → execute (6 h) **[OK?]**; keeper observe on status edges/OI; mirrors on 10143
- [ ] S8.24 Mainnet cold start + TxRecovery (D-179): keeper `sweeps` job (`InboxFactory.sweep`); voucher path; mainnet
      copy until a native bot check; per-chain TxRecovery host (never resends) + journal cap; app rebuild with 143.json
      (EAS **[OK?]**)

## Gate
Assurance findings closed (fixed or documented) · mainnet deposit → XAU long → close from the phone (txs in
`acceptance.md`) · the indexer shows it · a closed session blocks opens · fast gate · `expo export` · contracts gate.

## Findings
- **Phone test 30 Sep (user) → root causes (v2-plan §2):** (1) "Adding gas…" dead end — ticket needs 620k × gasPrice
  (0.0632 MON) vs a 0.05 MON drip, nothing tops up (no api route; keeper `topups` off, trading-users-only, no RELAYER_ROLE),
  and the signed maxFee (≈202 gwei) makes the drip worth ~247k gas = zero trades; (2) "keeps refreshing" — `ReadingView`
  moves children between slots on fresh↔stale so the whole Ticket remounts, and `fromQuery` flips on TanStack `isStale`
  every refetch cycle; (3) claim prompt returns — `use-starter` starts `idle`, trusts a stuck `lastRelay` over `claimed`,
  falls back to Claim on errors, never invalidates; Account always shows the card; (4) Portfolio — same remounts + the
  tabs layout re-rendering on every price tick. Fixes: S8.16a–e.

## Handoff

### Contracts track (S8.4–S8.6)
- **S8.4 (D-180, `707ff92`).** `CollateralSwapper` now encodes the 6-field `ExactInputSingleParams` with
  `minHopPriceX36 = 0`, which for exact-in single is the same bound as `amountOutMinimum`; `minOut` stays the user's
  protection. The pool key lives in `SeedConstants.stablePoolKey()`. `Deploy.s.sol` builds the swapper with it and
  calls `core.setSwapper` on the first run. Before this, mainnet would have deployed a zero-key swapper the core never
  used. Mainnet fork: 100 USDC → 100.020357 AUSD and 100 AUSD → 99.969617 USDC through `swapCollateral`, both equal to
  the Quoter; the mainnet `Deploy.s.sol` dry run on the fork completes (31 txs). Fork suites run with
  `MONAD_FORK_URL=<local anvil fork> forge test --match-path 'test/fork/*'`; they skip without it.
- **S8.5 (D-181…D-184, `ed267f7`, `docs/security/assurance.md`).** Finding #1 (D-182, your differential check) is
  fixed your way: `_settleFees` no longer snaps. Also fixed: #2 D-181 (decrease shortfall socialisation, a real
  extraction PoC) and #3 D-183 (oracle answer bound). Added events for the silent setters. The invariant suite gained
  `noPanics` + `aggregatesMatchPositions`, and the handler no longer warps backwards. All tool findings are triaged.
- **Lead actions**
  - **[OK?] Testnet redeploy (required, SenryoCore is immutable).** No constructor or deploy-script change is needed
    for 10143; the S8.4 Deploy change is mainnet-only.
    1. Build from a `git submodule update --init --recursive` checkout. The OZ nested-submodule remappings are part of
       every metadata hash; without them all recorded contracts report `Drift`.
    2. Delete `SenryoCore`, `SessionOracle`, `LpVault`, `StarterDrip`, `InboxFactory` and `IntentRouter` from
       `packages/contracts/src/addresses/10143.json`.
    3. Run `Deploy.s.sol` exactly as in S2.9, with the same KEEPER/OPERATOR/SPONSOR env.
    4. Verify on Sourcify, `pnpm contracts:export`, re-sync the indexer (new addresses + start block, `address-drift`),
       and redeploy api/keeper/card.

    Dry run on a 10143 fork: it reuses AccessManager, MarketCalendar, MockAUSD/USDC and MirrorXAU/XAG, creates the six,
    re-wires roles and re-seeds the books: 30 txs, ~23.4M gas simulated. Practice balances inside the old core stay
    stranded. The new StarterDrip lets addresses claim again and needs its MON float.
  - **Clients.** A close or decrease can now revert `PerpModule.LossExceedsBalance(shortfall)` (D-181). The S8.7
    blockers need "close your profitable position first or add funds". The ABIs are re-exported.
  - The unused errors in `Errors.sol` are kept on purpose until the next full redeploy (see assurance.md).
- **S8.6 (D-185).** `GAS_LIMITS` is re-calibrated from `eth_estimateGas`-equivalents on mainnet and testnet forks.
  Flat values are the budget for ONE open position. The new `positionGasLimit(action, positions)` adds
  `POSITION_GAS` per extra position: count the traded position, and for an opening increase count it after the open.
  `liquidateGasLimit` is 350k + 180k × n. New keys: `swapCollateral`, `setCardEnvelope`, `placeTrigger`,
  `lpRequestRedeem`, `lpClaimRedeem`.
  - **Lead: wire callers to pass the position count** (apps + keeper + card). Most important is
    `services/card/src/submit.ts`, which sends `placeHold` with `fixedGas: GAS_LIMITS.placeHold`. That limit is
    charged in full, so use `positionGasLimit("placeHold", positions)`. Mainnet costs are ~1.5–2× testnet (every
    risk pass reads the AUSD/USDC Chainlink feeds), so the practice numbers are not a guide to mainnet.
  - To re-measure: `anvil --fork-url https://rpc.monad.xyz --network monad` (or the testnet RPC), then
    `MONAD_FORK_URL=http://127.0.0.1:<port> forge test --match-path test/fork/GasProfileFork.t.sol --isolate -vv`
    and read the `estimate <action>.p<n>` log lines.

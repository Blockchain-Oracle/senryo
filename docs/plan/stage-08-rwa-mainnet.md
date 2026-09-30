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
- [ ] S8.5b `security-review` on `services/` (lead) before the mainnet deploy
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
- [ ] S8.9 Mobile Markets live: watchlist (session badge, oracle age, sparkline, ▲▼ + sign), market detail with candles
      (victory-native Candlestick), holiday/STALE/CIRCUIT/HALTED banners (F43–F45)
- [x] S8.10 Mobile ticket (F10): risk explainer (3 cards, hold "I understand"), side, keypad + chips (MAX = Free to trade),
      leverage detents, margin gauge, live notional/fee/liq/"x% away", session chip, oracle age, blocker chain,
      `HoldToConfirm`, Face ID gate (D-037), execution trace on the lifecycle, receipt + share
      — done (c6f2dda, 66679dd); `pnpm --filter @senryo/drive ticket-e2e` 3/3 on a 10143 fork: fund in scope, open signs
      in scope with TradeContext (no prompt), trace checking→…→finalized, close finalized
- [ ] S8.11 Positions (F11, F12, F14): list + detail (PnL with funding/borrow), close (hold), partial close, TP/SL via
      `TriggerOrders` (EIP-712 in session), liquidation-risk banner + post-mortem, reduce-only copy, `MIN_HOLD_BLOCKS`
      — done: list, detail (price/funding/borrow, liq, gauge), 25/50/75 %/all close by hold with previewDecrease,
      closed-session + anti-flash copy, live BottomAccessory mini-bar; left: TP/SL, liquidation banner + post-mortem
- [ ] S8.12 Portfolio from the chain: buckets (Free to trade · Free to spend · Locked) at `finalized`, equity, activity
      from the indexer, BottomAccessory mini-bar; delete every `useSample()`/`PreviewBadge` on these screens
- [ ] S8.13 LP (F24/F25): TVL, historical APR, utilisation, risks card, deposit, request redeem → countdown → claim;
      blocked while any market isn't OPEN (explained)
- [ ] S8.14 Collateral swap (F26, mainnet): Quoter → `swapCollateral(minOut)` → trace; quote-moved + paused states
- [ ] S8.15 Geofence (F95, D-038): api country lookup (DB-IP Lite, D-121) + mainnet blocker; practice never gated
- [ ] S8.16 Practice gate: deposit → XAU long → partial close → TP/SL → close on 10143 from the phone; a CLOSED session
      blocks opens and allows reduce; txs in `acceptance.md`
- [ ] S8.17 **[OK?]** mainnet funding by the user (Q-012): deployer, sponsor, 2 operators, keeper MON; LP 250 AUSD,
      insurance 50 AUSD, card float 50 USDC (`SeedConstants.sol`)
- [ ] S8.18 **[OK?]** mainnet deploy (`Deploy.s.sol`, ensure-style) + Sourcify/Monadscan verify + roles + admin → Safe
      2-of-3 (owners from the user) + `143.json` export + `address-drift`
- [ ] S8.19 **[OK?]** seed LP/insurance/card float + mainnet StarterDrip budget (D-030 relayed gas drip)
- [ ] S8.20 **[OK?]** S4 re-sync (143 addresses + `ENVIO_APP_LAUNCH_BLOCK_143`) + api `CHAIN_IDS=10143,143` redeploy
- [ ] S8.21 Gate + Handoff: mainnet deposit → XAU long → close from the phone; indexer shows it; a closed session blocks
      opens; assurance findings closed

## Gate
Assurance findings closed (fixed or documented) · mainnet deposit → XAU long → close from the phone (txs in
`acceptance.md`) · the indexer shows it · a closed session blocks opens · fast gate · `expo export` · contracts gate.

## Findings

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

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
- [ ] S8.2 **Practice prices live:** testnet keeper float (D-118 routes: faucets, deployer transfer) → **[OK?]** deploy
      `senryo-keeper` on Coolify (256m, `KEEPER_JOBS` incl. `mirror`) → XAU/XAG OPEN on 10143 with a fresh round
- [ ] S8.3 **[OK?]** deploy the indexer compose (`indexer.senryo.xyz`, S4 Handoff) → api `INDEXER_GRAPHQL_URL` → candles +
      history live for 10143
- [x] S8.4 Contracts: `CollateralSwapper` → 6-field `ExactInputSingleParams` (`minHopPriceX36`, D-122); mainnet-fork
      swap check matches the Quoter
- [ ] S8.5 Assurance (D-024): Slither + Aderyn + Wake on `contracts/`; `security-review` on `services/`; every finding fixed
      or documented in `docs/security/assurance.md`; invariants I1–I7 green after fixes
- [ ] S8.6 Gas re-calibration (D-119): `forge snapshot --network monad` + fork/mainnet `eth_estimateGas` → `GAS_LIMITS`
- [ ] S8.7 `packages/core` risk mirror (preview only; contract wins): execution price/spread, N, IM/MM, uPnL, liq price,
      FreeToTrade after the trade, caps (OI/skew/trade/min), session calendar display, `blockers.ts` in F10 order;
      differential check vs `SenryoCore.quote` on the fork
- [ ] S8.8 `packages/query`: keys, hooks (markets, market ctx/candles/session, account buckets/positions/orders,
      starter, geo), engine WS client + `PriceStore` (rAF flush, stale after `PRICE_STALE_MS`), TxLifecycle store
- [ ] S8.9 Mobile Markets live: watchlist (session badge, oracle age, sparkline, ▲▼ + sign), market detail with candles
      (victory-native Candlestick), holiday/STALE/CIRCUIT/HALTED banners (F43–F45)
- [ ] S8.10 Mobile ticket (F10): risk explainer (3 cards, hold "I understand"), side, keypad + chips (MAX = Free to trade),
      leverage detents, margin gauge, live notional/fee/liq/"x% away", session chip, oracle age, blocker chain,
      `HoldToConfirm`, Face ID gate (D-037), execution trace on the lifecycle, receipt + share
- [ ] S8.11 Positions (F11, F12, F14): list + detail (PnL with funding/borrow), close (hold), partial close, TP/SL via
      `TriggerOrders` (EIP-712 in session), liquidation-risk banner + post-mortem, reduce-only copy, `MIN_HOLD_BLOCKS`
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

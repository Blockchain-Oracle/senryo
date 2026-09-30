# S2 — Contracts: SenryoCore and friends on testnet (wave A)

**Goal:** the onchain engine — one custody, one risk-accounted balance — built to spec, checked by targeted invariants, deployed ensure-style to Monad testnet (10143) and exported to `@senryo/contracts`.
- **Plan:** `00-plan.md` §1 (D-005, D-006, D-009, D-010, D-020, D-032, D-036, D-039, D-041), §2.1, §4 (S2 row).
- **Open first:** `specs/contracts.md`, `specs/risk-math.md` (binding), `specs/client.md` (package shape), `context/02-monad/differences-from-ethereum.md`, `context/03-sponsors/finance-trading/chainlink-cre.md` (AggregatorV3 feeds), OZ 5.7.0 source in `contracts/lib/openzeppelin-contracts` (AccessManager/AccessManaged, ERC4626, EIP712, ECDSA, ReentrancyGuardTransient, SafeERC20, Math), Uniswap v4 docs via Context7 `/uniswap/docs` + `/uniswap/v4-periphery`.
**D-number range:** D-052 onward.

## Steps
- [x] S2.1 Stage file; libraries `Constants`, `Types`, `Errors`, `Events`, `PerpMath`; interfaces (`IPriceSource`, `AggregatorV3Interface`)
- [x] S2.2 `SessionOracle` + `MarketCalendar` (clamp, circuit, 3-round confirm, reopen window, DST-union slots, holidays)
- [ ] S2.3 SenryoCore modules (AccountLedger, CollateralConfig, RiskModule, MarketRegistry, MarketAccounting, PerpModule, TriggerOrders, CardModule, LiquidationModule, AdminModule) composed into `SenryoCore`; size < 128 KB
- [ ] S2.4 `LpVault` (ERC-4626), periphery (`StarterDrip`, `IntentRouter`, `InboxFactory`/`DepositInbox`, `CollateralSwapper`), testnet (`MirrorAggregator`, `MockAUSD`, `MockUSDC`)
- [ ] S2.5 Targeted checks: invariant suites I1–I7, PerpMath fuzz, SessionOracle/MarketCalendar scenarios (`forge test --network monad`)
- [ ] S2.6 `script/SeedConstants.sol` + ensure-style `script/Deploy.s.sol` (addresses JSON, drift check, `chainid != 143` for testnet-only)
- [ ] S2.7 `packages/contracts` (`@senryo/contracts`) + `scripts/contracts-export.mjs` (ABIs `as const`, addresses)
- [ ] S2.8 Deployer keystore (`senryo-deployer`, public address only) + testnet MON balance check
- [ ] S2.9 Deploy to 10143 + Sourcify verify + export (needs a funded deployer)

## Gate
`pnpm contracts:check` · `forge test --network monad` (invariants I1–I7 green, fuzz + oracle scenarios green) · `pnpm invariants` · `pnpm lint` · testnet verified · `address-drift` passes.

## Findings
- (filled while working)

## Handoff
- (filled at the end of the stage)

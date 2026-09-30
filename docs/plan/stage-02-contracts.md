# S2 — Contracts: SenryoCore and friends on testnet (wave A)

**Goal:** the onchain engine — one custody, one risk-accounted balance — built to spec, checked by targeted invariants, deployed ensure-style to Monad testnet (10143) and exported to `@senryo/contracts`.
- **Plan:** `00-plan.md` §1 (D-005, D-006, D-009, D-010, D-020, D-032, D-036, D-039, D-041), §2.1, §4 (S2 row).
- **Open first:** `specs/contracts.md`, `specs/risk-math.md` (binding), `specs/client.md` (package shape), `context/02-monad/differences-from-ethereum.md`, `context/03-sponsors/finance-trading/chainlink-cre.md` (AggregatorV3 feeds), OZ 5.7.0 source in `contracts/lib/openzeppelin-contracts` (AccessManager/AccessManaged, ERC4626, EIP712, ECDSA, ReentrancyGuardTransient, SafeERC20, Math), Uniswap v4 docs via Context7 `/uniswap/docs` + `/uniswap/v4-periphery`.
**D-number range:** D-052 onward.

## Steps
- [x] S2.1 Stage file; libraries `Constants`, `Types`, `Errors`, `Events`, `PerpMath`; interfaces (`IPriceSource`, `AggregatorV3Interface`)
- [x] S2.2 `SessionOracle` + `MarketCalendar` (clamp, circuit, 3-round confirm, reopen window, DST-union slots, holidays)
- [x] S2.3 SenryoCore modules (AccountLedger, CollateralConfig, RiskModule, MarketRegistry, MarketAccounting, PerpModule, TriggerOrders, CardModule, LiquidationModule, AdminModule) composed into `SenryoCore`; size < 128 KB
- [x] S2.4 `LpVault` (ERC-4626), periphery (`StarterDrip`, `IntentRouter`, `InboxFactory`/`DepositInbox`, `CollateralSwapper`), testnet (`MirrorAggregator`, `MockAUSD`, `MockUSDC`)
- [x] S2.5 Targeted checks: invariant suites I1–I7, PerpMath fuzz, SessionOracle/MarketCalendar scenarios (`forge test --network monad`)
- [x] S2.6 `script/SeedConstants.sol` + ensure-style `script/Deploy.s.sol` (addresses JSON, drift check, `chainid != 143` for testnet-only)
- [x] S2.7 `packages/contracts` (`@senryo/contracts`) + `scripts/contracts-export.mjs` (ABIs `as const`, addresses)
- [x] S2.8 Deployer keystore (`senryo-deployer`, public address only) + testnet MON balance check
- [ ] S2.9 Deploy to 10143 + Sourcify verify + export — **blocked: deployer unfunded** (0 MON on 10143, 30 Sep)

## Gate
`pnpm contracts:check` · `forge test --network monad` (invariants I1–I7 green, fuzz + oracle scenarios green) · `pnpm invariants` · `pnpm lint` · testnet verified · `address-drift` passes.

## Findings
- **Sizes** (`forge build --sizes`, network monad): SenryoCore 40,630 B runtime / 43,497 B initcode (limit 128 KB — no split needed) · SessionOracle 7,677 · LpVault 6,654 · StarterDrip 5,654 · IntentRouter 4,116 · CollateralSwapper 3,406 · MarketCalendar 2,847 · InboxFactory 2,702 · MockAUSD 2,852 · MirrorAggregator 1,859 · DepositInbox 1,183.
- **Checks** (`forge test --network monad`, 28 tests): invariants I1–I7 green over 256 runs × 128 calls (every handler action succeeds within single runs — verified with the per-run `calls:` log, `-vv`); 7 PerpMath fuzz (1,000 runs each) incl. engine open/close at one price never profits and pool + insurance never lose; 13 SessionOracle + 7 MarketCalendar scenarios.
- **Gas** (gas report): deposit 145.8k (budget 150k — tight), increase 372.6k (450k), close 249.8k (400k), `observe` 132.7k. S3 calibrates `GAS_LIMITS` with `forge snapshot --network monad` + estimateGas.
- **Deploy dry run** on 10143: ~29.2M gas total; forge's worst-case estimate ≈ 5.92 MON at 2× max fee (≈ 2.9 MON at the 100 gwei base fee).
- `via_ir` caches `block.timestamp`/`block.number` inside one test function after `vm.warp`/`vm.roll`; tests use `vm.getBlockTimestamp()` / `vm.getBlockNumber()`.
- forge-std's `Test` defines `Account`; tests import ours as `CoreAccount`.
- `Contract.fn.selector` fails for inherited functions via the derived contract name; RoleWiring uses the declaring module (`CardModule.placeHold.selector`).
- `forge lint` exits 0 with warnings left for the D-024 assurance pass: mostly `reentrancy-events` (every entry is behind the shared transient lock; the oracle/swapper are trusted), `unsafe-typecast` (bounded uint64 timestamps), `block-timestamp` (inequalities only; invariant `sol-no-timestamp-equality` passes).
- Uniswap v4 `ExactInputSingleParams` differs between the docs (5 fields) and v4-periphery `main` (+`minHopPriceX36`) — verify against Universal Router 2.1.2 on a mainnet fork before enabling swaps (D-093).
- Mainnet feed descriptions (`XAU / USD`, `XAG / USD`) are unverified (no mainnet reads in S2); `Deploy.s.sol` asserts them, so a mismatch fails safely in S8.

## Handoff
- **Branch** `stage/S2-contracts` (not pushed, not merged — the lead merges). STATUS.md left for the lead to avoid cross-branch conflicts.
- **Deployer** keystore `senryo-deployer` (`~/.foundry/keystores/`, password file `~/.config/senryo/deployer.password`, mode 600); public address **`0x52d205731E97C90aAB738AE66371449F585C0E6A`**; testnet balance **0 MON**. **User:** fund it with ≥ 7 MON on 10143 (≥ 16 MON to also float StarterDrip, which is only funded while the deployer stays above the 10 MON reserve); faucet may need a captcha.
- **S2.9 once funded** (wait 3 blocks after funding):
  `cd contracts && forge script script/Deploy.s.sol --rpc-url monad_testnet --account senryo-deployer --password-file ~/.config/senryo/deployer.password --sender 0x52d205731E97C90aAB738AE66371449F585C0E6A --broadcast --slow --gas-estimate-multiplier 110`
  then verify each address on Sourcify (`forge verify-contract <addr> <path:Name> --chain 10143 --verifier sourcify --verifier-url https://sourcify-api-monad.blockvision.org`), then `pnpm contracts:export` and commit `packages/contracts/src/addresses/10143.json` (+ STATUS networks line). Re-running the script is safe (ensure-style).
- **Env for Deploy** (optional, default = deployer): `OPERATOR_ADDRESS` (CARD_OPERATOR), `SPONSOR_ADDRESS` (RELAYER), `KEEPER_ADDRESS` (MIRROR pushes).
- **For S3/S4:** ABIs in `@senryo/contracts` (`senryoCoreAbi` …); `MirrorAggregator.pushAnswer` needs the keeper mirroring mainnet XAU/XAG each round; keepers should `poke(marketId)` at session edges (D-057); indexer must list every `indexed: true` address or `address-drift` fails.

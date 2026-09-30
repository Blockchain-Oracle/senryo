# Assurance — contracts (D-024, S8.5)

Static analysis plus targeted checks on `contracts/src`, run before the S8 mainnet deploy. Scope is the 33 source
files under `contracts/src`; `lib/`, `test/` and `script/` are excluded. The services `security-review` is the lead's
separate pass. Decisions: D-181 (decrease shortfall), D-182 (aggregate snapshots, finding #1), D-183 (oracle answer
bound), D-184 (this assurance pass). Fixes landed in `ed267f7`; the S8.4 swapper fix is in `707ff92` (D-180).

## Tools and commands (2026-09-30, from `contracts/`)
| Tool | Version | Install (official docs) | Command | Raw report |
|---|---|---|---|---|
| Slither | 0.11.6 | `uv tool install slither-analyzer` | `slither . --filter-paths "lib/\|test/\|script/" --json …` | `raw/slither.txt`, `raw/slither.json` (compact: id, check, impact, confidence, location) |
| Aderyn | 0.6.8 | `brew install cyfrin/tap/aderyn` | `aderyn . --src src -o report.json` (and `.md`) | `raw/aderyn.json`, `raw/aderyn.md` |
| Ackee Wake | 4.22.1 (stable) | `uv tool install eth-wake` | `wake up config` (→ `contracts/wake.toml`), then `wake detect --export json all` | `raw/wake.json` (compact) |
| Foundry | forge 1.8.3, solc 0.8.31, `network = "monad"` | — | `forge test` (fuzz, oracle, money, invariants), `pnpm contracts:check` | — |

Wake 4.22.1 on macOS verifies solc 0.8.31 against the *first* `0.8.31` row of the solc list, which is the
`0.8.31-pre.1` prerelease, so the release binary fails its checksum. The fix was to drop the prerelease row from Wake's local list
cache (`~/.local/share/wake/compilers/solc.json`); Wake then downloaded and verified the release build. Its sha256
`f5a243d6…ade9` equals the official list and Foundry's svm copy.

Builds must come from a `git submodule update --init --recursive` checkout (contracts/README). OZ's nested submodules
add auto-detected remappings (`erc4626-tests/`, `halmos-cheatcodes/`), and those remappings enter every contract's metadata
hash. Without them, the ensure-style `Deploy.s.sol` reports `Drift` on every recorded 10143 contract.

## Result
- **Slither** 137: 4 High · 31 Medium · 77 Low · 24 Info · 1 Opt. **Aderyn** 59 instances: 6 High (4 detectors) · 53 Low
  (12 detectors). **Wake** 36: 2 high · 31 warning · 3 info. Every one is triaged below: fixed, false positive (FP),
  or accepted with a rationale. The first runs also reported Slither `dead-code` (1), Aderyn `unsafe-casting` (2) and
  `state-change-without-event` (8), and the Wake/Aderyn unchecked `_settleLoss` in `_decrease`. All four are **fixed**
  and absent from the final reports.
- **Real issues fixed (money-touching, each with a check):** #1 D-182 (critical), #2 D-181 (high), #3 D-183 (low).
  #4 and #5 harden the invariant harness and add events.
- **Gates after the fixes:** `forge test` 35 passed / 1 skipped (fork suite without RPC). That includes invariants I1–I7
  plus `aggregatesMatchPositions` and `noPanics` (256 runs × depth 128), 14 oracle scenarios and test/money (6). The
  mainnet-fork suites pass (`MONAD_FORK_URL`). `pnpm contracts:check` and the fast gate are green.
- **forge lint** (inside `contracts:check`) reports 173 warnings in 13 lints. They cover the same code sites and
  categories as the Slither rows below, and the gate passes on warnings.
- **Testnet 10143 redeploy required.** SenryoCore is immutable and carries #1/#2; SessionOracle carries #3. See the
  stage-08 Handoff.

## Findings fixed
| # | Severity | Finding | Source | Fix / commit | Check |
|---|---|---|---|---|---|
| 1 | **Critical** | `_increase`/`_decrease` re-snapped a position's funding/borrow indexes (`_settleFees` → `_snap`) *before* `_removeAggregate`, so the aggregate was removed with the new snapshots. `borrowSnapSum` (uint) underflowed, so the **only position in a market could not be closed or increased once any borrow had accrued**. With other holders it didn't revert but silently skewed `borrowSnapSum`/`FundingSnapSum`, i.e. the LP receivables and `poolValue`. | Lead's core-mirror differential check on a 10143 fork; independently reproduced in this triage (Wake/Aderyn unchecked-return on `_settleLoss`/`_settleFees` → money test panicked) | `_settleFees` no longer snaps. Both callers remove the aggregate with the original snapshots and re-snap just before re-adding it. D-182, `ed267f7` | `test/money/AggregateSnapshots.t.sol` (2; both panic on the old code); invariants `aggregatesMatchPositions` (aggregates == Σ positions) and `noPanics` (fails on the old code) |
| 2 | **High** | A voluntary decrease socialised a loss the balance couldn't cover **while other positions stayed open**, then paid those positions' profits in full. PoC: long gold + short silver, both −30 %, account healthy (E_liq 11.87 USD, not liquidatable). Closing the loser first ended at 15.15 USD instead of 11.83; the house lost 3.20 USD (28 % of the deposit). Funding/borrow were also charged *before* a same-close profit, so owed fees could be socialised ahead of it. | This triage (unchecked `_settleLoss` return) | `_decrease` settles PnL − funding − borrow as one net amount (as liquidation does) and reverts `LossExceedsBalance(shortfall)` if a shortfall would be socialised while any position remains. A last-position shortfall is still socialised (liquidation-equivalent). D-181, `ed267f7` | `test/money/DecreaseShortfall.t.sol` (4; the loser-first and fee-netting cases fail on the old code) |
| 3 | Low | SessionOracle stored `uint128(answer18)` unchecked, and `_normalize` could overflow *inside* the feed `try` success block, reverting `peek`/`observe` for every held position. Only reachable with a malfunctioning feed. | Aderyn `unsafe-casting` (SessionOracle `_accept`) | Answers whose 1e18 form exceeds uint128 are invalid → STALE (reduce-only), never truncated. `_confirmed` stops at them and `acceptFeedPrice` rejects them. SafeCast on the accepted price/time. D-183, `ed267f7` | `test_unrepresentableAnswerIsStaleNeverTruncated` |
| 4 | Harness | Invariant handlers swallowed every revert (`catch {}`), including Panics, which is how #1 stayed invisible under `fail_on_revert = false`. `capture(expire)` also warped time **backwards**, faking future-dated accepted prices (a harness-only panic in `peek`). | This triage | `ghostPanics` + `invariant_noPanics`; forward-only warp. `ed267f7` | invariant suite |
| 5 | Low | State changes without events: `setSwapper`, `setInboxFactory`, `setPoolKey`, `setTvlCap`, StarterDrip `setConfig`/`topUp`/`withdrawNative`/`withdrawToken`. | Aderyn `state-change-without-event` | `SwapperSet`, `InboxFactorySet`, `PoolKeySet`, `TvlCapSet`, `DripConfigSet`, `GasToppedUp`, `DripWithdrawn`, declared in the emitting contracts so `Events.sol` stays byte-identical. Dead `_maxMarkets` removed (Slither `dead-code`). `ed267f7` | ABIs re-exported |

## Other notes from the review (accepted)
| Note | Verdict | Rationale |
|---|---|---|
| IntentRouter: a relayed `OpenOrder` that fails still consumes its nonce | Accepted (Low) | Designed so an invalid/stale order never reverts the deposit. Only the signature holder can submit it, and the user re-signs. Griefing only, no value moves. |
| CollateralSwapper forwards any stray `tokenOut` balance to the core | Accepted (Info) | Only a donation to the next swap. The core credits the measured delta and the user's `minOut` holds. |
| `_decrease` realised losses use the whole balance, including hold-backed funds (liquidation charges only what sits above holds) | Accepted (Info) | The hold's later capture books the gap as `cardDebt` (senior in E_init/E_liq). Coverage via `coverCardDebt` matches the liquidation path's outcome. |
| `LossExceedsBalance` can block a close while another held market is not OPEN and the account is insolvent | Accepted (Info) | Same exposure the design already accepts: liquidation needs every held market OPEN. The user can still close other legs; liquidators act at reopen. |

## Analyzer findings — full triage
| ID | Tool / detector | Severity | Location(s) | Verdict | Rationale / commit |
|---|---|---|---|---|---|
| S-000 | Slither `arbitrary-send-erc20` | High | AccountLedger.sol:111 | FP | `_pull`'s `from` is `msg.sender` at all three call sites (deposit/depositFor, fundPool, fundBook). |
| S-001 | Slither `arbitrary-send-eth` | High | StarterDrip.sol:129 | Accepted | `withdrawNative` is ADMIN-only (Safe 2-of-3 on mainnet); the recipient is the admin's choice. Now emits `DripWithdrawn`. |
| S-002…S-003 | Slither `uninitialized-state` | High | CardModule.sol:181, MarketCalendar.sol:22 | FP | `_allowances` / `_holidays` are written through storage pointers (`Allowance storage al = …`, `list.push`), which the detector does not follow. |
| S-004…S-010 | Slither `incorrect-equality` | Medium | LpVault.sol:94, SessionOracle.sol:146 ×2, SessionOracle.sol:213, DepositInbox.sol:31, MirrorAggregator.sol:46, MirrorAggregator.sol:52 | FP | Zero sentinels (`bal == 0`, `shares == 0`, `updatedAt == 0`, `at == 0`) and round-id equality. No `block.timestamp` equality exists (invariant `sol-no-timestamp-equality`). |
| S-011…S-014 | Slither `reentrancy-no-eth` | Medium | AccountLedger.sol:44, CoreStorage.sol:92, PerpModule.sol:178, PerpModule.sol:192 | Accepted | Every core entry point shares one `nonReentrant` (transient) lock. Callees are our SessionOracle (feeds read in try/catch) and the PARAM_ADMIN-timelocked swapper (hookless v4 pool; AUSD/USDC have no transfer hooks). No untrusted code runs mid-mutation. |
| S-015…S-028 | Slither `uninitialized-local` | Medium | LiquidationModule.sol:116, LiquidationModule.sol:29, LiquidationModule.sol:30, LiquidationModule.sol:45, LiquidationModule.sol:99, MarketAccounting.sol:59, PerpModule.sol:106, PerpModule.sol:196, PerpModule.sol:229, RiskModule.sol:50, RiskModule.sol:51, RiskModule.sol:52, RiskModule.sol:53, StarterDrip.sol:76 | FP | Solidity zero-initialises locals; accumulators and `Fill` structs start at 0 by design. |
| S-029…S-034 | Slither `unused-return` | Medium | AccountLedger.sol:44, CollateralConfig.sol:54, SessionOracle.sol:115, SessionOracle.sol:213, SessionOracle.sol:236, IntentRouter.sol:77 | FP | Tuple fields that are validated (rid/answer/at/air) or not needed (startedAt, tryRecover errorArg). `swap()`'s return is ignored on purpose: the core credits its own measured delta. |
| S-035…S-038 | Slither `missing-zero-check` | Low | AdminModule.sol:44, AdminModule.sol:50, DepositInbox.sol:19, StarterDrip.sol:129 | Accepted | `setSwapper`/`setInboxFactory`: address(0) is the documented off switch. `withdrawNative` is ADMIN. `DepositInbox.USER`: the factory rejects user 0 before CREATE2. |
| S-039…S-074 | Slither `calls-loop` | Low | CardModule.sol:201 ×2, LiquidationModule.sol:84, LiquidationModule.sol:96, MarketAccounting.sol:32, RiskModule.sol:48 ×23, SessionOracle.sol:146 ×2, SessionOracle.sol:213 ×3, SessionOracle.sol:236, SessionOracle.sol:273 ×2 | Accepted | Loops run over held-position bits (≤ MAX_MARKETS; 2 live) or configured markets. Callees are our oracle/calendar and the trusted feeds (reads in try/catch). Gas scales per position (D-185). |
| S-075…S-077 | Slither `reentrancy-benign` | Low | CoreStorage.sol:92 ×2, LiquidationModule.sol:115 | Accepted | As reentrancy-no-eth: trusted callees, one transient lock. |
| S-078…S-084 | Slither `reentrancy-events` | Low | LiquidationModule.sol:84, MarketAccounting.sol:65 ×2, LpVault.sol:101, DepositInbox.sol:26, DepositInbox.sol:31, IntentRouter.sol:77 | Accepted | Events after trusted calls inside one atomic tx; the indexer orders by log index. |
| S-085…S-111 | Slither `timestamp` | Low | CardModule.sol:112, CardModule.sol:146, CardModule.sol:187, CardModule.sol:92, CollateralConfig.sol:54, CoreStorage.sol:86, PerpModule.sol:178, PerpModule.sol:88, RiskModule.sol:162, TriggerOrders.sol:21, TriggerOrders.sol:44, LpVault.sol:94, MarketCalendar.sol:102, SessionOracle.sol:115, SessionOracle.sol:146, SessionOracle.sol:202, SessionOracle.sol:213, SessionOracle.sol:236, SessionOracle.sol:252, SessionOracle.sol:259, SessionOracle.sol:78, SessionOracle.sol:96, StarterDrip.sol:69, StarterDrip.sol:86, MirrorAggregator.sol:46, MirrorAggregator.sol:52, MockStable.sol:33 | Accepted | Deadlines, heartbeats, hold TTL, allowance days and pauses are time-based by nature. Monad's 1 s granularity is respected: no equality, and anti-flash uses `MIN_HOLD_BLOCKS` block numbers. |
| S-112 | Slither `costly-loop` | Info | MarketRegistry.sol:74 | Accepted | Constructor-only `_addMarket` loop (2 markets). |
| S-113…S-115 | Slither `cyclomatic-complexity` | Info | PerpModule.sol:178, RiskModule.sol:48, SessionOracle.sol:146 | Accepted | Covered by the oracle scenario suite, test/money and the invariants. |
| S-116…S-117 | Slither `low-level-calls` | Info | StarterDrip.sol:129, StarterDrip.sol:147 | Accepted | Native MON sends with a checked `ok`, `nonReentrant`, restricted. |
| S-118…S-134 | Slither `naming-convention` | Info | CoreStorage.sol:33, CoreStorage.sol:34, CoreStorage.sol:35, CoreStorage.sol:80, LpVault.sol:33, CollateralSwapper.sol:67, CollateralSwapper.sol:68, CollateralSwapper.sol:69, DepositInbox.sol:14, DepositInbox.sol:15, DepositInbox.sol:16, DepositInbox.sol:17, InboxFactory.sol:15, InboxFactory.sol:16, InboxFactory.sol:17, IntentRouter.sol:33, StarterDrip.sol:46 | Accepted | UPPER_CASE immutables and EIP-712's `DOMAIN_SEPARATOR()` by convention. |
| S-135 | Slither `too-many-digits` | Info | InboxFactory.sol:48 | FP | Creation-code bytes, not a literal. |
| S-136 | Slither `cache-array-length` | Opt | SessionOracle.sol:97 | Accepted | View loop over 2 markets. |
| A-01 | Aderyn `abi-encode-packed-hash-collision` | High | InboxFactory.sol:49 | FP | `creationCode ‖ abi.encode(args)` is the canonical CREATE2 init code: one constant dynamic part. |
| A-02 | Aderyn `eth-send-unchecked-address` | High | StarterDrip.sol:105, StarterDrip.sol:129 | Accepted | `topUp` is RELAYER-only and capped per address per day plus the daily budget. `withdrawNative` is ADMIN. |
| A-03 | Aderyn `reentrancy-state-change` | High | LpVault.sol:98, SessionOracle.sol:117 | FP | `claimRedeem` makes a view call to our core before `delete`. `acceptFeedPrice` reads Chainlink (view) under PARAM_ADMIN timelock. |
| A-04 | Aderyn `reused-contract-name` | High | Errors.sol:7 | Accepted | Our `Errors` library vs OZ `utils/Errors`. Foundry uses fully qualified names, and 10143 is already Sourcify exact_match; renaming would change every contract's bytecode. |
| A-05 | Aderyn `costly-loop` | Low | LiquidationModule.sol:32, LiquidationModule.sol:85, MarketCalendar.sol:101, StarterDrip.sol:117 | Accepted | Bounded: position bits, MAX_HOLIDAYS, admin voucher batches. |
| A-06 | Aderyn `internal-function-used-once` | Low | PerpMath.sol:55 | Accepted | Readability. |
| A-07 | Aderyn `large-numeric-literal` | Low | Constants.sol:14, Constants.sol:59 | Accepted | `10_000` in named constants (underscore-grouped). |
| A-08 | Aderyn `require-revert-in-loop` | Low | CardModule.sol:204, LiquidationModule.sol:32, LiquidationModule.sol:85, MarketAccounting.sol:34, RiskModule.sol:56, SessionOracle.sol:97 | Accepted | All-or-nothing by design: one unsafe held market blocks the hold; an unknown market reverts. |
| A-09 | Aderyn `state-no-address-check` | Low | AdminModule.sol:45, AdminModule.sol:51 | Accepted | address(0) is the documented off switch (NatSpec). |
| A-10 | Aderyn `state-variable-could-be-immutable` | Low | MirrorAggregator.sol:27 | FP | `string description` cannot be immutable (testnet mirror). |
| A-11 | Aderyn `storage-array-length-not-cached` | Low | SessionOracle.sol:97 | Accepted | View loop over 2 markets. |
| A-12 | Aderyn `unchecked-return` | Low | AccountLedger.sol:108, AccountLedger.sol:51, CardModule.sol:136, CardModule.sol:138, CardModule.sol:164, CardModule.sol:166, CardModule.sol:227, CardModule.sol:229, CardModule.sol:37, CardModule.sol:47, CardModule.sol:62, CardModule.sol:64, LiquidationModule.sol:57, LiquidationModule.sol:59, LiquidationModule.sol:60, LiquidationModule.sol:71, LiquidationModule.sol:72, MarketAccounting.sol:21, MarketRegistry.sol:19, PerpModule.sol:236, PerpModule.sol:264, PerpModule.sol:76, SenryoCore.sol:25, TriggerOrders.sol:26, SessionOracle.sol:132 | FP / Accepted | Same sites as Wake `unchecked-return-value`; see W-002…W-028. |
| A-13 | Aderyn `uninitialized-local-variable` | Low | CardModule.sol:204, LiquidationModule.sol:32, LiquidationModule.sol:85, MarketAccounting.sol:131, MarketAccounting.sol:34, RiskModule.sol:56 | FP | Loop counters start at 0 by design. |
| A-14 | Aderyn `unsafe-erc20-operation` | Low | CollateralSwapper.sol:103 | FP | `Permit2.approve` (not ERC-20) reverts on failure; the ERC-20 leg uses `SafeERC20.forceApprove`. |
| A-15 | Aderyn `unused-error` | Low | Errors.sol:16, Errors.sol:60, Errors.sol:82 | Accepted (deferred) | Removing them changes `Errors.sol`, which the testnet mocks/mirrors/calendar import: their bytecode would drift and the redeploy could not reuse them. Remove at the next full redeploy. |
| A-16 | Aderyn `unused-import` | Low | Errors.sol:4 | FP | `MarketStatus` is used in error signatures. |
| W-000 | Wake `reentrancy` | high/medium | AccountLedger.sol:51 | Accepted | See S-011: shared transient lock; allowlisted + timelocked swapper; hookless pool, no-hook tokens. The core credits its measured delta and re-checks I2. StarterDrip: CEI (`claimed`/budget written first), `nonReentrant`, restricted; the practice mint is our testnet MockStable. |
| W-001 | Wake `reentrancy` | high/low | StarterDrip.sol:78 | Accepted | See S-011: shared transient lock; allowlisted + timelocked swapper; hookless pool, no-hook tokens. The core credits its measured delta and re-checks I2. StarterDrip: CEI (`claimed`/budget written first), `nonReentrant`, restricted; the practice mint is our testnet MockStable. |
| W-002 | Wake `unchecked-return-value` | warning/high | AccountLedger.sol:51 (`swap`) | FP | By design: the core never trusts the adapter's return and credits its measured balance delta. |
| W-003 | Wake `unchecked-return-value` | warning/high | AccountLedger.sol:108 (`_emitRisk`) | FP | Returns the Risk snapshot; the emit is the point. |
| W-004 | Wake `unchecked-return-value` | warning/high | CardModule.sol:37 (`_emitRisk`) | FP | Returns the Risk snapshot; the emit is the point. |
| W-005 | Wake `unchecked-return-value` | warning/high | CardModule.sol:47 (`_emitRisk`) | FP | Returns the Risk snapshot; the emit is the point. |
| W-006 | Wake `unchecked-return-value` | warning/high | CardModule.sol:62 (`_chargeUser`) | FP | `repayCardDebt` checks `bal ≥ due` first, so paid == due. |
| W-007 | Wake `unchecked-return-value` | warning/high | CardModule.sol:64 (`_bump`) | FP | Returns the new nonce; it increments regardless. |
| W-008 | Wake `unchecked-return-value` | warning/high | CardModule.sol:136 (`_bump`) | FP | Returns the new nonce; it increments regardless. |
| W-009 | Wake `unchecked-return-value` | warning/high | CardModule.sol:138 (`_emitRisk`) | FP | Returns the Risk snapshot; the emit is the point. |
| W-010 | Wake `unchecked-return-value` | warning/high | CardModule.sol:164 (`_bump`) | FP | Returns the new nonce; it increments regardless. |
| W-011 | Wake `unchecked-return-value` | warning/high | CardModule.sol:166 (`_emitRisk`) | FP | Returns the Risk snapshot; the emit is the point. |
| W-012 | Wake `unchecked-return-value` | warning/high | CardModule.sol:214 (`_emitRisk`) | FP | Returns the Risk snapshot; the emit is the point. |
| W-013 | Wake `unchecked-return-value` | warning/high | CardModule.sol:227 (`_bump`) | FP | Returns the new nonce; it increments regardless. |
| W-014 | Wake `unchecked-return-value` | warning/high | CardModule.sol:229 (`_emitRisk`) | FP | Returns the Risk snapshot; the emit is the point. |
| W-015 | Wake `unchecked-return-value` | warning/high | LiquidationModule.sol:57 (`_emitRisk`) | FP | Returns the Risk snapshot; the emit is the point. |
| W-016 | Wake `unchecked-return-value` | warning/high | LiquidationModule.sol:59 (`_bump`) | FP | Returns the new nonce; it increments regardless. |
| W-017 | Wake `unchecked-return-value` | warning/high | LiquidationModule.sol:60 (`_emitRisk`) | FP | Returns the Risk snapshot; the emit is the point. |
| W-018 | Wake `unchecked-return-value` | warning/high | LiquidationModule.sol:71 (`_bump`) | FP | Returns the new nonce; it increments regardless. |
| W-019 | Wake `unchecked-return-value` | warning/high | LiquidationModule.sol:72 (`_emitRisk`) | FP | Returns the Risk snapshot; the emit is the point. |
| W-020 | Wake `unchecked-return-value` | warning/high | MarketAccounting.sol:21 (`_requireMarket`) | FP | Guard; the returned storage ref is unused here. |
| W-021 | Wake `unchecked-return-value` | warning/high | MarketRegistry.sol:19 (`_requireMarket`) | FP | Guard; the returned storage ref is unused here. |
| W-022 | Wake `unchecked-return-value` | warning/high | PerpModule.sol:76 (`_requireMarket`) | FP | Guard; the returned storage ref is unused here. |
| W-023 | Wake `unchecked-return-value` | warning/high | PerpModule.sol:236 (`_emitRisk`) | FP | Returns the Risk snapshot; the emit is the point. |
| W-024 | Wake `unchecked-return-value` | warning/high | PerpModule.sol:250 (`_settleLoss`) | Accepted → led to D-181/D-182 | Increase path only: a shortfall there always fails the increase's I2 check, so nothing is socialised. The `_decrease` path now checks it (ed267f7). |
| W-025 | Wake `unchecked-return-value` | warning/high | PerpModule.sol:264 (`_moveBooks`) | FP | POOL has just received ≥ the fee, so the insurance split always moves in full. |
| W-026 | Wake `unchecked-return-value` | warning/high | SenryoCore.sol:25 (`_addMarket`) | FP | Returns the sequential id. |
| W-027 | Wake `unchecked-return-value` | warning/high | TriggerOrders.sol:26 (`_requireMarket`) | FP | Guard; the returned storage ref is unused here. |
| W-028 | Wake `unchecked-return-value` | warning/high | SessionOracle.sol:132 (`_config`) | FP | Guard; the returned config is unused here. |
| W-029 | Wake `missing-return` | warning/medium | MarketAccounting.sol:130 | FP | `_reservedProfit` accumulates into the named return. `_latest`'s catch returns (false, 0, 0, 0) → STALE on purpose. |
| W-030 | Wake `missing-return` | warning/medium | SessionOracle.sol:236 | FP | `_reservedProfit` accumulates into the named return. `_latest`'s catch returns (false, 0, 0, 0) → STALE on purpose. |
| W-031 | Wake `reentrancy` | warning/medium | StarterDrip.sol:130 | Accepted | See S-011: shared transient lock; allowlisted + timelocked swapper; hookless pool, no-hook tokens. The core credits its measured delta and re-checks I2. StarterDrip: CEI (`claimed`/budget written first), `nonReentrant`, restricted; the practice mint is our testnet MockStable. |
| W-032 | Wake `reentrancy` | warning/medium | StarterDrip.sol:157 | Accepted | See S-011: shared transient lock; allowlisted + timelocked swapper; hookless pool, no-hook tokens. The core credits its measured delta and re-checks I2. StarterDrip: CEI (`claimed`/budget written first), `nonReentrant`, restricted; the practice mint is our testnet MockStable. |
| W-033 | Wake `unused-error` | info/high | Errors.sol:16 | Accepted (deferred) | As Aderyn unused-error. |
| W-034 | Wake `unused-error` | info/high | Errors.sol:60 | Accepted (deferred) | As Aderyn unused-error. |
| W-035 | Wake `unused-error` | info/high | Errors.sol:82 | Accepted (deferred) | As Aderyn unused-error. |

## Services review (S8.5b, 30 Sep, lead + security-reviewer)

Scope: `services/api`, `services/card`, `services/common` (keeper jobs, migrations and the deployed Traefik config not
reviewed — see "Not covered"). Verdict before fixes: **block**; after fixes: no open high/medium.

| # | Sev | Finding | Verdict |
|---|---|---|---|
| 1 | High | Starter relay anti-abuse was client-controlled: omitted Turnstile token passed; a missing `x-senryo-device` was stored NULL and never counted | **Fixed** — Turnstile required whenever configured, and mainnet claims require it configured (D-166); header-less clients share one `unknown` device bucket |
| 2 | Medium | `trustProxy: true` took the client-controlled left-most X-Forwarded-For → spoofable IP for rate limits, /24 caps, geofence, Turnstile | **Fixed** — trust exactly one hop (Traefik): `request.ip` = the entry Traefik appended (`TRUSTED_PROXY_HOPS`) |
| 3 | Medium | Country headers (`cf-ipcountry`, …) trusted from any client → geofence bypass | **Fixed** — ignored unless `TRUSTED_COUNTRY_HEADER` names the real edge; DB-IP on the client IP otherwise |
| 4 | Medium | Parallel replays of one signed claim/voucher/allowance burned sponsor/operator gas on reverts; allowance relay needed no session | **Fixed** — one relay per (chain, user, kind) in flight (409 otherwise), claimed() re-read inside the lock; allowance requires the owner's session + its own in-flight guard |
| 5 | Medium | Unauthenticated RPC-heavy reads had no rate limit | **Fixed** — 120/min per client IP on /v1/status, /v1/markets, /v1/account, /v1/starter/status |
| 6 | Low | WS account push could stack overlapping ticks | **Fixed** — a busy tick skips the next; per-IP socket caps + token-expiry drop deferred (S14) |
| 7 | Low | /v1/status echoed raw RPC errors (keyed URLs) | **Fixed** — fixed public line, full error to the log |
| 8 | Low | Vault upsert check-then-act race could overwrite another account's first write | **Fixed** — owner-guarded `ON CONFLICT … WHERE`, 409 when it didn't apply |
| 9 | Low | SIWE: `uri` not compared, nonce not bound to chain | **Fixed** — `uri` must equal `SIWE_URI`; nonce consumed only for its `chain_id` |
| 10 | Low | Push token re-bind by any session knowing the token | **Accepted** — one phone / several accounts share an Expo token; tokens aren't public; worst case a missed notification |
| 11 | Low | Card event dedupe row committed before routing → a failure lost the capture/release | **Fixed** — insert + outbox + processed_at in one transaction |
| 12 | Low | Voucher route without per-device/network caps | **Accepted** — vouchers are single-use secret codes (`VOUCHER_USED` onchain) |
| 13 | Low | /v1/events accepted client clocks / unbounded props / uncapped device header | **Fixed** — ±1 day clamp, props ≤ 2 KB, device header capped (retention job: S14) |

Not covered (next pass before mainnet card/keeper deploys): `services/keeper/src/**` key handling and trigger/topup
jobs, `services/common/src/{db,keys,migrate-cli}.ts`, SQL migrations (siwe_nonces purge), the deployed Traefik
`forwardedHeaders` config (the one-hop trust assumes Traefik is the only hop — a CDN in front must raise it).

### Keeper + migrations pass (S8.5b, follow-up)

Verdict before fixes: needs_fix (4 medium, 6 low). A lying indexer can't make the keeper send a harmful tx (every
candidate is re-checked onchain and simulated); the gaps were in candidate coverage.

| # | Sev | Finding | Verdict |
|---|---|---|---|
| K1 | Medium | Failed multicall rows read as "not liquidatable" — silent coverage loss under RPC errors | **Fixed** — unread rows are `undefined`, retried once; still unread → job error + ops alert |
| K2 | Medium | Only the 500 most recently active accounts were scanned | **Fixed** — full pagination in a stable order (page cap 20 000, warns) |
| K3 | Medium | Only the 500 oldest PLACED triggers were fetched | **Fixed** — full pagination |
| K4 | Medium | Top-ups (off by default) paid every past claimer daily | **Fixed** — only accounts with an open position, ≤ 10 per run, stop at the first budget/role refusal |
| K5 | Low | `/v1/keeper/status` exposed full error text (keyed RPC URL) | **Fixed** — short `describeError` line; the port has no public domain |
| K6 | Low | Candidate list unbounded; sequential reads | **Deferred (S14)** — accounts table + batched snapshots |
| K7 | Low | An abandoned tx left the nonce counter past a gap | **Fixed** — `resync` on abandoned (chain send + query trace) |
| K8 | Low | Testnet mirror trusts the source RPC round | **Accepted (testnet only)** — guarded to 10143; tighten if practice liquidations matter |
| K9 | Low | No retention anywhere | **Fixed** — daily `retention` job (nonces 1 d, telemetry/outbox/push 30 d, events/card events 90 d) |
| K10 | Low | One DB role migrates and serves every service | **Deferred (S14)** — least-privilege roles per service with the Coolify DB setup |

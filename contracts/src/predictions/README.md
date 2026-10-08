# Senryo Binary V1 contract foundation

This is undeployed Practice/test-MON source. The approved numerical proposal is
[`docs/design/prediction-binary-testnet-v1.md`](../../../docs/design/prediction-binary-testnet-v1.md).
No public address, funded round, signed public Pyth verification, keeper or native
execution acceptance is implied by these contracts or their generated ABIs.

## Immutable identity and activation

Both constructors reject chains other than 10143. `PythBoundaryOracle` also rejects
any receiver except `0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379`, and requires code.
`SenryoBinaryV1` starts risk-paused. The deployment has immutable creator,
guardian, beneficiary and adapter; there is no upgrade, sweep, rescue, arbitrary
call, recipient override or role-change function.

`POLICY_HASH = keccak256(bytes(the literal policy string in SenryoBinaryV1.sol))`.
`configHash = keccak256(abi.encode(POLICY_HASH, BTC, ETH, adapter, receiver,
creator, guardian, beneficiary))`. Feed IDs are bytes32; dependencies and roles
are addresses. This commits the frozen policy and the actual deployment
configuration. The round ID is `keccak256(abi.encode(chainId, marketAddress,
configHash, feedId, duration, start))`; duration is uint32 and start is uint64.

The policy is recorded before code in the approved proposal: 300/900-second
aligned rounds, creation 30–3600 seconds ahead, cutoff end−10, first boundary
observation within 5 seconds, opening deadline start+30, closing deadline
end+120, positive price ≤1e16 at exponent −8, confidence ≤25bps, half-value
tie/void, zero fee, 10–100 MON seed, 0.01–5 MON buy, 1000 MON outstanding
complete-set cap, at most eight unsettled rounds and at most 15-second quotes.
UI defaults (900 seconds, 100 MON seed, 100bps slippage selectable 0–500bps,
5-second display stale limit) belong to the subsequent configuration/native
integration; no UI execution configuration is created here.

An address or chain ID alone is **never** permission to activate a local fixture.
Future local integration must use an explicit development environment manifest
including source identity and fixture status; mobile must also require existing
`__DEV__ && EXPO_PUBLIC_DEV_WORKSPACE` gating. Public activation must independently
verify bytecode, configuration, roles, oracle proofs and funded liquidity. No
public registry entry or deployment/broadcast script is added by this phase.

## Calls, units and reconciliation

All amounts are native MON/share wei (18 decimals). One complete set of one Up
plus one Down share is backed by one MON. `isUp=true` selects Up. Buy is payable;
sell burns complete sets and creates MON credit. Both call the same pure
`BinaryMath` functions as quote reads, with rounding toward solvency. The sell
formula uses OpenZeppelin 5.7.0 integer ceil-square-root. Trades are exact-input,
atomic and bounded by the explicitly reviewed minimum output and deadline.

`Quote` includes input/output, reserves, revision, cutoff/state and block/time.
`marginalPriceE18` is the selected share's pre-trade reserve price in MON scaled
by 1e18. `executionPriceE18` is average MON per share for the requested size.
`priceImpactBps` is the absolute relative difference between these rounded prices;
if marginal price rounds to zero, uint256 max explicitly denotes unbounded impact.
These are AMM inventory metrics, not underlying BTC/ETH prices or probabilities.
Zero-output exits revert; the shares remain redeemable on settlement.

Claims combine both held sides before fractional rounding. Up/Down settlement
pays only the winning side; Tie/Void pays floor((Up+Down)/2), **not original
purchase-cost refund**. Residual rounding dust remains locked. Dedicated seed
reserves are not duplicated in anyone's user position. Anyone can call
`claimLiquidity`, but only the frozen beneficiary receives its credit.

Buy, sell, user claim and withdraw require a nonzero, previously unused
`usedOperation[owner][operationId]`. Each independently reviewed mutation/step
needs its own operation ID. A reverted transaction does not consume it. A failed
withdrawal consumes its ID, restores credits and emits `WithdrawalFailed`; its
EVM receipt is successful, but wallet payment failed. A fresh explicitly reviewed
withdrawal may retry. Canonical events/receipt plus operation marker must resolve
uncertain submissions before any replacement. Permissionless opening, resolution,
timeout and liquidity redemption are instead deduplicated by round state.

Quotes do not authorize another owner's shares. Mutation ownership is always
`msg.sender`, with no transfer or recipient argument. Gas reserve, exact fee
review, account/passkey step-up, terms, source/environment guards and durable
transaction journal remain required integration work. Every prediction mutation
must require step-up; this contract does not create session authority.

Risk pause blocks creation and buys only. It intentionally leaves sells,
settlement, timeout, claims and withdrawals usable. It cannot contain a sell-side
implementation bug; deployment retirement is the remaining containment action.

## Oracle and local evidence

The adapter requests the unique parser's exact `[boundary,boundary+5]` range and
requires its exact update fee, paid separately from collateral. Only authenticated
first-observation semantics supplied by the pinned receiver can establish the
previous-publish condition. Wrong/malformed proofs revert; verified observations
of bad quality become immutable rejected boundaries and later timeout to Void.
Latest on-chain display values cannot resolve rounds.

Official references checked 2026-10-08:

- [Unique boundary parser](https://api-reference.pyth.network/price-feeds/evm/parsePriceFeedUpdatesUnique)
- [Current/upgraded Core receiver table](https://docs.pyth.network/price-feeds/core/upgrade/contracts)

Run `forge test --root contracts --match-path 'test/predictions/*'` from the repo.
Tests use a disposable Foundry EVM, `vm.chainId(10143)` and `vm.etch` at the pinned
receiver address. `FixturePyth` and `CallbackPyth` live under test only; plaintext
ABI fixture bytes and the arbitrary 7-wei fixture fee are not real signatures,
real Pyth proof verification or measured public oracle cost. No shared fork is
reset and no RPC broadcast occurs.

Scoped `forge lint src/predictions` is clean after narrowly documenting and
suppressing only the following accepted findings, each with a
`disable-next-line` rule at the statement. No file-wide or rule-wide suppression
is used; new locations remain checked.

| Rule | Exact source location | Accepted reason |
|---|---|---|
| `block-timestamp` | `PythBoundaryOracle.verify`: publication upper-bound check | Rejects future publications using consensus time; never selects a price by keeper time. |
| `unsafe-typecast` | `PythBoundaryOracle.verify`: confidence ratio cast | Earlier `quality` checks prove `0 < price <= 1e16` before int64→uint64→uint256 conversion. |
| `unsafe-typecast` | `PythBoundaryOracle.verify`: observation publish-time cast | Earlier comparison bounds publication by checked uint64 `boundary+5`. |
| `block-timestamp` | `SenryoBinaryV1.createRound`, `recordOpening`, `resolve`, `voidExpired`, `_trade`, `_deadline`: schedule/deadline comparisons | Fixed block-time cutoffs intentionally enforce the frozen policy; signed unique observations determine prices. |
| `reentrancy-events` | `SenryoBinaryV1.recordOpening`: both result events; `resolve`: rejection event; `_finalize`: resolution event | Every reaching mutation path is guarded by `nonReentrant`, including oracle callbacks. |
| `reentrancy-events` | `SenryoBinaryV1.buy` / `sell`: trade event | Quote and math calls dispatch internally and cannot reenter; mutations also have `nonReentrant`. |
| `reentrancy-eth` | `SenryoBinaryV1.withdraw`: recipient call | Credits debit before interaction; `nonReentrant` protects callback paths; only failed payment restores credit. |
| `reentrancy-events` | `SenryoBinaryV1.withdraw`: both result events | The guarded payment must complete before emitting its canonical success/failure outcome. |

The focused withdrawal test asserts the exact event emitter, signature, indexed
owner/operation ID and MON amount, with exactly one result event per processed
attempt. Failed IDs stay consumed; duplicate attempts revert without logs. A fresh
ID pays exactly once, verified against both wallet/contract cash and credit
balances. Recipient and oracle callback tests remain fixture evidence, not an audit.

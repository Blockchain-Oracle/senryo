# Proposed Senryo Binary V1 testnet architecture

8 October 2026 — architecture only; **undeployed, unfunded, unverified against signed public Pyth boundary payloads**. This report authorizes no deployment or funding. It follows `task-4-design-brief.md`, `docs/design/reviews/2026-10-08-native-prediction-feasibility.md` and the approved native execution amendment. Existing dirty UI/source work must be preserved. Names below are proposed additions unless explicitly described as existing.

## 1. Decision and deliberately explicit economics

Use one non-upgradeable `SenryoBinaryV1` contract with a round mapping, original internal nontransferable Up/Down share ledgers, a two-reserve constant-product AMM and native MON collateral. No factory/clones, token approvals, external share transfers, loans, pair LP or card collateral are needed for the initial native lifecycle. Users may buy either side, hold both, and sell any positive portion of a held side before cutoff. Orders are atomic transactions, not resting exchange orders. There is no meaningful cancel after inclusion; an unsigned review may be canceled.

The Pyth adapter verifies the first signed observation at/after each fixed boundary. The product is explicitly **Practice · test MON**, with independent money balances. Polymarket discovery and Castora numerical contests retain their own providers, rules, histories and references. A genuine owned position never changes round because the list rolls forward.

### Proposed frozen parameters: `senryo-binary-testnet-v1`

These are numerical starting choices for implementation/measurement, not accepted production economics. Embed immutable values and a public `configHash`; changing them means a new configuration/version for future deployments, never editing a funded round.

| Parameter | Proposal | Rationale / restriction |
|---|---|---|
| Chain | 10143 only, constructor rejects others except explicitly local test harness | Prevent accidental Mainnet activation; fixtures require separate local manifest |
| Assets | BTC/USD, ETH/USD only | Pin the two exact IDs in feasibility report |
| Pyth receiver | `0xFC6bd9F9f0c6481c6Af3A7Eb46b296A5B85ed379` | Fresh read evidence; signed unique-proof compatibility still gated |
| Durations | Both 300 and 900 seconds; initial UI default 900 | Preserve requested 5m/15m candidates. 15m gives more time for first integration approval/recovery. Support both in tests, do not silently remove 5m |
| Fixed boundaries | `start % duration == 0`, `end=start+duration` | Absolute UTC epoch alignment, immutable identifiers |
| Creation | Between 30 seconds and 1 hour before start | Known pre-funded rounds; no late strike/seed selection |
| Buy and sell cutoff | `end - 10 seconds`, exclusive | Reduces last-instant information advantage; this is still not arbitrage immunity |
| Opening proof window | `[start, start+5 seconds]` | Narrow unique-print tolerance; not an arbitrary five-second choice |
| Closing proof window | `[end, end+5 seconds]` | Same rule for both boundaries |
| Opening submission deadline | `start+30 seconds`, exclusive | A round cannot activate several minutes late |
| Closing submission deadline | `end+120 seconds`, exclusive | Allows delivery/retry/finality delay while keeping timeout bounded |
| Earliest-proof quality | `price > 0`, exponent exactly -8, confidence/price ≤ 25 bps | Exponent pinned to observed BTC/ETH feeds; quality limit above sampled ~4–6 bps, subject to actual distribution validation |
| Price bound | ≤ `10^16` in 8-decimal USD units | Safety bound ($100 million); out-of-range earliest proof voids rather than clips |
| Equal-price/void payout | Up:Down = 1:1, denominator 2 | Neutral fractional redemption; **not original purchase-cost refund** |
| Winner payout | Winner 2, loser 0, denominator 2 | One whole winning share pays 1 MON |
| Trading/platform fee | 0 for V1 testnet | Fewer accounting paths; native gas/oracle charges remain real test-MON costs |
| Seed | Default 100 MON; creation requires 10–100 MON | Small test treasury, explicit funded reserves; no free or implicit liquidity |
| Maximum new buy | 5 MON per transaction | At default seed about 5% of initial collateral; still show real price impact. Not a Sybil/account exposure guarantee |
| Round supply cap | 1,000 MON worth of complete sets outstanding | Bounded arithmetic/state exposure; sell reduces supply room, so not lifetime turnover cap |
| Active funded rounds | At most 8 not-yet-finalized | Allows one current/resolving plus one next round for BTC/ETH × 5m/15m; caps concurrently risky seed at 800 MON. A delayed backlog blocks new seeds, not claims |
| Minimum buy | 0.01 MON | UI/gas practicality; does not constrain exits of small existing holdings |
| Minimum sell | 1 share-wei, but quote must yield ≥1 MON-wei | No artificial minimum trapping ordinary partial exits; dust may await claim |
| Quote lifetime | 15 seconds, and strictly before cutoff | Review may need refresh after biometric delay; never silently sign refreshed bounds |
| Default slippage | 100 bps with explicit review; 0–500 bps selectable | Bounds trade-state change, not promised value; cannot override cutoff |
| Display source stale | 5 seconds for live underlying; source time + timer | Proposed presentation limit; does not overwrite boundary truth |

Need measured proof availability/quality and gas before adopting these numerical settings for public testnet activation. A tight five-second oracle window can create voids during outages; widening it is an economic/version change, not a silent retry tactic. All contract deadlines use block time, not device clocks.

## 2. State and interface

Use `roundId = keccak256(abi.encode(block.chainid, address(this), configHash, asset, duration, start))`. Preserve bytes32 IDs separately from existing numeric provider IDs; do not weaken Polymarket/Castora validators globally. Round storage contains frozen metadata, seed owner, state, reserves, remaining outstanding Up/Down supplies, collateral escrow, opening/closing proof observations and a monotonically increasing reserve revision.

State: `Scheduled -> Open -> ResolvedUp | ResolvedDown | Tie | Void`. Effective `Locked/Resolving` is a view of Open after cutoff/end; every trade checks time directly. A valid earliest opening proof of bad quality records `OpeningInvalid`, never permits trading, and times out to Void. A valid earliest closing proof of bad quality records `ClosingInvalid`, followed by Void at deadline. Invalid signatures/wrong feeds/out-of-window proofs simply revert and cannot mark a good round invalid. Future publish times (`publishTime > block.timestamp`) revert. Once a valid-quality boundary is stored it is immutable. No optional operator override.

Proposed external methods (Solidity types abbreviated only for readability):

```
createRound(asset, duration, start, liquidityBeneficiary) payable returns (bytes32)
recordOpening(roundId, bytes[] proof) payable
resolve(roundId, bytes[] closingProof) payable
voidExpired(roundId)
buy(roundId, side, minSharesOut, deadline, operationId) payable returns (shares)
sell(roundId, side, sharesIn, minMonOut, deadline, operationId) returns (monCredit)
claim(roundId, operationId) returns (monCredit)
claimLiquidity(roundId) returns (monCredit)
withdraw(amountWei, operationId) returns (bool paid)
quoteBuy(roundId, side, monIn) view returns (Quote)
quoteSell(roundId, side, sharesIn) view returns (Quote)
round(roundId) view returns (RoundView)
position(roundId, owner) view returns (PositionView)
creditOf(owner) view returns (uint256)
setRiskPaused(bool paused)
```

Trades always act on `msg.sender` and credit that sender's ledger; no recipient parameter. `withdraw` always pays `msg.sender`. Every user mutation checks `usedOperation[msg.sender][operationId]`; reject zero/reused IDs and mark before effects. Use a newly reviewed operation ID only for intentional new activity. A reverted transaction reverts ID consumption. On a failed external withdrawal, restore the credit and emit failure; the ID remains consumed because the request was processed, and the user can explicitly retry with a fresh operation ID. This avoids two successful duplicate logical submissions and still preserves recoverability.

`claimLiquidity` is permissionless but credits only the frozen beneficiary. Reserve holdings are not also entered in the user's share map. It zeros/burns the two AMM reserves exactly once after finalization and uses the same payout routine as user claims. Finalization never loops over holders. `claim` burns both sides for the caller in one call, including losing shares, to minimize rounding dust. Repeated claims cannot deliver money again.

`Quote` contains shares/mon input and output, reserves and revision, marginal share price (explicitly indicative), full-size price impact, state, cutoff and current block context. The native review independently records min-output/deadline; execution does not require reserve revision equality because slippage tolerance already bounds reserve changes. No keeper-offered off-chain quote signature is necessary.

Oracle calls require **exact** `msg.value == pyth.getUpdateFee(proof)`, passed through separately from collateral. Contract never spends user escrow on oracle fees. Permissionless user resolution uses a dedicated review showing its oracle fee and gas; normal keeper-funded resolution incurs no hidden user charge. No public payable fallback accepts unaccounted deposits; forced MON is surplus and grants no shares.

Events: `RoundCreated` (full frozen config identity and seed); `OpeningRecorded`; `BoundaryRejected` (verified-but-bad-quality only); `RoundResolved` (outcome and reason plus exact observations); `Bought` / `Sold` (owner, operationId, round, side, input, output, reserves and revision after); `SharesClaimed`; `LiquidityClaimed`; `Withdrawal` / `WithdrawalFailed`; `RiskPaused`. Include MON and share wei units in ABI/docs; `txHash + logIndex` identifies each event. Do not call credited proceeds transferred cash.

## 3. Math and accounting proof

One share-wei is a claim to one MON-wei if its outcome wins. Deposit `c` MON-wei creates `c` Up plus `c` Down; matched burns destroy equal units of each and release equal collateral. There are no public arbitrary mint/merge calls in V1: the seed/buy/sell routines perform these internal operations atomically.

For an Up buy, let current positive AMM reserves be `x` Up, `y` Down and `k=x*y`. Given input `c`:

```
y' = y+c
x' = ceil(k/y')
sharesOut = x+c-x'
```

Retain `x',y'`; send `sharesOut` to the internal user ledger. `x'*y' >= k` by ceiling definition. Both outcome total supplies increase by `c`, exactly matching new escrow. Reverse x/y for Down. Reject zero output and all cap/slippage/time failures before committing.

For an Up sell `s`, receiving `c` MON requires reserves `x'=x+s-c`, `y'=y-c`. Choose the maximum integer `c` with positive reserves and `x'*y' >= k`:

```
A = x+y+s
D = (x+s-y)^2 + 4*x*y
c = floor((A - ceilSqrt(D))/2)
```

Compute the difference by absolute value before squaring. `ceilSqrt(D)=floorSqrt(D)+(floorSqrt(D)^2<D ? 1:0)`. The expression is the lower quadratic root rounded down; monotonicity of `(x+s-c)*(y-c)` until either reserve empties proves maximality. Recheck the product/bounds defensively in code. Ceil-root is necessary: floor-root can overpay one wei. Use the installed OpenZeppelin integer math helpers only after confirming their actual signatures/version. A measured bounded binary search is an alternative but unnecessary if this formula is proved/tested.

With the 1,000 MON supply cap, each reserve and each side's aggregate holdings is ≤ `10^21` wei. `x+s` remains ≤ that side's aggregate supply for a genuine seller, but use a conservative intermediate bound `2*10^21`; products and D are far below uint256. Nevertheless explicit precondition checks precede multiplication and native `msg.value` addition. Quotes and mutations call **the same Solidity library**, so no JavaScript float formula determines money.

**No manufactured sell payout:** sell moves `s` shares from the user into the pool, then burns `c` complete sets; both aggregate outcome supplies and escrow decrease by `c`. `credits[user]` increases by `c`. Nothing requires the losing side's future payout to cover an undercollateralized sale. User state cannot supply shares absent from their ledger.

Let `E_r` be each round's collateral escrow and `W` total withdrawable credits. Maintain:

```
contract.balance >= sum(E_r) + W
Before finalization: totalUp_r == totalDown_r == E_r
After binary settlement: E_r >= remainingWinningShares_r
After tie/void: 2*E_r >= remainingUp_r + remainingDown_r
```

Seed/buy increases cash and E equally. Sell/claim decreases E and increases W equally. Successful withdrawal decreases W and cash equally; failed withdrawal restores W. Oracle fee pass-through adds then removes identical money outside E/W. Forced transfers only increase surplus. Track global `totalEscrow` and `totalCredits` to test the first invariant without enumerating rounds.

Finalized payout uses weights `(2,0)`, `(0,2)` or `(1,1)`: `credit=floor((u*wUp+d*wDown)/2)`. Combine both sides before division. The payout never exceeds represented liability; tie/void half-wei remainders stay as round dust. After all user and pool shares are burned, dust may remain bounded by less than half a wei per combined claim. Do not permit any admin sweep, early liquidity redemption or rescue of that dust in V1. Leaving at most sub-wei-per-claim residual collectively locked is safer and smaller than introducing claim-order-dependent dust ownership. Loser holders may never burn, so do not require all claims for ordinary user withdrawals.

An unaided buy-then-sell cannot increase the taker's MON with no external trade: buy's rounded product is nondecreasing and sell enforces that new product. Reversing the exact share transfer can return at most the initial collateral; rounding may cost one or more wei. This does not prevent profitable arbitrage from external information or other users' trades. The treasury can lose its entire seed; the cap limits that known exposure.

Read-only model validation conducted for this report: 172,304 small-integer sell cases (`x,y=1..44`, `s=1..89`) verified positive reserves, product preservation and maximal integer payout; 172,304 buy/round-trip cases over the same ranges verified no round-trip profit. This is algebra/model evidence only, **not Solidity tests, overflow proof by execution, or deployment acceptance**.

## 4. Oracle and role boundaries

The adapter calls `parsePriceFeedUpdatesUnique` with the exact feed ID and `[T,T+5]`; its rule is `previousPublishTime < T <= publishTime`. Require positive price and quality/exponent bounds on the returned record. Store raw integer price, exponent, confidence, publish time and `keccak256(proof)`; calldata hash is an evidence pointer, not proof of price authenticity by itself. Compare accepted raw prices only because exponent is frozen to -8.

A proof cryptographically valid for the earliest update but failing quality is an immutable bad-boundary fact. Subsequent proof submissions cannot substitute a later update. Submission deadlines are exclusive: proof must land strictly before deadline; timeout is allowed at or after deadline. Missing opening proof causes void from start+30; missing/bad closing causes void from end+120. A Scheduled round cannot accept a closing proof and become Open retroactively. Valid resolution can complete after end as soon as its closing proof exists and validates. Permissionless duplicate resolution reverts/no-ops without paying oracle twice; clients read state first.

Use constructor-set immutable `roundCreator`, `guardian`, one `liquidityBeneficiary` and immutable adapter. The creation argument must equal that beneficiary; it cannot redirect seed recovery. The creator can fund only valid future rounds under constants/caps. Guardian can pause/unpause **creation and buys**. Sells, settlement, timeout, finalized claims and withdrawals continue; this pause reduces new risk, it is not an emergency fix for a sell bug. No upgrade proxy, arbitrary call, collateral extraction, feed replacement, beneficiary rewriting or existing-round parameter changes. Deployment/address retirement is the containment path for a fundamentally broken design. Record this limitation rather than imply pause stops every possible exploit.

Public testnet creation remains disabled by absent deployment configuration. Deployment tooling may start `riskPaused=true`; guarded unpause occurs only after public proof and lifecycle validation. Mainnet addresses and fixtures never populate the same activation registry.

## 5. Exact minimal repository integration surface

Observed owners below were read in the shared checkout. The sole implementer must merge against current dirty versions rather than replace files using this report as a template.

| Proposed additions | Existing files to extend / reason |
|---|---|
| `contracts/src/predictions/{SenryoBinaryV1.sol,BinaryMath.sol,PythBoundaryOracle.sol}` and an explicitly minimal `IPythBoundary.sol` | Isolate this ledger from `SenryoCore`, `LpVault`, `SessionOracle` and card accounting. Adapter not owner-authorized price setter |
| `contracts/test/predictions/{BinaryMath.t.sol,SenryoBinaryV1.t.sol,BinaryInvariant.t.sol,PythBoundaryOracle.t.sol}`; fixture mock under test only | Follow current Foundry 0.8.31/osaka/Monad configuration. Public Pyth fork proof tests separate from mock tests |
| A separate later `contracts/script/DeployBinary.s.sol` | Export verified ABI through `scripts/contracts-export.mjs`; generated `packages/contracts/src/abis/senryoBinaryV1Abi.ts`. Never fabricate `addresses/10143.json` entry before deployment |
| `packages/config/src/prediction-execution.ts` | Frozen public version, constants, activation metadata, testnet allowlist; existing `predictions.ts` discovery unchanged |
| `packages/chain/src/{binary-reads.ts,binary-calls.ts}` | Add read/quote/calldata builders with `chainId+contract+roundId`, `value`, `minOut`, deadline and operationId. Extend `receipt-facts.ts`, `contracts.ts`, exports and `packages/config/src/gas.ts` with measured actions |
| `packages/api-client/src/routes/binary-predictions.ts` | Separate owned-binary schemas and routes, with bigint codecs and source evidence. Existing discovery `execution:'view-only'` remains true for providers without adapters |
| `services/api/src/predictions/binary.ts` | Extend `services/api/src/routes/predictions.ts` or register a distinct binary route module; use direct chain reads for balances/quotes, indexer only for history |
| `packages/query/src/binary-predictions.ts` | Extend `keys.ts` with chain/address/round/owner/side scope. Reuse `trace.ts`, `operation-progress.ts`, `operations.ts`, `activity-journal.ts`; keep public discovery query keys distinct |
| `indexer/src/handlers/binary-predictions.ts` | Extend `indexer/config.yaml`, `schema.graphql`; add `packages/indexer-client/src/documents/binary-predictions.ts` and exports. Configure real start block only after deployment |
| `services/keeper/src/{jobs/binary-predictions.ts,binary-proof-source.ts,binary-outbox.ts}` | Register job in `env.ts`/`main.ts`; reuse runner/read/sender. Add dedicated migration after latest existing migration for proof cache + durable outbox, without changing card outbox semantics |
| `apps/mobile/src/features/predictions/{BinaryTicket.tsx,BinaryReview.tsx,BinaryPosition.tsx,BinaryHistory.tsx,useBinaryOperation.ts}` | Integrate into existing/new dirty prediction workspace and route owners. Do not replace current chart/dock/source-generation work; import its accepted source owner |

Suggested API shape: public `GET /v1/binary-predictions?chainId=10143&asset=BTC&duration=900`; `GET /:contract/:roundId`; `GET /:contract/:roundId/quote?side=up&action=buy&amountWei=...`; `GET /:contract/:roundId/position/:owner`; `GET /:contract/history/:owner?cursor=...`; bounded `GET /:contract/:roundId/proof?boundary=open|close` can return signed public evidence once redistribution permissions/access are established. No server route signs user orders. Public on-chain ownership data can be read without account authentication; private saved preferences/session actions still use existing auth. Every endpoint validates supported chain/contract rather than letting arbitrary addresses reach RPC.

Indexer entities: `BinaryRound`, `BinaryPosition`, `BinaryTrade`, `BinaryClaim`, `BinaryWithdrawal`, `BinaryAccountCredit`. Scope every ID by chain, contract and round/owner; use canonical event identity including transaction hash/log index. Existing Envio configuration disables automatic cross-chain merging, but explicit namespace protects adapters and caches. Positions indexed for history/display must never authorize spending. Return `indexedBlock` and freshness; unavailable history is unknown, not empty. Preserve canonical rollback behavior and no duplicate event effects.

Weighted-average cost basis is display/accounting metadata, not collateral: buy adds MON cost; partial sell allocates `floor(costBefore*soldShares/sharesBefore)` and final sell allocates the entire remaining cost, so rounding cannot leave orphan cost. Realized result is actual credited MON less allocated basis. Claim removes remaining basis; withdrawal is not a second realized gain. Include both sides separately; pair netting is not automatic before settlement.

## 6. Signing, source guards and durable recovery

Existing `apps/mobile/src/lib/market-data.tsx` installs `configureOperationScopeValidator` checking active network, account and foreground state. `packages/query/src/trace.ts` calls `revalidate` after gas planning and immediately before signature; preserve both checks. Existing `packages/account/src/policy/decode.ts` turns all positive `value` into native-send before calldata parsing; add tightly scoped prediction decoding before that branch, but keep **all V1 prediction mutations step-up-required**, including sell/claim/withdraw. Do not count MON risk as USD6 pair notional and do not approve unknown calls broadly.

Use existing `requestStepUp` -> fresh account ceremony -> `stepUpSender` -> tracked operation. Source/round review fingerprint includes chain, binary contract, config hash, round ID, owner, side, action, input, min output, deadline, operationId, source identity and generation (using the current dirty UI's source-generation owner). Before any async signature completes, recheck account/network/foreground/source generation, contract activation, quote expiry, cutoff, balance/holdings, gas budget and immutable reviewed amounts. Changing source, side or round requires a fresh review. Signed uncertainty remains pinned to its original scope even if the UI navigates elsewhere.

`maxBuy=min(walletMon - 10MON reserve - pendingMon - worstCaseGas, 5MON, supplyRoom)`, floored at zero; include extra user-paid oracle fee only for explicit resolve actions. The 10 MON reservation is conservative and matches current account configuration; do not enable the protocol's emptying exception as a casual prediction shortcut. Existing `fees.ts`/`FeeCache` and gas planning supply the actual gas fee bound. Credits cannot be spent as wallet MON until withdrawn; no virtual double-counting.

Persist an operation before signing, then attach journal signed hash/nonce before broadcast. On receipt, canonical Bought/Sold/Claimed/Withdrawal facts determine output. A successful sell creates a credit, not a wallet transfer. Native Close can be a reviewed two-step sell→withdraw journey with separate gas budget and progress; if the second step fails the UI says proceeds are ready to withdraw. Claims can similarly claim→withdraw. Respect a mid-journey account/network switch: stop unsigned subsequent steps and leave credits recoverable later.

Current mobile sender journal is MMKV-backed and reconciles per chain. Extend existing receipt facts/activity labels; do not introduce a second sender. Unknown after signing blocks blind resubmit; query the original receipt and contract operation marker. A finalized failed withdrawal must be interpreted from its event even though EVM receipt status is success, or use an explicit `withdraw` revert design consistently instead. Both designs preserve credits; this report selects failure event + restored credit to make outcome visible without rolling back prior standalone claim.

The inspected `services/keeper/src/main.ts` currently constructs its Sender with **MemoryJournal**. A new binary keeper cannot rely on that for crash-safe submission. Its durable outbox should use the row-journal pattern in `services/card/src/outbox.ts` (signed bytes/hash saved before send), while keeping prediction state separate. Deduplicate by chain+contract+round+boundary; replay identical signed bytes only according to the existing service outbox policy, never invent a second user order. Coordinate nonces if the existing keeper signer is shared. Persist proof bytes, feed/timestamp metadata, fetch version and checksum with bounded retention, and redact API authorization material from errors.

Collector may run continuously; scheduler can poll due rounds every second. Keeper writes require activation flag, verified manifest and funded operator. Missing Pyth credentials disables proof acquisition and produces an explicit health gate; it must not load fixture proofs or relay unrelated mainnet latest values. Keeper death does not block permissionless proof/timeout/claim methods. A generic healthy runner heartbeat is insufficient: expose last good boundary capture and pending-round backlog separately.

## 7. Required adversarial and native checks

- Algebra/integers: exhaustive small values plus fuzz near caps, perfect/nonperfect sqrt, all rounding parities, 1-wei inputs, reserves 1, alternating sides/trade cycles, full/partial sales, extreme slippage and `minOut+1` failure. Verify no output exceeds actual held shares/escrow.
- Ledger: randomized seed/buy/sell/resolve/tie/void/claim/withdraw sequences across accounts/rounds; global cash/escrow/credit identities, no cross-round leakage, no double liquidity holdings, no duplicate operation/claim, losing and odd-wei void claims, forced MON never mints shares.
- Oracle: wrong receiver/feed, malformed signature, later-valid tick, equal boundary second, previous publish equals boundary, future publish, out-of-range exponent/confidence/price, opening deadline, close deadline, late activation and attempted override. Fixture tests are explicitly not real Pyth verification.
- Calls/roles: callback/reentrancy on withdrawals and oracle adapter, failed recipient, zero address beneficiary, exact fee mismatch, pause while holding, all claims/timeout still possible under risk pause, creator cannot select unsupported schedule or withdraw seed early.
- Recovery: kill before signing/after signing/after broadcast/after inclusion/after sell before withdraw; pending duplicate tap; same operation nonce/hash marker; credit restored on failed payout; background/source/account/network changes during gas planning and step-up; held round remains selected through rollover.
- Indexer/UI: replay/reorg/dedup, unavailable or lagging indexer, direct-chain holdings disagreeing with stale history, 15m and 5m boundary behavior, partial close plus basis allocation, credits and wallet balance not double counted, indicative chart price never presented as executable output.

## 8. Open choices and activation gates

The numerical defaults above and half-value tie/void economics need explicit recording in the implementation design; they are proposed testnet settings, not inferred user approvals of production economics. Most significant economic choice: whether tradable-share fractional void redemption is acceptable, or exact purchase-cost refunds are required (the latter needs materially different insurance/accounting). Fees are deliberately zero, not omitted.

External gate remains authorized Pyth signed-payload access, proof redistribution permissions as applicable, and actual unique-parser `eth_call` / gas measurement. Local fixtures may complete native architecture tests but must not populate the public activation registry. Testnet deployment, roles, 100-MON seeds, keeper funding and verified native lifecycle are subsequent concrete steps; no current address/transaction is supplied because none exists from this work. Physical-device behavior and production Mainnet readiness remain separate gates.

Reference authority: [Pyth unique parser](https://api-reference.pyth.network/price-feeds/evm/parsePriceFeedUpdatesUnique), [upgraded contracts](https://docs.pyth.network/price-feeds/core/upgrade/contracts), [Hermes migration](https://docs.pyth.network/price-feeds/core/upgrade/preparing), [Monad reserve rules](https://docs.monad.xyz/developer-essentials/reserve-balance). Current observations and source-access failures are retained in the feasibility report; this follow-up performed no additional public writes or credential lookup.

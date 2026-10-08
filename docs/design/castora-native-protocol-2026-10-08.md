# Castora retained numerical-contest protocol audit

8 October 2026. Read-only primary-source/RPC audit; only this report was written. No signing, funding, transaction simulation with a user's wallet, public writes, account creation, credential access, UI changes, source changes or Git changes. This is implementation feasibility, not Mainnet transaction acceptance or a legal eligibility opinion.

## Decision and scope

Create **Task 4E — native Castora numerical contests**, sequenced after the current binary implementation so shared account/operation/receipt owners are not edited concurrently. Native entry, owned entries, settlement observation, claim and recovery are feasible source work; a missing Senryo adapter is not a missing protocol capability. Keep live actions disabled until deployment identity, policy, eligibility and transaction acceptance gates below are met. Do not wait for those gates to implement and locally test the native journey.

The approved plan §Trading (lines 114–118), prediction amendment (120–136) and slice 4B explicitly retain Castora separately. It requires genuine native entry/management/claim; redirecting to Castora's website does not complete it. Castora is a fixed-stake numerical accuracy competition, with no share trading/early exit. The binary fallback's AMM, price quotes, exits and timeout refunds must not be imposed on Castora or represented as Castora features. Retain Perpl independently.

Task 6 should replace its broad authentic-provider contest clause with: “Task 4E owns Castora financial contest entry/owned entries/settlement/claim/recovery; Task 6 owns clubs and links to those entries without inventing financial prizes. Task 6B owns programmes/referrals/content.” Task 6 must not count a ranking or generic competition table as Castora delivery.

## Primary evidence and trust boundary

GitHub repository API reports default branch `main`, current SHA `6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643`, and no recognized repository license. Sources inspected directly at that SHA:

- [Core contract](https://github.com/castora-xyz/castora/blob/6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643/contract/src/Castora.sol), [state](https://github.com/castora-xyz/castora/blob/6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643/contract/src/CastoraState.sol), [structs](https://github.com/castora-xyz/castora/blob/6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643/contract/src/CastoraStructs.sol), [getters](https://github.com/castora-xyz/castora/blob/6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643/contract/src/CastoraGetters.sol), [rules](https://github.com/castora-xyz/castora/blob/6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643/contract/src/CastoraPoolsRules.sol), [protocol README](https://github.com/castora-xyz/castora/blob/6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643/contract/README.md).
- [Official frontend contract configuration](https://github.com/castora-xyz/castora/blob/6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643/frontend/src/contexts/ContractContext.tsx), [chain](https://github.com/castora-xyz/castora/blob/6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643/frontend/src/contexts/chains.ts), [entry scaling](https://github.com/castora-xyz/castora/blob/6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643/frontend/src/components/predictions/MakePredictionModal.tsx).
- [Settlement price acquisition](https://github.com/castora-xyz/castora/blob/6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643/server/completer/src/get-snapshot-price.ts), [ranking/ties](https://github.com/castora-xyz/castora/blob/6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643/server/completer/src/get-splitted-predictions.ts), [completion sequence](https://github.com/castora-xyz/castora/blob/6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643/server/completer/src/complete-pool-onchain.ts), [Terms source](https://github.com/castora-xyz/castora/blob/6e0b6dc6be9df1bffbb1d3e0270fe6153a9c8643/frontend/src/pages/TermsPage.tsx).

Source semantics below are verified against published source, **not** reproducible compiled-bytecode equivalence. Nonempty code, stable implementation address and compatible reads do not prove equivalence, audit, future operator liveness or current website policy. The website fetch timed out. No claim of an audit or legal/provider permission is made.

## Exact deployed read evidence

Read-only `eth_chainId`, finalized block, code, EIP-1967 storage, and `eth_call` through public `https://rpc.monad.xyz`; block **111544318**, timestamp **1791442654**, chain **143**. Every deployment/pool read below was pinned to that block.

| Role | Address |
|---|---|
| Core proxy / native MON sentinel | `0x9E1e6f277dF3f2cD150Ae1E08b05f45B3297bE6D` |
| Getters | `0xf08959E66614027AE76303F4C5359eBfFd00Bc30` |
| Core implementation | `0x1cee4bfc463a7cc0016828bcc94e0592c850f97f` |
| Rules (core getter) | `0xfacA692BfeaFB4c6DCaF95a25E5CBCDB65d6eC41` |
| Pools manager (core getter) | `0xF8f179Ab96165b61833F2930309bCE9c6aB281bE` |
| Activities (core getter) | `0x83d063ACDe4C3E799F0F0162d36D8b0605081b6e` |
| Owner (core getter) | `0x3961fe1541fc75fBbC3AdAEb018E65FE391333E0` |

EIP-1967 implementation slot: `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`.

| Code | bytes | keccak256 |
|---|---:|---|
| Proxy | 130 | `0x57558271d751e6ef68dc9809a5d909be98d0ef9629a4508852fdcedea8e4f116` |
| Getters | 12668 | `0x4d39884510234b8516c62dfe38253dda240ea21ca50fb77dca22293dee1a4ea3` |
| Implementation | 18956 | `0xb34508c6dd59c36440170a5e2318c1c72a5e0831c4a66bdfc04e34c0e314d7a6` |

`paused=false`. Global counters: 16 users, 250 pools, 95 predictions, 44 winnings, 3 claimable, 41 claimed, 4 prediction identifiers, 1 stake token. All 250 pools were decoded in five 50-pool reads: **zero open entry windows**, zero unresolved pools with entries. Every pool stakes native MON, at 100 or 200 MON per prediction; fees 500 bps; multiplier values 200/300/500/1000. Pools 69, 186 and 200 each have one unclaimed winning prediction and 95 MON per winner. These are public provider data, not Senryo holdings or acceptance receipts. Latest pool 250 is empty, windowCloseTime 1781257500 and snapshotTime 1783849500. Do not invent new active pools or represent old empty pools as pending winnings.

Official current frontend selects Monad Mainnet. Old Sepolia/testnet artifacts are not sufficient evidence of an operational, supported Castora Practice deployment. Never send chain-143 addresses through the Practice sender.

## Calls, units and lifecycle

Selectors computed independently with installed viem from the exact signatures:

| Contract | Signature | Selector |
|---|---|---|
| Core | `predict(uint256,uint256)` | `0xaca4ed84` |
| Core | `bulkPredict(uint256,uint256,uint16)` | `0x6b8598bc` |
| Core | `claimWinnings(uint256,uint256)` | `0x286db5c2` |
| Core | `claimWinningsBulk(uint256[],uint256[])` | `0xe840a547` |
| Getters | `pool(uint256)` | `0xfe313112` |
| Getters | `prediction(uint256,uint256)` | `0xbdd28010` |
| Getters | `userStats(address)` | `0x8a65d874` |
| Getters | `userPredictionRecordsPaginated(address,uint256,uint256)` | `0x8bcc7e65` |
| Getters | `userClaimableRecordsPaginated(address,uint256,uint256)` | `0x45deb81c` |
| Core, admin only | `initiatePoolCompletion(uint256,uint256,uint256)` | `0x9aed5c6d` |
| Core, admin only | `setWinnersInBatch(uint256,uint256[])` | `0x700aad98` |

The getters also expose joined-pool, per-pool prediction IDs, winner IDs, claimable IDs, and batch `predictions(poolId,ids)` pagination. Use user record pagination directly; the public discovery cap of 500 pools must not hide older owned claims.

- Price input and snapshot convention: USD price × 10^8. Native stake/payout: wei, 18 decimals. Fee `feesPercent` is bps (500=5%); multiplier has two decimals (200=2×). Timestamps are Unix seconds; identifiers/counts/amounts stay bigint. Parse decimal user input exactly without the provider frontend's floating-point multiplication. Prediction identifiers are not ERC20 token addresses.
- Entry: fixed amount per prediction, stored against `msg.sender`; window accepts `block.timestamp <= windowCloseTime`. Paused rejects entry. Single entry requires exact native value equal to stake; bulk requires exact stake × nonzero uint16 count. ERC20 pools use transferFrom to core (send zero native value and exact verified allowance), but none were observed and unknown stake assets must remain unsupported until metadata and policy are verified. No quote/share price/slippage exists. Review states irreversible stake, fee, deadline, snapshot, numerical prediction, maximum loss, multiplier and contingent payout; multiplier is not a guaranteed return.
- Position: immutable owned numerical prediction record (`predicter,poolId,predictionId,predictionPrice,predictionTime,claimedWinningsTime,isAWinner`), not fungible shares. No transfer, cancel, sell, cash-out, or early-exit method in inspected core. Show stake/entry/settlement facts, not tradable NAV or invented unrealized PnL.
- Settlement: admin supplies snapshot and winner IDs, then finalizes. Published worker uses Pyth historical benchmark data and nearest absolute price distance, lower prediction ID first on ties. Core does not independently verify Pyth proof or distance ranking. Winner count is max(1,floor(entries×100/multiplier)); fee=floor(stake×entries×bps/10000); each winning entry gets floor((total stakes−fee)/winner count). Finalization pays fees through manager and enables claims. Operator completion is a genuine dependency; a live display feed cannot resolve a pool.
- Source caveat: the worker's snapshot scaling multiplies by 10^abs(8−abs(exponent)); this is not correct normalization for exponent magnitude greater than eight. Do not duplicate that code or promise robust oracle correctness. Display the provider's actual recorded snapshot and document the operator trust boundary.
- Claim: caller must own that prediction; pool completed, winner flag true, claim timestamp zero, and core unpaused. Exact pool winAmount transfers to the predicter; native recipient uses a low-level call. Batch requires matching arrays and is atomic: one invalid/already-claimed item reverts all. During winner batching, claimable counters may increase before completion; never enable a claim based only on those counters.
- Refund: no inspected core timeout, void, cancellation or participant refund function. No permissionless settlement recovery. An overdue pool remains awaiting operator resolution, without a fabricated refund/close button. Pausing blocks claims too. Losing stakes are not a withdrawable balance.

## Actual Senryo compatibility and gaps

Existing `@senryo/account` supplies a local viem signer/EOA; chain 143 is already allowed and `externalCall` can build payable calls through the standard sender. Castora requires no per-user API credential, EIP-712 CLOB signature or separate provider account in inspected entry/claim source. User ownership and payout are `msg.sender`, compatible in principle with the signer address. This was a code audit, not a user-account transaction test.

**Current session policy rejects these calls.** `packages/account/src/policy/{targets,decode,types,evaluate}.ts` lacks Castora; unknown calldata is `out-of-scope` with `stepUp=false`. Native EVM capability does not mean today's app can send it. Add exact target+chain+selector+decoded argument policy, spend/gas limits, explicit review and consent; do not bypass through generic step-up or add arbitrary payable calls. Claims require zero value; verify ownership and payout account. Core upgrades/unknown code must invalidate the reviewed capability.

`apps/mobile/src/lib/account/sender.ts` selects the active network; dev signing is restricted to local Practice. Integrate chain/account guards so Mainnet discovery in Practice never signs accidentally. `recoverJournal` already reconciles receipts read-only on their original chain; reuse it with Castora event decoding and operation IDs. Entry is not contract-idempotent: blindly retrying after unknown outcome can create another paid entry. Recover hash/receipt and `Predicted` event/owned record first. Reconcile claims using both `ClaimedWinnings` and authoritative ownership/claim timestamp; after partial multi-operation progress retry only unclaimed records. Account/network changes must detach stale UI.

Local discovery is truthful but insufficient for execution: `execution` is literally `view-only`, API lacks core/stake identities, snapshot price, payout, user record, completion-progress and capability gates; provider detail cache can be five minutes old. Entry review must fresh-read pool/paused/implementation/time/balance/gas on the correct chain; fresh-read claimability immediately before sending. Preserve public read-only schemas or add separate capability/owned-entry endpoints rather than implying every discovered pool is executable. Keep historical unlisted owned-entry access distinct from public discovery filters.

Minimal owners: `packages/config/src/predictions.ts` and gas keys; original minimal interface/action/reads under `packages/chain/src/` plus `receipt-facts.ts`; `packages/account/src/policy/`; operation action types/storage in core/query; typed contest capability/owned-entry routes in `packages/api-client/src/routes/predictions.ts`, API prediction adapter and query hooks; `apps/mobile/src/features/predictions/` detail/entry review/my entries/claim/pending/outcome, existing account sender and portfolio/activity integration. Use the original ABI/interface technique already used by `prediction-reads.ts`; do not vendor Castora implementation or deploy it locally without permission.

## Task 4E acceptance and real gates

Implement now: native contest lifecycle, original minimal ABI and deterministic adapters, exact amount parsing, paginated owned records, operation/event recovery, specific closed/paused/unknown asset/awaiting settlement/unsupported network/eligibility states. Preserve discovery and separate binary and Perpl flows. Use an independently written behavioral test double, not copied provider Solidity, for local sender/lifecycle tests.

Required tests: target/selector/value/account/network rejection; exact 8/18 decimal input and overflow; boundary at cutoff and after cutoff; paused entry/claim; unknown stake metadata; entry fee/payout rounding and one-entry case; pending versus completed winner flags; loser/wrong-owner/duplicate claim; batch atomic revert; gas reserve; stale review; implementation drift; old owned records outside discovery cap; app kill before/after broadcast; ambiguous RPC outcome without duplicate entry; receipt emitter/chain filtering; reverted transaction not marked successful; restart/account switch/network switch and query invalidation. Run existing relevant package type/lint checks and native fixture/interactive acceptance. No such source tests were added/run by this report; only read-only RPC checks and independent selector computations above were executed.

Genuinely external gates:

1. **Provider/deployment validation:** establish verified-source/build equivalence and operator/audit/rules evidence, then review live implementation changes. Source inspection is sufficient to build the adapter but insufficient to certify money safety.
2. **Live availability:** current Mainnet has no open pool. A real authorized entry acceptance requires a genuine suitable live pool; do not create or fund a public pool to manufacture acceptance. Claim acceptance requires the actual authorized owner of a winning entry; aggregate provider claims are not ours.
3. **Eligibility and permission:** published Terms require compliance with applicable law but provide no explicit country/age allowlist or native-integration license. Their displayed “last updated” date is generated dynamically and is not a policy revision. Absence of an on-chain gate is not legal eligibility. Obtain product/provider-approved jurisdiction/age/terms policy and record its version before enabling money actions. No legal determination or user location inference occurred here.
4. **License:** inspected contracts carry `UNLICENSED`; repository API reports no license. Reading public signatures/behavior and authoring a minimal interoperability ABI does not authorize copying contract/server/frontend implementation. Do not claim permission to redeploy or reuse it. No license grant was found for copying; no implementation was copied into Senryo by this audit.
5. **Transaction and device acceptance:** requires separately authorized Mainnet funding/broadcast and physical native approval/recovery validation. Source/local-test completion must remain distinct from public entry/claim acceptance. No Castora testnet deployment is verified in this audit.

These gates do not justify leaving feasible source work as a provider-link placeholder. They do justify keeping live entry/claim explicitly gated until evidence exists.

# Monad Architecture — What It Means for App Builders

Monad is a Proof-of-Stake L1 that runs the EVM with full bytecode compatibility as of the **Fusaka** fork. Its design has five major parts: MonadBFT consensus, asynchronous execution, parallel optimistic execution, JIT compilation, and MonadDb. It also uses RaptorCast for block propagation and a local (non-global) mempool.

**TL;DR for builders:** the contract language and tooling are the same as Ethereum. What changes is timing (300 ms blocks, 600 ms finality), the four block states, speculative data, gas charged on the gas **limit**, the reserve-balance rule, and limited historical state.

## 1. MonadBFT (consensus)
- Pipelined, leader-based BFT with **speculative finality in 1 round (300 ms)** and **full finality in 2 rounds (600 ms)**.
- Communication is linear on the happy path. The protocol is optimistically responsive, a failed leader costs only one timeout ("leader fault isolation"), and it resists **tail-forking** (a leader can't fork away its predecessor's block, which blocks that class of MEV attack).
- Blocks come every 300 ms minimum. `TIMESTAMP` has one-second granularity, so **3–4 consecutive blocks share a timestamp**. Don't use `block.timestamp` for sub-second ordering or uniqueness; use `block.number`.
- Paper: https://arxiv.org/abs/2502.20692

## 2. Asynchronous execution: "vote first, execute later"
- Consensus agrees on transaction *ordering* without executing it. Execution runs in a separate lane that lags slightly behind. Because it gets the full block time instead of about 1% of it, execution has a much larger gas budget.
- Proposals carry a **delayed Merkle root** from D=3 blocks earlier. A block becomes `Verified` when a finalized block contains its state root.
- Consequences for builders:
  - **Gas is charged on gas_limit** (DoS protection: consensus can't see gas_used). See differences-from-ethereum.md.
  - **Reserve balance (10 MON)** rules exist because consensus sees state that is 3 blocks old.
  - **Newly funded accounts:** if account B had 0 MON and just received funds, B can't send a transaction until the funding transaction is k=3 blocks old (about 1.2 s after its receipt). A workaround is a contract that A calls to fund B and act on B's behalf in one transaction.
  - `eth_sendRawTransaction` may accept a transaction with a nonce gap or insufficient balance. Acceptance means "the RPC accepted it," not "it's valid."

## 3. Block states: which one should you read?

| Monad state | RPC tag | Reached | Guarantee | Use it for |
|---|---|---|---|---|
| `Proposed` | `"latest"` (`"pending"` behaves the same) | T | Speculatively executed; almost always ends up final | Snappy UI, games, trading signals, "pending ✓" |
| `Voted` | `"safe"` | T+1 (≈300 ms) | Speculative finality. Reverting requires leader equivocation (extremely rare) | Most user-facing confirmations |
| `Finalized` | `"finalized"` | T+2 (≈600 ms) | Irreversible without a hard fork | Crediting deposits, payments, bridging |
| `Verified` | none (latest finalized − 3) | T+5 | Supermajority agrees on the state root | Exchanges, bridges, and RWA/stablecoin issuers with off-chain financial logic |

- **Receipts** from `eth_getTransactionReceipt` are available once the block is **`Proposed`** (speculatively executed). The docs say showing success at `Proposed` is reasonable for most apps. Wait for `Finalized` if you never want to handle a reorg.
- Any RPC response built from non-finalized data **may change on an identical re-request**. That includes the `blockNumber`, log indices, or the receipt itself becoming `null`. Compare the receipt's block number to the `finalized` height before acting on value.
- Two candidate blocks can compete for the same height. Before finality, identify a block by its **blockId**, not its number (`monadNewHeads`/`monadLogs` provide `blockId` and `commitState`).
- A block can skip `Voted` and go straight from `Proposed` to `Finalized`. Abandoned proposals get no explicit event; they are simply superseded.

```ts
// viem: read at different commitment levels
const fast  = await client.readContract({ ...c, blockTag: 'latest' })    // Proposed
const safe  = await client.readContract({ ...c, blockTag: 'safe' })      // Voted
const final = await client.readContract({ ...c, blockTag: 'finalized' }) // Finalized
```

## 4. Parallel optimistic execution
- Transactions in a block run in parallel optimistically. Their inputs and outputs are tracked and results are merged in serial order. A transaction that read stale data is re-executed, with signature recovery and cached state reused.
- **Semantics are identical to serial execution.** Blocks are still linearly ordered, and nothing changes in your contracts.
- Practical perf tip (inferred, not an official rule): contention on a single hot storage slot, such as a global counter every transaction writes, forces re-execution. Shard hot state per user where you can.

## 5. JIT compilation
EVM bytecode is compiled to native machine code. This is transparent to developers.

## 6. MonadDb + MIP-8 page storage (MONAD_TEN)
- A custom Patricia-trie database with async I/O (io_uring) that can bypass the filesystem on raw block devices. It keeps multiple versions, which lets one writer (execution) coexist with many readers (consensus, RPC).
- **MIP-8:** storage is committed in **pages of 128 consecutive slots (4 KB)**, and the page commitment is a BLAKE3 Merkle root. This changes gas: the first touch of a page costs 8,100, and every other slot in that page is then warm (100). **Pack related state into consecutive slots.** Structs, arrays, and sequential state variables benefit automatically. Each mapping key lands on its own page. `monad-crypto/paged-solady` offers Solidity snippets optimized for paged storage.
- **Historical state is pruned.** Nodes keep as many state versions as the disk allows, roughly 40k blocks (about 3.3 hours) on a 2 TB SSD. Transactional data (blocks, txs, receipts, logs, traces) is kept in full. See differences-from-ethereum.md.

## 7. Local mempool, no global mempool
- RPC nodes forward transactions to the next few leaders and re-forward them if they aren't included.
- There is no `newPendingTransactions` subscription or global `txpool_content`. `eth_getTransactionByHash` returns `null` until the transaction is included.
- Use `txpool_statusByHash` / `txpool_statusByAddress` (Monad-specific) for node-level pending status.
- The default ordering is a Priority Gas Auction (descending total gas price).

## 8. Transaction lifecycle for a frontend
1. Build the transaction with an **explicit gas limit** (you pay for the limit).
2. `eth_sendRawTransaction` returns a hash, meaning "accepted by the RPC." `eth_sendRawTransactionSync` is also supported and returns the receipt in one round trip.
3. A receipt appears at `Proposed` (~300 ms or less). Show "done" here for low-value actions.
4. At `Finalized` (+600 ms), credit balances and treat value as settled.
5. For off-chain accounting (bridges, exchanges), wait until `Verified` (+3 more blocks).

## 9. Staking (native, precompile 0x1000)
- An epoch is 50,000 blocks (about 4 h 12 min) plus a 5,000-round delay. Changes take effect in epoch n+1, or n+2 if submitted after the boundary block. Always check `getEpoch()`, because rounds ≠ blocks.
- Methods: `delegate(valId)` payable (≥1 gwei), `undelegate(valId, amount, withdrawId 0-255)`, `withdraw` after a 1-epoch WITHDRAWAL_DELAY, `claimRewards` (immediate), and `compound`.
- **Only `CALL` works.** `STATICCALL`/`DELEGATECALL`/`CALLCODE` revert, so even "view" getters are `nonpayable`. There is **no code at the address**, so forked tests don't work; Foundry ≥1.8 has staking cheatcodes.
- Paginated getters return up to 100 results per page (`getDelegations`/`getDelegators` return 50 since MONAD_EIGHT).
- `ACTIVE_VALIDATOR_STAKE` = 10,000,000 MON (MONAD_FIVE).
- TS helpers: `@monad-crypto/viem` (`client.extend(monadActions())` → `client.staking.getEpoch()`, `client.wmon.getBalanceOf()`). Python: `monad-developers/staking-sdk-cli`.
- Reference: https://docs.monad.xyz/reference/staking/api

## 10. MON token basics for builders
- Native gas token, 18 decimals. Wrapped as **WMON** at `0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A` on mainnet.
- On other chains: WMON on Ethereum at `0x6917037f8944201b2648198a89906edf863b9517` (2/2 NTT); WMON on Solana at `CrAr4RRJMBVwRsZtT62pEhfA9H5utymC2mVx8e7FreP2`.
- Typical costs at the min base fee: a transfer (21k gas) is 0.0021 MON (~$0.00005); a swap (200k gas) is 0.02 MON (~$0.0005).

## Sources
- https://docs.monad.xyz/monad-arch/consensus/monad-bft.md
- https://docs.monad.xyz/monad-arch/consensus/asynchronous-execution.md
- https://docs.monad.xyz/monad-arch/consensus/block-states.md
- https://docs.monad.xyz/monad-arch/execution/parallel-execution.md
- https://docs.monad.xyz/monad-arch/execution/monaddb.md
- https://docs.monad.xyz/monad-arch/realtime-data/spec-realtime.md
- https://docs.monad.xyz/developer-essentials/summary.md
- https://docs.monad.xyz/reference/staking/overview.md
- https://docs.monad.xyz/developer-essentials/gas-pricing.md
- https://github.com/monad-crypto/monad-ts

# Monad vs Ethereum — The Gotchas That Will Bite You

Ordered by how likely each one is to hurt a hackathon build. All points were verified against docs.monad.xyz on 2026-09-28.

## 1. You pay for the gas LIMIT, not gas used
`fee = value + gas_price × gas_limit`. This protects async execution from DoS: consensus can't know gas_used.
- **Hardcode gas for fixed-cost actions.** Native transfer = `21_000n`. Pass `gas:` explicitly in viem or wagmi.
- For variable calls, use `eth_estimateGas` plus a **small** buffer, not the usual 20–50%. Category Labs has a gas-limit analysis: https://www.category.xyz/blogs/setting-your-gas-limit-on-monad
- **The MetaMask trap:** when `eth_estimateGas` reverts (for example, a mint that's sold out), some wallets fall back to a huge gas limit, and on Monad the user **pays all of it**. Simulate first and set gas explicitly.
- Per-tx max is **30M gas**. The block is 150M.
- `eth_maxPriorityFeePerGas` returns a hardcoded 2 gwei. `eth_feeHistory(…, "latest")` repeats the latest baseFee twice, so don't double-count it.
- Min base fee is 100 MON-gwei. The base-fee controller rises slower and falls faster than Ethereum's.

## 2. Reserve balance: 10 MON
Asynchronous execution means consensus sees state that is k=3 blocks (~1.2 s) old, so each EOA gets a 10 MON "gas budget" for in-flight transactions.
- **Execution rule:** a transaction reverts if it lowers an account's balance **below 10 MON** through *value* spend (outgoing MON), except for an "emptying transaction." An emptying transaction comes from an **undelegated** sender that has sent no other transaction in the last k blocks and has had no delegation change in that window.
- In practice, a normal undelegated wallet can drain itself below 10 MON **once per ~1.2 s**. A second MON-spending transaction within 3 blocks that dips below 10 MON will be **included but revert, and still pays gas.**
- **EIP-7702-delegated EOAs can never dip below 10 MON** through a transaction that decreases their balance. They may *hold* less than 10 MON; the rule is only that a transaction can't *decrease* the balance to below 10 MON. To empty such an account, undelegate first and wait k blocks. Gas-sponsored flows where the EOA holds ~0 MON and doesn't send MON out are fine.
- Contracts can detect a dip through the precompile at **`0x1001`**: `dippedIntoReserve()`, selector `0x3a61584e`, 100 gas. It must be called with `CALL` (not `STATICCALL`) and is deliberately not `view`.
- **Newly funded account:** wait until the funding transaction is 3 blocks old before spending from it.
- Expect to see "included but reverted" transactions for insufficient MON on explorers. They are valid.

## 3. Historical state is NOT available (receipts and logs are)
- Full nodes keep all **transactional** data (blocks, txs, receipts, logs, traces) but only **recent state** (~40k blocks, roughly 3 hours, depending on the provider's disk).
- `eth_call` / `eth_getBalance` / `eth_getStorageAt` at an old `blockNumber` **may fail**. For archive state use `https://rpc-mainnet.monadinfra.com` (20 rps, batch 1) or `https://rpc2.monad.xyz` (Goldsky).
- **Design rule:** emit events for anything you'll need later, or use an indexer. Don't plan on "read balance at block N" for leaderboards or snapshots.

## 4. `eth_getLogs` range is tiny
100 blocks (≈30 s) on QuickNode and MF, 1,000 on Alchemy and Ankr. Blocks hold up to ~3,750 transactions. Backfills need an indexer (Envio, Goldsky, The Graph, and others) or a paid RPC. Use WebSocket `logs`/`monadLogs` for live data.

## 5. Speculative data and commitment levels
- `latest` = `Proposed` = speculatively executed, not yet voted. `safe` = `Voted`. `finalized` = `Finalized` (600 ms).
- Receipts show up at `Proposed`. Data from non-final blocks can change on re-query. Settle value on `finalized`.
- `eth_getTransactionByHash` returns **null for pending transactions**. There's no global mempool and no `newPendingTransactions` subscription.
- `eth_sendRawTransaction` success means the RPC accepted the transaction, not that it's valid. Nonce and balance checks are deferred.

## 6. Timestamps
One-second granularity with 300 ms blocks, so **3–4 blocks share a `block.timestamp`**. Anything keyed on timestamp (rate limits, "one action per block", randomness seeds, auctions) must use `block.number` or its own counters.

## 7. EVM differences
| Item | Ethereum | Monad |
|---|---|---|
| Max contract code size | 24 KB | **128 KB** |
| Max initcode | 48 KB | **256 KB** |
| Cold account access (BALANCE, EXTCODE*, CALL family, SELFDESTRUCT) | 2,600 | **10,100** |
| Cold storage | 2,100 per slot | **8,100 per 128-slot page** (then 100 for any slot in the page) |
| SSTORE | 20k fresh / 2.9k overwrite | 100 base + 8,000 page load + 2,800 first page write + **17,000 per net new slot** (high-water mark per page) |
| Memory expansion | 3w + w²/512 | **w/2, capped at 8 MB per tx** (cumulative across frames; exceeding the cap behaves like OOG) |
| ecRecover / ecAdd / ecMul / ecPairing / blake2f / point_eval | 3k / 150 / 6k / 45k+34k·k / r / 50k | **6k / 300 / 30k / 225k+170k·k / 2r / 200k** |
| Warm access | 100 | 100 (same) |
| Opcodes | Fusaka | all Fusaka opcodes, incl. CLZ (EIP-7939) |

- Cross-contract calls to cold addresses cost about 4× more, so batch reads through one contract and avoid needless external calls in hot paths.
- Page-based storage (MIP-8): consecutive slots are cheap. Structs and arrays pack well; each mapping key starts its own page. EIP-2930 access lists warm whole pages.
- **Solidity/Hardhat:** set `evmVersion: "osaka"`.

## 8. Precompiles
- Ethereum `0x01`–`0x11` (Fusaka, including BLS12-381 `0x0b`–`0x11` and KZG `0x0a`).
- **`0x0100` P256VERIFY (EIP-7951, same address and interface as RIP-7212).** Input is 160 bytes `hash‖r‖s‖qx‖qy`, output is 32 bytes `…01` on success or **empty** on failure. **6,900 gas.** This enables on-chain passkey/WebAuthn verification.
  ```solidity
  (bool ok, bytes memory res) = address(0x0100).staticcall(abi.encodePacked(hash, r, s, qx, qy));
  bool valid = ok && res.length == 32 && abi.decode(res, (uint256)) == 1;
  ```
- **`0x1000` staking** (CALL only; no code at the address, so forked tests fail).
- **`0x1001` reserve balance** (`dippedIntoReserve()`).
- If an EIP-7702 EOA delegates to a *Monad* precompile, calls to it revert.

## 9. Transactions
- Supported types: 0, 1, 2, 4 (EIP-7702). **Type 3 (blobs / EIP-4844) is rejected.** Pre-EIP-155 (chainless) transactions are allowed, which is how Nick's-method deployments like ERC-1820 work, so don't reuse addresses that ever signed pre-155 transactions.
- **EIP-7702 is supported**, with two caveats: (a) the 10 MON dip rule above; (b) code running *as* a delegated EOA **cannot `CREATE`/`CREATE2`**. The frame reverts. A plain contract-creation transaction *sent from* a delegated EOA is fine.
- Clear a delegation with a type-4 transaction that points to `0x0000…0000`.

## 10. Account abstraction (4337)
- EntryPoint v0.6, v0.7, v0.8, and v0.9 are deployed at canonical addresses on mainnet and testnet (see contracts-and-tokens.md).
- Bundler/paymaster providers listed in the docs: Alchemy, Biconomy, FastLane, Gelato, Openfort, Pimlico, Sequence, thirdweb, ZeroDev. Smart-account SDKs: Biconomy, MetaMask Smart Accounts Kit, Pimlico, ZeroDev. The UserOp explorer is JiffyScan.
- Remember that UserOps pay on gas limits too, so size `callGasLimit` and `verificationGasLimit` tightly.

## 11. RPC quirks
- `debug_trace*` **requires** a trace-options object (`{}`); leaving it out gives `-32602`. The default tracer is **callTracer**. There are **no opcode-level struct logs**.
- `eth_call` has a 200M gas cap on most public RPCs. The low-gas pool (≤8.1M) is faster.
- Batch limits vary: 100 on QuickNode/Alchemy, 10 on Goldsky/Ankr, 1 on MF.
- WebSocket: `newHeads`, `logs`, `monadNewHeads`, `monadLogs`. **No** `syncing` or `newPendingTransactions`.
- `eth_sendRawTransactionSync` is supported.

## 12. Tooling versions that matter
- **Foundry ≥ 1.8** with `network = "monad"`. Without it, local tests use Ethereum gas rules and hide 128 KB-size and page-gas issues. The old `category-labs/foundry` fork is deprecated.
- **viem ≥ 2.40.0**, alloy-chains ≥ 0.2.20, Hardhat 3.1+ for Solidity 0.8.31.
- The viem chain defs still say `blockTime: 400`; the real value is 300 ms. The `monadTestnet` default explorer is the stale `testnet.monadexplorer.com`, so override it with MonadVision or Monadscan.
- The x402 `upto` scheme needs **`@x402/evm >= 2.12.0`** (2.22.0+ recommended). Versions 2.9–2.11 point to a proxy that isn't deployed on Monad, and settlement fails silently.

## Sources
- https://docs.monad.xyz/developer-essentials/differences.md
- https://docs.monad.xyz/developer-essentials/summary.md
- https://docs.monad.xyz/developer-essentials/gas-pricing.md
- https://docs.monad.xyz/developer-essentials/opcode-pricing.md
- https://docs.monad.xyz/developer-essentials/reserve-balance.md
- https://docs.monad.xyz/developer-essentials/eip-7702.md
- https://docs.monad.xyz/developer-essentials/precompiles.md
- https://docs.monad.xyz/developer-essentials/historical-data.md
- https://docs.monad.xyz/developer-essentials/transactions.md
- https://docs.monad.xyz/developer-essentials/wallet-developers.md
- https://docs.monad.xyz/reference/json-rpc/overview.md
- https://docs.monad.xyz/guides/x402.md
- https://docs.monad.xyz/tooling-and-infra/wallet-infra/account-abstraction.md

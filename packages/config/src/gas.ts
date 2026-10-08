/**
 * Gas budgets (Monad charges the gas LIMIT, not gas used — context/02-monad/differences-from-ethereum.md §1).
 * `packages/chain/send.ts` sets gas = estimate × (1 + GAS_HEADROOM_BPS), capped at the action's budget, and refuses to
 * send when the estimate alone is above the budget (something is wrong; a huge limit would be charged in full).
 *
 * Market budgets are ceilings for relayed and keeper sends (D-266, D-278); the limit actually set is the estimate plus
 * `GAS_HEADROOM_BPS`, so a ceiling only stops a runaway. Every user action is relayed, so users never hold gas.
 */

/** +10 % over `eth_estimateGas`: small on purpose — the whole limit is paid. */
export const GAS_HEADROOM_BPS = 1_000n;

/** Plain MON transfer (fixed cost). */
export const NATIVE_TRANSFER_GAS = 21_000n;

export const GAS_LIMITS = {
  transfer: NATIVE_TRANSFER_GAS,
  /** ERC-20 approve (finite allowances only, D-266). */
  approve: 110_000n,
  /** ERC-20 transfer of USDC / Test USD. */
  erc20Transfer: 90_000n,
  /** Circle USDC `transferWithAuthorization` (EIP-3009) relayed for withdrawals. */
  transferWithAuthorization: 120_000n,
  /** A commit, possibly batched with opening its window and recording the open print (Multicall3). */
  marketCommit: 900_000n,
  /** One `finalize` of up to 32 tickets at one print. */
  marketFinalize: 4_000_000n,
  /** Close print + resolve + settle + the first `claimFor` batch (Multicall3), or a further batch. */
  marketSettle: 5_000_000n,
  /** `expire` of up to 32 tickets. */
  marketExpire: 2_000_000n,
  sessionGrant: 300_000n,
  sessionRevoke: 150_000n,
  /** Test USD `mint` for the Practice grant. */
  dollarMint: 150_000n,
};
export type GasAction = keyof typeof GAS_LIMITS;

/** Monad's `eth_maxPriorityFeePerGas` is a hard-coded 2 gwei (network-and-endpoints.md). */
export const PRIORITY_FEE_WEI = 2_000_000_000n;

/**
 * Base-fee multiplier for `maxFeePerGas` (bps): 2× absorbs a few blocks of base-fee rise. The charge is
 * gas LIMIT × effective price (base + priority), so a higher cap costs nothing unless the base fee really rises.
 */
export const MAX_FEE_BASE_MULTIPLIER_BPS = 20_000n;

/**
 * Tighter max fee for user-signed sends (D-171): Monad checks the balance against gas LIMIT × max fee, so 2× doubles
 * the reserve for nothing. 24 h measurement (30 Sep): testnet flat at 100 gwei; mainnet ≤ 106.1 gwei, worst 10-block
 * rise 6.1 %. 1.25× keeps 4× that headroom.
 */
export const USER_MAX_FEE_BASE_MULTIPLIER_BPS = 12_500n;

/** Monad minimum base fee (100 MON-gwei) — used when a node reports none. */
export const MIN_BASE_FEE_WEI = 100_000_000_000n;

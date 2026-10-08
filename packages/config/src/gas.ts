/**
 * Gas budgets (Monad charges the gas LIMIT, not gas used — context/02-monad/differences-from-ethereum.md §1).
 * `packages/chain/send.ts` sets gas = estimate × (1 + GAS_HEADROOM_BPS), capped at the action's budget, and refuses to
 * send when the estimate alone is above the budget (something is wrong; a huge limit would be charged in full).
 *
 * After the prediction-market pivot (D-256) only the generic money actions remain here. The market budgets
 * (commit, finalize, close, settle, claimFor) are measured with `eth_estimateGas` against the S2 deploy and added then.
 * Every user action is relayed by the sponsor (D-266), so users never hold gas.
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

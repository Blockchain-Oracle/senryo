/**
 * Gas budgets (Monad charges the gas LIMIT, not gas used — context/02-monad/differences-from-ethereum.md §1).
 * `packages/chain/send.ts` sets gas = estimate × (1 + GAS_HEADROOM_BPS), capped at the action's budget, and refuses to
 * send when the estimate alone is above the budget (something is wrong; a huge limit would be charged in full).
 *
 * Budgets from specs/contracts.md "Monad specifics" (forge snapshot + mainnet estimate + 10 %); entries marked
 * (S3) were added for service/keeper actions and are re-calibrated against `eth_estimateGas` before mainnet (S8).
 */

/** +10 % over `eth_estimateGas`: small on purpose — the whole limit is paid. */
export const GAS_HEADROOM_BPS = 1_000n;

/** Plain MON transfer (fixed cost). */
export const NATIVE_TRANSFER_GAS = 21_000n;

/** Per-position increment of the liquidation budget (`liquidate` base + this × open positions). */
export const LIQUIDATE_GAS_PER_POSITION = 200_000n;

export const GAS_LIMITS = {
  transfer: NATIVE_TRANSFER_GAS,
  approve: 80_000n,
  deposit: 150_000n,
  withdraw: 200_000n,
  increase: 450_000n,
  decrease: 400_000n,
  close: 400_000n,
  placeHold: 180_000n,
  /** (S3) same storage shape as placeHold. */
  increaseHold: 180_000n,
  captureHold: 200_000n,
  releaseHold: 100_000n,
  /** (S3) anyone after expiry + grace. */
  releaseExpiredHold: 120_000n,
  /** (S3) refund repays card debt first, then credits the user. */
  refund: 200_000n,
  liquidate: 300_000n,
  lpDeposit: 220_000n,
  claimFor: 120_000n,
  /** (S3) testnet claim also mints practice AUSD and deposits it into the core. */
  claimForPractice: 400_000n,
  /** (S3) voucher = signature check + depositFor. */
  redeemVoucher: 300_000n,
  /** (S3) StarterDrip.topUp: capped native send. */
  topUp: 120_000n,
  /** (S3) SessionOracle.observe (feed read + optional confirmation walk). */
  observe: 250_000n,
  /** (S3) TriggerOrders.executeTrigger ≈ a decrease plus the order bookkeeping. */
  executeTrigger: 500_000n,
  /** (S3) testnet MirrorAggregator.pushAnswer (two fresh slots). */
  pushAnswer: 150_000n,
  /** (S3) testnet MockStable.faucet(). */
  faucet: 120_000n,
  /** (S3) setSpendAllowance relay (EIP-712 check + allowance write). */
  setSpendAllowance: 150_000n,
  /** Perpl IOC order (S7). */
  perplIoc: 700_000n,
} as const;

export type GasAction = keyof typeof GAS_LIMITS;

/** Liquidation budget for an account with `positions` open positions. */
export function liquidateGasLimit(positions: number): bigint {
  return GAS_LIMITS.liquidate + LIQUIDATE_GAS_PER_POSITION * BigInt(Math.max(positions, 1));
}

/** Monad's `eth_maxPriorityFeePerGas` is a hard-coded 2 gwei (network-and-endpoints.md). */
export const PRIORITY_FEE_WEI = 2_000_000_000n;

/**
 * Base-fee multiplier for `maxFeePerGas` (bps): 2× absorbs a few blocks of base-fee rise. The charge is
 * gas LIMIT × effective price (base + priority), so a higher cap costs nothing unless the base fee really rises.
 */
export const MAX_FEE_BASE_MULTIPLIER_BPS = 20_000n;

/** Monad minimum base fee (100 MON-gwei) — used when a node reports none. */
export const MIN_BASE_FEE_WEI = 100_000_000_000n;

/**
 * The protocol constants the preview mirror needs, copied **by name** from `contracts/src/libraries/Constants.sol`.
 * The invariant `risk-mirror-constants` fails the fast gate when any value here drifts from the Solidity source.
 * Units: usd6 (1e6 = $1) · price/size 1e18 · bps 1e4 · seconds.
 */
export const RISK = {
  WAD: 10n ** 18n,
  BPS: 10_000n,
  /** size (1e18) × price (1e18) / NOTIONAL_SCALE = usd6. */
  NOTIONAL_SCALE: 10n ** 30n,
  SECONDS_PER_HOUR: 3600n,
  SECONDS_PER_WEEK: 604_800n,

  MIN_POSITION_NOTIONAL_USD6: 5_000_000n,
  MIN_HOLD_BLOCKS: 20n,
  CLOSED_IM_MULTIPLIER: 2n,

  AGE_SPREAD_BPS_PER_HOUR: 6n,
  AGE_SPREAD_CAP_BPS: 10n,
  CLOSED_BASE_SPREAD_BPS: 25n,
  CLOSED_SPREAD_BPS_PER_HOUR: 5n,
  CLOSED_SPREAD_CAP_BPS: 300n,
  IMPACT_K_BPS: 10n,
  DEPTH_POOL_BPS: 10_000n,
  MAX_IMPACT_BPS: 50n,

  SAFETY_BUFFER_USD6: 1_000_000n,
  /** Insurance fund's cut of every trading fee; the LP pool keeps the rest. */
  FEE_TO_INSURANCE_BPS: 1_000n,
  LIQ_PENALTY_BPS: 100n,

  REOPEN_WINDOW: 300n,
  WEEK_ANCHOR: 345_600n,
  SLOT_SECONDS: 900n,
  SLOTS_PER_WEEK: 672n,
  SLOTS_PER_WORD: 256n,
  LP_REDEEM_DELAY: 86_400n,
} as const;

/** `MarketStatus` enum order in `Types.sol`. */
export const MARKET_STATUSES = ["OPEN", "REOPENING", "CLOSED", "STALE", "CIRCUIT", "HALTED"] as const;
export type MarketStatus = (typeof MARKET_STATUSES)[number];

/** Statuses where only reducing is allowed and liquidations pause (risk-math.md status matrix). */
export const PAUSED_STATUSES: ReadonlySet<MarketStatus> = new Set(["STALE", "CIRCUIT", "HALTED"]);

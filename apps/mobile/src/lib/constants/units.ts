/** Decimal places of each integer unit the app displays. */
export const DECIMALS = {
  /** usd6: AUSD / USDC base units. */
  usd: 6,
  /** Chainlink push feeds on Monad (XAU/USD, XAG/USD): 8 decimals. */
  oracle: 8,
  /** Basis points shown as a percent: 1 bp = 0.01%. */
  bpsAsPct: 2,
  /** Cents / two-decimal display. */
  cents: 2,
} as const;

/** One whole unit in each base. */
export const ONE_USD6 = 1_000_000n;
export const ONE_E8 = 100_000_000n;
export const BPS_DENOMINATOR = 10_000n;

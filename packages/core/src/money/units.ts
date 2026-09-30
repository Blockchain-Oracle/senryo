/**
 * Money is integer base units everywhere (CLAUDE.md). These are the scales the product uses:
 *  - usd6: AUSD / USDC base units (collateral, balances, PnL, fees)
 *  - e8: Chainlink push-feed answers (XAU/USD, XAG/USD — 8 decimals, D-006)
 *  - e18: engine prices and sizes (specs/risk-math.md) and native MON
 *  - bps: rates and ratios (1 bp = 0.01 %)
 */
export const DECIMALS = {
  usd6: 6,
  e8: 8,
  e18: 18,
  /** Basis points read as a percent with two decimals: 82 bps → 0.82 %. */
  bpsAsPct: 2,
  /** Two-decimal display (cents, percent). */
  cents: 2,
} as const;

export const TEN = 10n;

export function oneUnit(decimals: number): bigint {
  return TEN ** BigInt(decimals);
}

export const ONE_USD6 = oneUnit(DECIMALS.usd6);
export const ONE_E8 = oneUnit(DECIMALS.e8);
export const ONE_E18 = oneUnit(DECIMALS.e18);
export const BPS_DENOMINATOR = 10_000n;

/** Rescales between integer bases. Down-scaling truncates toward zero (callers that need rounding use `divRound`). */
export function rescale(value: bigint, fromDecimals: number, toDecimals: number): bigint {
  if (fromDecimals === toDecimals) return value;
  return toDecimals > fromDecimals
    ? value * oneUnit(toDecimals - fromDecimals)
    : value / oneUnit(fromDecimals - toDecimals);
}

/** Integer division rounding half away from zero. */
export function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new RangeError("divRound: division by zero");
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = (n + d / 2n) / d;
  return negative ? -q : q;
}

/** `value × bps / 10_000`, rounded half away from zero. */
export function applyBps(value: bigint, bps: bigint): bigint {
  return divRound(value * bps, BPS_DENOMINATOR);
}

/**
 * A basket's value in points, bit for bit with `BasketPrintVerifier` (D-286, D-124): Σ floor(wᵢ · pᵢ · 1e11 /
 * (10,000 · baseᵢ)) over e-8 prices, so 1,000 points × 1e8 when every member sits at its base. Confidence is the same
 * sum over the members' confidences. Null when a member has no price (a basket is never shown partial).
 */

/** 1,000 points × 1e8 (contracts `BASKET_BASE_POINTS_E8`). */
export const BASKET_BASE_POINTS_E8 = 100_000_000_000n;
const BPS = 10_000n;

export interface BasketTerm {
  weightBps: number;
  baseE8: bigint;
  /** The member's price × 1e8, or undefined when it has none yet. */
  valueE8: bigint | undefined;
}

export function basketPointsE8(terms: readonly BasketTerm[]): bigint | null {
  let sum = 0n;
  for (const t of terms) {
    if (t.valueE8 === undefined || t.baseE8 <= 0n) return null;
    sum += (BigInt(t.weightBps) * t.valueE8 * BASKET_BASE_POINTS_E8) / (BPS * t.baseE8);
  }
  return sum;
}

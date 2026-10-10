// σ marks as the reserve reads them (contracts `SigmaMarks.sol`, `SeriesListing._priceBand`; D-300, D-313): the one
// minute a fill's mark must be for, and each σ held inside the series' listed bounds. Quotes on the devices and in the
// services price with the mark the fill will carry, clamped the same way.

/** The keeper signs a few seconds after each boundary; a fill carries the last boundary at least this long before it. */
export const SIGMA_MARK_LAG_SEC = 5;
export const SIGMA_MARK_STEP_SEC = 60;

/** The minute boundary whose mark a fill at `target` (seconds) carries. */
export function markMinuteOf(target: number): number {
  const t = target - SIGMA_MARK_LAG_SEC;
  return t - (t % SIGMA_MARK_STEP_SEC);
}

/** A feed's fast mark and slow anchor through one minute (σ per √second × 1e8). */
export interface SigmaPair {
  fastE8: bigint;
  slowE8: bigint;
}

const clamp = (x: bigint, lo: bigint, hi: bigint): bigint => (x < lo ? lo : x > hi ? hi : x);

/** Both σ held inside a series' bounds, as the reserve prices them. */
export const clampMark = (m: SigmaPair, floorE8: bigint, capE8: bigint): SigmaPair => ({
  fastE8: clamp(m.fastE8, floorE8, capE8),
  slowE8: clamp(m.slowE8, floorE8, capE8),
});

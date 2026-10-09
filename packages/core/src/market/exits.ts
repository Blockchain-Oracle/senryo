// When a ticket's exit (D-292) should fire, as `BandBook._fillClose` judges it at the fill print: the api's watcher
// fires on this, the apps show it, and the chain re-checks the bid of the print that actually fills.

/** A ticket's exit as the chain holds it: a share's bid × 1e6, 0 = unset. */
export interface ExitPrices {
  takeProfitE6: number;
  stopLossE6: number;
  floorE6: number;
  trailE6: number;
}

/** `price`: take-profit or stop-loss (anyone may fire it) · `trail`: the trail's stop (the exit role fires it). */
export type ExitFire = "price" | "trail";

export const hasExit = (e: ExitPrices): boolean => e.takeProfitE6 > 0 || e.stopLossE6 > 0 || e.trailE6 > 0;

/** The trail's stop: its best bid less the trail, never under the floor (null without a trail or a best bid). */
export function trailStopE6(e: ExitPrices, peakE6: number): number | null {
  if (e.trailE6 === 0 || peakE6 === 0) return null;
  return Math.max(peakE6 - e.trailE6, e.floorE6);
}

/** Whether `bidE6` meets the exit now, and the trail's best bid after seeing it (it only rises). */
export function exitDecision(e: ExitPrices, bidE6: number, peakE6: number): { fire: ExitFire | null; peakE6: number } {
  const peak = e.trailE6 > 0 ? Math.max(peakE6, bidE6) : 0;
  if (e.takeProfitE6 > 0 && bidE6 >= e.takeProfitE6) return { fire: "price", peakE6: peak };
  if (e.stopLossE6 > 0 && bidE6 <= e.stopLossE6 && bidE6 >= e.floorE6) return { fire: "price", peakE6: peak };
  const stop = trailStopE6(e, peak);
  if (stop !== null && bidE6 <= stop && bidE6 >= e.floorE6) return { fire: "trail", peakE6: peak };
  return { fire: null, peakE6: peak };
}

// When a ride's exit (R3.12) should fire, as `RideBounds._rideExitMet` judges it at the close's print: the api's
// watcher fires on this and the apps show it. Take-profit and stop-loss are prices; the trail follows the best price
// since it was set by `trailBps` of it, and fills only on the rider's side of the floor.
import { BPS } from "./band-math.ts";

/** A ride's exit as the chain holds it: prices × 1e8 (0 = unset) and the trail in bps of the price. */
export interface RideExitLevels {
  takeProfitE8: bigint;
  stopLossE8: bigint;
  floorE8: bigint;
  trailBps: number;
}

export type RideExitFire = "price" | "trail";

/** The trail's stop from its best price (null without a trail or a best price yet). */
export function rideTrailStopE8(e: RideExitLevels, isLong: boolean, peakE8: bigint): bigint | null {
  if (e.trailBps === 0 || peakE8 === 0n) return null;
  const away = (peakE8 * BigInt(e.trailBps)) / BPS;
  return isLong ? peakE8 - away : peakE8 + away;
}

/** Whether `priceE8` meets the exit now, and the trail's best price after seeing it (it only moves the rider's way). */
export function rideExitDecision(
  e: RideExitLevels,
  isLong: boolean,
  priceE8: bigint,
  peakE8: bigint,
): { fire: RideExitFire | null; peakE8: bigint } {
  const better = peakE8 === 0n || (isLong ? priceE8 > peakE8 : priceE8 < peakE8);
  const peak = e.trailBps > 0 && better ? priceE8 : e.trailBps > 0 ? peakE8 : 0n;
  if (e.takeProfitE8 > 0n && (isLong ? priceE8 >= e.takeProfitE8 : priceE8 <= e.takeProfitE8)) {
    return { fire: "price", peakE8: peak };
  }
  if (e.stopLossE8 > 0n && (isLong ? priceE8 <= e.stopLossE8 : priceE8 >= e.stopLossE8)) {
    return { fire: "price", peakE8: peak };
  }
  const stop = rideTrailStopE8(e, isLong, peak);
  const pastFloor = e.floorE8 === 0n || (isLong ? priceE8 >= e.floorE8 : priceE8 <= e.floorE8);
  if (stop !== null && pastFloor && (isLong ? priceE8 <= stop : priceE8 >= stop))
    return { fire: "trail", peakE8: peak };
  return { fire: null, peakE8: peak };
}

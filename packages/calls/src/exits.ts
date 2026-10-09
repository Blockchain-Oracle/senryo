/**
 * Exits on a call (S8.4, D-292), both apps. The user sets them in dollars — what the call would cash out for — and the
 * chain keeps a share's bid: take-profit rounded up (it sells for at least that), the stop rounded down (it sells at or
 * under it), the floor rounded up (never less). Bids survive a part cashed out; the words turn them back into dollars
 * for the shares still held. Only bids the pool prices can ever fill (its 3–97 % less the spread).
 */
import { type ExitPrices, formatUnits, hasExit, P_ONE, trailStopE6 } from "@senryo/core";
import { CENT_E6, EXIT_DOLLAR_STEP_CENTS, EXIT_STEP_CENTS, FLOOR_START_BPS } from "./constants.ts";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const BPS = 10_000n;
const SHARE_MAX_E6 = 999_999n;

const dollars = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`;

/** What the user set, in dollars of the call's value (null = off); the trail in cents a share. */
export interface ExitValues {
  takeProfit: bigint | null;
  stopLoss: bigint | null;
  floor: bigint | null;
  trailCents: number | null;
}

/** The api's view of an armed exit (`ticketsRoute`). */
export interface ExitState extends ExitPrices {
  trailStopE6: number | null;
  firedKind: number | null;
}

/** The bids the pool prices a cash-out at: probability bounds less the half-spread (BandBook `_fillClose`). */
export interface BidBounds {
  minBidE6: number;
  maxBidE6: number;
}

export function bidBoundsOf(terms: { halfSpreadE6: number; minProbE6: number; maxProbE6: number }): BidBounds {
  return { minBidE6: terms.minProbE6 - terms.halfSpreadE6, maxBidE6: terms.maxProbE6 - terms.halfSpreadE6 };
}

/** A cash-out value for `shares` as a share's bid; `up` makes the sale worth at least the value. */
export function bidForValue(value: bigint, shares: bigint, round: "up" | "down"): number {
  if (shares <= 0n || value <= 0n) return 0;
  const e6 = round === "up" ? (value * P_ONE + shares - 1n) / shares : (value * P_ONE) / shares;
  return Number(e6 > SHARE_MAX_E6 ? SHARE_MAX_E6 : e6);
}

/** What `shares` cash out for at a bid (BandMath `proceedsFor`). */
export const valueAtBid = (bidE6: number, shares: bigint): bigint => (shares * BigInt(bidE6)) / P_ONE;

export function exitPricesOf(v: ExitValues, shares: bigint): ExitPrices {
  return {
    takeProfitE6: v.takeProfit ? bidForValue(v.takeProfit, shares, "up") : 0,
    stopLossE6: v.stopLoss ? bidForValue(v.stopLoss, shares, "down") : 0,
    floorE6: v.floor ? bidForValue(v.floor, shares, "up") : 0,
    trailE6: v.trailCents ? v.trailCents * CENT_E6 : 0,
  };
}

/** The values an armed exit stands for with `shares` held (the sheet opens on them). */
export function exitValuesOf(e: ExitState | null, shares: bigint): ExitValues {
  return {
    takeProfit: e?.takeProfitE6 ? valueAtBid(e.takeProfitE6, shares) : null,
    stopLoss: e?.stopLossE6 ? valueAtBid(e.stopLossE6, shares) : null,
    floor: e?.floorE6 ? valueAtBid(e.floorE6, shares) : null,
    trailCents: e?.trailE6 ? Math.round(e.trailE6 / CENT_E6) : null,
  };
}

/** Why an exit can't be set as drafted, in words (the chain's own checks plus the live value), or null. */
export function exitProblem(e: ExitPrices, shares: bigint, nowBidE6: number | null, b: BidBounds): string | null {
  if (!hasExit(e)) return null;
  if (e.takeProfitE6 > b.maxBidE6) return `Take profit can be at most ${dollars(valueAtBid(b.maxBidE6, shares))}`;
  if (e.takeProfitE6 > 0 && nowBidE6 !== null && e.takeProfitE6 <= nowBidE6) {
    return "Take profit is at or below what it's worth now";
  }
  if (e.stopLossE6 > 0 && e.stopLossE6 < b.minBidE6) {
    return `The stop can be no lower than ${dollars(valueAtBid(b.minBidE6, shares))}`;
  }
  if (e.stopLossE6 > 0 && nowBidE6 !== null && e.stopLossE6 >= nowBidE6) {
    return "The stop is at or above what it's worth now";
  }
  if (e.takeProfitE6 > 0 && e.takeProfitE6 <= e.stopLossE6) return "Take profit must be above the stop";
  if (e.stopLossE6 > 0 && e.floorE6 > e.stopLossE6) return "Never below must be under the stop";
  if (e.floorE6 > 0 && nowBidE6 !== null && e.floorE6 >= nowBidE6) return "Never below is above what it's worth now";
  return null;
}

/** The terminal's line for an armed exit: "Take profit $15.00 · Stop $8.00 · Trail 10¢ (stop $9.40)". */
export function exitLine(e: ExitState | null, shares: bigint): string | null {
  if (!e || !hasExit(e)) return null;
  const parts: string[] = [];
  if (e.takeProfitE6 > 0) parts.push(`Take profit ${dollars(valueAtBid(e.takeProfitE6, shares))}`);
  if (e.stopLossE6 > 0) parts.push(`Stop ${dollars(valueAtBid(e.stopLossE6, shares))}`);
  if (e.trailE6 > 0) {
    const stop = e.trailStopE6 ?? trailStopE6(e, 0);
    const cents = `${Math.round(e.trailE6 / CENT_E6)}¢`;
    parts.push(stop ? `Trail ${cents} (stop ${dollars(valueAtBid(stop, shares))})` : `Trail ${cents}`);
  }
  if (e.floorE6 > 0) parts.push(`never below ${dollars(valueAtBid(e.floorE6, shares))}`);
  return parts.join(" · ");
}

/** A take-profit or stop offered as a multiple of today's value, inside the bids the pool prices. */
export function exitStep(now: bigint, stepBps: bigint, shares: bigint, b: BidBounds): bigint | null {
  const value = (now * stepBps) / BPS;
  const bid = bidForValue(value, shares, stepBps > BPS ? "up" : "down");
  return bid > 0 && bid >= b.minBidE6 && bid <= b.maxBidE6 ? value : null;
}

export const exitStepCents = (maxCents: number): number =>
  EXIT_STEP_CENTS.find(([under]) => maxCents < under)?.[1] ?? EXIT_DOLLAR_STEP_CENTS;

/** Where "never below" starts when turned on. */
export const floorStart = (now: bigint): bigint => (now * FLOOR_START_BPS) / BPS;

/** The receipt's words for the exit that sold the last shares (indexer `closedBy`). */
export const CLOSED_BY_WORD = { "take-profit": "Take profit", "stop-loss": "Stop loss", trail: "Trail" } as const;
export type ClosedBy = keyof typeof CLOSED_BY_WORD;

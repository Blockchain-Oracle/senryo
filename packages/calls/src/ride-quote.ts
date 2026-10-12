/**
 * A ride before and after the tap (D-299, D-301, R5.4–R5.6), one copy for both apps: what an open of `margin` at
 * `leverage` costs at the live price, where it would be knocked out and capped (fixed at the fill, `LinearMath`), how
 * far each is in words, where it breaks even after both fees, and — held — whether TRAIL can arm yet.
 */
import {
  type PriceUnit,
  priceText,
  RIDE_SCALE,
  rideCapPrice,
  rideFee,
  rideKoPrice,
  rideNotional,
  rideNotionalAt,
  rideReserve,
  rideSize,
} from "@senryo/core";

const BPS_BIG = 10_000n;
const PERCENT_PER_BPS = 100;
const ONE_DECIMAL = 1;
const TWO_DECIMALS = 2;
const LEVERAGE_ONE = 10_000;

export interface RideTermsLike {
  takerFeeBps: number;
  maxProfitBps: number;
  maxMoveBps: number;
}

export interface RideQuote {
  /** Margin × leverage. */
  notional: bigint;
  /** The open fee (taker rate) and what leaves the wallet (margin + fee). */
  fee: bigint;
  cost: bigint;
  /** The pool's reserve: the most the ride can win. */
  reserve: bigint;
  koE8: bigint;
  capE8: bigint;
  /** Signed moves from the price to each bound, in bps (a long's knock-out is negative). */
  koMoveBps: number;
  capMoveBps: number;
  /** Where it breaks even after the open and close fees. */
  breakEvenE8: bigint;
}

const moveBps = (from: bigint, to: bigint): number => Number(((to - from) * BPS_BIG) / from);

/** An open of `margin` at `leverageBps`, priced at `markE8` (the fill prints a second later). */
export function rideQuote(
  isLong: boolean,
  margin: bigint,
  leverageBps: number,
  markE8: bigint,
  t: RideTermsLike,
): RideQuote {
  const lev = BigInt(leverageBps);
  const notional = rideNotional(margin, lev);
  const fee = rideFee(notional, BigInt(t.takerFeeBps));
  const size = rideSize(notional, markE8);
  const reserve = rideReserve(margin, lev, BigInt(t.maxProfitBps), BigInt(t.maxMoveBps));
  const koE8 = rideKoPrice(isLong, markE8, size, margin);
  const capE8 = rideCapPrice(isLong, markE8, size, reserve);
  const closeFee = rideFee(rideNotionalAt(size, markE8), BigInt(t.takerFeeBps));
  const beMove = size === 0n ? 0n : ((fee + closeFee) * RIDE_SCALE) / size;
  return {
    notional,
    fee,
    cost: margin + fee,
    reserve,
    koE8,
    capE8,
    koMoveBps: moveBps(markE8, koE8),
    capMoveBps: moveBps(markE8, capE8),
    breakEvenE8: isLong ? markE8 + beMove : markE8 - beMove,
  };
}

const pctText = (bps: number, decimals = ONE_DECIMAL): string =>
  `${bps < 0 ? "−" : "+"}${Math.abs(bps / PERCENT_PER_BPS).toFixed(decimals)}%`;

/** "Knocked out at $80,431 (−2.2%)". */
export const knockOutWords = (q: RideQuote, unit: PriceUnit = "usd"): string =>
  `Knocked out at ${priceText(q.koE8, unit)} (${pctText(q.koMoveBps)})`;

/** "Capped at $92,000 (+22.5%)": the most it can win. */
export const capWords = (q: RideQuote, unit: PriceUnit = "usd"): string =>
  `Capped at ${priceText(q.capE8, unit)} (${pctText(q.capMoveBps)})`;

/** "$92,000 (+22.5%)": where a side caps, and how far that is. */
export const capText = (q: RideQuote, unit: PriceUnit = "usd"): string =>
  `${priceText(q.capE8, unit)} (${pctText(q.capMoveBps)})`;

/** "10×". */
export const leverageOf = (leverageBps: number): number => Math.round(leverageBps / LEVERAGE_ONE);

/**
 * Whether a held ride's TRAIL can arm (Tradash: once the move past break-even beats the trail distance), and, until it
 * can, how much more it needs ("Need +0.08% to trail").
 */
export function rideTrailReady(
  isLong: boolean,
  markE8: bigint,
  breakEvenE8: bigint,
  trailBps: number,
): { ready: boolean; needText: string } {
  const past = isLong ? moveBps(breakEvenE8, markE8) : -moveBps(breakEvenE8, markE8);
  const need = Math.max(0, trailBps - past);
  return { ready: need === 0, needText: `Need ${pctText(need, TWO_DECIMALS)} to trail` };
}

/** "0.10%" for a trail distance in bps. */
export const trailText = (bps: number): string => `${(bps / PERCENT_PER_BPS).toFixed(TWO_DECIMALS)}%`;

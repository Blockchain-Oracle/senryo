/**
 * The live book's rides (R5.1–R5.2, D-303): a ride's PnL is (mark − entry) × size; CLOSE returns its equity less the
 * close fee (the taker rate, so at least that) and, in its first seconds, the early-close fee; it breaks even where
 * both fees are paid back. Split from `book.ts`, which holds the entry shape, calls and totals.
 */
import { FILL_DELAY_SEC, type RideNetworkTerms } from "@senryo/config";
import { RIDE_SCALE, rideEarlyFee, rideEquity, rideFee, rideNotionalAt, ridePnl } from "@senryo/core";
import { type BookEntry, type BookRideExit, type BookState, rideKey } from "./book.ts";

const BPS = 10_000n;
const roi = (pnl: bigint | null, cost: bigint): number | null =>
  pnl === null || cost === 0n ? null : Number((pnl * BPS) / cost);

/** A ride as the book needs it (`/v1/rides` row). */
export interface BookRide {
  rideId: bigint;
  symbol: string;
  isLong: boolean;
  state: string;
  margin: bigint;
  leverageBps: number;
  openFee: bigint;
  size: bigint;
  reserve: bigint;
  entryE8: bigint | null;
  koE8: bigint | null;
  capE8: bigint | null;
  filledAt: number | null;
  endAt: number | null;
  exit: BookRideExit | null;
}

/** What a close of the whole ride returns at `markE8`: equity less the taker fee and the early fee (contracts
 *  `_exitPart`; a close that reduces the pool's skew pays the maker rate, so it gets at least this). */
export function rideCloseValue(
  r: BookRide,
  markE8: bigint,
  takerFeeBps: number,
  terms: Pick<RideNetworkTerms, "earlyFeeBps" | "earlyWindowSec">,
  nowSec: number,
): { pnl: bigint; value: bigint; closeFee: bigint } {
  const entry = r.entryE8 ?? markE8;
  const pnl = ridePnl(r.isLong, r.size, entry, markE8);
  const equity = rideEquity(r.margin, r.reserve, pnl);
  const exitNotional = rideNotionalAt(r.size, markE8);
  const age = BigInt(Math.max(0, nowSec + FILL_DELAY_SEC - (r.filledAt ?? nowSec)));
  const early = rideEarlyFee(exitNotional, pnl, age, BigInt(terms.earlyFeeBps), BigInt(terms.earlyWindowSec));
  const fee = rideFee(exitNotional, BigInt(takerFeeBps)) + early;
  const charged = fee > equity ? equity : fee;
  return { pnl, value: equity - charged, closeFee: charged };
}

/** A ride's value at `markE8` (the live price), or unvalued without one. */
export function valueRide(
  r: BookRide,
  markE8: bigint | undefined,
  takerFeeBps: number | undefined,
  terms: Pick<RideNetworkTerms, "earlyFeeBps" | "earlyWindowSec">,
  nowSec: number,
): BookEntry {
  const base: BookEntry = {
    key: rideKey(r.rideId),
    kind: "ride",
    id: r.rideId,
    symbol: r.symbol,
    label: r.isLong ? "Up" : "Down",
    up: r.isLong,
    state: "no-price",
    cost: r.margin,
    pnl: null,
    roiBps: null,
    closeValue: null,
    worth: r.margin,
    fees: null,
    endsAt: r.endAt,
    markE8: markE8 ?? null,
    entryE8: r.entryE8,
    ride: {
      leverageBps: r.leverageBps,
      koE8: r.koE8,
      capE8: r.capE8,
      size: r.size,
      breakEvenE8: takerFeeBps === undefined ? null : rideBreakEvenE8(r, takerFeeBps),
      exit: r.exit,
    },
  };
  if (r.state === "committed") return { ...base, state: "opening" };
  if (markE8 === undefined || takerFeeBps === undefined || r.entryE8 === null) return base;
  const v = rideCloseValue(r, markE8, takerFeeBps, terms, nowSec);
  const state: BookState =
    r.state === "closing" ? "closing" : r.endAt !== null && nowSec >= r.endAt ? "settling" : "live";
  return {
    ...base,
    state,
    pnl: v.pnl,
    roiBps: roi(v.pnl, r.margin),
    closeValue: state === "live" ? v.value : null,
    worth: v.value,
    fees: r.openFee + v.closeFee,
  };
}

/** Where a ride breaks even after both fees (closed form): the entry moved by fees ÷ size, the rider's way. */
export function rideBreakEvenE8(r: BookRide, takerFeeBps: number): bigint | null {
  if (r.entryE8 === null || r.size === 0n) return null;
  const closeFee = rideFee(rideNotionalAt(r.size, r.entryE8), BigInt(takerFeeBps));
  const move = ((r.openFee + closeFee) * RIDE_SCALE) / r.size;
  return r.isLong ? r.entryE8 + move : r.entryE8 - move;
}

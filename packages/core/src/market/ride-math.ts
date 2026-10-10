// The client mirror of `contracts/src/markets/LinearMath.sol` (rides, D-299/D-301), bit for bit: BigInt for every
// step, `mulDiv` floored and `mulDivUp` ceiled as OpenZeppelin's `Math.mulDiv` rounds. Every rounding goes against the
// rider. Pinned to Foundry's vectors (`packages/core/vectors/ride-math.json`, `scripts/drive/src/mirror-vectors.ts`).
import { BPS } from "./band-math.ts";

/** size × Δprice(× 1e8) / RIDE_SCALE = PnL in collateral units (contracts `RIDE_SCALE`). */
export const RIDE_SCALE = 100_000_000_000_000_000_000n;
/** Knocked out at 90 % of the margin lost; the prover takes 2 % of it, at most $5 (contracts RideTypes). */
export const KO_LOSS_BPS = 9_000n;
export const KO_KEEPER_BPS = 200n;
export const KO_KEEPER_CAP = 5_000_000n;
const INT64_MAX = 9_223_372_036_854_775_807n;

const mulDiv = (a: bigint, b: bigint, d: bigint): bigint => (a * b) / d;
const mulDivUp = (a: bigint, b: bigint, d: bigint): bigint => {
  const n = a * b;
  return n / d + (n % d === 0n ? 0n : 1n);
};
const min = (a: bigint, b: bigint): bigint => (a < b ? a : b);

/** The ride's exposure: margin × leverage, floored. */
export const rideNotional = (margin: bigint, leverageBps: bigint): bigint => (margin * leverageBps) / BPS;

/** Size bought with `notional` at `entryE8`, floored. */
export const rideSize = (notional: bigint, entryE8: bigint): bigint => mulDiv(notional, RIDE_SCALE, entryE8);

/** The most the ride can win (the pool's reserve): margin × min(maxProfit, leverage × maxMove), floored. */
export function rideReserve(margin: bigint, leverageBps: bigint, maxProfitBps: bigint, maxMoveBps: bigint): bigint {
  const moveBps = (leverageBps * maxMoveBps) / BPS;
  return (margin * min(maxProfitBps, moveBps)) / BPS;
}

/** PnL of `size` from `entryE8` to `exitE8`: gains floor, losses ceil. */
export function ridePnl(isLong: boolean, size: bigint, entryE8: bigint, exitE8: bigint): bigint {
  const gain = isLong ? exitE8 > entryE8 : exitE8 < entryE8;
  const diff = exitE8 > entryE8 ? exitE8 - entryE8 : entryE8 - exitE8;
  return gain ? mulDiv(size, diff, RIDE_SCALE) : -mulDivUp(size, diff, RIDE_SCALE);
}

/** What the ride is worth to its rider at a PnL: margin + PnL, never below 0 nor above margin + reserve. */
export function rideEquity(margin: bigint, reserve: bigint, pnl: bigint): bigint {
  if (pnl < 0n) return -pnl >= margin ? 0n : margin + pnl;
  return min(margin + pnl, margin + reserve);
}

function priceAt(dir: bigint, entryE8: bigint, dist: bigint): bigint {
  const p = entryE8 + dir * dist;
  if (p < 1n) return 1n;
  return p > INT64_MAX ? INT64_MAX : p;
}

/** The knock-out price (90 % of the margin lost); the distance floors, nearer the entry. */
export function rideKoPrice(isLong: boolean, entryE8: bigint, size: bigint, margin: bigint): bigint {
  const dist = mulDiv(margin * KO_LOSS_BPS, RIDE_SCALE, size * BPS);
  return priceAt(isLong ? -1n : 1n, entryE8, dist);
}

/** The cap-out price (the PnL reaches the reserve); the distance ceils, further out. */
export function rideCapPrice(isLong: boolean, entryE8: bigint, size: bigint, reserve: bigint): bigint {
  const dist = mulDivUp(reserve, RIDE_SCALE, size);
  return priceAt(isLong ? 1n : -1n, entryE8, dist);
}

export const ridePastKo = (isLong: boolean, priceE8: bigint, koE8: bigint): boolean =>
  isLong ? priceE8 <= koE8 : priceE8 >= koE8;

export const ridePastCap = (isLong: boolean, priceE8: bigint, capE8: bigint): boolean =>
  isLong ? priceE8 >= capE8 : priceE8 <= capE8;

/** Notional of `size` at `priceE8`, ceiled (fees are charged on it). */
export const rideNotionalAt = (size: bigint, priceE8: bigint): bigint => mulDivUp(size, priceE8, RIDE_SCALE);

/** A charge of `bps` on `amount`, ceiled. */
export const rideFee = (amount: bigint, bps: bigint): bigint => mulDivUp(amount, bps, BPS);

/** The early-close fee: `feeBps` of the exit notional falling to 0 over `window` s, never more than the profit. */
export function rideEarlyFee(exitNotional: bigint, pnl: bigint, age: bigint, feeBps: bigint, window: bigint): bigint {
  if (pnl <= 0n || age >= window) return 0n;
  return min(mulDivUp(exitNotional, feeBps * (window - age), window * BPS), pnl);
}

/** What the prover of a knock-out takes from the forfeited margin. */
export const rideKeeperFee = (margin: bigint): bigint => min((margin * KO_KEEPER_BPS) / BPS, KO_KEEPER_CAP);

/** A part of a stored amount leaving with `part` of `whole` size, ceiled. */
export const rideShare = (amount: bigint, part: bigint, whole: bigint): bigint => mulDivUp(amount, part, whole);

/** What a market side owes its riders at `priceE8` from its sums (riders' gains ceil), as `markRides` sums it. */
export function rideSidePnl(isLong: boolean, size: bigint, cost: bigint, priceE8: bigint): bigint {
  const value = size * priceE8;
  const riderGain = isLong ? value > cost : value < cost;
  const diff = value > cost ? value - cost : cost - value;
  return riderGain ? mulDivUp(diff, 1n, RIDE_SCALE) : -(diff / RIDE_SCALE);
}

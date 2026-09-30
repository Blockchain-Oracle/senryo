/**
 * Bigint port of `contracts/src/libraries/PerpMath.sol` and the price helpers of `RiskModule.sol` — same formulas,
 * same rounding (always against the account). Preview only: the contract is authoritative (risk-math.md).
 */
import { type MarketStatus, RISK } from "./constants.ts";

const { BPS, NOTIONAL_SCALE, WAD } = RISK;

/** ⌊a × b / d⌋ or ⌈a × b / d⌉ for non-negative operands (OZ `Math.mulDiv` with `Rounding`). */
export function mulDiv(a: bigint, b: bigint, d: bigint, up = false): bigint {
  if (d === 0n) throw new RangeError("mulDiv: division by zero");
  const product = a * b;
  const q = product / d;
  return up && q * d !== product ? q + 1n : q;
}

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;
const abs = (x: bigint) => (x < 0n ? -x : x);
export const minBig = (a: bigint, b: bigint) => (a < b ? a : b);
export const maxBig = (a: bigint, b: bigint) => (a > b ? a : b);

/** N = ⌈size × price / 1e30⌉ (usd6). */
export const notional = (size: bigint, price18: bigint) => mulDiv(size, price18, NOTIONAL_SCALE, true);

/** Units bought for `notionalUsd6` at `price18`, rounded down. */
export const sizeFor = (notionalUsd6: bigint, price18: bigint) => mulDiv(notionalUsd6, NOTIONAL_SCALE, price18);

/** σ × size × (exit − entry) / 1e30, rounded toward −∞. */
export function pnl(isLong: boolean, size: bigint, entry18: bigint, exit18: bigint): bigint {
  const gain = isLong ? exit18 > entry18 : exit18 < entry18;
  const diff = abs(exit18 - entry18);
  return gain ? mulDiv(size, diff, NOTIONAL_SCALE) : -mulDiv(size, diff, NOTIONAL_SCALE, true);
}

/** Price moved against the account by `spreadBps`: `up` = ask (buys), else bid (sells). */
export function applySpread(price18: bigint, spreadBps: bigint, up: boolean): bigint {
  if (up) return mulDiv(price18, BPS + spreadBps, BPS, true);
  if (spreadBps >= BPS) return 0n;
  return mulDiv(price18, BPS - spreadBps, BPS);
}

/** Size-weighted average entry; longs round up, shorts down. */
export function averageEntry(size0: bigint, entry0: bigint, sizeDelta: bigint, price18: bigint, isLong: boolean) {
  const total = size0 + sizeDelta;
  const weighted = size0 * entry0 + sizeDelta * price18;
  return isLong ? ceilDiv(weighted, total) : weighted / total;
}

export const bpsUp = (x: bigint, bps: bigint) => mulDiv(x, bps, BPS, true);
export const bpsDown = (x: bigint, bps: bigint) => mulDiv(x, bps, BPS);

/** Impact only when |skew| grows: IMPACT_K × Δ|skew| / depth, rounded up; no depth → unbounded. */
export function impactBps(skewBefore: bigint, skewAfter: bigint, poolUsd6: bigint): bigint | undefined {
  const before = abs(skewBefore);
  const after = abs(skewAfter);
  if (after <= before) return 0n;
  const depth = bpsDown(poolUsd6, RISK.DEPTH_POOL_BPS);
  if (depth === 0n) return undefined;
  return mulDiv(after - before, RISK.IMPACT_K_BPS, depth, true);
}

/** The oracle part of a quote (`SessionOracle.peek`). */
export interface PriceView {
  price18: bigint;
  latest18: bigint;
  status: MarketStatus;
  /** Age spread when OPEN/STALE, the closed-session spread when CLOSED. */
  spreadBps: bigint;
}

/** Spread floors of a market (`MarketParams`). */
export interface SpreadParams {
  baseSpreadBps: bigint;
  devSpreadBps: bigint;
}

/** Conservative exit (bid for longs, ask for shorts) per the status matrix — `RiskModule._exitPrice`. */
export function exitPrice(market: SpreadParams, pv: PriceView, isLong: boolean): bigint {
  const base = maxBig(market.baseSpreadBps, market.devSpreadBps);
  let price = pv.price18;
  let spread: bigint;
  if (pv.status === "OPEN" || pv.status === "STALE") spread = base + pv.spreadBps;
  else if (pv.status === "CLOSED") spread = pv.spreadBps;
  else {
    spread = base;
    if (pv.latest18 !== 0n) price = isLong ? minBig(price, pv.latest18) : maxBig(price, pv.latest18);
  }
  return applySpread(price, spread, !isLong);
}

/** Entry for a new/increased position (OPEN only): P ± (max(base, dev) + oracle spread + impact). */
export function entryPrice(market: SpreadParams, pv: PriceView, impact: bigint, isLong: boolean): bigint {
  return applySpread(pv.price18, maxBig(market.baseSpreadBps, market.devSpreadBps) + pv.spreadBps + impact, isLong);
}

/** Borrow owed = ⌈N_entry × Δ index / 1e18⌉; funding owed = σ × N_entry × Δ index / 1e18 (+ = the account pays). */
export function borrowOwed(entryNotional: bigint, index: bigint, snap: bigint): bigint {
  return index <= snap ? 0n : mulDiv(entryNotional, index - snap, WAD, true);
}

export function fundingOwed(isLong: boolean, entryNotional: bigint, index: bigint, snap: bigint): bigint {
  const delta = isLong ? index - snap : snap - index;
  return delta >= 0n ? mulDiv(entryNotional, delta, WAD, true) : -mulDiv(entryNotional, -delta, WAD);
}

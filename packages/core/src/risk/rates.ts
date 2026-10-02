/**
 * Funding and borrow rates as the engine accrues them (`PerpMath.sol` fundingRate / borrowRate; `MarketAccounting.sol`
 * `_accrue`), so a ticket can say what a position pays or receives **before** it opens (flow book C3 step 5, C3a).
 * Rates are WAD per second. Funding > 0 means longs pay and shorts receive; borrow is paid by both sides, always.
 * Funding accrues only while the market is OPEN; borrow accrues in every status.
 */

import { RISK } from "./constants.ts";
import { mulDiv } from "./math.ts";

const SECONDS_PER_YEAR = 31_536_000n;
/** Millionths: a rate per hour in ppm reads to four decimals of a percent. */
const PPM = 1_000_000n;

/** clamp(factor × (L − S) / max(L + S, MIN_OI), ±MAX_FUNDING_RATE); positive when longs dominate (they pay). */
export function fundingRatePerSec(longUsd6: bigint, shortUsd6: bigint, factor: bigint): bigint {
  const total = longUsd6 + shortUsd6 > RISK.MIN_OI_USD6 ? longUsd6 + shortUsd6 : RISK.MIN_OI_USD6;
  const skew = longUsd6 > shortUsd6 ? longUsd6 - shortUsd6 : shortUsd6 - longUsd6;
  const raw = mulDiv(factor, skew, total);
  const rate = raw < RISK.MAX_FUNDING_RATE ? raw : RISK.MAX_FUNDING_RATE;
  return longUsd6 >= shortUsd6 ? rate : -rate;
}

/** base + slope × utilisation, utilisation = open notional ÷ pool (capped at 1; an empty pool counts as full). */
export function borrowRatePerSec(openUsd6: bigint, poolUsd6: bigint, base: bigint, slope: bigint): bigint {
  const util = poolUsd6 === 0n ? RISK.WAD : mulDiv(openUsd6, RISK.WAD, poolUsd6);
  return base + mulDiv(slope, util < RISK.WAD ? util : RISK.WAD, RISK.WAD);
}

/** What one side pays (+) or receives (−) per hour, in ppm of its entry notional. */
export function fundingPpmPerHour(ratePerSec: bigint, isLong: boolean): bigint {
  const paid = isLong ? ratePerSec : -ratePerSec;
  return (paid * RISK.SECONDS_PER_HOUR * PPM) / RISK.WAD;
}

/** A per-second WAD rate as bps per year (the borrow APR). */
export function aprBps(ratePerSec: bigint): bigint {
  return (ratePerSec * SECONDS_PER_YEAR * RISK.BPS) / RISK.WAD;
}

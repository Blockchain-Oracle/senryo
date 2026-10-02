/**
 * Funding and borrow in words (flow book C3 step 5, C3a; plan §0.9 Ticket Details): the market's current rates from
 * the engine's own accrual inputs (`@senryo/core` rates mirror), said from one side's point of view — "You pay
 * 0.0040%/h" or "You receive …" — and the borrow APR both sides pay. Funding only accrues while the market is open.
 */
import { aprBps, borrowRatePerSec, DECIMALS, formatUnits, fundingPpmPerHour, fundingRatePerSec } from "@senryo/core";
import type { LiveMarket } from "@senryo/query";

/** A ppm figure is a percent with four decimals (1 ppm = 0.0001 %). */
const PPM_AS_PCT_DECIMALS = 4;
/** "5.1% APR": one decimal of a percent. */
const APR_SHOWN = 1;

export interface MarketRates {
  /** WAD per second; > 0 means longs pay. */
  fundingPerSec: bigint;
  borrowPerSec: bigint;
}

export function marketRates(market: LiveMarket): MarketRates {
  const { rates, book } = market;
  return {
    fundingPerSec: fundingRatePerSec(rates.longNotionalUsd6, rates.shortNotionalUsd6, rates.fundingFactor),
    borrowPerSec: borrowRatePerSec(
      rates.longNotionalUsd6 + rates.shortNotionalUsd6,
      book.poolUsd6,
      rates.borrowBase,
      rates.borrowSlope,
    ),
  };
}

const ppmText = (ppm: bigint) => `${formatUnits(ppm < 0n ? -ppm : ppm, PPM_AS_PCT_DECIMALS, PPM_AS_PCT_DECIMALS)}%/h`;

/** "You pay 0.0040%/h" · "You receive 0.0040%/h" · "None now" — for the side being entered or held. */
export function fundingForSide(rates: MarketRates, isLong: boolean): string {
  const ppm = fundingPpmPerHour(rates.fundingPerSec, isLong);
  if (ppm === 0n) return "None now";
  return ppm > 0n ? `You pay ${ppmText(ppm)}` : `You receive ${ppmText(ppm)}`;
}

/** "Longs pay 0.0040%/h" · "Shorts pay …" · "Balanced" — the market's view (About). */
export function fundingForMarket(rates: MarketRates): string {
  const ppm = fundingPpmPerHour(rates.fundingPerSec, true);
  if (ppm === 0n) return "Balanced";
  return `${ppm > 0n ? "Longs" : "Shorts"} pay ${ppmText(ppm)}`;
}

/** "5.1% APR". */
export function borrowApr(rates: MarketRates): string {
  return `${formatUnits(aprBps(rates.borrowPerSec), DECIMALS.bpsAsPct, APR_SHOWN)}% APR`;
}

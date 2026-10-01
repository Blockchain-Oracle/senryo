/**
 * Token numbers span from WBTC's tens of thousands of dollars to fractions of a cent, so they are written to a fixed
 * number of significant figures (with cents at least) instead of a fixed number of decimals: $60,312.50, $1.0003,
 * $0.03189. Amounts follow the same rule in the token's own units.
 */
import { DECIMALS, formatUnits } from "@senryo/core";

/** Significant figures a price or amount keeps. */
const SIGNIFICANT = 4;
/** Never more decimals than this, however small the number (beyond it the row would only show noise). */
const MAX_DECIMALS = 10;
const PRICE_DECIMALS = 18;
const TEN = 10;

/**
 * Decimals that give `SIGNIFICANT` figures for `raw` units of `unitDecimals` (whole values keep cents). Integer digits
 * only — the money rule: no floats on money, even for display.
 */
function decimalsFor(raw: bigint, unitDecimals: number): number {
  const abs = raw < 0n ? -raw : raw;
  if (abs === 0n || abs >= BigInt(TEN) ** BigInt(unitDecimals)) return DECIMALS.cents;
  const leadingZeros = unitDecimals - abs.toString().length;
  return Math.min(MAX_DECIMALS, unitDecimals, leadingZeros + SIGNIFICANT);
}

/** "$60,312.50", "$0.03189" from USD × 1e18. */
export function tokenPrice(priceUsd18: bigint): string {
  return `$${formatUnits(priceUsd18, PRICE_DECIMALS, decimalsFor(priceUsd18, PRICE_DECIMALS))}`;
}

/** The decimals `tokenPrice` uses, for a chart axis beside it. */
export function tokenPriceDecimals(priceUsd18: bigint): number {
  return decimalsFor(priceUsd18, PRICE_DECIMALS);
}

/** "0.0012 WBTC", "1,250.00 MON" from raw units. */
export function tokenAmount(raw: bigint, decimals: number, symbol?: string): string {
  const text = formatUnits(raw, decimals, Math.min(decimals, decimalsFor(raw, decimals)));
  return symbol ? `${text} ${symbol}` : text;
}

/** "$18.9M", "$412K", "$3.2B" — a market's size at a glance (F10's MC line). */
export function compactUsd(value: number): string {
  const units = [
    { at: 1e9, suffix: "B" },
    { at: 1e6, suffix: "M" },
    { at: 1e3, suffix: "K" },
  ] as const;
  for (const u of units) {
    if (value >= u.at) return `$${(value / u.at).toFixed(1)}${u.suffix}`;
  }
  return `$${value.toFixed(0)}`;
}

const COMPACT_STEPS = [
  { digits: 9, suffix: "B" },
  { digits: 6, suffix: "M" },
  { digits: 3, suffix: "K" },
] as const;

/** `compactUsd` from usd6, in integer digits (a venue's open interest or volume is money). */
export function compactUsd6(value6: bigint): string {
  for (const step of COMPACT_STEPS) {
    const unitDecimals = DECIMALS.usd6 + step.digits;
    if (value6 >= BigInt(TEN) ** BigInt(unitDecimals)) return `$${formatUnits(value6, unitDecimals, 1)}${step.suffix}`;
  }
  return `$${formatUnits(value6, DECIMALS.usd6, 0)}`;
}

const BPS_PER_PERCENT = 100;
const FINE_DECIMALS = 2;

/** "0.05%", "1.20%", "<0.01%" — a fee or impact small enough that whole percents would read as nothing. */
export function finePct(bps: bigint): string {
  if (bps === 0n) return "<0.01%";
  return `${(Number(bps) / BPS_PER_PERCENT).toFixed(FINE_DECIMALS)}%`;
}

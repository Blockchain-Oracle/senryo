import { formatUnits, toPlot } from "@senryo/core";
import { BPS_PERCENT_DECIMALS, USD6_DECIMALS } from "@/lib/constants/money";

export { formatUnits } from "@senryo/core";

const TEN = 10n;

/** `$12,480.52` from usd6. */
export function usd(value: bigint, shown = 2): string {
  const s = formatUnits(value, USD6_DECIMALS, shown);
  return s.startsWith("-") ? `-$${s.slice(1)}` : `$${s}`;
}

/** Signed amount without the currency sign: `+102.40` / `-6.40`. */
export function signed(value: bigint, shown = 2): string {
  const s = formatUnits(value, USD6_DECIMALS, shown);
  return value > 0n ? `+${s}` : s;
}

/** Plain number from usd6 without a sign: `2,687.40`. */
export function amount(value: bigint, shown = 2): string {
  return formatUnits(value, USD6_DECIMALS, shown);
}

/** Basis points as a signed percent: 82n → `+0.82%`. */
export function pctBps(bps: bigint, withSign = true): string {
  const s = formatUnits(bps, BPS_PERCENT_DECIMALS, BPS_PERCENT_DECIMALS, { grouping: false });
  return `${withSign && bps > 0n ? "+" : ""}${s}%`;
}

/**
 * Display projection for chart components only (they plot floats). Never used for money arithmetic —
 * values stay bigint everywhere else.
 */
export function plotValue(value: bigint, decimals: number = USD6_DECIMALS): number {
  return toPlot(value, decimals);
}

const COMPACT_STEPS = [
  { unit: 1_000_000_000n, suffix: "B" },
  { unit: 1_000_000n, suffix: "M" },
  { unit: 1_000n, suffix: "K" },
] as const;

/** Compact usd6: `$18.4M`, `$950K`, `$12.40`. One decimal, bigint only. */
export function usdCompact(value: bigint): string {
  const whole = value / TEN ** BigInt(USD6_DECIMALS);
  const step = COMPACT_STEPS.find((s) => whole >= s.unit);
  if (!step) return usd(value);
  return `$${formatUnits((value * TEN) / (step.unit * TEN ** BigInt(USD6_DECIMALS)), 1, 1)}${step.suffix}`;
}

const SECONDS_PER_MINUTE = 60;

/** Compact age: `42s`, `3m`. */
export function age(seconds: number): string {
  return seconds < SECONDS_PER_MINUTE ? `${seconds}s` : `${Math.floor(seconds / SECONDS_PER_MINUTE)}m`;
}

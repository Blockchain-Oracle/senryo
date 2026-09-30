import { BPS_PERCENT_DECIMALS, THOUSANDS_GROUP, USD6_DECIMALS } from "@/lib/constants/money";

const TEN = 10n;
const HALF_DIVISOR = 2n;

function group(digits: string): string {
  const out: string[] = [];
  for (let end = digits.length; end > 0; end -= THOUSANDS_GROUP) {
    out.unshift(digits.slice(Math.max(0, end - THOUSANDS_GROUP), end));
  }
  return out.join(",");
}

/** Formats an integer base-unit amount (`decimals` places) to `shown` fraction digits, rounding half away from zero. */
export function formatUnits(value: bigint, decimals: number, shown: number, grouping = true): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const drop = BigInt(decimals - shown);
  const divisor = drop > 0n ? TEN ** drop : 1n;
  const rounded = drop > 0n ? (abs + divisor / HALF_DIVISOR) / divisor : abs * TEN ** -drop;
  const scale = TEN ** BigInt(shown);
  const whole = (rounded / scale).toString();
  const frac = shown > 0 ? `.${(rounded % scale).toString().padStart(shown, "0")}` : "";
  return `${negative ? "-" : ""}${grouping ? group(whole) : whole}${frac}`;
}

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
  const s = formatUnits(bps, BPS_PERCENT_DECIMALS, BPS_PERCENT_DECIMALS, false);
  return `${withSign && bps > 0n ? "+" : ""}${s}%`;
}

/**
 * Display projection for chart components only (they plot floats). Never used for money arithmetic —
 * values stay bigint everywhere else.
 */
export function plotValue(value: bigint, decimals = USD6_DECIMALS): number {
  return Number(value) / Number(TEN ** BigInt(decimals));
}

const SECONDS_PER_MINUTE = 60;

/** Compact age: `42s`, `3m`. */
export function age(seconds: number): string {
  return seconds < SECONDS_PER_MINUTE ? `${seconds}s` : `${Math.floor(seconds / SECONDS_PER_MINUTE)}m`;
}

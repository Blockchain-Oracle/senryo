import { oneUnit } from "./units.ts";

/**
 * Display formatting for integer money. Everything is bigint until the final string; apps keep their own wrappers
 * (sign glyphs, currency placement) on top of `formatUnits`.
 */

const THOUSANDS_GROUP = 3;
const GROUP_SEPARATOR = ",";

function group(digits: string): string {
  const out: string[] = [];
  for (let end = digits.length; end > 0; end -= THOUSANDS_GROUP) {
    out.unshift(digits.slice(Math.max(0, end - THOUSANDS_GROUP), end));
  }
  return out.join(GROUP_SEPARATOR);
}

export interface FormatUnitsOptions {
  /** Thousands separators (default on). */
  grouping?: boolean;
}

/**
 * Formats an integer amount with `decimals` base places to exactly `shown` fraction digits, rounding half away from
 * zero. `formatUnits(1_234_567_890n, 6, 2)` → `"1,234.57"`.
 */
export function formatUnits(value: bigint, decimals: number, shown: number, options: FormatUnitsOptions = {}): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  let rounded: bigint;
  if (shown < decimals) {
    const drop = oneUnit(decimals - shown);
    rounded = (abs + drop / 2n) / drop;
  } else {
    rounded = abs * oneUnit(shown - decimals);
  }
  const scale = oneUnit(shown);
  const wholeDigits = (rounded / scale).toString();
  const whole = options.grouping === false ? wholeDigits : group(wholeDigits);
  const frac = shown > 0 ? `.${(rounded % scale).toString().padStart(shown, "0")}` : "";
  return `${negative && rounded !== 0n ? "-" : ""}${whole}${frac}`;
}

/**
 * Chart geometry only: a plotted point needs a JS number. Never used for money arithmetic or display text.
 * Precision loss above 2^53 base units is irrelevant at chart resolution.
 */
export function toPlot(value: bigint, decimals: number): number {
  const scale = oneUnit(decimals);
  return Number(value / scale) + Number(value % scale) / Number(scale);
}

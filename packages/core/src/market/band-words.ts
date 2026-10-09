/**
 * Where a band wins, in prices and in words (S7.4, D-285), for the terminal's buttons, the chart's edges, receipts and
 * share cards alike. Exactly the contracts' rule (`bandOutcome`): Up wins above K and Down below it (a close on K
 * refunds both); Range wins between its edges, edges included; Moonshot wins strictly above its strike, Crash strictly
 * below. Edges are K ± `offsetE8`, so they exist once K does; before that the words use the band's distance in %.
 */
import { type BandShape, offsetE8 } from "./band-math.ts";
import { formatPrice, priceDecimals } from "./price-format.ts";

const E8 = 1e8;
/** Basis points → percent with two decimals (7 bps → "0.07%"). */
const BPS_PER_PERCENT = 100;
const PERCENT_DECIMALS = 2;

/** The winning interval: null ends are open (no bound), `inclusive` says whether the bounds themselves win. */
export interface BandEdges {
  low: bigint | null;
  high: bigint | null;
  inclusive: boolean;
}

export function bandEdgesE8(band: BandShape, k: bigint): BandEdges {
  switch (band.kind) {
    case "up":
      return { low: k, high: null, inclusive: false };
    case "down":
      return { low: null, high: k, inclusive: false };
    case "range":
      return { low: k - offsetE8(k, band.lowBps), high: k + offsetE8(k, band.highBps), inclusive: true };
    case "moonshot":
      return { low: k + offsetE8(k, band.lowBps), high: null, inclusive: false };
    case "crash":
      return { low: null, high: k - offsetE8(k, band.lowBps), inclusive: false };
  }
}

/** "Up", "Down", "Range", "Moonshot", "Crash". */
export function bandName(kind: BandShape["kind"]): string {
  return { up: "Up", down: "Down", range: "Range", moonshot: "Moonshot", crash: "Crash" }[kind];
}

const pct = (bps: number) => `${(bps / BPS_PER_PERCENT).toFixed(PERCENT_DECIMALS)}%`;

/**
 * Where it wins, in words: "above the line", "between $81,700.12 and $81,760.40", "above $81,800.00" — or, before K,
 * "within ±0.03% of the line", "0.07% above the line or more".
 */
export function bandWhere(band: BandShape, k: bigint | undefined): string {
  if (band.kind === "up") return "above the line";
  if (band.kind === "down") return "below the line";
  if (k === undefined) {
    if (band.kind === "range") {
      return band.lowBps === band.highBps
        ? `within ±${pct(band.lowBps)} of the line`
        : `from −${pct(band.lowBps)} to +${pct(band.highBps)} of the line`;
    }
    return `${pct(band.lowBps)} ${band.kind === "moonshot" ? "above" : "below"} the line or more`;
  }
  const decimals = priceDecimals(Number(k) / E8);
  const price = (v: bigint) => formatPrice(Number(v) / E8, decimals);
  const e = bandEdgesE8(band, k);
  if (band.kind === "range" && e.low !== null && e.high !== null) return `between ${price(e.low)} and ${price(e.high)}`;
  if (band.kind === "moonshot" && e.low !== null) return `above ${price(e.low)}`;
  if (e.high !== null) return `below ${price(e.high)}`;
  return "";
}

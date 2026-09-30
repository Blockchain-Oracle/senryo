/**
 * Display formatting for integer money (CLAUDE.md: integer base units only). `usd6` = 1e6 per dollar; oracle prices are
 * `e8` (Chainlink 8 decimals); rates are basis points. Everything is bigint arithmetic until the final string.
 * Moves to `packages/core` with the units module in S3; the shell only needs display.
 */
import { DECIMALS } from "./constants/units";

const TEN = 10n;
const GROUP = /\B(?=(\d{3})+(?!\d))/g;

function pow10(decimals: number): bigint {
  return TEN ** BigInt(decimals);
}

/** Round half away from zero to `shown` decimals, then group thousands. */
export function formatUnits(value: bigint, decimals: number, shown: number): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const drop = pow10(decimals - shown);
  const rounded = shown < decimals ? (abs + drop / 2n) / drop : abs * pow10(shown - decimals);
  const scale = pow10(shown);
  const whole = (rounded / scale).toString().replace(GROUP, ",");
  const frac = shown > 0 ? `.${(rounded % scale).toString().padStart(shown, "0")}` : "";
  return `${negative ? "-" : ""}${whole}${frac}`;
}

/** $12,480.52 */
export function usd(value6: bigint, shown: number = DECIMALS.cents): string {
  const text = formatUnits(value6, DECIMALS.usd, shown);
  return text.startsWith("-") ? `-$${text.slice(1)}` : `$${text}`;
}

/** +$184.22 / −$6.40 — a sign always, so colour is never the only signal. */
export function signedUsd(value6: bigint, shown: number = DECIMALS.cents): string {
  if (value6 < 0n) return `−${usd(-value6, shown)}`;
  return `+${usd(value6, shown)}`;
}

/** 2,687.40 from an e8 oracle price. */
export function price(valueE8: bigint, shown: number = DECIMALS.cents): string {
  return formatUnits(valueE8, DECIMALS.oracle, shown);
}

/** +0.82% from basis points. */
export function signedPct(bps: bigint): string {
  const text = formatUnits(bps < 0n ? -bps : bps, DECIMALS.bpsAsPct, DECIMALS.cents);
  return `${bps < 0n ? "−" : "+"}${text}%`;
}

/** 58% from basis points, no decimals. */
export function pct(bps: bigint): string {
  return `${formatUnits(bps, DECIMALS.bpsAsPct, 0)}%`;
}

/** ▲ / ▼ glyph paired with every coloured change (accessibility rule). */
export function arrow(value: bigint): string {
  return value < 0n ? "▼" : "▲";
}

/**
 * Chart geometry only: a plotted point needs a JS number. Never used for money math or display text.
 * Precision loss above 2^53 base units is irrelevant at chart resolution.
 */
export function toPlot(value: bigint, decimals: number): number {
  const scale = pow10(decimals);
  const whole = value / scale;
  const frac = value % scale;
  return Number(whole) + Number(frac) / Number(scale);
}

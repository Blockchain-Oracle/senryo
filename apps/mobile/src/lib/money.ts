/**
 * Display wrappers for integer money (CLAUDE.md: integer base units only). `usd6` = 1e6 per dollar; oracle prices are
 * `e8` (Chainlink 8 decimals); rates are basis points. The bigint algorithm lives in `@senryo/core`; this file owns
 * mobile's glyphs (true minus sign, ▲/▼).
 */
import { DECIMALS, formatUnits } from "@senryo/core";

export { formatUnits, toPlot } from "@senryo/core";

/** $12,480.52 */
export function usd(value6: bigint, shown: number = DECIMALS.cents): string {
  const text = formatUnits(value6, DECIMALS.usd6, shown);
  return text.startsWith("-") ? `-$${text.slice(1)}` : `$${text}`;
}

/** +$184.22 / −$6.40 — a sign always, so colour is never the only signal. */
export function signedUsd(value6: bigint, shown: number = DECIMALS.cents): string {
  if (value6 < 0n) return `−${usd(-value6, shown)}`;
  return `+${usd(value6, shown)}`;
}

/** 2,687.40 from an e8 oracle price. */
export function price(valueE8: bigint, shown: number = DECIMALS.cents): string {
  return formatUnits(valueE8, DECIMALS.e8, shown);
}

/** 4,189.06 from an engine price (1e18 USD per unit, risk-math.md units). */
export function price18(value18: bigint, shown: number = DECIMALS.cents): string {
  return formatUnits(value18, DECIMALS.e18, shown);
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

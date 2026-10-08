import { MAINNET_CHAIN_ID, type NetworkKey } from "@senryo/config";
import { DECIMALS, formatUnits, toPlot } from "@senryo/core";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { BPS_PERCENT_DECIMALS, USD6_DECIMALS } from "@/lib/constants/money";

const TEN = 10n;

/** Dollars on both networks (D-258); Practice says so through its tint and chip, never through the glyph. */
const MONEY_SYMBOL: Record<NetworkKey, string> = { testnet: "$", mainnet: "$" };
export const MONEY = MONEY_SYMBOL[ACTIVE_NETWORK.key];

/** Account money: `$12,480.52`. Market prices use `price18`. */
export function money(value6: bigint, shown: number = DECIMALS.cents): string {
  const s = formatUnits(value6 < 0n ? -value6 : value6, USD6_DECIMALS, shown);
  return value6 < 0n ? `−${MONEY}${s}` : `${MONEY}${s}`;
}

/** `+$184.22` / `−$6.40` — a sign always, so colour is never the only signal. */
export function signedMoney(value6: bigint, shown: number = DECIMALS.cents): string {
  return value6 < 0n ? money(value6, shown) : `+${money(value6, shown)}`;
}

/** `4,189.06` from a 1e18 price. */
export function price18(value18: bigint, shown: number = DECIMALS.cents): string {
  return formatUnits(value18, DECIMALS.e18, shown);
}

/** `+0.82%` / `−0.82%` from basis points (true minus, as on mobile). */
export function signedPct(bps: bigint): string {
  const s = formatUnits(bps < 0n ? -bps : bps, BPS_PERCENT_DECIMALS, DECIMALS.cents);
  return `${bps < 0n ? "−" : "+"}${s}%`;
}

/** `58%` from basis points, no decimals. */
export function wholePct(bps: bigint): string {
  return `${formatUnits(bps, BPS_PERCENT_DECIMALS, 0)}%`;
}

/** ▲ / ▼ paired with every coloured change (accessibility rule, plan §2.5). */
export function arrow(value: bigint): string {
  return value < 0n ? "▼" : "▲";
}

/** `$12,480.52` from usd6. */
export function usd(value: bigint, shown = 2): string {
  const s = formatUnits(value, USD6_DECIMALS, shown);
  return s.startsWith("-") ? `-$${s.slice(1)}` : `$${s}`;
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

/** Compact account money: `P$18.4M`, `P$950K`, `P$12.40` in practice. One decimal, bigint only. */
export function compactMoney(value: bigint): string {
  const whole = value / TEN ** BigInt(USD6_DECIMALS);
  const step = COMPACT_STEPS.find((s) => whole >= s.unit);
  if (!step) return money(value);
  return `${MONEY}${formatUnits((value * TEN) / (step.unit * TEN ** BigInt(USD6_DECIMALS)), 1, 1)}${step.suffix}`;
}

/** Money in a given network's glyph (watch mode can show the other network): `$12.40` on Mainnet, `P$12.40` in Practice. */
export function moneyOn(chainId: number, value6: bigint, shown: number = DECIMALS.cents): string {
  const glyph = chainId === MAINNET_CHAIN_ID ? MONEY_SYMBOL.mainnet : MONEY_SYMBOL.testnet;
  const s = formatUnits(value6 < 0n ? -value6 : value6, USD6_DECIMALS, shown);
  return value6 < 0n ? `−${glyph}${s}` : `${glyph}${s}`;
}

/** Signed `moneyOn`: a sign always. */
export function signedMoneyOn(chainId: number, value6: bigint, shown: number = DECIMALS.cents): string {
  return value6 < 0n ? moneyOn(chainId, value6, shown) : `+${moneyOn(chainId, value6, shown)}`;
}

const TWO_DIGITS = 2;

/** "14:02" in local time. */
export function clockTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(TWO_DIGITS, "0")}:${String(d.getMinutes()).padStart(TWO_DIGITS, "0")}`;
}

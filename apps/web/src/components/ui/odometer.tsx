"use client";
/**
 * Rolling digits for every changing number (Tradash's DOM odometer; Owarine's `Odometer`, 21st "Number Flow" 28181):
 * each digit rolls forward on a rise and back on a fall, 260 ms on `cubic-bezier(0.22, 1, 0.36, 1)`. Display only —
 * money stays in bigints upstream and arrives here as a number for the view. Hidden balances read "••••" (privacy).
 *
 *   usd    $1,234.56
 *   pnl    +$12.34 — signed, coloured by its sign; zero reads as up (Tradash: `pnl >= 0` is a win)
 *   pct    +4.20 % — a percent value (4.2 → +4.20%)
 *   plain  1,234
 */
import NumberFlow, { type Format } from "@number-flow/react";
import { HIDDEN_AMOUNT, usePrivacy } from "@/lib/shell/privacy";
import { cn } from "@/lib/utils";

export type OdometerKind = "usd" | "pnl" | "pct" | "plain";

const TIMING = { duration: 260, easing: "cubic-bezier(0.22, 1, 0.36, 1)" } as const;
const PERCENT = 100;
const CENTS = 2;
/** Tradash shows small PnL at 4 decimals so a $1 call visibly ticks; whole dollars at 2. */
const SMALL = 10;
const SMALL_DECIMALS = 4;

/** Dollars are 6-decimal base units. */
const UNITS_PER_DOLLAR = 1e6;

/** The one place a dollar amount becomes a float: the odometer's view of it (display only; money stays bigint). */
export const viewDollars = (units: bigint): number => Number(units) / UNITS_PER_DOLLAR;

/** Decimals that let a figure move visibly: 4 under $10, else 2. */
export const moneyDecimals = (v: number): number => (Math.abs(v) < SMALL ? SMALL_DECIMALS : CENTS);

export interface OdometerProps {
  value: number;
  kind?: OdometerKind;
  decimals?: number;
  /** Colour by sign (pnl and pct do by default). */
  tone?: boolean;
  /** A balance or result: masked while balances are hidden. */
  sensitive?: boolean;
  className?: string;
}

export function Odometer({ value, kind = "usd", decimals, tone, sensitive = false, className }: OdometerProps) {
  const hidden = usePrivacy() && sensitive;
  const dp = decimals ?? (kind === "plain" ? 0 : CENTS);
  const signed = kind === "pnl" || kind === "pct";
  const colour = tone ?? signed;
  const safe = Number.isFinite(value) ? value : 0;
  const format: Format = {
    ...(kind === "usd" || kind === "pnl"
      ? { style: "currency", currency: "USD" }
      : kind === "pct"
        ? { style: "percent" }
        : {}),
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
    signDisplay: signed ? "always" : "auto",
  };
  const dir = safe >= 0 ? "up" : "down";
  if (hidden) return <span className={cn("tnum", className)}>{HIDDEN_AMOUNT}</span>;
  return (
    <span
      data-slot="odometer"
      className={cn(
        "tnum inline-flex whitespace-nowrap",
        colour && (dir === "up" ? "text-up" : "text-down"),
        className,
      )}
    >
      <NumberFlow
        locales="en-US"
        value={kind === "pct" ? safe / PERCENT : safe}
        format={format}
        transformTiming={TIMING}
        spinTiming={TIMING}
        willChange
      />
    </span>
  );
}

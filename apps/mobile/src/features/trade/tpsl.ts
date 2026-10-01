/**
 * TP/SL input rules for the ticket's child (FT110/FT111; Codex S1b.7 consult #2). Presentation-only: it turns what the
 * user typed into a trigger price for the existing `triggerOrder` / `placeTriggerRequest` path and says, side-aware,
 * when a level can't work. Percent is the signed price movement from the oracle mark ("% from mark"), never a return
 * on margin. Long: liquidation < stop loss < mark < take profit. Short: take profit < mark < stop loss < liquidation.
 */
import { DECIMALS, formatUnits, parseUnits, RISK } from "@senryo/core";
import { PERCENT_DECIMALS } from "./constants";

export type TriggerKind = "sl" | "tp";

/** Does this kind sit above the mark for this side? (long TP, short SL) */
export function isAbove(kind: TriggerKind, isLong: boolean): boolean {
  return (kind === "tp") === isLong;
}

/** The trigger price `bps` away from the mark in this kind's direction. */
export function priceFromBps(mark18: bigint, bps: bigint, kind: TriggerKind, isLong: boolean): bigint {
  return isAbove(kind, isLong) ? (mark18 * (RISK.BPS + bps)) / RISK.BPS : (mark18 * (RISK.BPS - bps)) / RISK.BPS;
}

/** The unsigned distance of a price from the mark, in bps. */
export function bpsFromPrice(mark18: bigint, price18: bigint): bigint {
  if (mark18 === 0n) return 0n;
  const diff = price18 > mark18 ? price18 - mark18 : mark18 - price18;
  return (diff * RISK.BPS) / mark18;
}

/** "12.5" (percent text) → bps (a percent with two decimals is a count of bps), or undefined when not a number. */
export function parsePercent(text: string): bigint | undefined {
  const parsed = parseUnits(text, PERCENT_DECIMALS);
  return parsed.ok ? parsed.value : undefined;
}

export function percentText(bps: bigint): string {
  return formatUnits(bps, PERCENT_DECIMALS, PERCENT_DECIMALS, { grouping: false });
}

/** "4189.06" (price text) → 1e18 price, or undefined. */
export function parsePrice(text: string): bigint | undefined {
  const parsed = parseUnits(text, DECIMALS.e18);
  return parsed.ok && parsed.value > 0n ? parsed.value : undefined;
}

export function priceText(price18: bigint, decimals: number): string {
  return formatUnits(price18, DECIMALS.e18, decimals, { grouping: false });
}

export type TriggerProblem =
  | { code: "SIDE"; kind: TriggerKind; above: boolean }
  | { code: "PAST_LIQUIDATION"; liq18: bigint }
  | { code: "NOT_POSITIVE" };

/** Why a level can't work for this side, or undefined when it can. `liq18` null/undefined = unknown or none. */
export function triggerProblem(input: {
  kind: TriggerKind;
  isLong: boolean;
  price18: bigint;
  mark18: bigint;
  liq18: bigint | null | undefined;
}): TriggerProblem | undefined {
  const { kind, isLong, price18, mark18, liq18 } = input;
  if (price18 <= 0n) return { code: "NOT_POSITIVE" };
  const above = isAbove(kind, isLong);
  if (above ? price18 <= mark18 : price18 >= mark18) return { code: "SIDE", kind, above };
  if (kind === "sl" && liq18 !== null && liq18 !== undefined) {
    if (isLong ? price18 <= liq18 : price18 >= liq18) return { code: "PAST_LIQUIDATION", liq18 };
  }
  return undefined;
}

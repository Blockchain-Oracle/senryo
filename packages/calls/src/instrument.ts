/**
 * Call or Ride on one terminal (R5.4, D-299): the two instruments, their defaults, and the leverage a market offers.
 * Leverage is opt-in (D-344): a ride opens at 1× — "No leverage" — and turning leverage on offers the marks 2× / 5× /
 * 10× / 20× / 40× up to the market's cap, the cap itself appended when it isn't one of them (ETH's 25×).
 */
import { RIDE_MARKETS } from "@senryo/config";
import { RIDE_LEVERAGE_CHIPS } from "./constants.ts";

export type Instrument = "call" | "ride";
export const INSTRUMENTS = [
  { value: "call", label: "Call" },
  { value: "ride", label: "Ride" },
] as const;
export const isInstrument = (v: unknown): v is Instrument => v === "call" || v === "ride";

/** Whether a market rides (D-299 v1: the 24/7 Pyth crypto). */
export const ridesOn = (symbol: string): boolean => (RIDE_MARKETS as readonly string[]).includes(symbol);

const LEVERAGE_ONE = 10_000;
/** A ride's default margin ($5). */
export const DEFAULT_RIDE_MARGIN = 5_000_000n;
/** No leverage: a ride opens at 1× until leverage is turned on (D-344). */
export const LEVERAGE_OFF_X = 1;
/** Where the multiple starts the first time leverage is turned on. */
export const LEVERAGE_FIRST_ON_X = 2;
/** A call's trail by default: 5¢ behind the best bid (Codex direction 11 §3). */
export const DEFAULT_CALL_TRAIL_CENTS = 5;

/** The leverage marks a market offers, in ×, up to its cap (the slider's stops once leverage is on). */
export function leverageMarks(maxLeverageBps: number): number[] {
  const cap = Math.floor(maxLeverageBps / LEVERAGE_ONE);
  const chips: number[] = RIDE_LEVERAGE_CHIPS.filter((x) => x <= cap);
  if (!chips.includes(cap)) chips.push(cap);
  return chips;
}

/** The leverage to use: what was chosen if the market allows it, held to its cap; no choice is no leverage (1×). */
export function leverageFor(chosenX: number | null, maxLeverageBps: number): number {
  const cap = Math.max(LEVERAGE_OFF_X, Math.floor(maxLeverageBps / LEVERAGE_ONE));
  const x = chosenX !== null && chosenX >= LEVERAGE_OFF_X ? Math.min(chosenX, cap) : LEVERAGE_OFF_X;
  return x * LEVERAGE_ONE;
}

/** Leverage is on when the multiple is above 1×. */
export const leverageOn = (leverageBps: number): boolean => leverageBps > LEVERAGE_OFF_X * LEVERAGE_ONE;

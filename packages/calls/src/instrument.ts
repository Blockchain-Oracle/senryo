/**
 * Call or Ride on one terminal (R5.4, D-299): the two instruments, their defaults, and the leverage a market offers —
 * the chips 2× / 5× / 10× / 20× / 40× up to its cap, the cap itself appended when it isn't one of them (ETH's 25×).
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
/** A ride's default margin ($5) and leverage (10×, or the market's cap when lower). */
export const DEFAULT_RIDE_MARGIN = 5_000_000n;
const DEFAULT_LEVERAGE_X = 10;
/** A call's trail by default: 5¢ behind the best bid (Codex direction 11 §3). */
export const DEFAULT_CALL_TRAIL_CENTS = 5;

/** The leverage chips a market offers, in ×, up to its cap. */
export function leverageChips(maxLeverageBps: number): number[] {
  const cap = Math.floor(maxLeverageBps / LEVERAGE_ONE);
  const chips: number[] = RIDE_LEVERAGE_CHIPS.filter((x) => x <= cap);
  if (!chips.includes(cap)) chips.push(cap);
  return chips;
}

/** The leverage to use: what was chosen if the market allows it, else 10× or its cap. */
export function leverageFor(chosenX: number | null, maxLeverageBps: number): number {
  const cap = Math.floor(maxLeverageBps / LEVERAGE_ONE);
  const x = chosenX !== null && chosenX >= 1 && chosenX <= cap ? chosenX : Math.min(DEFAULT_LEVERAGE_X, cap);
  return x * LEVERAGE_ONE;
}

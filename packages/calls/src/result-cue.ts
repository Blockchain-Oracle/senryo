/**
 * What a result says and plays, shared by calls' and rides' results (`useResults`, `useRideResults`).
 */
import { formatUnits } from "@senryo/core";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;

export const usd = (v: bigint) => `$${formatUnits(v < 0n ? -v : v, DOLLAR_DECIMALS, CENTS)}`;
export const signed = (v: bigint) => `${v > 0n ? "+" : v < 0n ? "−" : ""}${usd(v)}`;

export type ResultCue = "win" | "loss" | "refund";

export interface ResultEffects {
  cue(cue: ResultCue): void;
  /** A win or a profitable cash-out: confetti. */
  celebrate(): void;
  /**
   * `symbol`: the market the result is on — the app draws its mark on the toast (R2.8); `id`: the trade's toast
   * (`tradeToastId`), which the result replaces in place.
   */
  notify(notice: { title: string; description: string; symbol: string; id: string }): void;
}

/** What a realised amount plays: win above zero (with confetti), loss below, the neutral cue at exactly zero. */
export function realisedCue(fx: ResultEffects, net: bigint): void {
  if (net > 0n) {
    fx.cue("win");
    fx.celebrate();
  } else fx.cue(net < 0n ? "loss" : "refund");
}

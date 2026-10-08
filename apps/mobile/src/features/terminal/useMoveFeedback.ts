/**
 * The combo ladder while a call is open (Tradash's reactions, SPEC-chart §5; Owarine's port): every move of one "step"
 * in the call's favour plays the profit cue one major-pentatonic note higher with a tiny tick; from the second step
 * against it, a soft adverse blip, and the ladder starts again. A step is clamp(2.5 × EMA|Δp|, 0.005 %, 0.08 %) of
 * price, so a quiet market and a fast one both sing at a human pace. Silent with sounds off (`fire` gates it).
 */
import { useLive } from "@senryo/live/react";
import { useEffect } from "react";
import { fire } from "~/feedback/fire";

const EMA_ALPHA = 0.03;
const STEP_GAIN = 2.5;
const MIN_STEP = 0.00005;
const MAX_STEP = 0.0008;
const ADVERSE_FROM = 2;
const LADDER_TOP = 10;

export function useMoveFeedback(symbol: string, side: "up" | "down" | null) {
  const live = useLive();
  useEffect(() => {
    if (!side) return;
    let anchor: number | null = null;
    let last: number | null = null;
    let ema = 0;
    let combo = 0;
    let against = 0;
    const sign = side === "up" ? 1 : -1;
    return live.prices.subscribe(symbol, () => {
      const p = live.prices.latest(symbol)?.priceE8;
      if (p === undefined) return;
      if (last !== null) ema = EMA_ALPHA * Math.abs(p - last) + (1 - EMA_ALPHA) * ema;
      last = p;
      if (anchor === null) {
        anchor = p;
        return;
      }
      const step = Math.min(MAX_STEP * p, Math.max(MIN_STEP * p, STEP_GAIN * ema));
      const moved = (sign * (p - anchor)) / step;
      if (moved >= 1) {
        anchor = p;
        against = 0;
        fire("move", { profit: Math.min(LADDER_TOP, combo) });
        combo += 1;
      } else if (moved <= -1) {
        anchor = p;
        combo = 0;
        against += 1;
        if (against >= ADVERSE_FROM) fire("move", { cue: "adverse" });
      }
    });
  }, [live, symbol, side]);
}

/**
 * The ride settings' risk ladder (Q1, D-345, Codex direction 16 §1): both sides on one rising price axis — each side's
 * knock-out and cap where they truly sit, the live mark between — so leverage is seen bringing the knock-out closer
 * instead of read in a sentence. Positions are 0 (the bottom) … 1 (the top); levels carry their exact price and signed
 * move for the tap that shows them. Never reordered for looks.
 */
import type { RideQuote } from "./ride-quote.ts";

/** Room above and below the outermost level, as a share of the span. */
const PAD = 0.06;

export interface LadderLevel {
  side: "up" | "down";
  kind: "ko" | "cap";
  priceE8: bigint;
  /** Signed move from the live price, bps. */
  moveBps: number;
  /** 0 bottom … 1 top. */
  at: number;
}

export interface RideLadder {
  markAt: number;
  levels: readonly LadderLevel[];
  /** Each side's live span on its rail: knock-out to cap, as [low, high]. */
  bands: { up: readonly [number, number]; down: readonly [number, number] };
}

export function rideLadder(up: RideQuote, down: RideQuote, markE8: bigint): RideLadder {
  const prices = [up.koE8, up.capE8, down.koE8, down.capE8, markE8].map(Number);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  const span = hi - lo || 1;
  const bottom = lo - span * PAD;
  const range = span * (1 + PAD * 2);
  const at = (e8: bigint) => (Number(e8) - bottom) / range;
  const level = (side: "up" | "down", kind: "ko" | "cap", q: RideQuote): LadderLevel => ({
    side,
    kind,
    priceE8: kind === "ko" ? q.koE8 : q.capE8,
    moveBps: kind === "ko" ? q.koMoveBps : q.capMoveBps,
    at: at(kind === "ko" ? q.koE8 : q.capE8),
  });
  return {
    markAt: at(markE8),
    levels: [level("up", "ko", up), level("up", "cap", up), level("down", "ko", down), level("down", "cap", down)],
    bands: {
      up: [at(up.koE8), at(up.capE8)],
      down: [at(down.capE8), at(down.koE8)],
    },
  };
}

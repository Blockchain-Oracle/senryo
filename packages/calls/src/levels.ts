/**
 * How each chart level is drawn, one table for both engines (Tradash's tags, R5.6): its dash, strength and width,
 * and a colour role each engine maps onto its theme — `tone` follows the line (up while PnL ≥ 0, else down).
 *   Line K [2,3] ink · Entry [4,4] · an edge [8,4] · B/E [1,3] amber · Trail [6,3] 1.5 px in the line's tone ·
 *   TP / SL [5,3] up / down · Knock-out [2,3] down · Cap [5,3] up.
 * The band from the price path to the entry fades 0.22 → 0.02 towards the entry.
 */
import { LEVEL_TABLE } from "./constants.ts";
import type { ChartOverlay, LevelKind } from "./quote.ts";

export type LevelRole = "ink" | "helper" | "warn" | "tone" | "up" | "down";

export interface LevelStyle {
  dash: readonly [number, number];
  alpha: number;
  width: number;
  role: LevelRole;
}

export const LEVEL_STYLE: Readonly<Record<LevelKind, LevelStyle>> = LEVEL_TABLE;

/**
 * What the chart draws this frame (both apps' one selector; a worklet on the phone): the instrument's overlay, the
 * entry drawn at the price tapped while the tap waits for its fill ("Opening…", R5.11 — Tradash's pending entry), and
 * the PnL masked while balances are hidden (R5.14).
 */
export function chartFrame(o: ChartOverlay | null, pending: number | null, mask: string | null): ChartOverlay | null {
  "worklet";
  if (!o || (pending === null && !(mask && o.pnlText))) return o;
  return {
    ...o,
    ...(mask && o.pnlText ? { pnlText: mask } : {}),
    ...(pending === null
      ? {}
      : { levels: [...o.levels, { kind: "entry" as const, price: pending, label: "Opening…" }] }),
  };
}

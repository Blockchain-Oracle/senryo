/**
 * Sharing a position (R5.21, D-352; Tradash's share by way of Owarine's `ShareSheet`): the slip and its image show the
 * PnL with its ROI (the PnL · ROI · Both chooser is gone), and the post carries words tiered by the result. An open position shares what it's worth now ("Open
 * PnL", from the live book); a finished one its realised result over what went in (a call's stake, a ride's margin
 * and open fee). Pure.
 */
import type { CallTimeline, RideView } from "@senryo/api-client";
import { signedUsd, usd } from "@senryo/core";
import type { BookEntry } from "./book.ts";
import { rideNet, type TradeSlip } from "./trade-slip.ts";

/** What a share is about: the result and what went in, e-6 (`cost` null when it isn't known). */
export interface ShareFigure {
  pnl: bigint;
  cost: bigint | null;
  /** Still open: valued now, not realised. */
  open: boolean;
}

/** A finished call: its realised result over its stake (null while it hasn't ended). */
export function callFigure(t: CallTimeline): ShareFigure | null {
  const c = t.call;
  return c.pnl === null ? null : { pnl: BigInt(c.pnl), cost: c.stake, open: false };
}

/** A finished ride: PnL less every fee (D-327) over its margin and open fee. */
export function rideFigure(r: RideView): ShareFigure {
  return { pnl: rideNet(r), cost: r.marginOpen === null ? null : r.marginOpen + r.openFee, open: false };
}

/** An open position as the live book values it (null while it can't be valued). */
export function bookFigure(e: BookEntry): ShareFigure | null {
  return e.pnl === null ? null : { pnl: e.pnl, cost: e.cost, open: true };
}

const BPS = 10_000n;
const PERCENT_BPS = 100;
const ROI_DECIMALS = 1;
/** Tradash's tiers, by ROI. */
const TIER = { moon: 100, green: 25, rough: -50 } as const;
const X_INTENT = "https://x.com/intent/post";

/** PnL ÷ cost as a percentage (null without a cost). */
export function roiPct(f: ShareFigure): number | null {
  if (f.cost === null || f.cost <= 0n) return null;
  return Number((f.pnl * BPS) / f.cost) / PERCENT_BPS;
}

const signedPct = (pct: number) => `${pct > 0 ? "+" : pct < 0 ? "−" : ""}${Math.abs(pct).toFixed(ROI_DECIMALS)}%`;

/** The post's words, tiered by the result (Tradash's tiers): "+120% Up on BTC on Senryo. let it ride 🚀" … */
export function shareWords(f: ShareFigure, symbol: string, side: string): string {
  const pct = roiPct(f) ?? 0;
  const money = usd(f.pnl);
  if (pct >= TIER.moon) return `+${Math.round(pct)}% ${side} on ${symbol} on Senryo. let it ride 🚀`;
  if (pct >= TIER.green) return `+${Math.round(pct)}% on ${symbol} (+${money}) on Senryo. green day`;
  if (f.pnl >= 0n) return `+${money} on ${symbol} on Senryo. up only`;
  if (pct <= TIER.rough) return `${Math.round(pct)}% on ${symbol} on Senryo. rough one, on to the next`;
  return `−${money} on ${symbol} on Senryo. taking the L, moving on`;
}

/** The post on X with its words and the slip's link. */
export function postLink(words: string, url: string): string {
  const query = new URLSearchParams({ text: words, url });
  return `${X_INTENT}?${query.toString()}`;
}

/**
 * The slip as shared, toned by the sign: the money, with the percentage in its label ("Realised · +24.8 %") so the
 * figure stays one line beside the stamp. "Open PnL" while open. Without a cost the ROI is unknown and the money stands
 * alone.
 */
export function sharedSlip(slip: TradeSlip, f: ShareFigure): TradeSlip {
  const pct = roiPct(f);
  const base = f.open ? "Open PnL" : "Realised";
  return {
    ...slip,
    figure: {
      label: pct !== null ? `${base} · ${signedPct(pct)}` : base,
      text: signedUsd(f.pnl),
      tone: f.pnl > 0n ? "up" : f.pnl < 0n ? "down" : "ink",
      money: true,
    },
  };
}

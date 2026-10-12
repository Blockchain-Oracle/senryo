/**
 * The terminal's per-tick pass for rides (R5.4–R5.6), one copy for both apps, as `quoteTick` is for calls: before a
 * ride, each side's knock-out in words under its button (and, previewed, on the chart); holding one, its live PnL in
 * the pill (D-303: (mark − entry) × size, red the moment it's below 0), what CLOSE returns now, whether TRAIL can arm,
 * and its levels — entry, break-even, knock-out, cap and the armed exit — with the band from the path to the entry.
 * Pure: each app writes the result where its screen reads it, never rendering React per tick.
 */
import type { PriceUnit } from "@senryo/core";
import { priceText, rideTrailStopE8 } from "@senryo/core";
import { type BookRide, rideCloseValue } from "./book-ride.ts";
import type { ChartLevel, ChartOverlay } from "./quote.ts";
import { signedDollars } from "./quote.ts";
import type { ReactionPosition } from "./reactions.ts";
import { type RideQuote, type RideTermsLike, rideQuote, rideTrailReady, trailText } from "./ride-quote.ts";

const E8 = 1e8;
const BPS = 10_000n;
const toPrice = (e8: bigint) => Number(e8) / E8;

export interface RideTickInput {
  markE8: bigint;
  nowSec: number;
  margin: bigint;
  leverageBps: number;
  terms: RideTermsLike & { earlyFeeBps: number; earlyWindowSec: number };
  /** The rider's open ride on this market, if any. */
  held: BookRide | undefined;
  /** The trail distance TRAIL arms at (bps of the price). */
  trailBps: number;
  /** The side under the pointer or focus: its knock-out previews on the chart. */
  preview?: 0 | 1 | null;
  unit?: PriceUnit;
}

export interface RideTrail {
  /** Armed on chain (the ride's exit has a trail). */
  armed: boolean;
  /** TRAIL may arm now (the move past break-even beats the distance). */
  ready: boolean;
  /** Under the button: "Need +0.08% to trail", "0.10% behind price" or "Stop $82,140 · runs with app closed". */
  caption: string;
}

export interface RideTickPass {
  /** Each side's open, priced at the mark. */
  up: RideQuote;
  down: RideQuote;
  /** Under UP and DOWN: "Knocked out at $80,431". */
  upLine: string;
  downLine: string;
  /** Holding: what CLOSE returns now (equity less the close fee) and the PnL; null otherwise. */
  closeValue: bigint | null;
  pnl: bigint | null;
  /** Holding: where it breaks even after both fees (the trail's floor). */
  breakEvenE8: bigint | null;
  trail: RideTrail | null;
  overlay: ChartOverlay;
  /** The held ride as the reaction engine reads it: its ROI in bps of margin, the knock-out as the losing level. */
  reading: ReactionPosition | null;
}

const knockedOutAt = (q: RideQuote, unit: PriceUnit) => `Knocked out at ${priceText(q.koE8, unit)}`;

function exitLevels(r: BookRide, markE8: bigint): ChartLevel[] {
  const e = r.exit;
  if (!e) return [];
  const out: ChartLevel[] = [];
  if (e.takeProfitE8 > 0n) out.push({ kind: "tp", price: toPrice(e.takeProfitE8), label: "TP" });
  if (e.stopLossE8 > 0n) out.push({ kind: "sl", price: toPrice(e.stopLossE8), label: "SL" });
  // The api serves the trail's stop from its best price so far; before its first tick, the stop from the mark.
  const stop = e.trailStopE8 ?? rideTrailStopE8(e, r.isLong, markE8);
  if (e.trailBps > 0 && stop !== null) out.push({ kind: "trail", price: toPrice(stop), label: "Trail" });
  return out;
}

export function rideTick(i: RideTickInput): RideTickPass {
  const unit = i.unit ?? "usd";
  const up = rideQuote(true, i.margin, i.leverageBps, i.markE8, i.terms);
  const down = rideQuote(false, i.margin, i.leverageBps, i.markE8, i.terms);
  const base = { up, down, upLine: knockedOutAt(up, unit), downLine: knockedOutAt(down, unit) };
  const r = i.held;
  if (!r || r.entryE8 === null || r.state === "committed") {
    const shown = i.preview === 0 ? up : i.preview === 1 ? down : null;
    return {
      ...base,
      closeValue: null,
      pnl: null,
      breakEvenE8: null,
      trail: null,
      reading: null,
      overlay: {
        winning: null,
        pnlText: null,
        pnlTrend: 0,
        line: null,
        zone: null,
        zoneTone: null,
        levels: shown ? [{ kind: "ko", price: toPrice(shown.koE8), label: "KO" }] : [],
      },
    };
  }
  const v = rideCloseValue(r, i.markE8, i.terms.takerFeeBps, i.terms, i.nowSec);
  const quoteAtEntry = rideQuote(r.isLong, r.margin, r.leverageBps, r.entryE8, i.terms);
  const be = quoteAtEntry.breakEvenE8;
  const armed = (r.exit?.trailBps ?? 0) > 0;
  const ready = rideTrailReady(r.isLong, i.markE8, be, i.trailBps);
  const stop = armed && r.exit ? (r.exit.trailStopE8 ?? rideTrailStopE8(r.exit, r.isLong, i.markE8)) : null;
  const caption = armed
    ? `Stop ${stop === null ? "—" : priceText(stop, unit)} · runs with app closed`
    : ready.ready
      ? `${trailText(i.trailBps)} behind price`
      : ready.needText;
  const levels: ChartLevel[] = [
    { kind: "entry", price: toPrice(r.entryE8), label: "Entry" },
    { kind: "be", price: toPrice(be), label: "B/E" },
    ...(r.koE8 !== null ? [{ kind: "ko" as const, price: toPrice(r.koE8), label: "KO" }] : []),
    ...(r.capE8 !== null ? [{ kind: "cap" as const, price: toPrice(r.capE8), label: "Cap" }] : []),
    ...exitLevels(r, i.markE8),
  ];
  return {
    ...base,
    closeValue: r.state === "open" ? v.value : null,
    pnl: v.pnl,
    breakEvenE8: be,
    trail: { armed, ready: ready.ready, caption },
    reading: {
      key: `ride:${r.rideId}`,
      side: r.isLong ? 1 : -1,
      pnl: r.margin > 0n ? Number((v.pnl * BPS) / r.margin) : 0,
      margin: Number(BPS),
      entry: toPrice(r.entryE8),
      line: r.koE8 === null ? null : toPrice(r.koE8),
    },
    overlay: {
      winning: v.pnl >= 0n,
      pnlText: signedDollars(v.pnl),
      pnlTrend: 0,
      line: null,
      zone: null,
      zoneTone: null,
      levels,
      band: toPrice(r.entryE8),
    },
  };
}

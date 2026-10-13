/**
 * The call settings' payoff drawing (Q1, D-345, Codex direction 16 §2): the line across a rising price axis, each
 * offered side's winning zone where its edges sit (Up above the line, a Range around it, a Moonshot beyond its strike),
 * and in each zone a pay bar — every bar on one shared scale that grows with the stake, so a bigger stake visibly pays
 * more. Values only: positions 0 (bottom) … 1 (top), bars 0 … 1 of the scale, money bigint; the apps draw and format.
 */
import { P_ONE } from "@senryo/core";
import type { Offer, OfferedBand } from "./modes.ts";
import type { Quotes } from "./quote.ts";

/** Half the axis when no side has an edge off the line (Up / Down), bps of the line. */
const DEFAULT_HALF_SPAN_BPS = 40;
/** The outermost edge sits this share of the way to the axis end, so the zone beyond it stays visible. */
const EDGE_REACH = 0.5;

export interface PayoffZone {
  slot: 0 | 1;
  band: OfferedBand;
  /** 0 bottom … 1 top. */
  from: number;
  to: number;
  /** What a win pays; null when refused or not yet quoted. */
  payout: bigint | null;
  /** The fee inside the price: stake − payout × probability. */
  fee: bigint | null;
  /** The bar's length, 0 … 1 of the shared scale. */
  bar: number;
  /** Where the bar and its labels sit, 0 … 1: the zone's middle, or — when the line runs through it (a Range) — the
   * middle of its part above the line, so the line never strikes through the words. */
  barAt: number;
}

export interface CallPayoff {
  lineAt: number;
  zones: readonly PayoffZone[];
  /** The stake's length on the same scale (the bar past it is the profit). */
  stakeBar: number;
}

/** The band's winning span in bps of the line, open ends as null. */
function spanBps(b: OfferedBand): readonly [number | null, number | null] {
  const { kind, lowBps, highBps } = b.band;
  if (kind === "up") return [0, null];
  if (kind === "down") return [null, 0];
  if (kind === "range") return [-lowBps, highBps];
  return kind === "moonshot" ? [lowBps, null] : [null, -lowBps];
}

/**
 * `scaleStake` is the stake the scale is drawn for — the top preset — so bars grow with the stake up to it and fill the
 * width past it.
 */
export function callPayoff(offer: Offer, quotes: Quotes, stake: bigint, scaleStake: bigint): CallPayoff {
  const offered = ([0, 1] as const).flatMap((slot) => {
    const band = offer[slot];
    return band ? [{ slot, band, quote: slot === 0 ? quotes.first : quotes.second }] : [];
  });
  const edges = offered.flatMap((o) => spanBps(o.band)).filter((v): v is number => v !== null && v !== 0);
  const reach = Math.max(0, ...edges.map(Math.abs));
  const half = reach > 0 ? reach / EDGE_REACH : DEFAULT_HALF_SPAN_BPS;
  const at = (bps: number) => Math.min(1, Math.max(0, (bps + half) / (2 * half)));
  const priced = offered.map((o) => {
    const q = o.quote && !o.quote.refusal && o.quote.payout > 0n ? o.quote : null;
    return { ...o, payout: q?.payout ?? null, fee: q ? stake - (q.payout * q.probE6) / P_ONE : null };
  });
  // The best side's pay per dollar staked, at the larger of the stake and the scale stake.
  const multiple = Math.max(
    0,
    ...priced.map((o) => (o.payout !== null && stake > 0n ? Number(o.payout) / Number(stake) : 0)),
  );
  const scale = multiple * Number(stake > scaleStake ? stake : scaleStake);
  const share = (v: bigint) => (scale > 0 ? Math.min(1, Number(v) / scale) : 0);
  return {
    lineAt: at(0),
    zones: priced.map((o) => {
      const [lo, hi] = spanBps(o.band);
      const from = lo === null ? 0 : at(lo);
      const to = hi === null ? 1 : at(hi);
      const line = at(0);
      return {
        slot: o.slot,
        band: o.band,
        from,
        to,
        barAt: from < line && line < to ? (line + to) / 2 : (from + to) / 2,
        payout: o.payout,
        fee: o.fee,
        bar: o.payout === null ? 0 : share(o.payout),
      };
    }),
    stakeBar: share(stake),
  };
}

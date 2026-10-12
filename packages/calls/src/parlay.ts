/**
 * Parlays in words, both apps (S8.5, D-293): a leg is a market, a lane and a side on the window that is trading now;
 * the slip says what it pays and how likely, and each leg's outcome as it settles. Up and Down only for now — the
 * pool prices any band, the builder offers the two that read at a glance.
 */
import type { ParlayView } from "@senryo/api-client";
import { type CadenceSec, H50_E6, PARLAY } from "@senryo/config";
import { clockText, halfSpreadE6, lane, sideName, signedUsd, usd } from "@senryo/core";
import { type CallWindow, nextOpensIn } from "./window.ts";

export interface ParlayPick {
  symbol: string;
  cadenceSec: CadenceSec;
  /** The band's index in the series' menu: 0 Up, 1 Down. */
  band: number;
}

export const PARLAY_SIDES = [
  { band: 0, label: "Up" },
  { band: 1, label: "Down" },
] as const;

const PERCENT = 100;
const E6 = 1_000_000;
const E2 = 100n;

/** "BTC Up · 1m" */
export const pickLine = (p: { symbol: string; cadenceSec: number; band: number }) =>
  `${p.symbol} ${sideName(p.band)} · ${lane(p.cadenceSec)}`;

/** "About 26%" — never "0%" for a priced parlay. */
export function chanceText(chanceE6: bigint | number | null): string {
  if (chanceE6 === null) return "—";
  const pct = Math.max(1, Math.round((Number(chanceE6) / E6) * PERCENT));
  return `About ${pct}%`;
}

/** A single side's decimal odds (what $1 returns) at its chance plus its lane's curve there (D-300): indicative for
 *  the selected window (D-326), on Parlay's cards and the slip's legs. The parlay's own price is `quoteParlay`'s, never
 *  these multiplied. */
export function indicativeOdds(
  chanceE6: bigint | null,
  minHalfSpreadE6: number,
  cadenceSec: CadenceSec,
): number | null {
  if (chanceE6 === null || chanceE6 <= 0n) return null;
  const h = halfSpreadE6(chanceE6, BigInt(H50_E6[cadenceSec]), BigInt(minHalfSpreadE6));
  return E6 / Number(chanceE6 + h);
}

/** "3.84×": what the parlay returns per dollar staked (null before it's priced). */
export const payoutMultiple = (stake: bigint, payout: bigint): string | null =>
  stake === 0n || payout === 0n ? null : `${(Number((payout * E2) / stake) / PERCENT).toFixed(2)}×`;

/** "pays 3.84×". */
export const multiplierText = (stake: bigint, payout: bigint): string => {
  const m = payoutMultiple(stake, payout);
  return m ? `pays ${m}` : "—";
};

export const LEG_WORD: Readonly<Record<ParlayView["legs"][number]["outcome"], string>> = {
  pending: "Waiting",
  won: "Came true",
  tied: "Tied · dropped",
  lost: "Missed",
  void: "Void · refunded",
};

/** The slip's big line: what it pays while live, the result once done. */
export function parlayHero(p: ParlayView): { text: string; tone: "up" | "down" | "ink" } {
  if (p.state === "committed") return { text: usd(p.stake), tone: "ink" };
  if (p.state === "open") return { text: `Pays ${usd(p.payout)}`, tone: "ink" };
  const pnl = (p.result ?? 0n) - p.stake;
  return { text: signedUsd(pnl), tone: pnl > 0n ? "up" : pnl < 0n ? "down" : "ink" };
}

/** "Live · 1 of 3 came true", "Won", "Missed on ETH", "Refunded". */
export function parlayStatus(p: ParlayView): string {
  if (p.state === "committed") return "Filling at the next price";
  if (p.state === "refunded") return "Refunded · never filled";
  if (p.state === "open") {
    const done = p.legs.filter((l) => l.outcome === "won").length;
    return `Live · ${done} of ${p.legs.length} came true`;
  }
  if (p.outcome === "win") return "Won";
  if (p.outcome === "refund") return "Refunded";
  const missed = p.legs.find((l) => l.outcome === "lost");
  return missed ? `Missed on ${missed.symbol}` : "Missed";
}

/** The round strip (D-326), one line for the whole board instead of a countdown per row. */
export function roundLine(w: CallWindow, nowSec: number): string {
  return w.trading
    ? `${lane(w.cadenceSec)} round · calls close in ${clockText(w.closesIn)}`
    : `Round settling · next opens in ${clockText(nextOpensIn(w, nowSec))}`;
}

/** A leg's clock on the slip: its window's close, or — between rounds — when its next round opens (D-326: the leg
 *  rolls on by itself, a draft for that round). */
export function legClock(w: CallWindow, nowSec: number): string {
  return w.trading ? `Closes in ${clockText(w.closesIn)}` : `Next round in ${clockText(nextOpensIn(w, nowSec))}`;
}

/** The slip bar's words: nothing picked, one leg, or the live multiplier (between rounds, when it comes) and the way
 *  in. */
export function slipBarWords(
  legs: number,
  multiplier: string | null,
  trading: boolean,
): { title: string; detail: string; action: string | null } {
  if (legs === 0)
    return {
      title: "Choose your first leg",
      detail: `Pick ${PARLAY.minLegs} to ${PARLAY.maxLegs} calls`,
      action: null,
    };
  const title = `${legs} ${legs === 1 ? "leg" : "legs"}`;
  if (legs < PARLAY.minLegs) return { title, detail: "Every leg must come true", action: "Add one more" };
  return { title, detail: multiplier ?? unpricedLine(legs, trading), action: "Review parlay" };
}

/** The slip's line under its hero before there's a price: what's missing, or when the price comes. */
export function unpricedLine(legs: number, trading: boolean): string {
  if (legs < PARLAY.minLegs) return `Pick ${PARLAY.minLegs} to ${PARLAY.maxLegs} calls`;
  return trading ? "Pricing your legs…" : "Priced as the next round opens";
}

/** The place button names whatever blocks it (Mitoshi's rule), or says what it places. */
export function placeWords(o: {
  legs: number;
  trading: boolean;
  nextOpensInSec: number;
  priced: boolean;
  refused: boolean;
  short: boolean;
  stake: bigint;
}): { label: string; ready: boolean } {
  if (o.legs === 0) return { label: "Choose your first leg", ready: false };
  if (o.legs < PARLAY.minLegs) return { label: "Add one more leg", ready: false };
  if (!o.trading) return { label: `Next round opens in ${clockText(o.nextOpensInSec)}`, ready: false };
  if (o.refused) return { label: "A leg can't be priced right now", ready: false };
  if (!o.priced) return { label: "Pricing your legs…", ready: false };
  if (o.short) return { label: "Top up to place this", ready: false };
  return { label: `Place parlay · ${usd(o.stake)}`, ready: true };
}

/** The lanes this network lists, shortest first (mainnet has no 1m, D-300): Parlay's lane choices; the first is the
 *  default. */
export function boardLanes(markets: readonly { series: readonly { cadenceSec: number }[] }[]): CadenceSec[] {
  const all = new Set<number>(markets.flatMap((m) => m.series.map((s) => s.cadenceSec)));
  return [...all].sort((a, b) => a - b) as CadenceSec[];
}

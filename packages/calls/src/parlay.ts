/**
 * Parlays in words, both apps (S8.5, D-293): a leg is a market, a lane and a side on the window that is trading now;
 * the slip says what it pays and how likely, and each leg's outcome as it settles. Up and Down only for now — the
 * pool prices any band, the builder offers the two that read at a glance.
 */
import type { ParlayView } from "@senryo/api-client";
import type { CadenceSec } from "@senryo/config";
import { lane, sideName, signedUsd, usd } from "@senryo/core";

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

/** A single side's decimal odds (what $1 returns) at its chance plus the half-spread, for the odds buttons. */
export const sideOdds = (chanceE6: bigint | null, halfSpreadE6: number): number | null =>
  chanceE6 === null || chanceE6 <= 0n ? null : E6 / (Number(chanceE6) + halfSpreadE6);

/** "pays 3.84×" from the payout per dollar × 100. */
export const multiplierText = (stake: bigint, payout: bigint): string =>
  stake === 0n || payout === 0n ? "—" : `pays ${(Number((payout * E2) / stake) / PERCENT).toFixed(2)}×`;

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

/**
 * The rest of your history as rows (D1, the owner's iPhone review: "anything I did should show in my history" — event
 * calls, parlays and duels were missing, Lucky's calls unnamed). Each finished event call, parlay and duel becomes a row
 * in the same shape as a call's, with the same outcome groups (Won · Lost · Refunded), its own mark and where it opens.
 * A duel is one row — its three cards are calls the match stands for, so they leave the list (`isDuelCard`).
 */
import type { DuelView, EventCallView, ParlayView } from "@senryo/api-client";
import { signedUsd, type Tone, toneOf } from "@senryo/core";
import { DUEL_LIVE_STATES, outcomeText, seatOf } from "./duel.ts";

/** Where a row opens: a receipt, or the place the thing lives (events, parlays and duels have no receipt yet). */
export type RowOpen =
  | { kind: "call"; id: bigint }
  | { kind: "ride"; id: bigint }
  | { kind: "event"; eventId: string }
  | { kind: "parlay" }
  | { kind: "duel" };

/** The row's mark: a market's own, or the place's nav icon (Trophy, Layers, Swords). */
export type RowMark = { kind: "market"; symbol: string } | { kind: "event" } | { kind: "parlay" } | { kind: "duel" };

export type HistoryGroup = "won" | "lost" | "refunded";

/** The fields every history row has beyond a call's own (`CallRow` carries these too). */
export interface HistoryRow {
  key: string;
  title: string;
  stake: bigint;
  tag: string;
  status: string;
  result: string;
  tone: Tone;
  group: HistoryGroup;
  at: number;
  open: RowOpen;
  mark: RowMark;
}

const MS = 1_000;
const DUEL_CARDS = 3;
const seconds = (iso: string) => Math.floor(Date.parse(iso) / MS);
const groupOf = (net: bigint, refunded: boolean): HistoryGroup => (refunded ? "refunded" : net > 0n ? "won" : "lost");

/** A settled event call: its question, your side, what it paid less the stake. Open ones lead the Events page. */
export function eventRow(c: EventCallView): HistoryRow | null {
  if (c.status === "open") return null;
  const refunded = c.status === "refunded";
  const net = refunded ? 0n : (c.amount ?? 0n) - c.stake;
  return {
    key: `event-${c.ticketId}`,
    title: c.question,
    stake: c.stake,
    tag: `Event · ${c.yes ? "Yes" : "No"}`,
    status: refunded ? "Refunded" : c.status === "won" ? "Won" : "Lost",
    result: signedUsd(net),
    tone: toneOf(net),
    group: groupOf(net, refunded),
    at: seconds(c.createdAt),
    open: { kind: "event", eventId: c.eventId },
    mark: { kind: "event" },
  };
}

/** A settled parlay: its legs' markets, what it paid less the stake. Open ones show live above the history. */
export function parlayRow(p: ParlayView): HistoryRow | null {
  if (p.state !== "settled" && p.state !== "refunded") return null;
  const refunded = p.state === "refunded" || p.outcome === "refund";
  const net = refunded ? 0n : (p.result ?? 0n) - p.stake;
  return {
    key: `parlay-${p.parlayId}`,
    title: `Parlay · ${p.legs.map((l) => l.symbol).join(" + ")}`,
    stake: p.stake,
    tag: `${p.legs.length} legs`,
    status: refunded ? "Refunded" : p.outcome === "win" ? "Won" : "Lost",
    result: signedUsd(net),
    tone: toneOf(net),
    group: groupOf(net, refunded),
    at: seconds(p.updatedAt),
    open: { kind: "parlay" },
    mark: { kind: "parlay" },
  };
}

/**
 * A finished duel: the pot and its three cards together — what went in (the pot and the cards' stakes) and what you
 * came out with (the cards' result, plus the other pot on a win or less yours on a loss; a tie returns each pot).
 */
export function duelRow(m: DuelView, me: string | undefined): HistoryRow | null {
  if (DUEL_LIVE_STATES.has(m.state)) return null;
  const seat = seatOf(m, me);
  const cards = m.results && seat !== null ? m.results[seat] : 0n;
  const won = m.winner !== null && m.winner.toLowerCase() === me?.toLowerCase();
  const lost = m.winner !== null && !won;
  const returned = m.state === "refunded" || m.state === "failed";
  const net = returned ? 0n : cards + (won ? m.pot : lost ? -m.pot : 0n);
  return {
    key: `duel-${m.matchId}`,
    title: "Duel",
    stake: m.pot + m.cardStake * BigInt(DUEL_CARDS),
    tag: m.pot === 0n ? "No pot" : "Pot",
    status: outcomeText(m, me).title,
    result: signedUsd(net),
    tone: toneOf(net),
    group: returned || m.winner === null ? "refunded" : won ? "won" : "lost",
    at: seconds(m.updatedAt),
    open: { kind: "duel" },
    mark: { kind: "duel" },
  };
}

/** A call placed by a duel card: its match row stands for it. */
export const isDuelCard = (c: { duelMatch: string | null }) => c.duelMatch !== null;

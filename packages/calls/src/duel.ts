/**
 * Duel in words, both apps (S8.6, D-294): the tiers, where my duel stands, each card's call and result, and the
 * outcome. A card is Up or Down on a window the deck dealt; each is a real call of the tier's card stake.
 */
import type { DuelQueueView, DuelView } from "@senryo/api-client";
import { type ChainId, DUEL, DUEL_TIERS, type DuelTierSpec, duelEntryCost } from "@senryo/config";
import { lane, signedUsd, usd } from "@senryo/core";

export const DUEL_SIDES = [
  { band: 0, label: "Up" },
  { band: 1, label: "Down" },
] as const;

/** States in which a match is still being played or paid. */
export const DUEL_LIVE_STATES = new Set(["opening", "sealed", "picking", "settling", "forfeited"]);

export const duelTiers = (chainId: ChainId): readonly DuelTierSpec[] => DUEL_TIERS[chainId];

/** "Free" or "$10 pot". */
export const tierTitle = (t: DuelTierSpec) => (t.pot === 0n ? "Free" : `${usd(t.pot)} pot`);

/** "3 calls of $10 · winner takes $20". */
export const tierLine = (t: DuelTierSpec) =>
  t.pot === 0n
    ? `${DUEL.cards} calls of ${usd(t.cardStake)} · no pot`
    : `${DUEL.cards} calls of ${usd(t.cardStake)} · winner takes ${usd(t.pot * 2n)}`;

/** What entering takes now; the cards' results and the pot come back after. */
export const entryText = (t: DuelTierSpec) => `${usd(duelEntryCost(t))} goes in now`;

export type DuelPhase = "idle" | "queued" | "opening" | "picking" | "waiting" | "settling" | "done";

export function seatOf(m: DuelView, me: string | undefined): 0 | 1 | null {
  const who = me?.toLowerCase();
  if (m.players[0].toLowerCase() === who) return 0;
  if (m.players[1].toLowerCase() === who) return 1;
  return null;
}

export const picksOf = (m: DuelView, seat: 0 | 1) => m.picks.filter((p) => p.seat === seat);

/** Where my duel stands: in the queue, being dealt, my picks to make, waiting on the other, the cards, or over. */
export function phaseOf(entry: DuelQueueView | null, m: DuelView | null, me: string | undefined): DuelPhase {
  if (m && DUEL_LIVE_STATES.has(m.state)) {
    if (m.state === "opening" || m.state === "sealed") return "opening";
    const seat = seatOf(m, me);
    if (m.state === "picking" && seat !== null) {
      return picksOf(m, seat).length < DUEL.cards ? "picking" : "waiting";
    }
    return "settling";
  }
  if (entry?.state === "queued") return "queued";
  if (entry?.state === "paired" && !m) return "opening";
  return m ? "done" : "idle";
}

/** "BTC · 5m". */
export const cardLine = (c: { symbol: string; cadenceSec: number }) => `${c.symbol} · ${lane(c.cadenceSec)}`;

/** A settled call's result for its card: "+$8.20", "−$10.00" or "Refunded". */
export function cardResultText(p: { returned: bigint | null; result: bigint | null }, stake: bigint): string {
  if (p.returned === null || p.result === null) return "Settling";
  return p.returned === stake && p.result === 0n ? "Refunded" : signedUsd(p.result);
}

/** The outcome in one line, for me. */
export function outcomeText(m: DuelView, me: string | undefined): { title: string; detail: string } {
  const seat = seatOf(m, me);
  const mine = m.results && seat !== null ? m.results[seat] : null;
  const theirs = m.results && seat !== null ? m.results[seat === 0 ? 1 : 0] : null;
  const totals = mine !== null && theirs !== null ? `${signedUsd(mine)} vs ${signedUsd(theirs)}` : "";
  if (m.state === "failed") return { title: "The duel didn't start", detail: "Nothing was taken." };
  if (m.state === "refunded")
    return { title: "Pots returned", detail: "Neither side finished, or the deck never opened." };
  if (m.state !== "finalized") return { title: "Settling", detail: "Each card pays when its window closes." };
  if (!m.winner) return { title: "A tie", detail: `${totals} · each pot returned` };
  const won = m.winner.toLowerCase() === me?.toLowerCase();
  const pot = usd(m.pot * 2n);
  return won
    ? { title: m.pot === 0n ? "You won" : `You won ${pot}`, detail: totals }
    : { title: "You lost the duel", detail: totals };
}

/** A pick's side in words. */
export const sideLabel = (band: number) => DUEL_SIDES.find((s) => s.band === band)?.label ?? "—";

/** The pick clock's tone: calm, then near in the last minute, late in the last 20 seconds. */
const NEAR_SEC = 60;
const LATE_SEC = 20;
export const clockTone = (leftSec: number): "calm" | "near" | "late" =>
  leftSec > NEAR_SEC ? "calm" : leftSec > LATE_SEC ? "near" : "late";

/** The other seat's address. */
export function opponentOf(m: DuelView, me: string | undefined): string | null {
  const seat = seatOf(m, me);
  return seat === null ? null : m.players[seat === 0 ? 1 : 0];
}

/** A seat's pick on a card, if placed. */
export const pickOn = (m: DuelView, seat: 0 | 1, card: number) =>
  m.picks.find((p) => p.seat === seat && p.card === card) ?? null;

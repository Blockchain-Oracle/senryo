/**
 * Yes/no events in words, both apps (S8.7, D-296). Labelled as what they are: Yes or No (never Up or Down), settled
 * by a named committee — never a price feed — and refunded whenever the committee doesn't agree in time.
 */
import type { CommitteeView, EventAnswerView, EventCallView, EventView } from "@senryo/api-client";
import { estimateEventPayout, statementHashOf } from "@senryo/chain";
import { leagueOf } from "@senryo/config";
import { usd } from "@senryo/core";

export const EVENT_SIDES = [
  { yes: true, label: "Yes" },
  { yes: false, label: "No" },
] as const;

export const sideWord = (yes: boolean) => (yes ? "Yes" : "No");

const PERCENT = 100n;
const BPS_PER_PERCENT = 100;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/** Yes's share of everything staked (0–100); null while nothing is. */
export function yesShare(e: Pick<EventView, "yesPool" | "noPool">): number | null {
  const total = e.yesPool + e.noPool;
  if (total === 0n) return null;
  const share = (e.yesPool * PERCENT) / total;
  return Number(share);
}

/** What `stake` on a side would return if that side wins with the pools as they are now (this stake included). */
export const estimateFor = (e: Pick<EventView, "yesPool" | "noPool" | "feeBps">, yes: boolean, stake: bigint) =>
  estimateEventPayout({ yes: e.yesPool, no: e.noPool }, yes, stake, e.feeBps);

export type EventPhase = "open" | "playing" | "answering" | "decided" | "voided";

/** Taking calls; under way (calls closed); waiting for the committee; settled; refunded. */
export function eventPhase(e: Pick<EventView, "state" | "closesAt" | "answerFrom">, nowSec: number): EventPhase {
  if (e.state === "decided") return "decided";
  if (e.state === "voided") return "voided";
  if (nowSec < e.closesAt) return "open";
  return nowSec < e.answerFrom ? "playing" : "answering";
}

/** "2d 4h", "3h 10m", "12m", "45s". */
export function spanText(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / SECONDS_PER_MINUTE);
  const h = Math.floor(m / MINUTES_PER_HOUR);
  const d = Math.floor(h / HOURS_PER_DAY);
  if (d > 0) return `${d}d ${h % HOURS_PER_DAY}h`;
  if (h > 0) return `${h}h ${m % MINUTES_PER_HOUR}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

const VOID_WORDS: Record<NonNullable<EventView["voidReason"]>, (answer: boolean | null) => string> = {
  disagreement: () => "Refunded · the signers disagreed",
  quorum: () => "Refunded · too few signers answered in time",
  "no-winners": (answer) => `Refunded · the answer was ${sideWord(answer ?? false)} and nobody called it`,
};

/** Where a question stands, in one line. */
export function statusLine(e: EventView, nowSec: number): string {
  switch (eventPhase(e, nowSec)) {
    case "open":
      return `Calls close in ${spanText(e.closesAt - nowSec)}`;
    case "playing":
      return "Under way · the committee answers once it's over";
    case "answering":
      return "Waiting for the committee";
    case "decided":
      return `Settled · ${sideWord(e.answer ?? false)}`;
    default:
      return e.voidReason ? VOID_WORDS[e.voidReason](e.answer) : "Refunded";
  }
}

export const leagueName = (key: string) => leagueOf(key)?.name ?? key.toUpperCase();

/** "Settled by 3 signers run by Senryo · 2 must agree, none disagree · not a price feed". */
export const committeeLine = (c: CommitteeView) =>
  `Settled by ${c.members.length} signers run by ${c.runBy} · ${c.quorum} must agree, none disagree · not a price feed`;

export const REFUND_RULE = "If they disagree, or too few answer in time, every call is refunded.";

/** "2 % of the losing side goes to the shared pool". */
export const feeLine = (feeBps: number) => `${feeBps / BPS_PER_PERCENT}% of the losing side goes to the shared pool`;

/** A call's line in "Your calls": its side and stake while open, then what it paid. */
export function callResultText(c: Pick<EventCallView, "status" | "stake" | "amount" | "yes">): string {
  if (c.status === "open") return `${sideWord(c.yes)} · ${usd(c.stake)}`;
  if (c.status === "won") return `Won ${usd(c.amount ?? 0n)}`;
  if (c.status === "refunded") return `Refunded ${usd(c.amount ?? c.stake)}`;
  return `Lost ${usd(c.stake)}`;
}

/** A member's statement re-hashed here: it must be what the chain recorded beside its answer. */
export const statementChecks = (a: Pick<EventAnswerView, "statement" | "statementHash">) =>
  statementHashOf(a.statement) === a.statementHash.toLowerCase();

/** What the member read, from its statement (the source and the result it saw). */
export function statementRead(a: Pick<EventAnswerView, "statement">): { source: string; read: string } | null {
  try {
    const s = JSON.parse(a.statement) as { source?: unknown; read?: unknown };
    return typeof s.source === "string" && typeof s.read === "string" ? { source: s.source, read: s.read } : null;
  } catch {
    return null;
  }
}

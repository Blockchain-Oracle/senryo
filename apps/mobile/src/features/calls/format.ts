/**
 * How a call reads everywhere (Calls rows, the receipt, the window proof): the side's name, the lane, dollar amounts,
 * the signed result, the state in one word and each timeline step in plain words. Money stays bigint until the text.
 */
import type { CallItem } from "@senryo/api-client";
import { formatUnits } from "@senryo/core";
import { formatUsd } from "~/features/terminal/chart/engine";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const E8 = 1e8;
const MS = 1_000;

export const SIDE: Readonly<Record<number, string>> = { 0: "Up", 1: "Down", 2: "Range", 3: "Moonshot", 4: "Crash" };
export const OPEN_STATES: ReadonlySet<string> = new Set(["committed", "open", "closing"]);

export const sideName = (band: number) => SIDE[band] ?? `Band ${band}`;

export function lane(cadenceSec: number): string {
  const minutes = cadenceSec / SECONDS_PER_MINUTE;
  return minutes >= MINUTES_PER_HOUR ? `${minutes / MINUTES_PER_HOUR}h` : `${minutes}m`;
}

/** `$5.00` — the magnitude; the sign is the caller's. */
export const usd = (v: bigint) => `$${formatUnits(v < 0n ? -v : v, DOLLAR_DECIMALS, CENTS)}`;

/** `+$4.60` / `−$0.40` / `$0.00`. */
export const signedUsd = (v: bigint) => `${v > 0n ? "+" : v < 0n ? "−" : ""}${usd(v)}`;

export type Tone = "up" | "down" | "muted";
export const toneOf = (v: bigint | null): Tone => (v === null || v === 0n ? "muted" : v > 0n ? "up" : "down");

/** A print or an entry price (e-8) as the terminal shows it. */
export const priceText = (e8: bigint) => formatUsd(Number(e8) / E8);

/** One word for where a finished or live call stands. */
export function stateWord(c: Pick<CallItem, "status" | "outcome">): string {
  if (c.status === "committed") return "Opening";
  if (c.status === "closing") return "Cashing out";
  if (c.status === "open") return "Live";
  if (c.status === "refunded" || c.outcome === "refund") return "Refunded";
  if (c.status === "closed") return "Cashed out";
  return c.outcome === "win" ? "Won" : "Lost";
}

/** A timeline step in words: what happened, with its amount and price where they mean something. */
export function stepTitle(kind: string, amount: bigint, priceE8: bigint | null): string {
  const at = priceE8 === null ? "" : ` at ${priceText(priceE8)}`;
  switch (kind) {
    case "committed":
      return `Placed ${usd(amount)}`;
    case "filled":
      return `Filled${at} · pays ${usd(amount)} if right`;
    case "refused":
      return "Refused · nothing taken";
    case "close requested":
      return "Cash-out asked";
    case "cashed out":
      return `Cashed out ${usd(amount)}${at}`;
    case "close refused":
      return "Cash-out refused · still live";
    case "settled: win":
      return `Won · ${usd(amount)} paid`;
    case "settled: refund":
      return `Refunded ${usd(amount)}`;
    case "settled: lose":
      return "Lost";
    default:
      return kind.charAt(0).toUpperCase() + kind.slice(1);
  }
}

/** `22:32:19` today, `8 Oct, 22:32` before. */
export function whenText(unixSec: number, now = Date.now()): string {
  const d = new Date(unixSec * MS);
  const today = new Date(now).toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : d.toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

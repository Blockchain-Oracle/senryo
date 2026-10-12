/**
 * The live book in words, one copy for both apps (R5.3): a position's title, its line under the title, and — when it
 * isn't simply live — why its figures or its close are held, in one plain sentence.
 */
import { laneLabel, usd } from "@senryo/core";
import type { BookEntry } from "./book.ts";

const MS = 1_000;
const LEVERAGE_ONE = 10_000;

/** "12:05", when a position ends, on this device's clock. */
export const endsText = (unixSec: number): string =>
  new Date(unixSec * MS).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** "BTC Up". */
export const positionTitle = (e: BookEntry): string => `${e.symbol} ${e.label}`;

/** "40×" for a ride. */
export const leverageText = (leverageBps: number): string => `${Math.round(leverageBps / LEVERAGE_ONE)}×`;

/** Under the title: "5m · settles 12:05" for a call, "40× · ends 15:58" for a ride. */
export function positionSub(e: BookEntry): string {
  const ends = e.endsAt === null ? "" : ` · ${e.kind === "ride" ? "ends" : "settles"} ${endsText(e.endsAt)}`;
  if (e.kind === "ride" && e.ride) return `${leverageText(e.ride.leverageBps)}${ends}`;
  if (e.call) return `${laneLabel(e.call.cadenceSec)}${ends}`;
  return e.endsAt === null ? "" : endsText(e.endsAt);
}

/** Why the position's close (or its figures) is held now; null when it's live and closable. */
export function positionHold(e: BookEntry): string | null {
  const at = e.endsAt === null ? "" : endsText(e.endsAt);
  switch (e.state) {
    case "live":
      return null;
    case "opening":
      return "Opening at the next price…";
    case "closing":
      return e.kind === "ride" ? "Closing at the next price…" : "Cashing out at the next price…";
    case "locked":
      return `Cash-out closed · result at ${at}`;
    case "too-sure":
      return `Too sure to price · pays ${usd(e.call?.shares ?? 0n)} at ${at}`;
    case "settling":
      return "Settling…";
    case "no-price":
      return "No live price right now";
  }
}

/** The close button's word: a call cashes out, a ride closes. */
export const closeWord = (e: BookEntry): string => (e.kind === "ride" ? "Close" : "Cash out");

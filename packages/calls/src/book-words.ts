/**
 * The live book in words, one copy for both apps (R5.3): when a position ends on this device's clock, a ride's
 * leverage and the close button's word. A live position's clock and state words are `position-live.ts` (D-343).
 */
import type { BookEntry } from "./book.ts";

const MS = 1_000;
const LEVERAGE_ONE = 10_000;

/** "12:05", when a position ends, on this device's clock. */
export const endsText = (unixSec: number): string =>
  new Date(unixSec * MS).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** "40×" for a ride. */
export const leverageText = (leverageBps: number): string => `${Math.round(leverageBps / LEVERAGE_ONE)}×`;

/** The close button's word: a call cashes out, a ride closes. */
export const closeWord = (e: BookEntry): string => (e.kind === "ride" ? "Close" : "Cash out");

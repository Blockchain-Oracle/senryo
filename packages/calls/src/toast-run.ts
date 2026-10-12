/**
 * One toast per trade, carried through its whole run (R5.11, Tradash): "Opening Up…" becomes "Up BTC opened", and a
 * close's "Cashing out…" becomes its result — "Realized +$1.24" with the market's mark — in place, by one id. Calls key
 * their close by ticket and rides by ride, so the result (`useResults`, `useRideResults`) lands on the same toast.
 */

export type TradeTone = "loading" | "info" | "warning";

/** A step of a trade's run as the app shows it (the app draws the market's mark from `symbol`). */
export interface TradeNote {
  title: string;
  description?: string;
  symbol: string;
  tone: TradeTone;
  /** One plain verb that waits on the toast ("Check status"): a toast with an action stays until it is used. */
  action?: { label: string; run: () => void };
}

let openSeq = 0;

export const tradeToastId = {
  /** An open has no id on chain until it fills: a fresh one per tap. */
  open: (): string => {
    openSeq += 1;
    return `trade-open-${openSeq}`;
  },
  call: (ticketId: bigint): string => `trade-call-${ticketId}`,
  ride: (rideId: bigint): string => `trade-ride-${rideId}`,
};

// The toasts whose result has landed (`useResults`, `useRideResults`): an earlier step that arrives late — the fill's
// "Counting it up…" after the realised amount — never overwrites it.
const resulted = new Set<string>();

export function tradeResulted(id: string): void {
  resulted.add(id);
}

export function tradeHasResult(id: string): boolean {
  return resulted.has(id);
}

// "$1.24", "+$9.60", "−$3,200.00": the amounts inside a toast's words.
const AMOUNT = /[+−-]?\$[\d,]+(?:\.\d+)?/g;

/** A note with its amounts swapped for `mask` (balances hidden, R5.14): the words stay, the money doesn't. */
export function maskedNote(note: TradeNote, mask: string): TradeNote {
  return {
    ...note,
    title: note.title.replace(AMOUNT, mask),
    ...(note.description ? { description: note.description.replace(AMOUNT, mask) } : {}),
  };
}

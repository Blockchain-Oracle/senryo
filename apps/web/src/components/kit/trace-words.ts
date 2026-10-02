/**
 * What an outcome calls its operation (the phone's `TraceWords`), so every money page shares one outcome contract
 * with its own nouns: a signed send the watch lost is "not confirmed yet" exactly like an order, never "nothing moved".
 */
export interface TraceWords {
  /** "order", "send", "withdrawal", "close". */
  thing: string;
  /** What not to do while it's unknown: "place it again", "send it again". */
  again: string;
  landed: string;
  reverted: string;
  done: string;
  back: string;
  leave: string;
  pending?: string;
  success?: string;
}

export const ORDER_WORDS: TraceWords = {
  thing: "order",
  again: "place it again",
  landed: "Confirmed — your position shows it.",
  reverted: "It reverted onchain. Only the network fee was paid.",
  done: "Done",
  back: "Back to ticket",
  leave: "You can leave — it continues and can’t be cancelled.",
  pending: "Placing order",
  success: "Order placed",
};

export const CLOSE_WORDS: TraceWords = {
  thing: "close",
  again: "close it again",
  landed: "Confirmed — your balance shows it.",
  reverted: "It reverted onchain. Only the network fee was paid.",
  done: "Done",
  back: "Back to position",
  leave: "You can leave — it continues and can’t be cancelled.",
  pending: "Closing",
  success: "Closed",
};

export const SEND_WORDS: TraceWords = {
  thing: "send",
  again: "send it again",
  landed: "Confirmed — it arrived.",
  reverted: "It reverted onchain. Only the network fee was paid.",
  done: "Done",
  back: "Back to review",
  leave: "You can leave — it continues and can’t be cancelled.",
  pending: "Sending",
  success: "Sent",
};

/** Plain words for a failed send (simulation reverts carry the decoded contract error). */
export function failureWords(error: unknown, thing = "trade"): string {
  if (!(error instanceof Error)) return `The ${thing} didn't go through. Nothing was sent.`;
  const first = error.message.split("\n")[0] ?? "";
  if (/SlippageExceeded/.test(first)) return "The price moved past your limit. Nothing was sent.";
  if (/InsufficientFreeCollateral/.test(first)) return "Not enough free at the new price. Nothing was sent.";
  if (/MarketNotOpen/.test(first)) return "The market just closed. Nothing was sent.";
  if (/\bPaused\b/.test(first)) return "Trading is paused. Closing still works. Nothing was sent.";
  if (/SettleOnly/.test(first)) return "Closing only: new positions are off. Nothing was sent.";
  if (/LossExceedsBalance/.test(first)) return "Close the profitable position first, or add money. Nothing was sent.";
  if (/MinHoldNotElapsed/.test(first)) return "Profit can be taken a few seconds after opening. Nothing was sent.";
  if (/Cancel|cancel/.test(first)) return "Cancelled — nothing was signed.";
  return first.length > 0 ? first : `The ${thing} didn't go through. Nothing was sent.`;
}

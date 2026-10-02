import type { TraceWords } from "~/features/trade/TradeTrace";

/** The nouns of the swap and bridge outcomes (B6, B9; the shared outcome contract, review S01). */
export const SWAP_WORDS: TraceWords = {
  thing: "swap",
  again: "swap it again",
  landed: "Confirmed — the tokens are in your wallet.",
  reverted: "It reverted onchain. Only the network fee was paid.",
  done: "Done",
  back: "Back to review",
  leave: "You can leave — it continues and can’t be cancelled.",
  pending: "Swapping",
  success: "Swapped",
};

export const BRIDGE_WORDS: TraceWords = {
  thing: "transfer",
  again: "send it again",
  landed: "Sent from Monad — it’s on its way.",
  reverted: "It reverted onchain. Only the network fee was paid.",
  done: "Done",
  back: "Back to review",
  leave: "You can leave — it continues and can’t be cancelled.",
  pending: "Sending",
  success: "Sent from Monad",
};

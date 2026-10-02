import type { TraceWords } from "~/features/trade/TradeTrace";

/** The card's nouns for the shared outcome surface (E1, E3, E4). */
export const LIMIT_WORDS: TraceWords = {
  thing: "limit change",
  again: "set it again",
  landed: "Confirmed — the new limit is live.",
  reverted: "It reverted onchain. Only the network fee was paid.",
  done: "Done",
  back: "Back to the limit",
  leave: "You can leave — it continues and can’t be cancelled.",
  pending: "Setting limit",
  success: "Limit set",
};

export const UNFREEZE_WORDS: TraceWords = {
  ...LIMIT_WORDS,
  back: "Back to unfreeze",
  pending: "Unfreezing",
  success: "Card active",
};

export const REPAY_WORDS: TraceWords = {
  thing: "repayment",
  again: "repay again",
  landed: "Confirmed — the debt is repaid.",
  reverted: "It reverted onchain. Only the network fee was paid.",
  done: "Done",
  back: "Back to repay",
  leave: "You can leave — it continues and can’t be cancelled.",
  pending: "Repaying",
  success: "Debt repaid",
};

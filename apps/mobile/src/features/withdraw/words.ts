import type { TraceWords } from "~/features/trade/TradeTrace";

/** The send and withdrawal nouns for the shared outcome surface (review S01; flow book B7/B8 copy). */
export const SEND_WORDS: TraceWords = {
  thing: "send",
  again: "send it again",
  landed: "Confirmed — the recipient has it.",
  reverted: "It reverted onchain. Only the network fee was paid.",
  done: "Send another",
  back: "Back to the send",
  leave: "You can leave — it continues and can’t be cancelled.",
  pending: "Sending",
  success: "Sent",
};

export const WITHDRAW_WORDS: TraceWords = {
  thing: "withdrawal",
  again: "withdraw again",
  landed: "Confirmed — it’s at the destination.",
  reverted: "It reverted onchain. Only the network fee was paid.",
  done: "Withdraw again",
  back: "Back to the withdrawal",
  leave: "You can leave — it continues and can’t be cancelled.",
  pending: "Withdrawing",
  success: "Withdrawn",
};

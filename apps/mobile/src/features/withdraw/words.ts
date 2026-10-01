import type { TraceWords } from "~/features/trade/TradeTrace";

/** The shared outcome contract's words for a send to someone else (review S01). */
export const SEND_WORDS: TraceWords = {
  thing: "send",
  again: "send it again",
  landed: "Confirmed: it was sent. The recipient has it.",
  reverted: "The send reverted onchain (gas was paid); the money stayed in your account.",
  done: "Send another",
  back: "Back to the send",
  leave: "You can leave this screen. The send is on its way and can’t be cancelled; its result shows in Activity.",
};

/** …and for a withdrawal to your own wallet. */
export const WITHDRAW_WORDS: TraceWords = {
  thing: "withdrawal",
  again: "withdraw again",
  landed: "Confirmed: it is in your wallet.",
  reverted: "The withdrawal reverted onchain (gas was paid); the money stayed in your account.",
  done: "Withdraw again",
  back: "Back to the withdrawal",
  leave:
    "You can leave this screen. The withdrawal is on its way and can’t be cancelled; its result shows in Activity.",
};

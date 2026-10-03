/**
 * The Practice swap (D-252, B6 (P), UNDEFINED-6 closed): test AUSD ↔ test USDC at par through our own PracticeSwap on
 * the test network. Not a market — no aggregator is asked, there is no price, no impact and nothing to re-quote: one
 * practice dollar for one, and Details names it "Practice swap · at par". Every other Practice pair keeps the lock
 * ("Swaps run on Mainnet"). The pair and its words live in `@senryo/query` (`practice-swap.ts`), shared with the web.
 */
import { PRACTICE_SWAP_ROUTE } from "@senryo/chain";
import { parStepUp as sharedParStepUp } from "@senryo/query";
import type { MoneyAsset } from "~/features/money/assets";
import { amountOf } from "~/features/money/format";

export { isParPair, parCounterpart, parRateText, parReceivables } from "@senryo/query";
export { PRACTICE_SWAP_ROUTE };

/** The step-up's words for a practice swap: the exact output, at par, Practice money, no value. */
export function parStepUp(pay: MoneyAsset, receive: MoneyAsset, amount: bigint) {
  return sharedParStepUp(amountOf(pay, amount), amountOf(receive, amount), receive.symbol);
}

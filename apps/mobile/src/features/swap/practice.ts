/**
 * The Practice swap (D-252, B6 (P), UNDEFINED-6 closed): test AUSD ↔ test USDC at par through our own PracticeSwap on
 * the test network. Not a market — no aggregator is asked, there is no price, no impact and nothing to re-quote: one
 * practice dollar for one, and Details names it "Practice swap · at par". Every other Practice pair keeps the lock
 * ("Swaps run on Mainnet").
 */
import { isDeployed, isPracticeSwapPair, PRACTICE_SWAP_ROUTE } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { type MoneyAsset, tradingOnlyAsset } from "~/features/money/assets";
import { amountOf } from "~/features/money/format";

export { PRACTICE_SWAP_ROUTE };

const NO_TRADING = { ausd: 0n, usdc: 0n, free: 0n } as const;

/** Is `pay → receive` the par pair on this network? */
export function isParPair(chainId: ChainId, pay: MoneyAsset, receive: MoneyAsset | undefined): boolean {
  return receive !== undefined && !pay.native && isPracticeSwapPair(chainId, pay.address, receive.address);
}

/**
 * Both practice dollars as receivable rows (zero balance when not held), so test USDC can be picked even before the
 * account holds any. Empty where no PracticeSwap is recorded (Mainnet).
 */
export function parReceivables(chainId: ChainId): MoneyAsset[] {
  if (!isDeployed(chainId, "PracticeSwap")) return [];
  return [tradingOnlyAsset(chainId, "AUSD", NO_TRADING), tradingOnlyAsset(chainId, "USDC", NO_TRADING)];
}

/** The other practice dollar of the pair, for the receive side's default when paying with one of them. */
export function parCounterpart(
  chainId: ChainId,
  pay: MoneyAsset,
  receivable: readonly MoneyAsset[],
): MoneyAsset | undefined {
  return receivable.find((a) => isParPair(chainId, pay, a));
}

/** "1 AUSD = 1 USDC" — par, in the receive token's own words. */
export function parRateText(pay: MoneyAsset, receive: MoneyAsset): string {
  return `1 ${pay.symbol} = 1 ${receive.symbol}`;
}

/** The step-up's words for a practice swap: the exact output, at par, Practice money. */
export function parStepUp(pay: MoneyAsset, receive: MoneyAsset, amount: bigint) {
  const paid = amountOf(pay, amount);
  return {
    title: `Swap ${paid} for ${receive.symbol}`,
    detail: `${amountOf(receive, amount)} at par · Practice money, no value. Swaps always ask for a fresh passkey check.`,
    confirmLabel: "Swap with passkey",
  };
}

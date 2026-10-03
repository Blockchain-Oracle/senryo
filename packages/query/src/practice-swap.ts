/**
 * Practice AUSD ↔ USDC at par (D-252, flow book B6 (P)): the composed steps of a practice swap — for the swap ticket
 * and for "Pay with" in Practice — through `@senryo/chain`'s par swap on the active network, and the pair's words both
 * apps show. Nothing to quote and nothing to re-quote: par is fixed by the contract, so what is reviewed is exactly
 * what is signed. Every other Practice pair keeps the lock ("Swaps run on Mainnet").
 */
import { isDeployed, isPracticeSwapPair, preparePracticeSwap } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import type { Address } from "@senryo/core";
import type { ComposedStep, StepRole } from "./compose.ts";
import type { QueryEnv } from "./env.tsx";
import { type MoneyAsset, tradingOnlyAsset } from "./money-assets.ts";

const NO_TRADING = { ausd: 0n, usdc: 0n, free: 0n } as const;

/** The par swap's steps from `owner`'s account: ["Approve AUSD"?, "Swap AUSD → USDC"], read from the chain now. */
export async function practiceSwapLeg(
  env: QueryEnv,
  owner: Address,
  tokenIn: Address,
  amountIn: bigint,
  label: { approve: string; swap: string },
  role: StepRole,
): Promise<ComposedStep[]> {
  const requests = await preparePracticeSwap(env.read, owner, {
    chainId: env.chainId,
    tokenIn,
    amountIn,
    recipient: owner,
  });
  return requests.map((request, i) => ({
    role,
    action: request.action,
    label: i === requests.length - 1 ? label.swap : label.approve,
    request,
  }));
}

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
export function parRateText(pay: Pick<MoneyAsset, "symbol">, receive: Pick<MoneyAsset, "symbol">): string {
  return `1 ${pay.symbol} = 1 ${receive.symbol}`;
}

/** The step-up's words for a practice swap: the exact output, at par, Practice money ("12.50 AUSD" in, out). */
export function parStepUp(paid: string, received: string, receiveSymbol: string) {
  return {
    title: `Swap ${paid} for ${receiveSymbol}`,
    detail: `${received} at par · Practice money, no value. Swaps always ask for a fresh passkey check.`,
    confirmLabel: "Swap with passkey",
  };
}

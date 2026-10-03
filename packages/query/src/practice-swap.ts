/**
 * Practice AUSD ↔ USDC at par (D-252, flow book B6 (P)): the composed steps of a practice swap — for the swap ticket
 * and for "Pay with" in Practice — through `@senryo/chain`'s par swap on the active network. Nothing to quote and
 * nothing to re-quote: par is fixed by the contract, so what is reviewed is exactly what is signed.
 */
import { preparePracticeSwap } from "@senryo/chain";
import type { Address } from "@senryo/core";
import type { ComposedStep, StepRole } from "./compose.ts";
import type { QueryEnv } from "./env.tsx";

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

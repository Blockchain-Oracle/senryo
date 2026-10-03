/**
 * A pool deposit as ONE composed operation (flow book D1 steps 2–6; B0.4): paying with AUSD it takes the wallet first,
 * then the free trading part (withdrawn to self) → approve (exact, when the allowance is short) → deposit; paying with
 * any other verified holding (Mainnet) it swaps to AUSD first — the swap's minimum covers the deposit, re-quoted right
 * before it signs — then approve → deposit. Within the session's move cap an AUSD-only deposit signs in session; a swap
 * leg or a deposit above the cap asks for one passkey that signs every step (rule 11, defect 13).
 */
import { readAccountSnapshot, readLpVault, type TxRequest } from "@senryo/chain";
import { type ChainId, positionCount } from "@senryo/config";
import {
  type ComposedStep,
  composeSteps,
  lpApproveRequest,
  lpDepositRequest,
  maxWithdrawable,
  type QueryEnv,
  withdrawRequest,
} from "@senryo/query";
import type { MoneyAsset } from "~/features/money/assets";
import { type PaySwap, parPaySteps, payIntent, paySwapSteps } from "~/features/money/pay-with";
import type { MoneyOperation } from "~/features/money/useMoneyOperation";
import { usd } from "~/lib/money";

export interface PoolDeposit {
  amountUsd6: bigint;
  payWith: MoneyAsset;
  swap: PaySwap;
  vault: `0x${string}`;
  allowance: bigint;
  /** The account's position bitmap (sizes a pull from trades). */
  positionBitmap: number;
  passkey: boolean;
}

/** The planned steps of a reviewed deposit, in order. */
export async function poolDepositSteps(
  env: QueryEnv,
  me: `0x${string}`,
  d: PoolDeposit,
): Promise<ComposedStep[] | undefined> {
  const approve: ComposedStep[] =
    d.allowance < d.amountUsd6
      ? [
          {
            action: "approve",
            label: "Approve AUSD",
            request: lpApproveRequest(env.chainId as ChainId, d.vault, d.amountUsd6),
          },
        ]
      : [];
  const act: ComposedStep[] = [
    ...approve,
    { action: "lpDeposit", label: "Deposit", request: lpDepositRequest(env.chainId as ChainId, d.amountUsd6, me) },
  ];
  if (d.payWith.collateral === "AUSD") {
    const fromWallet = d.amountUsd6 < d.payWith.wallet ? d.amountUsd6 : d.payWith.wallet;
    const fromTrading = d.amountUsd6 - fromWallet;
    const pull: ComposedStep[] =
      fromTrading > 0n
        ? [
            {
              action: "withdraw",
              label: "Pull from trades",
              request: withdrawRequest(
                env.chainId as ChainId,
                "AUSD",
                fromTrading,
                me,
                positionCount(d.positionBitmap),
              ) as TxRequest,
            },
          ]
        : [];
    return composeSteps({ pull, act });
  }
  if (d.swap.status === "par")
    return composeSteps({ swap: await parPaySteps(env, me, d.payWith, d.swap.amountIn), act });
  if (d.swap.status !== "ok") return undefined;
  return composeSteps({ swap: await paySwapSteps(env, me, d.payWith, d.swap.quote), act });
}

/** The operation the slide signs: the steps, the reviewed facts, the checks before each step, the step-up if any. */
export function poolDepositOperation(
  env: QueryEnv,
  me: `0x${string}`,
  d: PoolDeposit,
  steps: ComposedStep[],
  guard: () => void,
): MoneyOperation {
  const swapping = d.payWith.collateral !== "AUSD";
  return {
    steps,
    reviewedIntent: {
      kind: "lpDeposit",
      amount: d.amountUsd6.toString(),
      symbol: "AUSD",
      decimals: "6",
      destination: "pool",
      source: swapping ? "swap" : d.payWith.wallet >= d.amountUsd6 ? "wallet" : "wallet+trading",
      ...payIntent(d.payWith, d.swap),
    },
    spends: {
      [d.payWith.key]: swapping && (d.swap.status === "ok" || d.swap.status === "par") ? d.swap.amountIn : d.amountUsd6,
    },
    // Before the first step: the pool's room and the paying balance; before the deposit: the AUSD it needs.
    revalidate: async (index) => {
      guard();
      const pool = await readLpVault(env.read, env.chainId, me);
      if (d.amountUsd6 > pool.maxDeposit) throw new Error("The pool capacity changed. Review again.");
      if (index === 0 && !swapping) {
        const account = await readAccountSnapshot(env.read, env.chainId, me, "latest");
        if (pool.walletAusd + maxWithdrawable(account, "AUSD") < d.amountUsd6)
          throw new Error("Your balance changed. Review again.");
      }
      guard();
    },
    ...(d.passkey || swapping
      ? {
          stepUp: {
            title: `Deposit ${usd(d.amountUsd6)} into the pool`,
            detail: swapping
              ? `Paid with ${d.payWith.symbol}, swapped to AUSD first. One passkey signs every step.`
              : "Above the session's limit: one passkey signs every step.",
            confirmLabel: "Deposit with passkey",
          },
        }
      : {}),
  };
}

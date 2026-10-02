/**
 * A reviewed move of any asset on Monad (B7 send, B8 withdraw to an address): the frozen intent, the steps, the fee
 * budget, and the checks that run again right before each signature — the balance at its source (wallet and the free
 * trading part, MON keeping its 10 MON floor), the @handle still resolving to the same address, and the recipient
 * checks (an inbox or a typo blocks even if the review missed it). Sends to anyone are outside the session's scope:
 * one passkey step-up signs every step.
 */
import { profileGetRoute } from "@senryo/api-client";
import { erc20Abi } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { formatUnits } from "@senryo/core";
import { gasBudgetFor, type QueryEnv } from "@senryo/query";
import { MON_RESERVE_WEI, type MoneyAsset } from "~/features/money/assets";
import { exactAmount } from "~/features/money/format";
import { checkRecipient, RECIPIENT_WORDS } from "~/features/money/recipient";
import { moveSteps, splitSource } from "~/features/money/requests";
import type { MoneyOperation, PlannedStep } from "~/features/money/useMoneyOperation";
import { validateMoney } from "~/lib/validate-money";

const MON_DECIMALS = 18;
const FEE_SHOWN_DECIMALS = 4;

export interface ReviewedMove {
  kind: "send" | "withdraw";
  asset: MoneyAsset;
  amount: bigint;
  to: `0x${string}`;
  handle: string | null;
  /** "@kai", "Coinbase", "0x12…ab". */
  label: string;
  steps: PlannedStep[];
  /** Identity of the reviewed intent (review guard, slide reset). */
  key: string;
}

export function reviewMove(
  chainId: ChainId,
  kind: ReviewedMove["kind"],
  asset: MoneyAsset,
  amount: bigint,
  to: `0x${string}`,
  handle: string | null,
  label: string,
  positionBitmap: number,
): ReviewedMove {
  return {
    kind,
    asset,
    amount,
    to,
    handle,
    label,
    steps: moveSteps(chainId, asset, amount, to, positionBitmap, kind),
    key: [chainId, kind, asset.key, amount, to.toLowerCase(), handle ?? ""].join(":"),
  };
}

/** "~0.0031 MON" for the review (Σ limit × max fee of every step). */
export async function feeEstimate(env: QueryEnv, me: `0x${string}`, move: ReviewedMove): Promise<string> {
  const budgets = await Promise.all(move.steps.map((s) => gasBudgetFor(env.read, me, s.request)));
  const wei = budgets.reduce((sum, b) => sum + b.needWei, 0n);
  return `~${formatUnits(wei, MON_DECIMALS, FEE_SHOWN_DECIMALS)} MON`;
}

export function moveOperation(
  env: QueryEnv,
  me: `0x${string}`,
  move: ReviewedMove,
  network: string,
  known: ReadonlySet<string>,
  guard: () => void,
): MoneyOperation {
  const { asset, amount, to } = move;
  const split = splitSource(asset, amount);
  const exact = exactAmount(asset, amount);
  return {
    steps: move.steps,
    reviewedIntent: {
      kind: move.kind,
      symbol: asset.symbol,
      asset: asset.key,
      decimals: String(asset.decimals),
      amount: amount.toString(),
      recipient: to,
      recipientLabel: move.label,
      network,
      source: split.trading > 0n ? (split.wallet > 0n ? "wallet+trading" : "trading") : "wallet",
    },
    stepUp: {
      title: `${move.kind === "send" ? "Send" : "Withdraw"} ${exact}`,
      detail: `To ${move.label === to ? "" : `${move.label} · `}${to} on ${network}. Money leaving your account always asks for a fresh passkey check.`,
      confirmLabel: move.kind === "send" ? "Send with passkey" : "Withdraw with passkey",
    },
    revalidate: async () => {
      guard();
      if (split.wallet > 0n) {
        const balance = asset.native
          ? await env.read.getBalance({ address: me, blockTag: "latest" })
          : await env.read.readContract({
              address: asset.address,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [me],
              blockTag: "latest",
            });
        if (balance < split.wallet) throw new Error("The balance changed. Review again.");
        if (asset.native && balance - split.wallet < MON_RESERVE_WEI) throw new Error("Keep 10 MON for fees.");
      }
      if (split.trading > 0n && asset.collateral) {
        await validateMoney(env, me, "trading", asset.collateral, split.trading);
      }
      if (move.handle) {
        const current = await env.api.call(profileGetRoute, {
          params: { handleOrAddress: move.handle },
          query: { chainId: env.chainId },
        });
        if (current.address.toLowerCase() !== to.toLowerCase()) throw new Error("The recipient changed. Review again.");
      }
      const check = await checkRecipient(env.read, env.chainId, me, to, known);
      if (check.block) throw new Error(RECIPIENT_WORDS[check.block]);
      guard();
    },
  };
}

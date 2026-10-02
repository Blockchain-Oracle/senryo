/**
 * One intent, one confirmation (flow book B0.4–B0.6, rules 4–5): a reviewed money operation is an ordered list of
 * steps — [pull from trades] → [approve] → act — signed under ONE slide and, outside the session's scope, ONE passkey
 * step-up. Every step is journalled under the same operation (`plannedActions`, `reviewedIntent`), so a failure after
 * earlier steps is `partial` and a kill mid-way resumes as that same row. A step's request may be built at the last
 * moment (a fresh swap or bridge quote replaces stale calldata only if it still meets the reviewed minimum). It never
 * resends: a failure goes back to review, an unknown outcome offers nothing new until the journal settles it.
 */
import type { TxRequest } from "@senryo/chain";
import type { GasAction } from "@senryo/config";
import { gasBudgetFor, type TrackedResult, useQueryEnv, useSendTrace } from "@senryo/query";
import { useCallback, useState } from "react";
import { useEnsureGas } from "~/features/trade/useGasTopUp";
import { useAccount } from "~/lib/account/provider";
import { stepUpSender, userSender } from "~/lib/account/sender";
import { requestStepUp, type StepUpIntent } from "~/lib/account/step-up";
import { useNetwork } from "~/lib/network";

export interface PlannedStep {
  /** The journal action of the request this step sends. */
  action: GasAction;
  /** Shown in Details ("Pull from trades", "Approve USDC", "Send"). */
  label: string;
  /** The review-time request (for the fee budget); `build` may replace it at signing time. */
  request: TxRequest;
  /** Rebuilds the request just before signing (a re-quote); defaults to `request`. */
  build?: () => Promise<TxRequest>;
}

export interface MoneyOperation {
  steps: PlannedStep[];
  /** The facts the receipt and Activity show, frozen at review (strings only). */
  reviewedIntent: Record<string, string>;
  /**
   * Re-checks reviewed scope, balances and quotes right before each step's signature; throws to stop. `stepIndex`
   * tells which step is about to sign: source balances are checked before the first only, because the operation's
   * own earlier steps (a pull from trades, a swap) legitimately move them.
   */
  revalidate: (stepIndex: number) => Promise<void>;
  /** Present → outside the session's scope: one passkey step-up signs every step. */
  stepUp?: StepUpIntent | undefined;
}

export type FeeCheck = { ok: true } | { ok: false; shortWei: bigint };

export function useMoneyOperation(traceKey: string) {
  const env = useQueryEnv();
  const network = useNetwork();
  const account = useAccount();
  const trace = useSendTrace(traceKey);
  const gas = useEnsureGas();
  const [step, setStep] = useState<{ index: number; count: number; label: string }>();

  /**
   * Mainnet pays its own fees in MON: Σ (limit × max fee) of every step plus any MON value must be on the account
   * before the passkey is asked for (B11; SwapTicket's missing preflight). Practice tops up through the sponsor.
   */
  const checkFees = useCallback(
    async (op: Pick<MoneyOperation, "steps">): Promise<FeeCheck> => {
      const address = account.hint?.address;
      if (!address || network.key === "testnet") return { ok: true };
      const budgets = await Promise.all(op.steps.map((s) => gasBudgetFor(env.read, address, s.request)));
      const need = budgets.reduce((sum, b) => sum + b.needWei, 0n);
      const value = op.steps.reduce((sum, s) => sum + (s.request.value ?? 0n), 0n);
      const balance = await env.read.getBalance({ address, blockTag: "latest" });
      return balance >= need + value ? { ok: true } : { ok: false, shortWei: need + value - balance };
    },
    [account.hint?.address, env.read, network.key],
  );

  const run = useCallback(
    async (op: MoneyOperation): Promise<TrackedResult | undefined> => {
      const client = account.client;
      const address = account.hint?.address;
      if (!client || !address || op.steps.length === 0) return undefined;
      const plannedActions = op.steps.map((s) => s.action);
      const practice = network.key === "testnet";
      const runAll = async (sender: Parameters<typeof trace.run>[0]) => {
        let operationId: string | undefined;
        let last: TrackedResult | undefined;
        for (const [index, s] of op.steps.entries()) {
          setStep({ index, count: op.steps.length, label: s.label });
          last = await trace.run(sender, s.build ?? s.request, {
            operationId,
            plannedActions,
            builderAction: s.action,
            reviewedIntent: { ...op.reviewedIntent, steps: op.steps.map((x) => x.label).join(" · ") },
            revalidate: () => op.revalidate(index),
            // Practice fees are sponsored: top up before each step when the balance is short.
            ...(practice ? { preflight: gas.preflight(s.request) } : {}),
          });
          operationId = last?.operationId ?? operationId;
          if (last?.final?.stage !== "finalized") return last;
        }
        return last;
      };
      if (!op.stepUp) return runAll(userSender(client, address, account.settings.faceId));
      return requestStepUp(op.stepUp, () => account.stepUp((signer) => runAll(stepUpSender(signer))));
    },
    [account, gas, network.key, trace],
  );

  return {
    trace,
    step,
    checkFees,
    run,
    reset: () => {
      trace.reset();
      setStep(undefined);
    },
  };
}

export type MoneyOperationRunner = ReturnType<typeof useMoneyOperation>;

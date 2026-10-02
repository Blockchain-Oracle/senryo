"use client";

/**
 * One intent, one confirmation (flow book rules 4–5; the phone's `useMoneyOperation`): a reviewed money operation is
 * an ordered list of steps — [pull from trades] → act — signed under ONE slide and, outside the session's scope, ONE
 * passkey step-up. Every step is journalled under the same operation, so a failure after earlier steps is `partial`.
 * It never resends: a failure goes back to review, an unknown outcome offers nothing new until the journal settles it.
 * Practice network fees are topped up by the sponsor before each step.
 */
import type { TxRequest } from "@senryo/chain";
import type { GasAction } from "@senryo/config";
import { type TrackedResult, useSendTrace } from "@senryo/query";
import { useCallback, useState } from "react";
import { type StepUpIntent, useStepUp } from "@/components/auth/step-up";
import { useAccount } from "@/lib/account/provider";
import { stepUpSender, userSender } from "@/lib/account/sender";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { useEnsureGas } from "@/lib/trade/use-gas-top-up";

export interface PlannedStep {
  action: GasAction;
  /** Shown in Details ("Pull from trades", "Send"). */
  label: string;
  request: TxRequest;
  build?: () => Promise<TxRequest>;
}

export interface MoneyOperation {
  steps: PlannedStep[];
  /** The facts the receipt shows, frozen at review (strings only). */
  reviewedIntent: Record<string, string>;
  /** Re-checks reviewed scope and balances right before each step's signature; throws to stop. */
  revalidate: (stepIndex: number) => Promise<void>;
  /** Present → outside the session's scope: one passkey step-up signs every step. */
  stepUp?: StepUpIntent | undefined;
}

export function useMoneyOperation(traceKey: string) {
  const account = useAccount();
  const trace = useSendTrace(traceKey);
  const gas = useEnsureGas();
  const stepUp = useStepUp();
  const [step, setStep] = useState<{ index: number; count: number; label: string }>();

  const run = useCallback(
    async (op: MoneyOperation): Promise<TrackedResult | undefined> => {
      const client = account.client;
      const address = account.hint?.address;
      if (!client || !address || op.steps.length === 0) return undefined;
      const plannedActions = op.steps.map((s) => s.action);
      const practice = ACTIVE_NETWORK.key === "testnet";
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
            ...(practice ? { preflight: (request: TxRequest) => gas.preflight(request)() } : {}),
          });
          operationId = last?.operationId ?? operationId;
          if (last?.final?.stage !== "finalized") return last;
        }
        return last;
      };
      if (!op.stepUp) return runAll(userSender(client, address, account.settings.faceId));
      return stepUp.confirm(op.stepUp, () => account.stepUp((signer) => runAll(stepUpSender(signer))));
    },
    [account, gas, stepUp, trace],
  );

  return {
    trace,
    step,
    run,
    reset: () => {
      trace.reset();
      setStep(undefined);
    },
  };
}

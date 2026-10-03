"use client";

/**
 * One intent, one confirmation (flow book rules 4–5, B0.4–B0.6, B11; the phone's `useMoneyOperation`): a reviewed money
 * operation is an ordered list of steps — [network fee] → [pull from trades] → [swap] → [move] → act (`@senryo/query`
 * compose.ts) — signed under ONE slide and, outside the session's scope, ONE passkey step-up. Every step is journalled
 * under the same operation, so a failure after earlier steps is `partial`; it stops at the first step that doesn't
 * finalize and never resends: a failure goes back to review, an unknown outcome offers nothing new until the journal
 * settles it.
 *
 * Mainnet pays its own fees in MON (B11): `prepare` plans them before review (`@senryo/query` money-operation.ts) —
 * covered by the account's MON, or "swap ~$0.50 of a dollar asset to MON" prepended as steps of the same operation
 * (Details: "Network fee"), or the named shortfall. Practice fees are topped up by the sponsor before each step.
 */
import type { TxRequest } from "@senryo/chain";
import { MAINNET_CHAIN_ID } from "@senryo/config";
import {
  type ComposedStep,
  type MoneyOperation,
  type PreparedOperation,
  prepareMoneyOperation,
  runOperationSteps,
  type TrackedResult,
  useQueryEnv,
  useSendTrace,
} from "@senryo/query";
import { useCallback, useState } from "react";
import { useStepUp } from "@/components/auth/step-up";
import { useAccount } from "@/lib/account/provider";
import { stepUpSender, userSender } from "@/lib/account/sender";
import { useEnsureGas } from "@/lib/trade/use-gas-top-up";
import { useMoneyAssets } from "./use-money-assets";

export { type MoneyOperation, type PreparedOperation, usePreparedOperation } from "@senryo/query";
export type PlannedStep = ComposedStep;

export function useMoneyOperation(traceKey: string) {
  const env = useQueryEnv();
  const account = useAccount();
  const money = useMoneyAssets(account.hint?.address);
  const trace = useSendTrace(traceKey);
  const gas = useEnsureGas();
  const stepUp = useStepUp();
  const [step, setStep] = useState<{ index: number; count: number; label: string }>();

  /** B11 before review: the network fee is on the account, or composed first, or named (never a dead end). */
  const prepare = useCallback(
    async (op: MoneyOperation): Promise<PreparedOperation> => {
      const address = account.hint?.address;
      if (!address) return { ok: false, block: "Choose an account first" };
      return prepareMoneyOperation(env, address, op, money.assets);
    },
    [account.hint?.address, env, money.assets],
  );

  const run = useCallback(
    async (op: MoneyOperation): Promise<TrackedResult | undefined> => {
      const client = account.client;
      const address = account.hint?.address;
      if (!client || !address || op.steps.length === 0) return undefined;
      const practice = env.chainId !== MAINNET_CHAIN_ID;
      const runAll = (sender: Parameters<typeof trace.run>[0]) =>
        runOperationSteps<TrackedResult>(
          op.steps,
          op.reviewedIntent,
          (s, index, options) => {
            setStep({ index, count: op.steps.length, label: s.label });
            const request: TxRequest | (() => Promise<TxRequest>) = s.build ?? s.request;
            return trace.run(sender, request, {
              ...options,
              revalidate: () => op.revalidate(index),
              // Practice fees are sponsored: top up before each step when the balance is short.
              ...(practice ? { preflight: gas.preflight(s.request) } : {}),
            });
          },
          { read: env.read },
        );
      if (!op.stepUp) return runAll(userSender(client, address, account.settings.faceId));
      return stepUp.confirm(op.stepUp, () => account.stepUp((signer) => runAll(stepUpSender(signer))));
    },
    [account, env.chainId, env.read, gas, stepUp, trace],
  );

  return {
    trace,
    step,
    prepare,
    run,
    reset: () => {
      trace.reset();
      setStep(undefined);
    },
  };
}

export type MoneyOperationRunner = ReturnType<typeof useMoneyOperation>;

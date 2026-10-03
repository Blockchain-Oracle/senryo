/**
 * One intent, one confirmation (flow book B0.4–B0.6, B11, rules 4–5): a reviewed money operation is an ordered list of
 * steps — [network fee] → [pull from trades] → [swap] → [move] → act (`@senryo/query` compose.ts) — signed under ONE
 * slide and, outside the session's scope, ONE passkey step-up. Every step is journalled under the same operation
 * (`plannedActions`, `reviewedIntent`), so a failure after earlier steps is `partial` and a kill mid-way resumes as that
 * same row. A step's request may be built at the last moment (a fresh swap or bridge quote replaces stale calldata only
 * if it still meets the reviewed minimum). It never resends: a failure goes back to review, an unknown outcome offers
 * nothing new until the journal settles it.
 *
 * Mainnet pays its own fees in MON (B11): `prepare` plans them before review — covered by the account's MON, or
 * "swap ~$0.50 of a dollar asset to MON" prepended as steps of the same operation (Details: "Network fee"), or a named
 * reason when neither works. Practice is sponsored: the sponsor tops up before each step.
 */
import type { TxRequest } from "@senryo/chain";
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
import { useEnsureGas } from "~/features/trade/useGasTopUp";
import { useAccount } from "~/lib/account/provider";
import { stepUpSender, userSender } from "~/lib/account/sender";
import { requestStepUp } from "~/lib/account/step-up";
import { useNetwork } from "~/lib/network";
import { useMoneyAssets } from "./useMoneyAssets";

// The operation's shape, its fee plan and the prepared-review hook are shared with the web (`@senryo/query`
// money-operation.ts); this hook is the phone's signer and journal for it.
export { feeSources, type MoneyOperation, type PreparedOperation, usePreparedOperation } from "@senryo/query";
export type PlannedStep = ComposedStep;

export function useMoneyOperation(traceKey: string) {
  const env = useQueryEnv();
  const network = useNetwork();
  const account = useAccount();
  const money = useMoneyAssets();
  const trace = useSendTrace(traceKey);
  const gas = useEnsureGas();
  const [step, setStep] = useState<{ index: number; count: number; label: string }>();

  /**
   * B11 before review: on Mainnet the operation's fee (Σ limit × max fee of every step, plus MON value) is either on
   * the account, or the "~$0.50 → MON" top-up steps go first in the same operation, or the reason it can't be paid.
   */
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
      const practice = network.key === "testnet";
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
      return requestStepUp(op.stepUp, () => account.stepUp((signer) => runAll(stepUpSender(signer))));
    },
    [account, env.read, gas, network.key, trace],
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

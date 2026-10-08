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
  assertReviewedSource,
  type ComposedStep,
  type MoneyOperation,
  type PreparedOperation,
  prepareMoneyOperation,
  runOperationSteps,
  type TrackedResult,
  useQueryEnv,
  useSendTrace,
} from "@senryo/query";
import { usePathname } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { useEnsureGas } from "~/features/trade/useGasTopUp";
import { useAccount } from "~/lib/account/provider";
import { stepUpSender, userSender } from "~/lib/account/sender";
import { requestStepUp } from "~/lib/account/step-up";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { useReviewGuard } from "~/lib/review-guard";
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
  const pathname = usePathname();
  const running = useRef(false);
  const origin = useRef(pathname);
  // The expected approval sheet belongs to this run. Every other route change abandons an unsent review.
  const route = pathname === ROUTES.stepUp && running.current ? origin.current : pathname;
  origin.current = route;
  const source = `${env.chainId}:${account.hint?.address.toLowerCase() ?? "guest"}:${route}`;
  const guard = useReviewGuard(source);
  const reviewSerial = useRef(0);
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
      guard();
      await op.revalidate(0);
      guard();
      const frozen: MoneyOperation = {
        ...op,
        reviewedIntent: {
          ...op.reviewedIntent,
          sourceAccount: address,
          sourceChainId: String(env.chainId),
          reviewGeneration: guard.key,
          reviewId: `${guard.key}:${++reviewSerial.current}`,
        },
        revalidate: async (index) => {
          guard();
          await op.revalidate(index);
          guard();
        },
      };
      const result = await prepareMoneyOperation(env, address, frozen, money.assets);
      guard();
      return result;
    },
    [account.hint?.address, env, money.assets, guard.key],
  );

  const run = useCallback(
    async (op: MoneyOperation): Promise<TrackedResult | undefined> => {
      if (running.current) return undefined;
      running.current = true;
      try {
        const client = account.client;
        const address = account.hint?.address;
        if (!client || !address || op.steps.length === 0) return undefined;
        guard();
        assertReviewedSource(op.reviewedIntent, address, env.chainId, guard.key);
        await op.revalidate(0);
        guard();
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
                revalidate: async () => {
                  guard();
                  await op.revalidate(index);
                  guard();
                },
                // Practice fees are sponsored: top up before each step when the balance is short.
                ...(practice ? { preflight: gas.preflight(s.request) } : {}),
              });
            },
            { read: env.read },
          );
        if (!op.stepUp) return await runAll(userSender(client, address, account.settings.faceId));
        return await requestStepUp(op.stepUp, () => {
          guard();
          return account.stepUp((signer) => {
            guard();
            return runAll(stepUpSender(signer));
          });
        });
      } finally {
        running.current = false;
      }
    },
    [account, env.read, gas, network.key, trace, guard.key],
  );

  return {
    trace,
    reviewKey: guard.key,
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

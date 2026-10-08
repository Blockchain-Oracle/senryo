/**
 * Runs one reviewed Perpl journey (`perplOpenOperation` / `perplCloseOperation` / `perplWithdrawOperation`, D1) as ONE
 * operation: every step goes through `trace.run(sender, step, …)` under the same journal record (`operationId`,
 * `plannedActions`, `reviewedIntent`), signed by the session or — when the slide named it — by one passkey step-up
 * that signs every leg; in Practice each step first tops the wallet's MON up to its budget. The order step is a builder: it reads the head block right before signing (the 20-block
 * window counts from there), and the signed bytes are checked against that window before they are broadcast, so an
 * order the user took too long to confirm is never sent to revert. A failure stops the journey and is never resent;
 * an unknown outcome blocks a new run until the journal settles it (useSendTrace).
 */
import { authFailureCopy, classifyAuthError, isSilent } from "@senryo/account";
import type { Sender, TxRequest } from "@senryo/chain";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import {
  type PerplPlan,
  type PerplStep,
  perplReadOf,
  type TrackedResult,
  useQueryEnv,
  useSendTrace,
} from "@senryo/query";
import { useCallback, useState, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import type { ConfirmLevel } from "~/features/trade/confirm-level";
import { useEnsureGas } from "~/features/trade/useGasTopUp";
import { useAccount } from "~/lib/account/provider";
import { stepUpSender, userSender } from "~/lib/account/sender";
import { notify } from "~/lib/notify";

/** The order must still have this many blocks of its window left when it is broadcast (~1 s of inclusion). */
const DEADLINE_MARGIN_BLOCKS = 3n;

/**
 * Journeys running now, by trace key — outside React like the trace itself, so a ticket closed and reopened mid-run
 * still knows a finalized approve is not the end of the operation.
 */
const activeKeys = new Set<string>();
const activeListeners = new Set<() => void>();
function setActiveKey(key: string, on: boolean): void {
  if (on) activeKeys.add(key);
  else activeKeys.delete(key);
  for (const listener of activeListeners) listener();
}
function subscribeActive(listener: () => void): () => void {
  activeListeners.add(listener);
  return () => {
    activeListeners.delete(listener);
  };
}

export interface PerplRun {
  plan: PerplPlan;
  reviewedNetworkFeesWei?: readonly bigint[];
  /** One label per step for the outcome and Details ("Approve AUSD", "Open Perpl account", "Order"). */
  labels: readonly string[];
  reviewedIntent: Record<string, string>;
  confirmWith: ConfirmLevel;
  /** The Perpl market's label for the Face ID prompt ("Bitcoin"). */
  marketLabel?: string | undefined;
  /** Re-checks the reviewed intent right before a step signs; throws to stop. */
  revalidate: (stepIndex: number) => Promise<void>;
}

export function usePerplRun(traceKey: string) {
  const env = useQueryEnv();
  const account = useAccount();
  const trace = useSendTrace(traceKey);
  const ensureGas = useEnsureGas();
  const [step, setStep] = useState<{ index: number; count: number; label: string }>();
  /** True from the slide until the last step returns: a finalized step with more to come is not the end. */
  const active = useSyncExternalStore(
    subscribeActive,
    () => activeKeys.has(traceKey),
    () => activeKeys.has(traceKey),
  );

  /** The order request with a broadcast check: the head must still be inside its `lastExecutionBlock`. */
  const timed = useCallback(
    (build: () => Promise<TxRequest>) => async (): Promise<TxRequest> => {
      const request = await build();
      const last = BigInt(request.meta?.lastExecutionBlock ?? "0");
      return {
        ...request,
        validate: async () => {
          await request.validate?.();
          if (last === 0n) return;
          const head = await perplReadOf(env).getBlockNumber();
          if (head + DEADLINE_MARGIN_BLOCKS > last) {
            throw new Error("The order’s time window passed before it was signed. Nothing was sent. Review it again.");
          }
        },
      };
    },
    [env],
  );

  const runSteps = useCallback(
    async (op: PerplRun): Promise<TrackedResult | undefined> => {
      const client = account.client;
      const address = account.hint?.address;
      if (!client || !address || op.plan.steps.length === 0) return undefined;
      const { steps, plannedActions } = op.plan;
      if (op.reviewedNetworkFeesWei && op.reviewedNetworkFeesWei.length !== steps.length)
        throw new Error("Incomplete network fee review.");
      const reviewedIntent = { ...op.reviewedIntent, steps: op.labels.join(" · ") };
      const runAll = async (sender: Sender) => {
        let operationId: string | undefined;
        let last: TrackedResult | undefined;
        for (const [index, s] of steps.entries()) {
          setStep({ index, count: steps.length, label: op.labels[index] ?? "" });
          const base: PerplStep = typeof s === "function" ? timed(s) : s;
          const bound = op.reviewedNetworkFeesWei?.[index];
          const request: PerplStep =
            bound === undefined
              ? base
              : typeof base === "function"
                ? async () => ({ ...(await base()), reviewedNetworkFeeWei: bound })
                : { ...base, reviewedNetworkFeeWei: bound };
          last = await trace.run(sender, request, {
            operationId,
            plannedActions,
            builderAction: "perplOrder",
            reviewedIntent,
            revalidate: () => op.revalidate(index),
            // Practice: the sponsor tops the wallet's MON up to this step's budget first (as the engine ticket does).
            ...(env.chainId === TESTNET_CHAIN_ID
              ? { preflight: (built: TxRequest) => ensureGas.preflight(built)() }
              : {}),
          });
          operationId = last?.operationId ?? operationId;
          if (last?.final?.stage !== "finalized") return last;
        }
        return last;
      };
      if (op.confirmWith === "passkey") {
        try {
          return await account.stepUp((signer) => runAll(stepUpSender(signer)));
        } catch (error) {
          const kind = classifyAuthError(error);
          if (isSilent(kind)) return undefined;
          if (kind === "unknown" && !(error instanceof Error && error.name === "AuthError")) throw error;
          const copy = authFailureCopy(kind, Platform.OS === "ios" ? "ios" : "android");
          notify({ title: copy.title, description: copy.body, tone: "warning" });
          return undefined;
        }
      }
      const label = op.marketLabel;
      return runAll(
        userSender(client, address, account.settings.faceId, {
          marketRoomUsd6: () => undefined,
          equityUsd6: () => undefined,
          ...(label ? { perplMarketLabel: () => label } : {}),
        }),
      );
    },
    [account, env.chainId, ensureGas, timed, trace],
  );

  const run = useCallback(
    async (op: PerplRun) => {
      if (activeKeys.has(traceKey)) return undefined;
      setActiveKey(traceKey, true);
      try {
        return await runSteps(op);
      } finally {
        setActiveKey(traceKey, false);
      }
    },
    [runSteps, traceKey],
  );

  return {
    trace,
    step,
    active,
    run,
    reset: () => {
      trace.reset();
      setStep(undefined);
    },
  };
}

export type PerplRunner = ReturnType<typeof usePerplRun>;

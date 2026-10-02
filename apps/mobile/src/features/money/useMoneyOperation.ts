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
import { MAINNET_TOKENS } from "@senryo/config";
import { formatUnits } from "@senryo/core";
import {
  type ComposedStep,
  type FeePlan,
  type FeeSource,
  planNetworkFee,
  runOperationSteps,
  type TrackedResult,
  useQueryEnv,
  useSendTrace,
} from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useEnsureGas } from "~/features/trade/useGasTopUp";
import { useAccount } from "~/lib/account/provider";
import { stepUpSender, userSender } from "~/lib/account/sender";
import { requestStepUp, type StepUpIntent } from "~/lib/account/step-up";
import { useNetwork } from "~/lib/network";
import type { MoneyAsset } from "./assets";
import { useMoneyAssets } from "./useMoneyAssets";

export type PlannedStep = ComposedStep;

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
  /** Wallet units each asset (lower-case address) gives up, so the network fee never takes what the act needs. */
  spends?: Readonly<Record<string, bigint>> | undefined;
}

/** A reviewed operation with its network fee settled: ready to slide, or blocked with the reason. */
export type PreparedOperation =
  | { ok: true; op: MoneyOperation; fee: FeePlan["kind"] | "sponsored" }
  | { ok: false; block: string };

const MON_DECIMALS = 18;
const FEE_SHOWN_DECIMALS = 3;
const USDT0 = MAINNET_TOKENS.usdt0.toLowerCase();

/** Dollar assets that can pay a network fee (B11), largest first, less what the operation spends of each. */
export function feeSources(assets: readonly MoneyAsset[], spends: Readonly<Record<string, bigint>> = {}): FeeSource[] {
  return assets
    .filter((a) => a.verified && !a.native && (a.collateral !== undefined || a.key === USDT0) && a.wallet > 0n)
    .map((a) => ({
      address: a.address,
      symbol: a.symbol,
      decimals: a.decimals,
      spare: a.wallet - (spends[a.key] ?? 0n),
    }))
    .filter((s) => s.spare > 0n)
    .sort((x, y) => (x.spare === y.spare ? 0 : x.spare > y.spare ? -1 : 1));
}

/** The one line a fee that can't be composed shows (never "gas"; never a bare "Add MON"). */
function shortCopy(plan: Extract<FeePlan, { kind: "short" }>): string {
  const need = formatUnits(plan.needWei, MON_DECIMALS, FEE_SHOWN_DECIMALS);
  if (plan.reason === "too-low") return `Network fee needs ~${need} MON first`;
  if (plan.reason === "no-dollars") return `Network fee needs ~${need} MON or $0.50 in dollars`;
  return "Network fee swap unavailable · try again";
}

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
      if (network.key === "testnet") return { ok: true, op, fee: "sponsored" };
      const plan = await planNetworkFee(env, address, op.steps, feeSources(money.assets, op.spends));
      if (plan.kind === "short") return { ok: false, block: shortCopy(plan) };
      if (plan.kind === "covered") return { ok: true, op, fee: "covered" };
      return {
        ok: true,
        fee: "top-up",
        op: {
          ...op,
          steps: [...plan.steps, ...op.steps],
          reviewedIntent: {
            ...op.reviewedIntent,
            networkFee: `${formatUnits(plan.amountIn, plan.source.decimals, 2)} ${plan.source.symbol} → MON`,
          },
          // The fee swap moves the dollar asset first: the act's own source check runs before the fee step only.
          revalidate: (index) => op.revalidate(index - plan.steps.length < 0 ? 0 : index - plan.steps.length),
          // A swap always asks for the passkey (rule 11): an operation that was in session scope steps up for it.
          stepUp: op.stepUp ?? {
            title: "Network fee",
            detail: `${formatUnits(plan.amountIn, plan.source.decimals, 2)} ${plan.source.symbol} is swapped to MON for the network fee first. Swaps always ask for a fresh passkey check.`,
            confirmLabel: "Confirm with passkey",
          },
        },
      };
    },
    [account.hint?.address, env, money.assets, network.key],
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

/** A prepared review is re-planned after this (balances and the fee quote move). */
const PREPARE_STALE_MS = 15_000;

/**
 * The review's operation with its network fee planned (B11) while the review is open, keyed by the reviewed intent:
 * Details shows "Network fee" before the slide, and the slide signs exactly what was shown.
 */
export function usePreparedOperation(
  runner: MoneyOperationRunner,
  key: string | undefined,
  build: () => MoneyOperation | undefined | Promise<MoneyOperation | undefined>,
) {
  return useQuery({
    queryKey: ["money-prepare", key ?? ""],
    queryFn: async (): Promise<PreparedOperation> => {
      const op = await build();
      return op ? runner.prepare(op) : { ok: false, block: "Review again" };
    },
    enabled: key !== undefined && key !== "",
    staleTime: PREPARE_STALE_MS,
    gcTime: 0,
  });
}

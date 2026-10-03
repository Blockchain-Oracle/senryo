/**
 * One intent, one confirmation (flow book B0.4–B0.6, B11, rules 4–5), the platform-free half shared by the phone and
 * the web: a reviewed money operation is an ordered list of composed steps ([network fee] → [pull from trades] →
 * [swap] → [move] → act, `compose.ts`), signed under one slide and, outside the session's scope, one passkey step-up.
 * Each app's runner signs and journals it (`useMoneyOperation`); this module plans its network fee before review.
 *
 * Mainnet pays its own fees in MON (B11): `prepareMoneyOperation` plans them — covered by the account's MON, or "swap
 * ~$0.50 of a dollar asset to MON" prepended as steps of the same operation (Details: "Network fee"), or the named
 * shortfall when neither works (never a dead end). Practice is sponsored: the sponsor tops up before each step.
 */
import { MAINNET_CHAIN_ID, MAINNET_TOKENS } from "@senryo/config";
import { type Address, formatUnits } from "@senryo/core";
import { useQuery } from "@tanstack/react-query";
import { type ComposedStep, type FeePlan, type FeeSource, planNetworkFee } from "./compose.ts";
import type { QueryEnv } from "./env.tsx";
import type { MoneyAsset } from "./money-assets.ts";

/** The passkey step-up's words: verb first, the facts, the button. */
export interface OperationStepUp {
  title: string;
  detail: string;
  confirmLabel?: string;
}

export interface MoneyOperation {
  steps: ComposedStep[];
  /** The facts the receipt and Activity show, frozen at review (strings only). */
  reviewedIntent: Record<string, string>;
  /**
   * Re-checks reviewed scope, balances and quotes right before each step's signature; throws to stop. `stepIndex`
   * tells which step is about to sign: source balances are checked before the first only, because the operation's
   * own earlier steps (a pull from trades, a swap) legitimately move them.
   */
  revalidate: (stepIndex: number) => Promise<void>;
  /** Present → outside the session's scope: one passkey step-up signs every step. */
  stepUp?: OperationStepUp | undefined;
  /** Wallet units each asset (lower-case address) gives up, so the network fee never takes what the act needs. */
  spends?: Readonly<Record<string, bigint>> | undefined;
}

/** A reviewed operation with its network fee settled: ready to slide, or blocked with the reason. */
export type PreparedOperation =
  | { ok: true; op: MoneyOperation; fee: FeePlan["kind"] | "sponsored" }
  | { ok: false; block: string };

const MON_DECIMALS = 18;
const FEE_SHOWN_DECIMALS = 3;
const SOURCE_SHOWN_DECIMALS = 2;
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
export function feeShortCopy(plan: Extract<FeePlan, { kind: "short" }>): string {
  const need = formatUnits(plan.needWei, MON_DECIMALS, FEE_SHOWN_DECIMALS);
  if (plan.reason === "too-low") return `Network fee needs ~${need} MON first`;
  if (plan.reason === "no-dollars") return `Network fee needs ~${need} MON or $0.50 in dollars`;
  return "Network fee swap unavailable · try again";
}

/**
 * B11 before review: on Mainnet the operation's fee (Σ limit × max fee of every step, plus MON value) is either on
 * the account, or the "~$0.50 → MON" top-up steps go first in the same operation, or the reason it can't be paid.
 * `assets` are the account's verified holdings (the fee's possible sources).
 */
export async function prepareMoneyOperation(
  env: QueryEnv,
  address: Address,
  op: MoneyOperation,
  assets: readonly MoneyAsset[],
): Promise<PreparedOperation> {
  if (env.chainId !== MAINNET_CHAIN_ID) return { ok: true, op, fee: "sponsored" };
  const plan = await planNetworkFee(env, address, op.steps, feeSources(assets, op.spends));
  if (plan.kind === "short") return { ok: false, block: feeShortCopy(plan) };
  if (plan.kind === "covered") return { ok: true, op, fee: "covered" };
  const paid = `${formatUnits(plan.amountIn, plan.source.decimals, SOURCE_SHOWN_DECIMALS)} ${plan.source.symbol}`;
  return {
    ok: true,
    fee: "top-up",
    op: {
      ...op,
      steps: [...plan.steps, ...op.steps],
      reviewedIntent: { ...op.reviewedIntent, networkFee: `${paid} → MON` },
      // The fee swap moves the dollar asset first: the act's own source check runs before the fee step only.
      revalidate: (index) => op.revalidate(index - plan.steps.length < 0 ? 0 : index - plan.steps.length),
      // A swap always asks for the passkey (rule 11): an operation that was in session scope steps up for it.
      stepUp: op.stepUp ?? {
        title: "Network fee",
        detail: `${paid} is swapped to MON for the network fee first. Swaps always ask for a fresh passkey check.`,
        confirmLabel: "Confirm with passkey",
      },
    },
  };
}

/** A prepared review is re-planned after this (balances and the fee quote move). */
const PREPARE_STALE_MS = 15_000;

/**
 * The review's operation with its network fee planned (B11) while the review is open, keyed by the reviewed intent:
 * Details shows "Network fee" before the slide, and the slide signs exactly what was shown.
 */
export function usePreparedOperation(
  runner: { prepare: (op: MoneyOperation) => Promise<PreparedOperation> },
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

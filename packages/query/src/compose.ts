/**
 * Composed operations (flow book B0.4, B11; routes.md §7; plan §0.5 rule 4): one reviewed intent, one slide, one
 * journalled operation whose steps run in a fixed order — [network fee] → [pull from trades] → [swap] → [move to the
 * trading account] → act — every approval right before the call it serves.
 *  - Network fee (B11, Mainnet): MON pays fees. When the account's MON, after Σ (gas limit × signed max fee) of every
 *    step plus any MON value, would fall below the fee reserve (what one top-up costs), "swap ~$0.50 of a dollar
 *    asset to MON" is prepended as steps of the SAME operation (Details: "Network fee"). The top-up pays its own fee
 *    in MON, so an account below even that can't buy MON by itself (a zero-MON wallet needs MON sent in or bought).
 *    After it lands the next step waits FUNDING_SETTLE_BLOCKS (Monad spends a new balance only after 3 blocks).
 *  - MON value-dip rule (context/02-monad/differences-from-ethereum.md §2): a step that spends MON value goes first,
 *    or leaves at least the reserve after it. App accounts are plain passkey EOAs (no EIP-7702 delegation is ever
 *    signed by the app), so the 10 MON floor binds only a second value spend within 3 blocks — which a composed
 *    operation is — and the existing reserve on every native send (`SENDER_RESERVE_MON`) is kept as is.
 *  - A swap leg is re-quoted the moment before it is signed: the same router, at least the reviewed minimum, and the
 *    impact rule (block > 5 %) again — anything else stops the operation at that step ("Price moved · review again").
 */
import { type SwapQuoteOk, swapQuoteRoute } from "@senryo/api-client";
import { addressOf, contractCall, erc20Abi, externalCall, type ReadClient, type TxRequest } from "@senryo/chain";
import {
  aggregatorSwapGasLimit,
  type ChainId,
  FUNDING_SETTLE_BLOCKS,
  GAS_LIMITS,
  type GasAction,
  MAINNET_CHAIN_ID,
  NATIVE_TOKEN,
  SENDER_RESERVE_MON,
  SWAP_SLIPPAGE_BPS,
} from "@senryo/config";
import { type Address, ONE_E18 } from "@senryo/core";
import { aggregatorSwapRequests } from "./anyasset.ts";
import type { QueryEnv } from "./env.tsx";
import { gasBudgetFor, userFeeCache } from "./gas.ts";
import { type CollateralSymbol, collateralTokenOf } from "./withdraw.ts";

export type StepRole = "fee" | "pull" | "swap" | "move" | "act";
/** The fixed order of a composed operation (B0.4). */
export const ROLE_ORDER: readonly StepRole[] = ["fee", "pull", "swap", "move", "act"];

export interface ComposedStep {
  /** Where the step sits in the order; omitted = `act`. */
  role?: StepRole | undefined;
  /** The journal action of the request this step sends. */
  action: GasAction;
  /** Shown in Details ("Network fee", "Pull from trades", "Swap MON → AUSD", "Deposit"). */
  label: string;
  /** The review-time request (fee budget, approvals); `build` may replace it at signing time. */
  request: TxRequest;
  /** Rebuilds the request just before signing (a re-quote); defaults to `request`. */
  build?: (() => Promise<TxRequest>) | undefined;
}

/** The MON an account keeps after a native value send (wei). */
export const MON_RESERVE_WEI = SENDER_RESERVE_MON * ONE_E18;
/** "~$0.50 of a dollar asset to MON" (B11), in usd6. */
export const FEE_TOP_UP_USD6 = 500_000n;
const USD6_DECIMALS = 6;
const TEN = 10n;
const MOVED = "Price moved · review again";
const BLOCK_POLL_MS = 400;
const SETTLE_POLLS = 20;

/** Orders the groups [fee] → [pull] → [swap] → [move] → act, keeping each group's own order (approve before call). */
export function composeSteps(groups: Partial<Record<StepRole, readonly ComposedStep[]>>): ComposedStep[] {
  return ROLE_ORDER.flatMap((role) => (groups[role] ?? []).map((step) => ({ ...step, role })));
}

/** "Network fee · Swap MON → AUSD · Deposit · Open" — Details' one line; consecutive repeats show once. */
export function stepsLine(steps: readonly Pick<ComposedStep, "label">[]): string {
  return steps
    .map((s) => s.label)
    .filter((label, i, all) => label !== all[i - 1])
    .join(" · ");
}

export class MonOrderError extends Error {
  constructor(
    readonly index: number,
    readonly label: string,
  ) {
    super(`"${label}" spends MON after another step and would leave less than the reserve — compose it first`);
    this.name = "MonOrderError";
  }
}

/**
 * The value-dip rule over the planned order: walking the projected balance (each step's fee budget out, a top-up's
 * minimum in), a step that sends MON value is either the first step or leaves at least `reserveWei` after it.
 */
export function assertMonOrder(
  steps: readonly ComposedStep[],
  balanceWei: bigint,
  budgetsWei: readonly bigint[],
  topUpWei = 0n,
  reserveWei = MON_RESERVE_WEI,
): void {
  let balance = balanceWei;
  steps.forEach((step, i) => {
    balance -= budgetsWei[i] ?? 0n;
    const value = step.request.value ?? 0n;
    if (value > 0n) {
      if (i > 0 && balance - value < reserveWei) throw new MonOrderError(i, step.label);
      balance -= value;
    }
    if (step.role === "fee" && step.action === "aggregatorSwap") balance += topUpWei;
  });
}

/** Σ (limit × signed max fee) of every step plus the MON value they send, and each step's budget. */
export async function operationFeeNeed(
  read: ReadClient,
  owner: Address,
  steps: readonly ComposedStep[],
): Promise<{ needWei: bigint; budgetsWei: bigint[] }> {
  const budgets = await Promise.all(steps.map((s) => gasBudgetFor(read, owner, s.request)));
  const budgetsWei = budgets.map((b) => b.needWei);
  const value = steps.reduce((sum, s) => sum + (s.request.value ?? 0n), 0n);
  return { needWei: budgetsWei.reduce((sum, b) => sum + b, 0n) + value, budgetsWei };
}

/** A dollar asset that can pay the network fee, with what the operation itself leaves of it in the wallet. */
export interface FeeSource {
  address: Address;
  symbol: string;
  decimals: number;
  /** Wallet units the operation doesn't spend. */
  spare: bigint;
}

export type FeePlan =
  | { kind: "covered"; needWei: bigint; haveWei: bigint; budgetsWei: bigint[] }
  | {
      kind: "top-up";
      needWei: bigint;
      haveWei: bigint;
      source: FeeSource;
      amountIn: bigint;
      quote: SwapQuoteOk;
      /** [approve?, swap], role `fee`, label "Network fee". */
      steps: ComposedStep[];
    }
  | {
      kind: "short";
      needWei: bigint;
      haveWei: bigint;
      /** no-dollars: nothing to swap · no-route: no quote · too-low: MON can't pay even the top-up's own fee. */
      reason: "no-dollars" | "no-route" | "too-low";
    };

const usd6ToUnits = (usd6: bigint, decimals: number) =>
  decimals >= USD6_DECIMALS
    ? usd6 * TEN ** BigInt(decimals - USD6_DECIMALS)
    : usd6 / TEN ** BigInt(USD6_DECIMALS - decimals);

/**
 * The swap leg of a reviewed quote as composed steps: [approve(router, exact)?, swap], the swap re-quoted right before
 * it is signed (same router, ≥ `floorOut`, impact not blocked).
 */
export async function swapLeg(
  env: QueryEnv,
  owner: Address,
  quote: SwapQuoteOk,
  label: { approve: string; swap: string },
  role: StepRole,
  floorOut: bigint = quote.quote.minOut,
): Promise<ComposedStep[]> {
  const requests = await aggregatorSwapRequests(env, owner, quote);
  return requests.map((request, i) => {
    const last = i === requests.length - 1;
    return {
      role,
      action: request.action,
      label: last ? label.swap : label.approve,
      request,
      ...(last ? { build: () => requoteSwap(env, owner, quote, floorOut) } : {}),
    };
  });
}

/** The swap call signed now: a fresh quote through the same router giving at least `floorOut`, or a stop. */
export async function requoteSwap(
  env: QueryEnv,
  owner: Address,
  was: SwapQuoteOk,
  floorOut: bigint = was.quote.minOut,
): Promise<TxRequest> {
  const fresh = await env.api.call(swapQuoteRoute, {
    query: {
      chainId: env.chainId,
      from: was.from.address,
      to: was.to.address,
      amount: was.amountIn,
      sender: owner,
      slippageBps: was.slippageBps,
    },
  });
  if (
    fresh.status !== "ok" ||
    fresh.quote.impact === "block" ||
    fresh.quote.minOut < floorOut ||
    fresh.quote.router.toLowerCase() !== was.quote.router.toLowerCase()
  ) {
    throw new Error(MOVED);
  }
  const requests = await aggregatorSwapRequests(env, owner, fresh);
  const swap = requests.at(-1);
  if (!swap || requests.length > 1) throw new Error(MOVED);
  return swap;
}

async function feeQuote(env: QueryEnv, owner: Address, source: FeeSource, amountIn: bigint) {
  const q = await env.api.call(swapQuoteRoute, {
    query: {
      chainId: env.chainId,
      from: source.address,
      to: NATIVE_TOKEN,
      amount: amountIn,
      sender: owner,
      slippageBps: SWAP_SLIPPAGE_BPS,
    },
  });
  return q.status === "ok" && q.quote.impact !== "block" ? q : undefined;
}

/**
 * The network-fee reserve (B11; B1's "Keeps … for fees"): what one "~$0.50 → MON" top-up costs at today's max fee
 * (approve + the aggregator swap's flat budget). An operation that would leave less MON than this tops up first, so
 * the account never runs so dry that it can't buy MON again.
 */
export async function feeReserveWei(read: ReadClient): Promise<bigint> {
  const fees = await userFeeCache(read).get();
  return (GAS_LIMITS.approve + aggregatorSwapGasLimit()) * fees.maxFeePerGas;
}

/**
 * B11 on Mainnet: does the account's MON cover the operation AND keep the fee reserve, or which "~$0.50 → MON" steps
 * go first in the same operation, or why neither works. An operation the MON pays for is never blocked: when the top-up
 * isn't possible (no dollars, no route, MON below the top-up's own fee) it runs as is. `sources` in preference order;
 * their `spare` excludes what the operation spends.
 */
export async function planNetworkFee(
  env: QueryEnv,
  owner: Address,
  steps: readonly ComposedStep[],
  sources: readonly FeeSource[],
): Promise<FeePlan> {
  const [{ needWei, budgetsWei }, haveWei, reserveWei] = await Promise.all([
    operationFeeNeed(env.read, owner, steps),
    env.read.getBalance({ address: owner, blockTag: "latest" }),
    feeReserveWei(env.read),
  ]);
  const covered: FeePlan = { kind: "covered", needWei, haveWei, budgetsWei };
  const short = (reason: "no-dollars" | "no-route" | "too-low", need = needWei): FeePlan =>
    haveWei >= needWei ? covered : { kind: "short", needWei: need, haveWei, reason };
  if (haveWei >= needWei + reserveWei || env.chainId !== MAINNET_CHAIN_ID) return covered;
  const source = sources.find((s) => s.spare >= usd6ToUnits(FEE_TOP_UP_USD6, s.decimals));
  if (!source) return short("no-dollars");
  let amountIn = usd6ToUnits(FEE_TOP_UP_USD6, source.decimals);
  let quote = await feeQuote(env, owner, source, amountIn);
  if (!quote) return short("no-route");
  const ownFee = (await operationFeeNeed(env.read, owner, await swapLeg(env, owner, quote, LABELS, "fee"))).needWei;
  if (haveWei < ownFee) return short("too-low", ownFee);
  // What the top-up must bring: the operation's fees and the reserve back, after paying for itself.
  const floor = needWei + reserveWei + ownFee - haveWei;
  if (quote.quote.minOut < floor) {
    // MON this dear is unlikely: scale the top-up once, then give up.
    const scaled = (amountIn * floor) / quote.quote.minOut + 1n;
    quote = scaled <= source.spare ? await feeQuote(env, owner, source, scaled) : undefined;
    if (!quote || quote.quote.minOut < floor) return short("no-route");
    amountIn = scaled;
  }
  // The fee leg's own floor is what the operation needs, not the quote's minimum (a fee top-up isn't a trade).
  const feeSteps = await swapLeg(env, owner, quote, LABELS, "fee", floor);
  return { kind: "top-up", needWei: needWei + ownFee, haveWei, source, amountIn, quote, steps: feeSteps };
}

const LABELS = { approve: "Network fee", swap: "Network fee" } as const;

/** `SenryoCore.deposit(token, amount)`: the account's own dollars into its trading account (own funds, uncapped). */
export function coreDepositRequest(chainId: ChainId, symbol: CollateralSymbol, amount: bigint): TxRequest {
  return contractCall(chainId, "SenryoCore", "deposit", [collateralTokenOf(chainId, symbol), amount], "deposit", {
    // Not `symbol` / `amount`: the journal matches those against the operation's reviewed intent (the act's facts).
    meta: { kind: "deposit", collateral: symbol, units: amount.toString() },
  });
}

/** ERC-20 approve(SenryoCore, exact)? + `SenryoCore.deposit` — the "move to the trading account" leg. */
export function moveToTradingSteps(
  chainId: ChainId,
  symbol: CollateralSymbol,
  amount: bigint,
  allowance: bigint,
): ComposedStep[] {
  const token = collateralTokenOf(chainId, symbol);
  const core = addressOf(chainId, "SenryoCore");
  const steps: ComposedStep[] = [];
  if (allowance < amount) {
    steps.push({
      role: "move",
      action: "approve",
      label: `Approve ${symbol}`,
      request: externalCall(token, erc20Abi, "approve", [core, amount], "approve"),
    });
  }
  steps.push({
    role: "move",
    action: "deposit",
    label: "Move to trading",
    request: coreDepositRequest(chainId, symbol, amount),
  });
  return steps;
}

export interface OperationRunOptions {
  operationId: string | undefined;
  plannedActions: string[];
  reviewedIntent: Record<string, string>;
  builderAction: GasAction;
}

/** What a step runner reports: the operation it joined and how its transaction ended. */
export interface StepRun {
  operationId?: string | undefined;
  final?: { stage: string; receipt?: { blockNumber: bigint } | undefined } | undefined;
}

async function untilBlock(read: ReadClient, target: bigint): Promise<void> {
  for (let i = 0; i < SETTLE_POLLS && (await read.getBlockNumber()) < target; i += 1) {
    await new Promise((r) => setTimeout(r, BLOCK_POLL_MS));
  }
}

/**
 * Runs a composed operation's steps in order under ONE operation id: the first step opens the journal record with
 * every planned action and the reviewed intent (plus the steps line), each later step joins it; it stops at the first
 * step that doesn't finalize (completed steps are never resent). After a network-fee step it waits for the new MON
 * to settle (`waitForBlock`, default: polls the chain) before the next step signs.
 */
export async function runOperationSteps<R extends StepRun>(
  steps: readonly ComposedStep[],
  reviewedIntent: Record<string, string>,
  runStep: (step: ComposedStep, index: number, options: OperationRunOptions) => Promise<R | undefined>,
  settle: { read: ReadClient; waitForBlock?: ((target: bigint) => Promise<void>) | undefined },
  /** Actions that follow outside these steps but belong to the operation (the ticket's TP/SL legs). */
  alsoPlanned: readonly string[] = [],
): Promise<R | undefined> {
  const plannedActions = [...steps.map((s) => s.action), ...alsoPlanned];
  const intent = { ...reviewedIntent, steps: stepsLine(steps) };
  let operationId: string | undefined;
  let last: R | undefined;
  for (const [index, step] of steps.entries()) {
    last = await runStep(step, index, {
      operationId,
      plannedActions,
      reviewedIntent: intent,
      builderAction: step.action,
    });
    operationId = last?.operationId ?? operationId;
    if (last?.final?.stage !== "finalized") return last;
    const landed = last.final.receipt?.blockNumber;
    const next = steps[index + 1];
    if (step.role === "fee" && step.action === "aggregatorSwap" && next && landed !== undefined) {
      const target = landed + FUNDING_SETTLE_BLOCKS;
      await (settle.waitForBlock ?? ((t: bigint) => untilBlock(settle.read, t)))(target);
    }
  }
  return last;
}

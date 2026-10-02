/**
 * `Policy.evaluate` — the one judge every in-session signature passes (spec session-policy.md). Pure: it reads the
 * decoded action, the live context and what the session already spent, and returns sign / confirm / reject.
 */
import { BPS_DENOMINATOR, formatUnits } from "@senryo/core";
import type { Address, Hex } from "viem";
import {
  FACE_ID_TRADE_THRESHOLD_USD6,
  MINUTES,
  SESSION_MAX_LEVERAGE_BPS,
  SESSION_MOVE_CAP_USD6,
  SESSION_RATE_PER_MINUTE,
  SESSION_TOTAL_CAP_USD6,
  SESSION_TRADE_CAP_USD6,
} from "../constants.ts";
import { type CallInput, decodeCall } from "./decode.ts";
import { includesAddress, scopeTargets } from "./targets.ts";
import type { Action, PolicyContext, PolicyUsage, RejectReason, Verdict } from "./types.ts";

const USD_DECIMALS = 6;
/** Perpl leverage is in hundredths (500 = 5x); the session's cap is in bps of equity (100,000 = 10x). */
const PERPL_HDTHS_TO_BPS = 100n;
const USD_SHOWN = 2;

export interface TxInput {
  chainId: number | undefined;
  to: Address | null | undefined;
  data: Hex | undefined;
  value: bigint | undefined;
  authorizationList: readonly unknown[] | undefined;
}

const usd = (v: bigint) => `$${formatUnits(v, USD_DECIMALS, USD_SHOWN)}`;

const reject = (action: Action | undefined, reason: RejectReason, stepUp = true): Verdict => ({
  kind: "reject",
  action,
  reason,
  stepUp,
});

function recentCount(usage: PolicyUsage, now: number): number {
  return usage.signedAt.filter((t) => now - t < MINUTES).length;
}

function tradePrompt(action: Extract<Action, { kind: "open" | "perpl-open" }>, ctx: PolicyContext): string {
  const label =
    action.kind === "open"
      ? (ctx.marketLabel?.(action.marketId) ?? `market #${action.marketId}`)
      : `${ctx.perplMarketLabel?.(action.marketId) ?? `market #${action.marketId}`} on Perpl`;
  return `Confirm ${action.isLong ? "long" : "short"} ${usd(action.notionalUsd6)} ${label}`;
}

/** D-037 gate for trades: every trade, or opens at/above the threshold; never in practice by default. */
function gate(action: Action, ctx: PolicyContext): string | undefined {
  if (ctx.faceId === "off") return undefined;
  if (action.kind === "open" || action.kind === "perpl-open") {
    if (ctx.faceId === "every-trade" || action.notionalUsd6 >= FACE_ID_TRADE_THRESHOLD_USD6)
      return tradePrompt(action, ctx);
    return undefined;
  }
  if (
    ctx.faceId === "every-trade" &&
    (action.kind === "reduce" || action.kind === "perpl-reduce" || action.kind === "swap")
  ) {
    return action.kind === "swap" ? `Confirm swap ${usd(action.amountUsd6)}` : "Confirm closing trade";
  }
  return undefined;
}

function allow(action: Action, spendUsd6: bigint, rateLimited: boolean, ctx: PolicyContext): Verdict {
  const prompt = gate(action, ctx);
  return prompt === undefined
    ? { kind: "sign", action, spendUsd6, rateLimited }
    : { kind: "confirm", action, spendUsd6, rateLimited, prompt };
}

function judgeOpen(action: Extract<Action, { kind: "open" }>, ctx: PolicyContext, usage: PolicyUsage): Verdict {
  const equity = ctx.equityUsd6();
  const room = ctx.marketRoomUsd6(action.marketId, action.isLong);
  if (equity === undefined || room === undefined) return reject(action, "context-unavailable");
  const n = action.notionalUsd6;
  if (equity <= 0n || n * BPS_DENOMINATOR > equity * SESSION_MAX_LEVERAGE_BPS) return reject(action, "over-leverage");
  // Per-trade cap: never above the session cap, the market's open-interest room, or equity × max leverage.
  const cap = [SESSION_TRADE_CAP_USD6, room].reduce((m, v) => (v < m ? v : m));
  if (n > cap) return reject(action, "over-trade-cap");
  if (usage.spentUsd6 + n > SESSION_TOTAL_CAP_USD6) return reject(action, "over-session-total");
  return allow(action, n, true, ctx);
}

/**
 * A Perpl open (D1). Perpl enforces its own margin, so the engine's equity/OI-room reads don't apply; the session
 * still bounds what a live key can do on its own: leverage from calldata ≤ the session maximum (0 = "market maximum"
 * is refused), notional at the order's own limit price ≤ the per-trade cap, and it counts to the session total.
 */
function judgePerplOpen(
  action: Extract<Action, { kind: "perpl-open" }>,
  ctx: PolicyContext,
  usage: PolicyUsage,
): Verdict {
  const leverageBps = action.leverageHdths * PERPL_HDTHS_TO_BPS;
  if (action.leverageHdths <= 0n || leverageBps > SESSION_MAX_LEVERAGE_BPS) return reject(action, "over-leverage");
  if (action.notionalUsd6 > SESSION_TRADE_CAP_USD6) return reject(action, "over-trade-cap");
  if (usage.spentUsd6 + action.notionalUsd6 > SESSION_TOTAL_CAP_USD6) return reject(action, "over-session-total");
  return allow(action, action.notionalUsd6, true, ctx);
}

function judgeMove(action: Action, amount: bigint, ctx: PolicyContext, usage: PolicyUsage, counts: boolean): Verdict {
  if (amount > SESSION_MOVE_CAP_USD6) return reject(action, "over-move-cap");
  if (counts && usage.spentUsd6 + amount > SESSION_TOTAL_CAP_USD6) return reject(action, "over-session-total");
  return allow(action, counts ? amount : 0n, true, ctx);
}

/** Judge a decoded action (exported for typed-data/message siblings and the scope checks). */
export function judgeAction(action: Action, ctx: PolicyContext, usage: PolicyUsage): Verdict {
  const t = scopeTargets(ctx.chainId);
  switch (action.kind) {
    case "open":
      return judgeOpen(action, ctx, usage);
    case "reduce":
    case "card-safe":
      // Reduce-only and debt-reducing actions are never capped: closing must always work.
      return allow(action, 0n, false, ctx);
    case "deposit":
      // Own funds into the own account: no loss path, uncapped.
      return allow(action, 0n, true, ctx);
    case "withdraw":
      if (!action.toSelf) return reject(action, "destination");
      // To the signer's own EOA (D-039): the key that signs still holds the funds, so it is in scope.
      return includesAddress(t.stables, action.token) ? allow(action, 0n, true, ctx) : reject(action, "unknown-token");
    case "swap":
      return judgeMove(action, action.amountUsd6, ctx, usage, true);
    case "approve":
      if (!action.spenderKnown) return reject(action, "unknown-spender");
      return judgeMove(action, action.amountUsd6, ctx, usage, false);
    case "lp-deposit":
      if (!action.receiverSelf) return reject(action, "destination");
      return judgeMove(action, action.amountUsd6, ctx, usage, true);
    case "lp-redeem":
      return action.receiverSelf ? allow(action, 0n, true, ctx) : reject(action, "destination");
    case "faucet":
      return allow(action, 0n, true, ctx);
    // Perpl (D1, session-policy.md §3). Conservative by design: money leaving the Senryo account for a third-party
    // venue is a move, not a deposit — `createAccount` / `depositCollateral` are capped per action
    // (SESSION_MOVE_CAP_USD6, like LP deposits) and count to the session total, so a live key can't drain the wallet
    // into Perpl; larger top-ups take a step-up. The AUSD approve before them is a known spender under the same cap.
    // Closing is reduce-only and must always work (uncapped); a withdrawal is paid to the signer by the contract.
    case "perpl-open":
      return judgePerplOpen(action, ctx, usage);
    case "perpl-reduce":
      return allow(action, 0n, false, ctx);
    case "perpl-deposit":
      return judgeMove(action, action.amountUsd6, ctx, usage, true);
    case "perpl-withdraw":
      return allow(action, 0n, true, ctx);
    case "card-setting":
      return reject(action, "card-setting");
    case "transfer":
    case "native-send":
      return reject(action, action.kind === "native-send" ? "value" : "send");
    case "delegation":
      return reject(action, "delegation");
    case "typed-data":
    case "message":
    case "unknown":
      return reject(action, "out-of-scope", false);
  }
}

/** Evaluate a transaction the session is asked to sign. */
export function evaluateTransaction(tx: TxInput, ctx: PolicyContext, usage: PolicyUsage, now: number): Verdict {
  if (tx.chainId !== ctx.chainId) return reject(undefined, "wrong-chain", false);
  const call: CallInput = {
    to: tx.to ?? undefined,
    data: tx.data,
    value: tx.value ?? 0n,
    hasAuthorizationList: (tx.authorizationList?.length ?? 0) > 0,
  };
  const verdict = judgeAction(decodeCall(call, ctx.self, scopeTargets(ctx.chainId)), ctx, usage);
  if (verdict.kind !== "reject" && verdict.rateLimited && recentCount(usage, now) >= SESSION_RATE_PER_MINUTE) {
    return reject(verdict.action, "rate");
  }
  return verdict;
}

/**
 * Would one live session sign every transaction of a reviewed operation, in order, each counted to the usage before
 * the next (approve → deposit → open)? The first refusal, or undefined when all of them sign in session. A screen
 * uses it to name the confirmation before the slide ("… · passkey"); the signer still judges every one for real.
 */
export function evaluateSequence(
  txs: readonly TxInput[],
  ctx: PolicyContext,
  usage: PolicyUsage,
  now: number,
): Extract<Verdict, { kind: "reject" }> | undefined {
  let spent = usage;
  for (const tx of txs) {
    const verdict = evaluateTransaction(tx, ctx, spent, now);
    if (verdict.kind === "reject") return verdict;
    spent = recordUsage(spent, verdict, now);
  }
  return undefined;
}

/** Record a signed verdict against the session's usage (called only after the signature exists). */
export function recordUsage(usage: PolicyUsage, verdict: Verdict, now: number): PolicyUsage {
  if (verdict.kind === "reject") return usage;
  return {
    spentUsd6: usage.spentUsd6 + verdict.spendUsd6,
    signedAt: verdict.rateLimited ? [...usage.signedAt.filter((t) => now - t < MINUTES), now] : usage.signedAt,
  };
}

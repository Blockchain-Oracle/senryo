/**
 * `Policy.evaluate` — the one judge every in-session signature passes (spec session-policy.md). Pure: it reads the
 * decoded action, the live context and what the session already spent, and returns sign / confirm / reject.
 *
 * Interim scope (S1, D-256): no transaction is prompt-free. Users sign EIP-712 intents that the relayer sends
 * (D-266); a dollar transfer, an approval or a native send always asks for Face ID, and a 7702 delegation or an
 * unknown call is never signed. The prompt-free market intents arrive with the S2 contracts (D-267).
 */
import type { Address, Hex } from "viem";
import { MINUTES, SESSION_RATE_PER_MINUTE } from "../constants.ts";
import { type CallInput, decodeCall } from "./decode.ts";
import { scopeTargets } from "./targets.ts";
import type { Action, PolicyContext, PolicyUsage, RejectReason, Verdict } from "./types.ts";

export interface TxInput {
  chainId: number | undefined;
  to: Address | null | undefined;
  data: Hex | undefined;
  value: bigint | undefined;
  authorizationList: readonly unknown[] | undefined;
}

const reject = (action: Action | undefined, reason: RejectReason, stepUp = true): Verdict => ({
  kind: "reject",
  action,
  reason,
  stepUp,
});

function recentCount(usage: PolicyUsage, now: number): number {
  return usage.signedAt.filter((t) => now - t < MINUTES).length;
}

/** Judge a decoded action (exported for typed-data/message siblings and the scope checks). */
export function judgeAction(action: Action, _ctx: PolicyContext, _usage: PolicyUsage): Verdict {
  switch (action.kind) {
    case "transfer":
      return reject(action, "send");
    case "native-send":
      return reject(action, "value");
    case "approve":
      return action.spenderKnown ? reject(action, "approve") : reject(action, "approve", false);
    case "delegation":
      return reject(action, "delegation", false);
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
 * the next? The first refusal, or undefined when all of them sign in session. A screen uses it to name the
 * confirmation before the slide; the signer still judges every one for real.
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

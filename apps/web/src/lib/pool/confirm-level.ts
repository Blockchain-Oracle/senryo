/**
 * How a pool deposit is confirmed (flow book D1 step 4; Part 1 defect 13), the pool's twin of the ticket's
 * `confirm-level.ts`. The session policy judges every leg the deposit composes — the approval when one is needed and
 * the deposit itself (a withdraw to self from the trading account is uncapped): within the session's move cap they
 * sign in session; above the move cap or the session total, the same reviewed deposit is signed through one passkey
 * step-up that covers every leg, instead of failing with `over-move-cap`.
 */
import {
  type AccountClient,
  type Action,
  type Address,
  emptyUsage,
  type FaceIdMode,
  judgeAction,
  type PolicyUsage,
} from "@senryo/account";
import { policyContext } from "@/lib/account/api";
import type { ConfirmLevel } from "@/lib/trade/confirm-level";

/** Reject reasons a step-up resolves: the session's own limits. */
const STEP_UP_REASONS = new Set(["over-move-cap", "over-session-total", "over-trade-cap"]);

export interface DepositCheck {
  client: AccountClient | undefined;
  address: Address | undefined;
  faceId: FaceIdMode | undefined;
  amountUsd6: bigint;
  /** The vault (the approval's spender), and whether this deposit needs an approval leg first. */
  vault: Address | undefined;
  needsApproval: boolean;
  /** The pool token (AUSD on mainnet, MockAUSD on practice). */
  token: Address | undefined;
}

export function depositConfirmLevel(check: DepositCheck): ConfirmLevel {
  const { client, address, amountUsd6, vault, token } = check;
  if (!client || !address || amountUsd6 <= 0n || !vault || !token) return "session";
  const context = policyContext(address, check.faceId)();
  const usage: PolicyUsage = client.session.live()?.usage ?? emptyUsage();
  const legs: Action[] = [
    ...(check.needsApproval
      ? [{ kind: "approve" as const, token, spender: vault, amountUsd6, spenderKnown: true }]
      : []),
    { kind: "lp-deposit", amountUsd6, receiverSelf: true },
  ];
  const stepUp = legs.some((leg) => {
    const verdict = judgeAction(leg, context, usage);
    return verdict.kind === "reject" && verdict.stepUp && STEP_UP_REASONS.has(verdict.reason);
  });
  return stepUp ? "passkey" : "session";
}

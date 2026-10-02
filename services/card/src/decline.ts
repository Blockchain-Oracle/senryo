import { CARD_DECLINE_REASONS, type CardDeclineReason } from "@senryo/api-client";
import { UNANSWERED_GRACE_MS } from "./constants.ts";

/**
 * Decline reasons (E4: "declines carry their reason"). New decisions store `card_auth.reason` as
 * `<code>: <detail>` so the summary reads the code back exactly; rows written before that are classified from the
 * ASA result and the free-text reason (decoded revert names, reserve outcomes).
 */

export function coded(code: CardDeclineReason, detail: string): string {
  return `${code}: ${detail}`;
}

/** A failed or reverted `placeHold` → the reason the contract (or the send) gave. */
export function failureCode(text: string): CardDeclineReason {
  if (/UnsafeMarketForHold|\bPaused\b|SettleOnly|NoPrice/.test(text)) return "prices_paused";
  if (/AllowanceExceeded|AllowanceExpired|HoldTooLarge/.test(text)) return "over_limit";
  if (/InsufficientFreeCollateral|InsufficientBalance/.test(text)) return "not_enough_spendable";
  return "issuer_error";
}

export interface AuthOutcomeRow {
  status: string;
  result: string | null;
  reason: string | null;
  deadline_at: Date;
}

/** The status the app sees: a PENDING row past its deadline was never answered in time, so Lithic declined it. */
export function effectiveStatus(row: AuthOutcomeRow, now: number = Date.now()): string {
  const unanswered = row.status === "PENDING" && row.deadline_at.getTime() + UNANSWERED_GRACE_MS < now;
  return unanswered ? "DECLINED" : row.status;
}

export function declineReasonOf(row: AuthOutcomeRow, now: number = Date.now()): CardDeclineReason | null {
  if (effectiveStatus(row, now) !== "DECLINED") return null;
  const reason = row.reason ?? "";
  const code = CARD_DECLINE_REASONS.find((c) => reason.startsWith(`${c}:`));
  if (code) return code;
  if (row.result === "CARD_PAUSED") return "frozen";
  if (row.result === "VELOCITY_EXCEEDED" || reason.startsWith("allowance")) return "over_limit";
  if (reason.startsWith("insufficient")) return "not_enough_spendable";
  return failureCode(reason);
}

/** The issuer's own decline result (it decided without calling us, e.g. a paused card) → our reason. */
export function issuerResultCode(result: string): CardDeclineReason {
  switch (result) {
    case "CARD_PAUSED":
    case "CARD_CLOSED":
    case "ACCOUNT_PAUSED":
      return "frozen";
    case "USER_TRANSACTION_LIMIT":
    case "VELOCITY_EXCEEDED":
      return "over_limit";
    case "INSUFFICIENT_FUNDS":
      return "not_enough_spendable";
    default:
      return "issuer_error";
  }
}

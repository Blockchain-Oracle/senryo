/**
 * One card payment as the user reads it (E-D8, E4, E6): the service rows (`card_auth` joined with its hold) become a
 * purchase lifecycle — Pending → Paid / Released / Refunded, or Declined with a reason in ≤ 4 words — never raw ASA
 * statuses. Amounts stay in integer units (cents from the issuer, usd6 on chain).
 */
import type { CardAuthSummary, CardDeclineReason } from "@senryo/api-client";
import type { AllowanceState } from "@senryo/query";

/** Issuer amounts are cents; chain amounts are usd6. */
export const USD6_PER_CENT = 10_000n;

export type PaymentStage = "pending" | "paid" | "released" | "refund" | "declined" | "settling";

export interface PaymentView {
  merchant: string;
  stage: PaymentStage;
  /** The word under the merchant: "Pending", "Paid", "Declined · Over daily limit". */
  status: string;
  /** What the row's amount shows (usd6): the settled charge once paid, else the authorised amount. */
  amountUsd6: bigint;
  /** The hold when it is above the amount (tip and FX buffers): "may settle lower". */
  holdUsd6: bigint | null;
}

const OPEN_HOLDS = new Set(["RESERVED", "SUBMITTED", "ONCHAIN", "FINALIZED"]);
const WORD = /\b([A-Za-z])([A-Za-z']*)/g;

/** Lithic descriptors arrive in capitals ("KISSA COFFEE"); rows read them in title case. */
export function merchantName(descriptor: string | null | undefined): string {
  const text = descriptor?.trim();
  if (!text) return "Card payment";
  return text.toLowerCase().replace(WORD, (_, first: string, rest: string) => first.toUpperCase() + rest);
}

/**
 * The decline in ≤ 4 words (E-D4). An allowance decline reads "Limit expired" when the onchain limit has expired —
 * the service can't tell expired from used up (`reason` is "allowance" for both), the snapshot can.
 */
export function declineWords(reason: CardDeclineReason | null, allowance?: AllowanceState): string {
  switch (reason) {
    case "over_limit":
      return allowance?.kind === "expired" ? "Limit expired" : "Over daily limit";
    case "not_enough_spendable":
      return "Not enough spendable";
    case "frozen":
      return "Card frozen";
    case "prices_paused":
      return "Prices paused";
    default:
      return "Card service error";
  }
}

export function paymentView(row: CardAuthSummary, allowance?: AllowanceState): PaymentView {
  const merchant = merchantName(row.merchantDescriptor);
  const amountUsd6 = row.amountCents * USD6_PER_CENT;
  const holdUsd6 = row.holdUsd6 !== null && row.holdUsd6 > amountUsd6 ? row.holdUsd6 : null;
  if (row.kind === "CREDIT_AUTH") return { merchant, stage: "refund", status: "Refunded", amountUsd6, holdUsd6: null };
  if (row.status === "DECLINED") {
    const status = `Declined · ${declineWords(row.declineReason, allowance)}`;
    return { merchant, stage: "declined", status, amountUsd6, holdUsd6: null };
  }
  if (row.holdStatus === "CAPTURED") {
    const paid = row.capturedUsd6 ?? amountUsd6;
    return { merchant, stage: "paid", status: "Paid", amountUsd6: paid, holdUsd6: null };
  }
  if (row.holdStatus === "RELEASED") return { merchant, stage: "released", status: "Released", amountUsd6, holdUsd6 };
  if (row.holdStatus === "FAILED") return { merchant, stage: "settling", status: "Settling", amountUsd6, holdUsd6 };
  const open = row.holdStatus === undefined || row.holdStatus === null || OPEN_HOLDS.has(row.holdStatus);
  return { merchant, stage: open ? "pending" : "settling", status: "Pending", amountUsd6, holdUsd6 };
}

import type { CardDeclineReason as AppDeclineReason } from "@senryo/api-client";
import { describeError } from "@senryo/chain";
import { type CardDeclineReason, type CardNotice, notifyCardEvent } from "@senryo/service-common";
import { USD6_PER_CENT } from "./constants.ts";
import type { CardContext } from "./context.ts";
import { type AuthOutcomeRow, declineReasonOf, effectiveStatus } from "./decline.ts";

/**
 * Card pushes (E-D5, defect 8): every stage of a payment the user should hear about — the decision (approved or
 * declined, with its reason), the capture and the refund — is one row in the shared notifications ledger on channel
 * `card`; the keeper of this network delivers it. Each call is idempotent (`card:<kind>:<ref>`) and never throws: a
 * notification failing must not fail the decision it describes or retry the onchain step that triggered it.
 */

const REASON: Record<AppDeclineReason, CardDeclineReason> = {
  over_limit: "overLimit",
  not_enough_spendable: "notEnoughSpendable",
  frozen: "frozen",
  prices_paused: "pricesPaused",
  issuer_error: "other",
};

/** Only purchases are news: balance inquiries and credit authorisations (a refund's own auth) push nothing. */
const PAYMENT_KINDS = ["AUTH", "FINANCIAL_AUTH"] as const;

interface DecisionRow extends AuthOutcomeRow {
  id: string;
  account: string | null;
  amount_cents: bigint;
  txn_token: string;
  merchant: string | null;
}

async function send(ctx: CardContext, account: string, notice: CardNotice): Promise<void> {
  try {
    await notifyCardEvent(ctx.db, ctx.chainId, account, notice);
  } catch (error) {
    ctx.log.warn({ err: describeError(error), card: notice.kind, ref: notice.ref }, "card notification not recorded");
  }
}

/** After the ASA answer for `txnToken`: "Paid … at …" or "Card declined at …" with the reason. */
export async function notifyDecision(ctx: CardContext, txnToken: string): Promise<void> {
  try {
    const [row] = await ctx.db<DecisionRow[]>`
      SELECT id, account, status, result, reason, deadline_at, amount_cents, txn_token,
             request->'merchant'->>'descriptor' AS merchant
        FROM card_auth
       WHERE issuer = ${ctx.env.CARD_ISSUER_LABEL} AND txn_token = ${txnToken} AND kind IN ${ctx.db(PAYMENT_KINDS)}
       ORDER BY received_at DESC LIMIT 1`;
    if (!row?.account) return;
    const status = effectiveStatus(row);
    // Keyed by the issuer transaction (not our row id), so an issuer-side decline of the same payment
    // (`notifyIssuerDecline`) is the same notification, recorded once.
    const base = {
      ref: row.txn_token,
      authId: row.id,
      txn: row.txn_token,
      merchant: row.merchant,
      amountUsd6: row.amount_cents * USD6_PER_CENT,
    };
    if (status === "APPROVED") return send(ctx, row.account, { ...base, kind: "approved" });
    if (status !== "DECLINED") return;
    const reason = declineReasonOf(row) ?? "issuer_error";
    return send(ctx, row.account, { ...base, kind: "declined", reason: REASON[reason] });
  } catch (error) {
    ctx.log.warn({ err: describeError(error), txn: txnToken }, "card decision notification skipped");
  }
}

/**
 * A decline the issuer made without asking us (a card we hold paused is declined by Lithic itself, so no ASA request
 * and no `card_auth` row exist): the push still names the reason. `ref` is the issuer's transaction token.
 */
export async function notifyIssuerDecline(
  ctx: CardContext,
  account: string,
  txnToken: string,
  merchant: string | null,
  amountCents: number,
  reason: AppDeclineReason,
): Promise<void> {
  await send(ctx, account, {
    kind: "declined",
    ref: txnToken,
    txn: txnToken,
    merchant,
    amountUsd6: BigInt(amountCents) * USD6_PER_CENT,
    reason: REASON[reason],
  });
}

interface PaymentRef {
  id: string;
  txn_token: string;
  merchant: string | null;
}

/**
 * Once a capture is finalized: "$x settled at …" with the amount the chain captured (`HoldCaptured.captured`, an
 * over-capture included) and, when the collateral couldn't cover it, the card debt it created — the same numbers the
 * ledger and the summary record. `ref` = the hold, captured once.
 */
export async function notifyCaptured(
  ctx: CardContext,
  holdId: string,
  account: string,
  capturedUsd6: bigint,
  debtUsd6: bigint,
) {
  if (capturedUsd6 === 0n) return;
  try {
    const [auth] = await ctx.db<PaymentRef[]>`
      SELECT id, txn_token, request->'merchant'->>'descriptor' AS merchant FROM card_auth
       WHERE hold_id = ${holdId} AND status = 'APPROVED' ORDER BY received_at LIMIT 1`;
    await send(ctx, account, {
      kind: "captured",
      ref: holdId,
      authId: auth?.id,
      txn: auth?.txn_token,
      merchant: auth?.merchant ?? null,
      amountUsd6: capturedUsd6,
      debtUsd6,
    });
  } catch (error) {
    ctx.log.warn({ err: describeError(error), hold: holdId }, "capture notification skipped");
  }
}

/** Once a refund is finalized: "$x refunded by …" (`ref` = the refund's onchain id, refunded once). */
export async function notifyRefunded(
  ctx: CardContext,
  refId: string,
  account: string,
  amountUsd6: bigint,
  from: { txnToken?: string | undefined; merchant?: string | undefined },
) {
  try {
    const [auth] = from.txnToken
      ? await ctx.db<PaymentRef[]>`
          SELECT id, txn_token, request->'merchant'->>'descriptor' AS merchant FROM card_auth
           WHERE issuer = ${ctx.env.CARD_ISSUER_LABEL} AND txn_token = ${from.txnToken}
           ORDER BY received_at LIMIT 1`
      : [];
    await send(ctx, account, {
      kind: "refunded",
      ref: refId,
      authId: auth?.id,
      txn: from.txnToken,
      merchant: from.merchant ?? auth?.merchant ?? null,
      amountUsd6,
    });
  } catch (error) {
    ctx.log.warn({ err: describeError(error), ref: refId }, "refund notification skipped");
  }
}

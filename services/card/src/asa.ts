import { randomUUID } from "node:crypto";
import { getAddress, type Hex } from "@senryo/chain";
import { positionCount } from "@senryo/config";
import type { LatencyTimer } from "@senryo/service-common";
import { bytes32Of, holdAmount, holdIdOf, usd6ToCents } from "./amounts.ts";
import { DUPLICATE_POLL_MS, RESPOND_MARGIN_MS } from "./constants.ts";
import type { CardContext } from "./context.ts";
import type { AsaRequest, AsaResponse, AsaResult } from "./lithic/schemas.ts";
import { enqueue } from "./outbox.ts";
import { reserveHold, spendable } from "./reserve.ts";
import { submitHold } from "./submit.ts";

/**
 * ASA decision (specs/services.md §card 2–5; flows.md F31). Signature verification happens in the route before this.
 *   idempotency (UNIQUE issuer, txn_token, kind) → reserve under the account lock → placeHold from the operator shard
 *   → finalized before INTERNAL_DEADLINE_MS ⇒ APPROVED · else the envelope covers ⇒ APPROVED · else DECLINE and the
 *   outbox releases the hold if it lands later. Every stage is timed into `latency_samples`.
 */

type Kind = "AUTH" | "FINANCIAL_AUTH" | "BALANCE_INQUIRY" | "CREDIT_AUTH";

const KIND_OF: Record<AsaRequest["status"], Kind> = {
  AUTHORIZATION: "AUTH",
  FINANCIAL_AUTHORIZATION: "FINANCIAL_AUTH",
  BALANCE_INQUIRY: "BALANCE_INQUIRY",
  CREDIT_AUTHORIZATION: "CREDIT_AUTH",
  FINANCIAL_CREDIT_AUTHORIZATION: "CREDIT_AUTH",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function decide(ctx: CardContext, authId: string, result: AsaResult, reason: string, holdId?: Hex) {
  await ctx.db`UPDATE card_auth SET status = ${result === "APPROVED" ? "APPROVED" : "DECLINED"}, result = ${result},
                 reason = ${reason}, hold_id = ${holdId ?? null}, decided_at = now() WHERE id = ${authId}`;
}

/** A retried request (same token): wait for the original decision, never decide twice. */
async function awaitOriginal(ctx: CardContext, issuer: string, token: string, kind: Kind): Promise<AsaResponse> {
  for (;;) {
    const [row] = await ctx.db<{ status: string; result: string | null; deadline_at: Date }[]>`
      SELECT status, result, deadline_at FROM card_auth WHERE issuer = ${issuer} AND txn_token = ${token} AND kind = ${kind}`;
    if (!row) return { result: "INSUFFICIENT_FUNDS" };
    if (row.status !== "PENDING" && row.result) return { result: row.result as AsaResult };
    if (Date.now() > row.deadline_at.getTime() + RESPOND_MARGIN_MS) return { result: "INSUFFICIENT_FUNDS" };
    await sleep(DUPLICATE_POLL_MS);
  }
}

export async function handleAsa(ctx: CardContext, req: AsaRequest, timer: LatencyTimer): Promise<AsaResponse> {
  const receivedAt = Date.now();
  const deadline = receivedAt + ctx.env.INTERNAL_DEADLINE_MS - RESPOND_MARGIN_MS;
  const kind = KIND_OF[req.status];
  const issuer = ctx.env.CARD_ISSUER_LABEL;
  const [card] = await ctx.db<{ account: string; state: string }[]>`
    SELECT account, state FROM cards WHERE card_token = ${req.card.token} AND chain_id = ${ctx.chainId}`;
  const authId = randomUUID();
  timer.refId = authId;
  const inserted = await ctx.db`
    INSERT INTO card_auth (id, issuer, txn_token, kind, chain_id, card_token, account, amount_cents, currency, mcc,
                           status, deadline_at, request)
    VALUES (${authId}, ${issuer}, ${req.token}, ${kind}, ${ctx.chainId}, ${req.card.token}, ${card?.account ?? null},
            ${BigInt(req.amounts.cardholder.amount)}, ${req.amounts.cardholder.currency}, ${req.merchant.mcc ?? null},
            'PENDING', ${new Date(deadline)}, ${ctx.db.json({ status: req.status, amounts: req.amounts, merchant: req.merchant } as never)})
    ON CONFLICT (issuer, txn_token, kind) DO NOTHING RETURNING id`;
  timer.mark("idempotency");
  if (inserted.length === 0) return awaitOriginal(ctx, issuer, req.token, kind);

  if (card?.state !== "ACTIVE") {
    await decide(ctx, authId, "CARD_PAUSED", card ? `card ${card.state}` : "unknown card");
    return { result: "CARD_PAUSED" };
  }
  const account = getAddress(card.account);

  if (kind === "BALANCE_INQUIRY") {
    const balance = await spendable(ctx, account);
    timer.mark("snapshot");
    await decide(ctx, authId, "APPROVED", "balance inquiry");
    return {
      result: "APPROVED",
      balance: { amount: usd6ToCents(balance.settled), available: usd6ToCents(balance.available) },
    };
  }
  if (kind === "CREDIT_AUTH") {
    await decide(ctx, authId, "APPROVED", "credit (refund arrives as a RETURN event)");
    return { result: "APPROVED" };
  }

  const amount = holdAmount(req, { fxBps: ctx.env.FX_BUFFER_BPS, tipBps: ctx.env.TIP_BUFFER_BPS });
  if ("rejected" in amount) {
    const result: AsaResult = amount.rejected === "too-large" ? "VELOCITY_EXCEEDED" : "UNAUTHORIZED_MERCHANT";
    await decide(ctx, authId, result, `amount ${amount.rejected}`);
    return { result };
  }
  const txnToken = bytes32Of(req.token);
  const holdId = holdIdOf(ctx.issuer, txnToken);
  await ctx.db`UPDATE card_auth SET hold_usd6 = ${amount.usd6}, hold_id = ${holdId}, mode = ${amount.buffer} WHERE id = ${authId}`;

  const reserve = await reserveHold(ctx, { account, holdId, txnToken: req.token, amount: amount.usd6 });
  timer.mark("reserve");
  if (!reserve.ok) {
    const result: AsaResult = reserve.reason === "allowance" ? "VELOCITY_EXCEEDED" : "INSUFFICIENT_FUNDS";
    await decide(ctx, authId, result, `${reserve.reason}: available ${reserve.available} < ${amount.usd6}`);
    return { result };
  }

  const positions = positionCount(reserve.snapshot.positionBitmap);
  const submitted = submitHold(ctx, { holdId, txnToken, account, amount: amount.usd6, positions });
  const outcome = await Promise.race([submitted, sleep(Math.max(deadline - Date.now(), 0)).then(() => undefined)]);
  timer.mark("placeHold→finalized");
  if (outcome?.stage === "finalized") {
    await decide(ctx, authId, "APPROVED", "hold finalized", holdId);
    return { result: "APPROVED" };
  }
  if (outcome === undefined && reserve.envelopeCovers) {
    await decide(ctx, authId, "APPROVED", "envelope covers (hold still settling)", holdId);
    return { result: "APPROVED" };
  }
  // Declined: if the hold lands anyway, release it (outbox re-checks the chain before sending).
  await enqueue(ctx.db, ctx.chainId, "releaseIfLanded", `release-declined:${holdId}`, { holdId, account });
  await decide(ctx, authId, "INSUFFICIENT_FUNDS", outcome ? outcome.reason : "deadline before finality", holdId);
  return { result: "INSUFFICIENT_FUNDS" };
}

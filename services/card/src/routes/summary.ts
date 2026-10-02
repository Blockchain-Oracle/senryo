import { type CardSummary, cardRepayQuoteRoute, cardSummaryRoute } from "@senryo/api-client";
import { contractCall, describeError, getAddress } from "@senryo/chain";
import { positionGasLimit } from "@senryo/config";
import { HTTP_STATUS, HttpError, type HttpServer, parseRoute, sendRoute } from "@senryo/service-common";
import { ISSUER_NAME } from "../constants.ts";
import type { CardContext } from "../context.ts";
import { declineReasonOf, effectiveStatus } from "../decline.ts";
import { OPEN_HOLD_STATUSES } from "../reserve.ts";
import { type AppKit, type CardRow, type ChainView, readChainView, sandboxBase } from "./kit.ts";

const RECENT_AUTHS = 20;
const LAST4 = /^\d{4}$/;

interface AuthRow {
  id: string;
  kind: string;
  status: string;
  result: string | null;
  reason: string | null;
  deadline_at: Date;
  amount_cents: bigint;
  hold_usd6: bigint | null;
  mcc: string | null;
  merchant_descriptor: string | null;
  received_at: Date;
}

/** Cards issued before `last4` was stored: fill it once from the issuer (never the PAN; rows without it retry). */
async function backfillLast4(ctx: CardContext, card: CardRow): Promise<string | null> {
  if (card.last4 || card.state === "CLOSED" || !ctx.lithic) return card.last4;
  try {
    const issued = await ctx.lithic.card(card.card_token);
    const last4 = issued.last_four && LAST4.test(issued.last_four) ? issued.last_four : null;
    if (last4)
      await ctx.db`UPDATE cards SET last4 = ${last4}, updated_at = now() WHERE card_token = ${card.card_token}`;
    return last4;
  } catch (error) {
    ctx.log.warn({ err: describeError(error), card: card.card_token }, "last4 backfill failed");
    return null;
  }
}

/**
 * The card summary (E2–E6): the live card first, spendable-side facts (open holds, card debt), the issuer's status
 * (named when unavailable), and recent authorisations with their decline reasons. Reads only Postgres and one chain
 * snapshot — the issuer is called only to backfill a missing last4.
 */
export async function buildSummary(
  ctx: CardContext,
  address: string,
): Promise<{ summary: CardSummary; chain: ChainView | null }> {
  const account = address.toLowerCase();
  const sandbox = sandboxBase(ctx);
  const [cards, [held], recent, chain] = await Promise.all([
    ctx.db<CardRow[]>`
      SELECT card_token, account, state, label, last4, created_at FROM cards
       WHERE account = ${account} AND chain_id = ${ctx.chainId}
       ORDER BY (state = 'CLOSED'), created_at DESC`,
    ctx.db<{ total: bigint }[]>`
      SELECT COALESCE(SUM(amount_usd6), 0)::bigint AS total FROM holds
       WHERE account = ${account} AND chain_id = ${ctx.chainId} AND status IN ${ctx.db(OPEN_HOLD_STATUSES)}`,
    ctx.db<AuthRow[]>`
      SELECT id, kind, status, result, reason, deadline_at, amount_cents, hold_usd6, mcc, received_at,
             request->'merchant'->>'descriptor' AS merchant_descriptor
        FROM card_auth WHERE account = ${account} AND chain_id = ${ctx.chainId}
       ORDER BY received_at DESC LIMIT ${RECENT_AUTHS}`,
    readChainView(ctx, address),
  ]);
  const now = Date.now();
  const summary: CardSummary = {
    account: getAddress(address),
    cards: await Promise.all(
      cards.map(async (c) => ({
        cardToken: c.card_token,
        state: c.state,
        label: c.label,
        last4: await backfillLast4(ctx, c),
        sandbox,
        capabilities: { reveal: ctx.lithic !== undefined && c.state !== "CLOSED", walletProvisioning: false },
        issuedAt: c.created_at.toISOString(),
      })),
    ),
    issuer: { name: ISSUER_NAME, sandbox, status: ctx.lithic ? "ready" : "issuer_unavailable" },
    openHoldsUsd6: held?.total ?? 0n,
    debtUsd6: chain?.debtUsd6 ?? null,
    recent: recent.map((r) => ({
      id: r.id,
      kind: r.kind,
      status: effectiveStatus(r, now),
      result: r.result,
      declineReason: declineReasonOf(r, now),
      amountCents: r.amount_cents,
      holdUsd6: r.hold_usd6,
      mcc: r.mcc,
      merchantDescriptor: r.merchant_descriptor,
      receivedAt: r.received_at.toISOString(),
    })),
  };
  return { summary, chain };
}

export function registerSummaryRoutes(app: HttpServer, ctx: CardContext, kit: AppKit): void {
  app.get(cardSummaryRoute.path, async (request, reply) => {
    const s = await kit.session(request);
    const { summary } = await buildSummary(ctx, s.address);
    return sendRoute(reply, cardSummaryRoute, summary);
  });

  /**
   * E4 Repay: the call that repays card debt from the trading-account balance. The app signs and sends it from the
   * account (session scope: it only lowers a liability); the service never moves user funds. Quoted at `latest`;
   * the contract caps the repayment at the debt when it lands.
   */
  app.post(cardRepayQuoteRoute.path, async (request, reply) => {
    const s = await kit.session(request);
    const { body } = parseRoute(cardRepayQuoteRoute, request);
    const chain = await readChainView(ctx, s.address);
    if (!chain) throw new HttpError(HTTP_STATUS.badGateway, "UPSTREAM_UNAVAILABLE", "chain read failed — try again");
    if (chain.debtUsd6 === 0n) throw new HttpError(HTTP_STATUS.conflict, "NOT_NEEDED", "no card debt to repay");
    const wanted = body.amountUsd6 ?? chain.debtUsd6;
    if (wanted === 0n) throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "amount must be positive");
    const capped = wanted < chain.debtUsd6 ? wanted : chain.debtUsd6;
    const repay = capped < chain.balanceUsd6 ? capped : chain.balanceUsd6;
    if (repay === 0n)
      throw new HttpError(HTTP_STATUS.conflict, "NOT_ELIGIBLE", "no trading-account balance to repay from — add funds");
    const call = contractCall(ctx.chainId, "SenryoCore", "repayCardDebt", [repay], "repayCardDebt");
    return sendRoute(reply, cardRepayQuoteRoute, {
      account: getAddress(s.address),
      chainId: ctx.chainId,
      debtUsd6: chain.debtUsd6,
      balanceUsd6: chain.balanceUsd6,
      repayUsd6: repay,
      remainingDebtUsd6: chain.debtUsd6 - repay,
      tx: {
        to: call.to,
        data: call.data,
        value: 0n,
        gasCap: positionGasLimit("repayCardDebt", chain.positions),
        functionName: "repayCardDebt",
      },
      quotedAt: new Date().toISOString(),
    });
  });
}

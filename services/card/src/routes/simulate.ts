import {
  CARD_SIMULATE_PRESETS,
  type CardSimulateResult,
  cardSimulateRoute,
  cardSimulateStepRoute,
} from "@senryo/api-client";
import { HTTP_STATUS, HttpError, type HttpServer, parseRoute, sendRoute } from "@senryo/service-common";
import { SIMULATE_POLL_MS, SIMULATE_WAIT_MS } from "../constants.ts";
import type { CardContext } from "../context.ts";
import { type AuthOutcomeRow, declineReasonOf, effectiveStatus, issuerResultCode } from "../decline.ts";
import type { LithicApi } from "../lithic/api.ts";
import { notifyIssuerDecline } from "../notify.ts";
import { type AppKit, viaIssuer } from "./kit.ts";

/**
 * Practice payments (D-042, E4) — real Lithic sandbox transactions, never fake rows: `simulate` authorises against
 * the card's PAN (fetched per call, never stored or logged), Lithic sends the ASA request to our responder, and the
 * route reports the decision our responder recorded. `simulate/step` then clears, voids, expires or refunds it, and
 * Lithic's `card_transaction.updated` webhook drives the onchain capture / release / refund.
 */

type Decision = Pick<CardSimulateResult, "authId" | "status" | "declineReason">;
const SIMULATE_RATE = { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function panOf(api: LithicApi, cardToken: string): Promise<string> {
  const card = await viaIssuer(() => api.card(cardToken));
  if (!card.pan) throw new HttpError(HTTP_STATUS.badGateway, "ISSUER_UNAVAILABLE", "card PAN unavailable");
  return card.pan;
}

/**
 * Our recorded decision for the transaction (the ASA `token` is the transaction token), waiting up to
 * SIMULATE_WAIT_MS. No row means the issuer decided without asking us (a paused card, its own checks — or ASA not
 * enrolled): then the issuer's own result is the answer.
 */
async function awaitDecision(ctx: CardContext, api: LithicApi, token: string, wait: boolean): Promise<Decision> {
  const until = Date.now() + (wait ? SIMULATE_WAIT_MS : 0);
  for (;;) {
    const [row] = await ctx.db<(AuthOutcomeRow & { id: string })[]>`
      SELECT id, status, result, reason, deadline_at FROM card_auth
       WHERE issuer = ${ctx.env.CARD_ISSUER_LABEL} AND txn_token = ${token} AND kind IN ('AUTH', 'FINANCIAL_AUTH')
       LIMIT 1`;
    const done = row && row.status !== "PENDING";
    if (row && (done || Date.now() >= until)) {
      const status = effectiveStatus(row) as Decision["status"];
      return { authId: row.id, status, declineReason: declineReasonOf(row) };
    }
    if (Date.now() >= until) break;
    await sleep(SIMULATE_POLL_MS);
  }
  const txn = await api.transaction(token).catch(() => undefined);
  if (!txn) return { authId: null, status: "PENDING", declineReason: null };
  if (txn.result === "APPROVED") {
    ctx.log.warn({ token }, "issuer approved without an ASA request — is the ASA responder enrolled?");
    return { authId: null, status: "APPROVED", declineReason: null };
  }
  return { authId: null, status: "DECLINED", declineReason: issuerResultCode(txn.result) };
}

export function registerSimulateRoutes(app: HttpServer, ctx: CardContext, kit: AppKit): void {
  app.post(cardSimulateRoute.path, SIMULATE_RATE, async (request, reply) => {
    const s = await kit.session(request);
    const { body } = parseRoute(cardSimulateRoute, request);
    const card = await kit.ownCard(body.cardToken, s);
    const api = kit.sandbox();
    const preset = body.preset ? CARD_SIMULATE_PRESETS[body.preset] : undefined;
    const amountCents = body.amountCents ?? preset?.amountCents;
    const descriptor = body.descriptor ?? preset?.descriptor;
    const mcc = body.mcc ?? preset?.mcc;
    if (amountCents === undefined || descriptor === undefined)
      throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "send a preset, or amountCents and descriptor");
    const pan = await panOf(api, card.card_token);
    const sim = await viaIssuer(() => api.simulateAuthorize({ pan, amount: amountCents, descriptor, mcc }));
    if (!sim.token) throw new HttpError(HTTP_STATUS.badGateway, "ISSUER_UNAVAILABLE", "simulate returned no token");
    // A card we hold paused is declined by the issuer itself — no ASA request comes, so don't wait for one.
    const decision = await awaitDecision(ctx, api, sim.token, card.state === "ACTIVE");
    // The issuer declined on its own (no ASA request, so no decision push was recorded): name it here.
    if (decision.authId === null && decision.status === "DECLINED")
      void notifyIssuerDecline(
        ctx,
        card.account,
        sim.token,
        descriptor,
        amountCents,
        decision.declineReason ?? "frozen",
      );
    return sendRoute(reply, cardSimulateRoute, {
      transactionToken: sim.token,
      ...decision,
      amountCents,
      descriptor,
      mcc: mcc ?? null,
    });
  });

  app.post(cardSimulateStepRoute.path, SIMULATE_RATE, async (request, reply) => {
    const s = await kit.session(request);
    const { body } = parseRoute(cardSimulateStepRoute, request);
    const card = await kit.ownCard(body.cardToken, s);
    const api = kit.sandbox();
    const txn = await viaIssuer(() => api.transaction(body.transactionToken));
    if (txn.card_token !== card.card_token)
      throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no such transaction on this card");
    const amount = body.amountCents;
    let result: { token?: string; debugging_request_id?: string };
    switch (body.step) {
      case "clear":
        result = await viaIssuer(() => api.simulateClearing(txn.token, amount));
        break;
      case "void":
        result = await viaIssuer(() => api.simulateVoid(txn.token, "AUTHORIZATION_REVERSAL", amount));
        break;
      case "expire":
        result = await viaIssuer(() => api.simulateVoid(txn.token, "AUTHORIZATION_EXPIRY"));
        break;
      case "return": {
        const authorised = txn.amounts?.cardholder?.amount;
        const refund = amount ?? (authorised ? Math.abs(authorised) : undefined);
        const descriptor = txn.merchant?.descriptor;
        if (!refund || !descriptor)
          throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "send amountCents for this refund");
        const pan = await panOf(api, card.card_token);
        result = await viaIssuer(() => api.simulateReturn({ pan, amount: refund, descriptor }));
        break;
      }
    }
    return sendRoute(reply, cardSimulateStepRoute, {
      transactionToken: result.token ?? txn.token,
      step: body.step,
      debuggingRequestId: result.debugging_request_id ?? null,
    });
  });
}

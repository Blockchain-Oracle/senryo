import {
  cardAllowanceRoute,
  cardEmbedRoute,
  cardFreezeRoute,
  cardSimulateRoute,
  cardSummaryRoute,
} from "@senryo/api-client";
import {
  contractCall,
  describeError,
  readContract,
  SimulationRevertedError,
  sendAndFinalize,
  verifySpendAllowanceSignature,
} from "@senryo/chain";
import {
  HTTP_STATUS,
  HttpError,
  type HttpServer,
  MS_PER_SECOND,
  parseRoute,
  type Session,
  sendRoute,
} from "@senryo/service-common";
import type { FastifyRequest } from "fastify";
import { type CardContext, operatorFor } from "../context.ts";
import { OPEN_HOLD_STATUSES } from "../reserve.ts";

const DEFAULT_EMBED_TTL_SEC = 60;
const RECENT_AUTHS = 20;

/** Allowance relays in flight, by user (one process serves the card API). */
const allowanceInflight = new Set<string>();

/** App-facing card routes (session = the api's SIWE token; D-111). Lithic-backed ones need `LITHIC_API_KEY`. */
export function registerAppRoutes(app: HttpServer, ctx: CardContext): void {
  const session = async (request: FastifyRequest): Promise<Session> => {
    if (!ctx.sessions) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", "sessions not configured");
    return ctx.sessions.require(request);
  };
  const lithic = () => {
    if (!ctx.lithic) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", "card issuer not configured");
    return ctx.lithic;
  };
  const ownCard = async (cardToken: string, s: Session) => {
    const [card] = await ctx.db<{ account: string }[]>`SELECT account FROM cards WHERE card_token = ${cardToken}`;
    if (!card || card.account !== s.address.toLowerCase())
      throw new HttpError(HTTP_STATUS.notFound, "NOT_FOUND", "no such card");
  };

  app.post(
    cardSimulateRoute.path,
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const s = await session(request);
      const { body } = parseRoute(cardSimulateRoute, request);
      await ownCard(body.cardToken, s);
      const api = lithic();
      if (!api.isSandbox) throw new HttpError(HTTP_STATUS.forbidden, "FORBIDDEN", "simulate is sandbox-only (D-042)");
      const card = await api.card(body.cardToken);
      if (!card.pan) throw new HttpError(HTTP_STATUS.badGateway, "UPSTREAM_UNAVAILABLE", "card PAN unavailable");
      const sim = await api.simulateAuthorize({
        pan: card.pan,
        amount: body.amountCents,
        descriptor: body.descriptor,
        mcc: body.mcc,
      });
      return sendRoute(reply, cardSimulateRoute, { transactionToken: sim.token });
    },
  );

  app.post(cardFreezeRoute.path, async (request, reply) => {
    const s = await session(request);
    const { body } = parseRoute(cardFreezeRoute, request);
    await ownCard(body.cardToken, s);
    const updated = await lithic().setState(body.cardToken, body.frozen ? "PAUSED" : "OPEN");
    await ctx.db`UPDATE cards SET state = ${body.frozen ? "PAUSED" : "ACTIVE"}, updated_at = now() WHERE card_token = ${body.cardToken}`;
    return sendRoute(reply, cardFreezeRoute, { cardToken: body.cardToken, state: updated.state });
  });

  app.get(cardEmbedRoute.path, async (request, reply) => {
    const s = await session(request);
    const { query } = parseRoute(cardEmbedRoute, request);
    await ownCard(query.cardToken, s);
    const ttl = query.ttlSec ?? DEFAULT_EMBED_TTL_SEC;
    const url = lithic().embedUrl(query.cardToken, ttl);
    return sendRoute(reply, cardEmbedRoute, {
      url,
      expiresAt: new Date(Date.now() + ttl * MS_PER_SECOND).toISOString(),
    });
  });

  app.post(
    cardAllowanceRoute.path,
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      // S8.5b #4: only the signed-in owner may spend operator gas on their allowance, one relay at a time.
      const s = await session(request);
      const { body } = parseRoute(cardAllowanceRoute, request);
      if (body.chainId !== ctx.chainId)
        throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "wrong chain for this card service");
      if (s.address.toLowerCase() !== body.user.toLowerCase())
        throw new HttpError(HTTP_STATUS.forbidden, "FORBIDDEN", "allowance must be for the signed-in account");
      const key = body.user.toLowerCase();
      if (allowanceInflight.has(key))
        throw new HttpError(HTTP_STATUS.conflict, "RELAYER_BUSY", "an allowance update is already in flight");
      allowanceInflight.add(key);
      try {
        const nonce = await readContract(ctx.chainId, "SenryoCore", ctx.read).read.allowanceNonce([body.user]);
        const ok = await verifySpendAllowanceSignature({
          chainId: ctx.chainId,
          user: body.user,
          dailyLimit: body.dailyLimitUsd6,
          expiry: body.expiry,
          nonce: BigInt(nonce),
          signature: body.signature,
        });
        if (!ok) throw new HttpError(HTTP_STATUS.badRequest, "SIGNATURE_INVALID", "allowance signature does not match");
        try {
          const sent = await sendAndFinalize(
            operatorFor(ctx, body.user),
            contractCall(
              ctx.chainId,
              "SenryoCore",
              "setSpendAllowance",
              [body.user, body.dailyLimitUsd6, body.expiry, body.signature],
              "setSpendAllowance",
            ),
          );
          return sendRoute(reply, cardAllowanceRoute, { txHash: sent.hash, stage: sent.final.stage });
        } catch (error) {
          const code = error instanceof SimulationRevertedError ? "RELAY_REVERTED" : "RELAYER_BUSY";
          throw new HttpError(HTTP_STATUS.badGateway, code, describeError(error));
        }
      } finally {
        allowanceInflight.delete(key);
      }
    },
  );

  app.get(cardSummaryRoute.path, async (request, reply) => {
    const s = await session(request);
    const account = s.address.toLowerCase();
    const cards = await ctx.db<{ card_token: string; state: string; label: string | null }[]>`
      SELECT card_token, state, label FROM cards WHERE account = ${account} ORDER BY created_at`;
    const [held] = await ctx.db<{ total: bigint }[]>`
      SELECT COALESCE(SUM(amount_usd6), 0)::bigint AS total FROM holds
       WHERE account = ${account} AND chain_id = ${ctx.chainId} AND status IN ${ctx.db(OPEN_HOLD_STATUSES)}`;
    const recent = await ctx.db<
      {
        id: string;
        kind: string;
        status: string;
        result: string | null;
        amount_cents: bigint;
        hold_usd6: bigint | null;
        mcc: string | null;
        received_at: Date;
      }[]
    >`SELECT id, kind, status, result, amount_cents, hold_usd6, mcc, received_at FROM card_auth
       WHERE account = ${account} ORDER BY received_at DESC LIMIT ${RECENT_AUTHS}`;
    return sendRoute(reply, cardSummaryRoute, {
      account: s.address,
      cards: cards.map((c) => ({ cardToken: c.card_token, state: c.state, label: c.label })),
      openHoldsUsd6: held?.total ?? 0n,
      recent: recent.map((r) => ({
        id: r.id,
        kind: r.kind,
        status: r.status,
        result: r.result,
        amountCents: r.amount_cents,
        holdUsd6: r.hold_usd6,
        mcc: r.mcc,
        receivedAt: r.received_at.toISOString(),
      })),
    });
  });
}

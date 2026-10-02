import { cardAllowanceRoute, cardEmbedRoute } from "@senryo/api-client";
import {
  contractCall,
  describeError,
  readContract,
  SimulationRevertedError,
  sendAndFinalize,
  verifySpendAllowanceSignature,
} from "@senryo/chain";
import { HTTP_STATUS, HttpError, type HttpServer, MS_PER_SECOND, parseRoute, sendRoute } from "@senryo/service-common";
import { type CardContext, operatorFor } from "../context.ts";
import { registerIssueRoutes } from "./issue.ts";
import { appKit } from "./kit.ts";
import { registerSimulateRoutes } from "./simulate.ts";
import { registerSummaryRoutes } from "./summary.ts";

const DEFAULT_EMBED_TTL_SEC = 60;

/** Allowance relays in flight, by user (one process serves the card API). */
const allowanceInflight = new Set<string>();

/**
 * App-facing card routes (session = the api's SIWE token; D-111). Issuer-backed ones need `LITHIC_API_KEY` and
 * answer a named `ISSUER_UNAVAILABLE` without it:
 *   issue · freeze · unfreeze (issue.ts) · summary · repay-quote (summary.ts) · simulate · simulate/step (simulate.ts)
 *   embed · allowance (here)
 */
export function registerAppRoutes(app: HttpServer, ctx: CardContext): void {
  const kit = appKit(ctx);
  registerIssueRoutes(app, ctx, kit);
  registerSummaryRoutes(app, ctx, kit);
  registerSimulateRoutes(app, ctx, kit);

  app.get(cardEmbedRoute.path, async (request, reply) => {
    const s = await kit.session(request);
    const { query } = parseRoute(cardEmbedRoute, request);
    const card = await kit.ownCard(query.cardToken, s);
    if (card.state === "CLOSED") throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", "card is closed");
    const ttl = query.ttlSec ?? DEFAULT_EMBED_TTL_SEC;
    const url = kit.issuer().embedUrl(card.card_token, ttl);
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
      const s = await kit.session(request);
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
}

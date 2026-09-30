/**
 * `POST /v1/starter/topup` (S8.16c, D-171): the app signs `TopUp(user, needWei, deadline)` with its unlocked session
 * (in scope → no prompt) when its next send's gas budget exceeds the balance; the sponsor sends `StarterDrip.topUp`.
 * Single-flight per (chain, user); eligibility and the amount come from `planTopUp`; recorded as a `topup` relay.
 */
import { starterTopUpRoute } from "@senryo/api-client";
import { verifyTopUpSignature } from "@senryo/chain";
import { HTTP_STATUS, HttpError, type HttpServer, parseRoute, sendRoute } from "@senryo/service-common";
import { type ApiContext, chainOf } from "../context.ts";
import { networkPrefix } from "../geo.ts";
import { relay } from "../starter.ts";
import { planTopUp } from "../topup.ts";
import { checkDeadline, checkGeo, deviceOf, once } from "./starter.ts";

const TOPUP_RATE = { max: 20, timeWindow: "1 minute" } as const;

export function registerTopUpRoutes(app: HttpServer, ctx: ApiContext): void {
  app.post(starterTopUpRoute.path, { config: { rateLimit: TOPUP_RATE } }, async (request, reply) => {
    const { body } = parseRoute(starterTopUpRoute, request);
    const chain = chainOf(ctx, body.chainId);
    checkGeo(ctx, body.chainId, request);
    checkDeadline(body.deadline);
    const signed = await verifyTopUpSignature(body);
    if (!signed) throw new HttpError(HTTP_STATUS.badRequest, "SIGNATURE_INVALID", "top-up signature does not match");
    const result = await once(`${body.chainId}:${body.user.toLowerCase()}:topup`, async () => {
      const amountWei = await planTopUp(chain, body.user, body.needWei);
      return relay(ctx, chain, {
        kind: "topup",
        user: body.user,
        deadline: body.deadline,
        signature: body.signature,
        amountWei,
        ipPrefix: networkPrefix(request.ip),
        deviceHash: deviceOf(request),
      });
    });
    return sendRoute(reply, starterTopUpRoute, result);
  });
}

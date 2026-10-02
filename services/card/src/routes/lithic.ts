import { HTTP_STATUS, type HttpServer, LatencyTimer } from "@senryo/service-common";
import type { FastifyRequest } from "fastify";
import { handleAsa, recordFailedDecision } from "../asa.ts";
import type { CardContext } from "../context.ts";
import { handleTransactionWebhook } from "../events.ts";
import { asaRequestSchema, cardTransactionWebhookSchema } from "../lithic/schemas.ts";
import { SIGNATURE_HEADERS, verifySignature } from "../lithic/signature.ts";
import { notifyDecision } from "../notify.ts";

/**
 * Issuer webhooks. JSON is parsed from the raw bytes inside this encapsulated plugin so the HMAC is computed over
 * exactly what Lithic signed (Fastify docs: content-type parser with `parseAs: "buffer"`). A bad signature is a 401
 * (Lithic does not retry 4xx; for ASA that is a decline). ASA errors never 5xx — a 5xx makes Lithic retry, so an
 * internal failure answers a decline instead.
 */

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

function headerOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function registerLithicRoutes(app: HttpServer, ctx: CardContext): void {
  void app.register(async (scope) => {
    scope.addContentTypeParser("application/json", { parseAs: "buffer" }, (request, body, done) => {
      request.rawBody = body as Buffer;
      try {
        done(null, JSON.parse((body as Buffer).toString("utf8")));
      } catch (error) {
        (error as { statusCode?: number }).statusCode = HTTP_STATUS.badRequest;
        done(error as Error, undefined);
      }
    });

    const verified = (secret: string | undefined, request: FastifyRequest) => {
      if (!secret || !request.rawBody) return false;
      const check = verifySignature(
        secret,
        {
          id: headerOf(request.headers[SIGNATURE_HEADERS.id]),
          timestamp: headerOf(request.headers[SIGNATURE_HEADERS.timestamp]),
          signature: headerOf(request.headers[SIGNATURE_HEADERS.signature]),
        },
        request.rawBody,
        ctx.env.WEBHOOK_TOLERANCE_S,
      );
      if (!check.ok) request.log.warn({ reason: check.reason }, "webhook signature rejected");
      return check.ok;
    };

    scope.post("/v1/card/lithic/asa", async (request, reply) => {
      const timer = new LatencyTimer("card", "asa");
      if (!verified(ctx.secrets.asaSecret, request)) return reply.code(HTTP_STATUS.unauthorized).send({});
      timer.mark("verify");
      const parsed = asaRequestSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(HTTP_STATUS.badRequest).send({ result: "UNAUTHORIZED_MERCHANT" });
      let response: Awaited<ReturnType<typeof handleAsa>>;
      let failure: unknown;
      try {
        response = await handleAsa(ctx, parsed.data, timer);
      } catch (error) {
        request.log.error({ err: error, token: parsed.data.token }, "ASA handler failed — declining");
        response = { result: "INSUFFICIENT_FUNDS" };
        failure = error;
      }
      await reply.code(HTTP_STATUS.ok).send(response);
      // After the reply: the decision is already sent; the row only has to say so, then the push names it (E-D5).
      const recorded =
        failure === undefined
          ? Promise.resolve()
          : recordFailedDecision(ctx, parsed.data, failure).catch((error: unknown) =>
              request.log.warn({ err: error, token: parsed.data.token }, "could not record the failed decision"),
            );
      void recorded.then(() => notifyDecision(ctx, parsed.data.token));
      timer.mark("respond");
      request.log.info({ token: parsed.data.token, result: response.result, ms: timer.summary() }, "asa decided");
      void timer.flush(ctx.db, ctx.log);
      return reply;
    });

    scope.post("/v1/card/lithic/events", async (request, reply) => {
      if (!verified(ctx.secrets.webhookSecret, request)) return reply.code(HTTP_STATUS.unauthorized).send({});
      const parsed = cardTransactionWebhookSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(HTTP_STATUS.ok).send({ ignored: true });
      const queued = await handleTransactionWebhook(ctx, parsed.data);
      return reply.code(HTTP_STATUS.ok).send({ ok: true, queued });
    });
  });
}

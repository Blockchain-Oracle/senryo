import type { ApiErrorBody, ApiErrorCode, RouteDef } from "@senryo/api-client";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import { DEFAULT_BODY_LIMIT_BYTES, HTTP_STATUS as HTTP, MS_PER_SECOND } from "./constants.ts";
import type { Logger } from "./logger.ts";

/** A deliberate client-facing error: rendered as `{ error: { code, message, … } }` (api-client `ApiErrorBody`). */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly retryAfterSec?: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

function body(code: ApiErrorCode, message: string, retryAfterSec?: number, details?: unknown): ApiErrorBody {
  return {
    error: {
      code,
      message,
      ...(retryAfterSec === undefined ? {} : { retryAfterSec }),
      ...(details === undefined ? {} : { details }),
    },
  };
}

export interface ServerOptions {
  service: string;
  logger: Logger;
  bodyLimit?: number;
  /** Readiness checks for `/ready` (never used as the container health check — runbook §7). */
  ready?: () => Promise<Record<string, boolean>>;
  /** Extra liveness condition (keeper: fails when the last tick is older than KEEPER_STALE_SEC). */
  live?: () => { ok: boolean; detail?: Record<string, unknown> };
}

/** Proxies between the internet and the service (deploy-runbook: Traefik only). */
export const TRUSTED_PROXY_HOPS = 1;

export function createHttpServer(options: ServerOptions) {
  const app = Fastify({
    loggerInstance: options.logger,
    bodyLimit: options.bodyLimit ?? DEFAULT_BODY_LIMIT_BYTES,
    // Behind exactly one proxy (Coolify's Traefik): trust only the hop Traefik appended, so `request.ip` is the real
    // client and a client-sent X-Forwarded-For can't choose it (S8.5b). A CDN in front adds a hop → raise this.
    trustProxy: (_address: string, hop: number) => hop < TRUSTED_PROXY_HOPS,
  });
  const startedAt = Date.now();

  app.get("/health", async (_request, reply) => {
    const live = options.live?.() ?? { ok: true };
    return reply.code(live.ok ? HTTP.ok : HTTP.unavailable).send({
      ok: live.ok,
      service: options.service,
      uptimeSec: Math.floor((Date.now() - startedAt) / MS_PER_SECOND),
      ...live.detail,
    });
  });

  app.get("/ready", async (_request, reply) => {
    const checks = (await options.ready?.()) ?? {};
    const ok = Object.values(checks).every(Boolean);
    return reply.code(ok ? HTTP.ok : HTTP.unavailable).send({ ok, service: options.service, checks });
  });

  app.setNotFoundHandler((_request, reply) => {
    void reply.code(HTTP.notFound).send(body("NOT_FOUND", "no such route"));
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      if (error.retryAfterSec !== undefined) void reply.header("retry-after", String(error.retryAfterSec));
      return reply.code(error.status).send(body(error.code, error.message, error.retryAfterSec, error.details));
    }
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
      return reply.code(HTTP.badRequest).send(body("BAD_REQUEST", "invalid request", undefined, issues));
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status === HTTP.tooLarge) return reply.code(status).send(body("PAYLOAD_TOO_LARGE", "request body too large"));
    if (status === HTTP.tooMany) return reply.code(status).send(body("RATE_LIMITED", "too many requests"));
    if (status !== undefined && status < HTTP.internal) {
      return reply.code(status).send(body("BAD_REQUEST", (error as Error).message));
    }
    request.log.error({ err: error }, "unhandled error");
    return reply.code(HTTP.internal).send(body("INTERNAL", "internal error"));
  });

  return app;
}

/** Decode a request against a shared route definition (zod codecs: strings → bigints). Throws ZodError → 400. */
export function parseRoute<R extends RouteDef>(
  route: R,
  request: FastifyRequest,
): {
  params: R["params"] extends z.ZodType ? z.output<R["params"]> : undefined;
  query: R["query"] extends z.ZodType ? z.output<R["query"]> : undefined;
  body: R["body"] extends z.ZodType ? z.output<R["body"]> : undefined;
} {
  return {
    params: route.params?.parse(request.params),
    query: route.query?.parse(request.query),
    body: route.body?.parse(request.body),
  } as never;
}

/** Encode a response with the route's schema (bigints → strings) and send it. */
export function sendRoute<R extends RouteDef>(reply: FastifyReply, route: R, value: z.output<R["response"]>) {
  return reply.code(route.status ?? HTTP.ok).send(route.response.encode(value));
}

const SHUTDOWN_SIGNALS = ["SIGTERM", "SIGINT"] as const;
const SHUTDOWN_GRACE_MS = 5_000;

/** Listen on HOST:PORT and close gracefully (Coolify sends SIGTERM on redeploy). */
export type HttpServer = ReturnType<typeof createHttpServer>;

export async function listen(app: HttpServer, port: number, host: string, onClose?: () => Promise<void>) {
  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, () => {
      app.log.info({ signal }, "shutting down");
      // Never hang a redeploy: exit even if a socket or pool refuses to close.
      setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
      void app
        .close()
        .then(() => onClose?.())
        .finally(() => process.exit(0));
    });
  }
  await app.listen({ port, host });
}

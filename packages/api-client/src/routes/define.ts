import type { z } from "zod";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

/**
 * How a route authenticates:
 *  - none: public (rate-limited)
 *  - session: `Authorization: Bearer <token>` from `POST /v1/auth/verify` (SIWE signed by the Mera EOA)
 *  - webhook: issuer signature over the raw body (card service only)
 */
export type RouteAuth = "none" | "session" | "webhook";

export interface RouteDef<
  Params extends z.ZodType | undefined = z.ZodType | undefined,
  Query extends z.ZodType | undefined = z.ZodType | undefined,
  Body extends z.ZodType | undefined = z.ZodType | undefined,
  Response extends z.ZodType = z.ZodType,
> {
  method: HttpMethod;
  /** Fastify-style path (`/v1/vault/:credentialId`). */
  path: string;
  auth: RouteAuth;
  params?: Params;
  query?: Query;
  body?: Body;
  response: Response;
  /** Success status (default 200). */
  status?: number;
}

/** Identity helper that keeps the literal schema types of a route. */
export function defineRoute<
  Params extends z.ZodType | undefined,
  Query extends z.ZodType | undefined,
  Body extends z.ZodType | undefined,
  Response extends z.ZodType,
>(def: RouteDef<Params, Query, Body, Response>): RouteDef<Params, Query, Body, Response> {
  return def;
}

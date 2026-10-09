import type * as z from "zod";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

/**
 * How a route authenticates:
 *  - none: public (rate-limited)
 *  - session: `Authorization: Bearer <token>` from `POST /v1/auth/verify` (SIWE signed by the Mera EOA)
 *  - optional: public, but the client sends the session token when it has one (viewer-specific filtering: blocks,
 *    mutes, likes, "Your rank"); the server reads an invalid or missing token as anonymous
 *  - webhook: issuer signature over the raw body (card service only)
 *  - admin: operator bearer secret (`API_ADMIN_SECRET`); never in an app bundle, so the app client never sends one
 */
export type RouteAuth = "none" | "session" | "optional" | "webhook" | "admin";

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
  /** `undefined` when the route takes none (keys are required so `R["body"]` stays exact in conditional types). */
  params: Params;
  query: Query;
  body: Body;
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

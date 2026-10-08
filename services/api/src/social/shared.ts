import type { MyProfile, SocialIdentity } from "@senryo/api-client";
import { type Address, getAddress } from "@senryo/chain";

import { HTTP_STATUS, HttpError, type Session, type Tx } from "@senryo/service-common";
import type { FastifyRequest } from "fastify";
import type { ApiContext } from "../context.ts";
import { PG_DEADLOCK_DETECTED } from "./constants.ts";

/** What the social routes need from the api context (no chains: they run in-process for the social check too). */
export type SocialContext = Pick<ApiContext, "db" | "sessions">;

export async function requireSession(ctx: SocialContext, request: FastifyRequest): Promise<Session> {
  if (!ctx.sessions) throw new HttpError(HTTP_STATUS.unavailable, "NOT_DEPLOYED", "sessions not configured");
  return ctx.sessions.require(request);
}

/** Serialises writers on `ns + key` until the transaction ends — across api instances, unlike a process-local set. */
export async function advisoryLock(tx: Tx, ns: string, key: string): Promise<void> {
  await tx`SELECT pg_advisory_xact_lock(hashtextextended(${ns + key}, 0))`;
}

export { listedColumn, publicTradesColumn, visibleOn } from "@senryo/service-common";

/**
 * The session when a valid bearer token came with the request; anonymous otherwise (an expired token on a public read
 * must not force a Face ID prompt — the client refreshes the session on its own schedule).
 */
export async function optionalSession(ctx: SocialContext, request: FastifyRequest): Promise<Session | undefined> {
  const [scheme, token] = (request.headers.authorization ?? "").split(" ");
  if (!ctx.sessions || scheme !== "Bearer" || !token) return undefined;
  return ctx.sessions.verify(token);
}

export interface ProfileRow {
  address: string;
  handle: string | null;
  display_name: string | null;
  bio: string | null;
  avatar: string | null;
  listed_practice: boolean;
  listed_mainnet: boolean;
  public_trades_practice: boolean;
  public_trades_mainnet: boolean;
  public_trades_practice_since: Date | null;
  public_trades_mainnet_since: Date | null;
  hidden: boolean;
  handle_changed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** An identity as shown on a network (only ever built from a row that passed `visibleOn`). */
export function identityOf(row: {
  address: string;
  handle: string | null;
  display_name: string | null;
  avatar: string | null;
}): SocialIdentity {
  return {
    address: getAddress(row.address) as Address,
    handle: row.handle,
    displayName: row.display_name,
    avatar: row.avatar,
  };
}

export function myProfileOf(row: ProfileRow): MyProfile {
  return {
    address: getAddress(row.address) as Address,
    handle: row.handle,
    displayName: row.display_name,
    bio: row.bio,
    avatar: row.avatar,
    listedPractice: row.listed_practice,
    listedMainnet: row.listed_mainnet,
    publicTradesPractice: row.public_trades_practice,
    publicTradesMainnet: row.public_trades_mainnet,
    handleChangedAt: row.handle_changed_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** The SQLSTATE and constraint of a Postgres error (postgres.js `PostgresError`), read structurally. */
export function pgErrorOf(error: unknown): { code?: string; constraint?: string } {
  if (typeof error !== "object" || error === null) return {};
  const e = error as { code?: unknown; constraint_name?: unknown };
  return {
    ...(typeof e.code === "string" ? { code: e.code } : {}),
    ...(typeof e.constraint_name === "string" ? { constraint: e.constraint_name } : {}),
  };
}

/** A deadlock between two writers is a retryable conflict, never a 500. */
export function rethrowDeadlock(error: unknown): void {
  if (pgErrorOf(error).code === PG_DEADLOCK_DETECTED) {
    throw new HttpError(HTTP_STATUS.conflict, "CONFLICT", "a concurrent update won; retry");
  }
}

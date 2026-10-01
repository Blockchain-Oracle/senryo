import { z } from "zod";
import { addressSchema, chainIdSchema, isoTimeSchema } from "../primitives.ts";
import { defineRoute } from "./define.ts";

/**
 * Deposit inbox watch (S8.24, D-179). The app shows `InboxFactory.inboxOf(user)` (read from the chain, never from this
 * response) and registers it here; the keeper credits deposits that reach `INBOX_SWEEP_MIN_USD6` until `expiresAt`.
 * Public and idempotent: a watch spends no gas and a sweep can only credit `user`, so anyone may register any address.
 */
export const inboxWatchRequestSchema = z.object({ chainId: chainIdSchema, user: addressSchema });

export const inboxWatchResponseSchema = z.object({
  /** The api's own `inboxOf` read; the app compares it with its read and never shows this one. */
  inbox: addressSchema,
  expiresAt: isoTimeSchema,
});

export const inboxWatchRoute = defineRoute({
  method: "POST",
  path: "/v1/inbox/watch",
  auth: "none",
  params: undefined,
  query: undefined,
  body: inboxWatchRequestSchema,
  response: inboxWatchResponseSchema,
});

export type InboxWatchResponse = z.output<typeof inboxWatchResponseSchema>;

import { z } from "zod";
import {
  addressSchema,
  chainIdSchema,
  isoTimeSchema,
  signatureSchema,
  txHashSchema,
  uintCodec,
} from "../primitives.ts";
import { defineRoute } from "./define.ts";

/**
 * services/card routes the apps call (served under `api.<rpId>/v1/card/*`, session = the api's SIWE token).
 * The Lithic webhooks (`/v1/card/lithic/asa`, `/v1/card/lithic/events`) are issuer-signed and not listed here.
 */

const CARD_TOKEN_MAX = 64;
const DESCRIPTOR_MAX = 25;
const MCC_LENGTH = 4;
const EMBED_TTL_MAX_SEC = 300;

export const cardTokenSchema = z.string().min(1).max(CARD_TOKEN_MAX);

/** D-042: trigger a real sandbox authorisation (the ASA then hits our responder). Sandbox only. */
export const cardSimulateRequestSchema = z.object({
  cardToken: cardTokenSchema,
  amountCents: z.int().positive(),
  descriptor: z.string().min(1).max(DESCRIPTOR_MAX),
  mcc: z.string().length(MCC_LENGTH).optional(),
});

export const cardSimulateResponseSchema = z.object({ transactionToken: z.string() });

export const cardFreezeRequestSchema = z.object({ cardToken: cardTokenSchema, frozen: z.boolean() });
export const cardFreezeResponseSchema = z.object({ cardToken: cardTokenSchema, state: z.string() });

export const cardEmbedQuerySchema = z.object({
  cardToken: cardTokenSchema,
  ttlSec: z.coerce.number().int().positive().max(EMBED_TTL_MAX_SEC).optional(),
});
export const cardEmbedResponseSchema = z.object({ url: z.url(), expiresAt: isoTimeSchema });

/** Relay the user-signed EIP-712 `SpendAllowance` (D-032; anyone may relay, the contract verifies). */
export const cardAllowanceRequestSchema = z.object({
  chainId: chainIdSchema,
  user: addressSchema,
  dailyLimitUsd6: uintCodec,
  expiry: uintCodec,
  signature: signatureSchema,
});
export const cardAllowanceResponseSchema = z.object({ txHash: txHashSchema, stage: z.string() });

export const cardAuthSummarySchema = z.object({
  id: z.uuid(),
  kind: z.string(),
  status: z.string(),
  result: z.string().nullable(),
  amountCents: uintCodec,
  holdUsd6: uintCodec.nullable(),
  mcc: z.string().nullable(),
  receivedAt: isoTimeSchema,
});

export const cardSummaryResponseSchema = z.object({
  account: addressSchema,
  cards: z.array(z.object({ cardToken: cardTokenSchema, state: z.string(), label: z.string().nullable() })),
  openHoldsUsd6: uintCodec,
  recent: z.array(cardAuthSummarySchema),
});

export const cardSimulateRoute = defineRoute({
  method: "POST",
  path: "/v1/card/simulate",
  auth: "session",
  params: undefined,
  query: undefined,
  body: cardSimulateRequestSchema,
  response: cardSimulateResponseSchema,
});

export const cardFreezeRoute = defineRoute({
  method: "POST",
  path: "/v1/card/freeze",
  auth: "session",
  params: undefined,
  query: undefined,
  body: cardFreezeRequestSchema,
  response: cardFreezeResponseSchema,
});

export const cardEmbedRoute = defineRoute({
  method: "GET",
  path: "/v1/card/embed",
  auth: "session",
  params: undefined,
  query: cardEmbedQuerySchema,
  body: undefined,
  response: cardEmbedResponseSchema,
});

export const cardAllowanceRoute = defineRoute({
  method: "POST",
  path: "/v1/card/allowance",
  auth: "session",
  params: undefined,
  query: undefined,
  body: cardAllowanceRequestSchema,
  response: cardAllowanceResponseSchema,
});

export const cardSummaryRoute = defineRoute({
  method: "GET",
  path: "/v1/card/summary",
  auth: "session",
  params: undefined,
  query: undefined,
  body: undefined,
  response: cardSummaryResponseSchema,
});

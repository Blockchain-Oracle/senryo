import * as z from "zod";
import { SIWE_MESSAGE_MAX_CHARS } from "../constants.ts";
import { addressSchema, chainIdSchema, isoTimeSchema, signatureSchema } from "../primitives.ts";
import { defineRoute } from "./define.ts";

/**
 * Sign-in with Ethereum (EIP-4361) for the API session. The server issues a one-time nonce and the exact message text
 * (domain = rpId, uri = API origin, statement = SIWE_STATEMENT, expiry = SIWE_CHALLENGE_TTL_SECONDS); the client
 * checks it (`parseSiweMessage`: domain, address, chainId, statement) before the Mera session signs it with
 * `signMessage`. `verify` returns a bearer token for `session` routes and the `account:{addr}` WS channel.
 */

export const authNonceRequestSchema = z.object({
  address: addressSchema,
  chainId: chainIdSchema,
});

export const authNonceResponseSchema = z.object({
  nonce: z.string().min(1),
  /** EIP-4361 text to sign verbatim. */
  message: z.string().max(SIWE_MESSAGE_MAX_CHARS),
  expiresAt: isoTimeSchema,
});

export const authVerifyRequestSchema = z.object({
  message: z.string().min(1).max(SIWE_MESSAGE_MAX_CHARS),
  signature: signatureSchema,
});

export const authVerifyResponseSchema = z.object({
  token: z.string().min(1),
  address: addressSchema,
  chainId: chainIdSchema,
  expiresAt: isoTimeSchema,
});

export const authNonceRoute = defineRoute({
  method: "POST",
  path: "/v1/auth/nonce",
  auth: "none",
  params: undefined,
  query: undefined,
  body: authNonceRequestSchema,
  response: authNonceResponseSchema,
});

export const authVerifyRoute = defineRoute({
  method: "POST",
  path: "/v1/auth/verify",
  auth: "none",
  params: undefined,
  query: undefined,
  body: authVerifyRequestSchema,
  response: authVerifyResponseSchema,
});

export type AuthNonceRequest = z.input<typeof authNonceRequestSchema>;
export type AuthNonceResponse = z.output<typeof authNonceResponseSchema>;
export type AuthVerifyRequest = z.input<typeof authVerifyRequestSchema>;
export type AuthVerifyResponse = z.output<typeof authVerifyResponseSchema>;

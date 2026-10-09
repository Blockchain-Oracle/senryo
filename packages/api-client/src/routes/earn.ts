/**
 * Earn (S7.6, D-287): the pool as suppliers see it and one account's place in it, read on chain by the api (the apps
 * make no RPC calls, D-280), and a signed request relayed (the owner signs, the relayer pays gas, D-266).
 */
import * as z from "zod";
import { addressSchema, chainIdSchema, hexSchema, uintCodec, unixSecondsSchema } from "../primitives.ts";
import { defineRoute } from "./define.ts";
import { permitSchema, relayResultSchema } from "./markets.ts";

const UINT8_MAX = 255;

/** A request waiting for its roll, or settled and waiting to be delivered. */
const pendingSchema = z.object({ amount: uintCodec, settled: z.boolean() });

export const earnViewSchema = z.object({
  deployed: z.boolean(),
  pool: z
    .object({
      /** liquid + reserved: what every share is a slice of. */
      value: uintCodec,
      liquid: uintCodec,
      reserved: uintCodec,
      supply: uintCodec,
      /** The last hour rolled and the next (UTC seconds). */
      lastRoll: unixSecondsSchema,
      nextRoll: unixSecondsSchema,
      maxExposureBps: z.int().nonnegative(),
    })
    .nullable(),
  account: z
    .object({
      shares: uintCodec,
      /** The shares (and any settled supply) valued now. */
      value: uintCodec,
      supply: pendingSchema,
      withdraw: pendingSchema,
      /** For the supply's permit: the dollar's allowance to the share contract and the owner's permit nonce. */
      allowance: uintCodec,
      permitNonce: uintCodec,
    })
    .nullable(),
});

export type EarnView = z.output<typeof earnViewSchema>;

export const earnRoute = defineRoute({
  method: "GET",
  path: "/v1/earn",
  auth: "none",
  params: undefined,
  query: z.object({ chainId: z.coerce.number().pipe(chainIdSchema), owner: addressSchema.optional() }),
  body: undefined,
  response: earnViewSchema,
});

export const earnRequestSchema = z.object({
  kind: z.int().min(1).max(UINT8_MAX),
  owner: addressSchema,
  amount: uintCodec,
  deadline: uintCodec,
  nonce: uintCodec,
});

export const earnRequestRoute = defineRoute({
  method: "POST",
  path: "/v1/earn/requests",
  auth: "none",
  params: undefined,
  query: undefined,
  body: z.object({
    chainId: chainIdSchema,
    request: earnRequestSchema,
    signature: hexSchema,
    permit: permitSchema.nullable(),
  }),
  response: relayResultSchema,
});

/**
 * Exits (S8.4, D-292): a ticket's take-profit, stop-loss and trail, signed by the owner or their one-tap session and
 * relayed gas-free like a call. The chain keeps the exit; the api's watcher fires it on the live price.
 */
import * as z from "zod";
import { addressSchema, chainIdSchema, signatureSchema, uintCodec } from "../primitives.ts";
import { defineRoute } from "./define.ts";
import { relayResultSchema, shareE6Schema } from "./markets.ts";

export const exitOrderSchema = z.object({
  owner: addressSchema,
  ticketId: uintCodec,
  takeProfitE6: shareE6Schema,
  stopLossE6: shareE6Schema,
  floorE6: shareE6Schema,
  trailE6: shareE6Schema,
  deadline: uintCodec,
  nonce: uintCodec,
  epoch: z.int().nonnegative(),
});

export const setExitRoute = defineRoute({
  method: "POST",
  path: "/v1/markets/exits",
  auth: "none",
  params: undefined,
  query: undefined,
  body: z.object({ chainId: chainIdSchema, order: exitOrderSchema, signature: signatureSchema }),
  response: relayResultSchema,
});

/**
 * Exits (S8.4, D-292, R3.12): a call's or a ride's take-profit, stop-loss and trail, keyed by `(book, id)`, signed by
 * the owner or their one-tap session and relayed gas-free. A call's levels are bids per share × 1e6 (under $1), a
 * ride's prices × 1e8. The chain keeps the exit; the api's watchers fire it on the live price.
 */
import * as z from "zod";
import { addressSchema, chainIdSchema, signatureSchema, uintCodec } from "../primitives.ts";
import { defineRoute } from "./define.ts";
import { relayResultSchema } from "./markets.ts";

/** Books (contracts `BOOK_CALL`, `BOOK_RIDE`). */
const BOOK_CALL = 1;
const BOOK_RIDE = 2;
const SHARE_E6 = 1_000_000n;

export const exitOrderSchema = z
  .object({
    owner: addressSchema,
    book: z.union([z.literal(BOOK_CALL), z.literal(BOOK_RIDE)]),
    id: uintCodec,
    takeProfit: uintCodec,
    stopLoss: uintCodec,
    floor: uintCodec,
    trail: uintCodec,
    deadline: uintCodec,
    nonce: uintCodec,
    epoch: z.int().nonnegative(),
  })
  .refine(
    (o) => o.book !== BOOK_CALL || [o.takeProfit, o.stopLoss, o.floor, o.trail].every((v) => v < SHARE_E6),
    "a call's exit levels are bids under $1",
  );

export const setExitRoute = defineRoute({
  method: "POST",
  path: "/v1/markets/exits",
  auth: "none",
  params: undefined,
  query: undefined,
  body: z.object({ chainId: chainIdSchema, order: exitOrderSchema, signature: signatureSchema }),
  response: relayResultSchema,
});

/**
 * Parlays (S8.5, D-293): a signed parlay relayed gas-free like a call — its status arrives on the caller's stream as an
 * intent (`ticketId` is the parlay's id) — and the caller's parlays with each leg's outcome for the slips.
 */
import * as z from "zod";
import {
  addressSchema,
  bytes32Schema,
  chainIdSchema,
  hexSchema,
  isoTimeSchema,
  uintCodec,
  unixSecondsSchema,
} from "../primitives.ts";
import { defineRoute } from "./define.ts";
import { intentStatusSchema, permitSchema, symbolSchema } from "./markets.ts";

const MIN_LEGS = 2;
const MAX_LEGS = 4;
const MAX_BAND_INDEX = 7;

export const parlayIntentSchema = z.object({
  owner: addressSchema,
  windowIds: z.array(bytes32Schema).min(MIN_LEGS).max(MAX_LEGS),
  bands: z.array(z.int().min(0).max(MAX_BAND_INDEX)).min(MIN_LEGS).max(MAX_LEGS),
  stake: uintCodec,
  minPayout: uintCodec,
  recipient: addressSchema,
  configVersion: z.int().nonnegative(),
  deadline: uintCodec,
  nonce: uintCodec,
  epoch: z.int().nonnegative(),
});

/** Each leg's market, cadence and window start (in leg order), so the relay can open the windows lazily. */
const parlayLegInputSchema = z.object({ symbol: symbolSchema, cadenceSec: z.int(), start: unixSecondsSchema });

export const submitParlayRoute = defineRoute({
  method: "POST",
  path: "/v1/markets/parlays",
  auth: "none",
  params: undefined,
  query: undefined,
  body: z.object({
    chainId: chainIdSchema,
    intent: parlayIntentSchema,
    signature: hexSchema,
    permit: permitSchema.nullable(),
    legs: z.array(parlayLegInputSchema).min(MIN_LEGS).max(MAX_LEGS),
  }),
  response: intentStatusSchema,
  status: 202,
});

export const PARLAY_STATES = ["committed", "open", "settled", "refunded"] as const;
export const LEG_OUTCOMES = ["pending", "won", "tied", "lost", "void"] as const;

export const parlaySchema = z.object({
  parlayId: uintCodec,
  state: z.enum(PARLAY_STATES),
  stake: uintCodec,
  /** What it pays if every leg comes true (0 until filled). */
  payout: uintCodec,
  /** The joint chance at the fill, × 1e6. */
  chanceE6: z.int().nullable(),
  /** What it paid or refunded, once settled. */
  result: uintCodec.nullable(),
  outcome: z.enum(["win", "lose", "refund"]).nullable(),
  legs: z.array(
    z.object({
      windowId: bytes32Schema,
      symbol: symbolSchema,
      cadenceSec: z.int(),
      start: unixSecondsSchema,
      band: z.int(),
      outcome: z.enum(LEG_OUTCOMES),
    }),
  ),
  updatedAt: isoTimeSchema,
});

export type ParlayView = z.output<typeof parlaySchema>;

export const parlaysRoute = defineRoute({
  method: "GET",
  path: "/v1/markets/parlays",
  auth: "none",
  params: undefined,
  query: z.object({ chainId: z.coerce.number().pipe(chainIdSchema), owner: addressSchema }),
  body: undefined,
  response: z.object({ parlays: z.array(parlaySchema) }),
});

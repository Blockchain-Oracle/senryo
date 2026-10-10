/**
 * Rides (D-299, D-301, R4.4): "ride the price" — an isolated long or short with leverage against the shared pool,
 * signed by the owner or their one-tap session and relayed gas-free like a call. Opens and closes fill at the next
 * unique print; the chain keeps the ride; the api's watchers settle knock-outs, cap-outs and exits on the live price.
 * A ride's exit is set through `/v1/markets/exits` (book 2). The screens arrive in R5.
 */
import * as z from "zod";
import {
  addressSchema,
  chainIdSchema,
  hexSchema,
  intCodec,
  isoTimeSchema,
  uintCodec,
  unixSecondsSchema,
} from "../primitives.ts";
import { defineRoute } from "./define.ts";
import { intentStatusSchema, permitSchema, symbolSchema } from "./markets.ts";

const ACTION_OPEN = 1;
const ACTION_CLOSE = 2;
const UINT16_MAX = 65_535;
const BPS = 10_000;

export const rideIntentSchema = z.object({
  action: z.union([z.literal(ACTION_OPEN), z.literal(ACTION_CLOSE)]),
  owner: addressSchema,
  marketId: z.int().min(0).max(UINT16_MAX),
  isLong: z.boolean(),
  rideId: uintCodec,
  margin: uintCodec,
  leverageBps: z.int().nonnegative(),
  size: uintCodec,
  worstPriceE8: intCodec,
  recipient: addressSchema,
  configVersion: z.int().nonnegative(),
  deadline: uintCodec,
  nonce: uintCodec,
  epoch: z.int().nonnegative(),
});

export const submitRideRoute = defineRoute({
  method: "POST",
  path: "/v1/rides/intents",
  auth: "none",
  params: undefined,
  query: undefined,
  body: z.object({
    chainId: chainIdSchema,
    intent: rideIntentSchema,
    signature: hexSchema,
    permit: permitSchema.nullable(),
  }),
  response: intentStatusSchema,
  status: 202,
});

/** Each ride market on a network and its terms (contracts `RideMarket`, `RideTerms`), in on-chain id order. */
export const rideCatalogRoute = defineRoute({
  method: "GET",
  path: "/v1/rides/catalog",
  auth: "none",
  params: undefined,
  query: z.object({ chainId: z.coerce.number().pipe(chainIdSchema) }),
  body: undefined,
  response: z.object({
    chainId: chainIdSchema,
    deployed: z.boolean(),
    markets: z.array(
      z.object({
        marketId: z.int().nonnegative(),
        symbol: symbolSchema,
        maxLeverageBps: z.int().positive(),
        takerFeeBps: z.int().nonnegative(),
        makerFeeBps: z.int().nonnegative(),
      }),
    ),
    terms: z.object({
      /** The reserve (the most a ride can win) is margin × min(maxProfit, leverage × maxMove). */
      maxProfitBps: z.int(),
      maxMoveBps: z.int(),
      maxLifeSec: z.int(),
      minMargin: uintCodec,
      maxMargin: uintCodec,
      earlyFeeBps: z.int(),
      earlyWindowSec: z.int(),
    }),
  }),
});

export const RIDE_STATES = [
  "committed",
  "open",
  "closing",
  "closed",
  "knocked_out",
  "capped",
  "ended",
  "refunded",
] as const;

/** A ride's standing exit (prices × 1e8; the trail in bps of the price) and the trail's stop now. */
export const rideExitSchema = z.object({
  takeProfitE8: uintCodec,
  stopLossE8: uintCodec,
  floorE8: uintCodec,
  trailBps: z.int().min(0).max(BPS),
  trailStopE8: uintCodec.nullable(),
  firedKind: z.int().nullable(),
});

export const rideSchema = z.object({
  rideId: uintCodec,
  marketId: z.int(),
  symbol: symbolSchema,
  isLong: z.boolean(),
  state: z.enum(RIDE_STATES),
  margin: uintCodec,
  leverageBps: z.int(),
  openFee: uintCodec,
  size: uintCodec,
  reserve: uintCodec,
  entryE8: intCodec.nullable(),
  koE8: intCodec.nullable(),
  capE8: intCodec.nullable(),
  /** The pending fill instant (an open or a close). */
  target: unixSecondsSchema.nullable(),
  filledAt: unixSecondsSchema.nullable(),
  /** When the ride settles at its print if nothing ends it first (its fill + the market's life). */
  endAt: unixSecondsSchema.nullable(),
  exitE8: intCodec.nullable(),
  /** Realised PnL over every part closed so far (before fees); paid is what reached the rider. */
  pnl: intCodec.nullable(),
  fees: uintCodec,
  paid: uintCodec,
  exit: rideExitSchema.nullable(),
  updatedAt: isoTimeSchema,
});

export const ridesRoute = defineRoute({
  method: "GET",
  path: "/v1/rides",
  auth: "none",
  params: undefined,
  query: z.object({ chainId: z.coerce.number().pipe(chainIdSchema), owner: addressSchema }),
  body: undefined,
  response: z.object({ rides: z.array(rideSchema) }),
});

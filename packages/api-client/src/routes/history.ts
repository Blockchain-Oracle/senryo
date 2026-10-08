import { z } from "zod";
import {
  addressSchema,
  bytes32Schema,
  chainIdSchema,
  txHashSchema,
  uintCodec,
  unixSecondsSchema,
} from "../primitives.ts";
import { defineRoute } from "./define.ts";
import { symbolSchema } from "./markets.ts";

/**
 * History from the indexer (S4, D-272): the api reads Envio's tables over SQL (Hasura is off). Calls with their
 * receipts, a window's proof and crowd split, the leaderboard (Practice and Real kept apart by `chainId`), and a
 * caller's record. Money in dollar base units, prices e-8.
 */

export const OUTCOMES = ["win", "lose", "refund"] as const;

export const callSchema = z.object({
  ticketId: uintCodec,
  windowId: bytes32Schema,
  symbol: symbolSchema,
  cadenceSec: z.int(),
  start: unixSecondsSchema,
  band: z.int(),
  status: z.enum(["committed", "open", "closing", "closed", "settled", "refunded"]),
  stake: uintCodec,
  payout: uintCodec,
  entryE8: uintCodec.nullable(),
  /** Everything it returned (cash-out proceeds, payout, refund) and the realised result, once finished. */
  returned: uintCodec,
  pnl: z.string().nullable(),
  outcome: z.enum(OUTCOMES).nullable(),
  viaSession: z.boolean(),
  committedAt: unixSecondsSchema,
  commitTx: txHashSchema,
  fillTx: txHashSchema.nullable(),
  settleTx: txHashSchema.nullable(),
});

export const callsRoute = defineRoute({
  method: "GET",
  path: "/v1/markets/calls",
  auth: "none",
  params: undefined,
  query: z.object({
    chainId: z.coerce.number().pipe(chainIdSchema),
    owner: addressSchema,
    /** Page backwards from this ticket id (exclusive). */
    before: z.coerce.bigint().optional(),
  }),
  body: undefined,
  response: z.object({ calls: z.array(callSchema), next: z.string().nullable() }),
});

export const callTimelineRoute = defineRoute({
  method: "GET",
  path: "/v1/markets/calls/:ticketId",
  auth: "none",
  params: z.object({ ticketId: z.coerce.bigint() }),
  query: z.object({ chainId: z.coerce.number().pipe(chainIdSchema) }),
  body: undefined,
  response: z.object({
    call: callSchema,
    events: z.array(
      z.object({
        kind: z.string(),
        amount: uintCodec,
        priceE8: uintCodec.nullable(),
        at: unixSecondsSchema,
        txHash: txHashSchema,
      }),
    ),
  }),
});

export const windowProofRoute = defineRoute({
  method: "GET",
  path: "/v1/markets/windows/:windowId",
  auth: "none",
  params: z.object({ windowId: bytes32Schema }),
  query: z.object({ chainId: z.coerce.number().pipe(chainIdSchema) }),
  body: undefined,
  response: z.object({
    windowId: bytes32Schema,
    symbol: symbolSchema,
    cadenceSec: z.int(),
    start: unixSecondsSchema,
    expiry: unixSecondsSchema,
    state: z.enum(["open", "resolved", "voided"]),
    settled: z.boolean(),
    open: z.object({ priceE8: uintCodec, publishTime: unixSecondsSchema, txHash: txHashSchema }).nullable(),
    close: z.object({ priceE8: uintCodec, publishTime: unixSecondsSchema, txHash: txHashSchema }).nullable(),
    calls: z.int(),
    volume: uintCodec,
    /** Stake per band index — "62 % called Up". */
    bandStake: z.array(uintCodec),
    openedTx: txHashSchema,
    settledTx: txHashSchema.nullable(),
  }),
});

export const LEADERBOARD_PERIODS = ["day", "week", "all"] as const;

export const leaderboardRoute = defineRoute({
  method: "GET",
  path: "/v1/markets/leaderboard",
  auth: "none",
  params: undefined,
  query: z.object({
    chainId: z.coerce.number().pipe(chainIdSchema),
    period: z.enum(LEADERBOARD_PERIODS).default("all"),
  }),
  body: undefined,
  response: z.object({
    period: z.enum(LEADERBOARD_PERIODS),
    rows: z.array(
      z.object({
        rank: z.int(),
        owner: addressSchema,
        handle: z.string().nullable(),
        pnl: z.string(),
        calls: z.int(),
        wins: z.int(),
      }),
    ),
  }),
});

export const callerStatsRoute = defineRoute({
  method: "GET",
  path: "/v1/markets/stats",
  auth: "none",
  params: undefined,
  query: z.object({ chainId: z.coerce.number().pipe(chainIdSchema), owner: addressSchema }),
  body: undefined,
  response: z.object({
    calls: z.int(),
    staked: uintCodec,
    returned: uintCodec,
    pnl: z.string(),
    wins: z.int(),
    losses: z.int(),
    refunds: z.int(),
    streak: z.int(),
    bestStreak: z.int(),
  }),
});

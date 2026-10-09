import * as z from "zod";
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
  /** The exit that sold its last shares (D-292), when one did. */
  closedBy: z.enum(["take-profit", "stop-loss", "trail"]).nullable(),
  /** A duel card (D-294): the match it was picked in. The arena holds it, so it has no cash-out. */
  duelMatch: bytes32Schema.nullable(),
});

/** One call as history reads it (`/v1/markets/calls` rows, the timeline's `call`). */
export type CallItem = z.output<typeof callSchema>;

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

/** A print on chain: the e-8 price, its confidence, its publish time and the transaction that recorded it. */
const printSchema = z.object({
  priceE8: uintCodec,
  confE8: uintCodec,
  publishTime: unixSecondsSchema,
  txHash: txHashSchema,
});

/** The most calls a window's proof lists. */
export const WINDOW_CALLS_MAX = 50;

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
    open: printSchema.nullable(),
    close: printSchema.nullable(),
    calls: z.int(),
    /** Calls still riding it. Settlement posts the close only while some are: 0 after expiry means it never will. */
    liveCalls: z.int().nonnegative(),
    volume: uintCodec,
    /** Stake per band index — "62 % called Up". */
    bandStake: z.array(uintCodec),
    openedTx: txHashSchema,
    settledTx: txHashSchema.nullable(),
    /** The verdict (S7.7): why it voided (0 none, 1 no print, 2 the cross-check diverged), and which bands won,
     *  refunded or lost (bit i = band i), what went to the pool and to holders, and the resolve transaction. */
    voidReason: z.int().nonnegative(),
    wonMask: z.int().nonnegative(),
    refundMask: z.int().nonnegative(),
    lostMask: z.int().nonnegative(),
    toPool: uintCodec,
    toHolders: uintCodec,
    resolvedTx: txHashSchema.nullable(),
    /** Every call in the window (owners are not listed), oldest first, at most `WINDOW_CALLS_MAX`. */
    callList: z.array(callSchema),
  }),
});

export const windowsRoute = defineRoute({
  method: "GET",
  path: "/v1/markets/windows",
  auth: "none",
  params: undefined,
  query: z.object({
    chainId: z.coerce.number().pipe(chainIdSchema),
    symbol: symbolSchema.optional(),
    /** Page backwards from this window start (exclusive). */
    before: z.coerce.number().int().optional(),
  }),
  body: undefined,
  response: z.object({
    windows: z.array(
      z.object({
        windowId: bytes32Schema,
        symbol: symbolSchema,
        cadenceSec: z.int(),
        start: unixSecondsSchema,
        expiry: unixSecondsSchema,
        state: z.enum(["open", "resolved", "voided"]),
        openE8: uintCodec.nullable(),
        closeE8: uintCodec.nullable(),
        calls: z.int(),
        volume: uintCodec,
      }),
    ),
    next: z.int().nullable(),
  }),
});

export type WindowsPage = z.output<typeof windowsRoute.response>;
export type CallTimeline = z.output<typeof callTimelineRoute.response>;
export type WindowProof = z.output<typeof windowProofRoute.response>;
export type CallerStats = z.output<typeof callerStatsRoute.response>;

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

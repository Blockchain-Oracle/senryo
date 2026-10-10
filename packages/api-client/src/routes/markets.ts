import * as z from "zod";
import {
  addressSchema,
  bytes32Schema,
  chainIdSchema,
  hexSchema,
  isoTimeSchema,
  signatureSchema,
  txHashSchema,
  uintCodec,
  unixSecondsSchema,
} from "../primitives.ts";
import { defineRoute } from "./define.ts";

/**
 * The markets (S3, D-266…D-272): the catalogue as deployed, signed calls relayed gas-free, sessions, the caller's own
 * tickets and Practice dollars (prices: `prices.ts`). Live prices and the caller's own events arrive on the one
 * `/v1/stream`; these routes are for first paint and for writes.
 */

const SYMBOL_RE = /^[A-Z0-9]{1,12}$/;
/** A series' band menu holds at most 8 (contracts `MAX_BANDS`). */
const MAX_BAND_INDEX = 7;
const UINT8_MAX = 255;
export const symbolSchema = z.string().regex(SYMBOL_RE, "expected a catalogue symbol");

// ------------------------------------------------------------------------------------------------ catalogue

const bandSchema = z.object({
  index: z.int().min(0),
  kind: z.enum(["up", "down", "range", "moonshot", "crash"]),
  lowBps: z.int().min(0),
  highBps: z.int().min(0),
});

export const catalogResponseSchema = z.object({
  chainId: chainIdSchema,
  deployed: z.boolean(),
  configVersion: z.int().nonnegative(),
  contracts: z.object({
    reserve: addressSchema,
    windows: addressSchema,
    verifier: addressSchema,
    dollar: addressSchema,
  }),
  terms: z.object({
    halfSpreadE6: z.int(),
    minProbE6: z.int(),
    maxProbE6: z.int(),
    /** The load surcharge at a full expiry, and the caps a fill must fit (BandPool `_hasCapacity`). */
    maxSurchargeE6: z.int(),
    maxExpiryReserved: uintCodec,
    maxExposureBps: z.int(),
    minStake: uintCodec,
    maxStake: uintCodec,
    session: z.object({ perCallCap: uintCodec, sessionCap: uintCodec, maxSessionSec: z.int() }),
  }),
  markets: z.array(
    z.object({
      symbol: symbolSchema,
      name: z.string(),
      kind: z.enum(["crypto", "equity", "metal", "fx", "basket"]),
      /** A basket's members and weights (D-286); empty for a single feed. */
      members: z.array(z.object({ symbol: symbolSchema, weightBps: z.int().positive() })),
      feedId: bytes32Schema,
      /** Why the market takes no calls at all (no price source, D-310), or null; absent from an older api. */
      paused: z.string().nullable().optional(),
      series: z.array(
        z.object({ cadenceSec: z.int(), seriesId: bytes32Schema, sigmaE8: z.int(), bands: z.array(bandSchema) }),
      ),
    }),
  ),
});

export const catalogRoute = defineRoute({
  method: "GET",
  path: "/v1/markets/catalog",
  auth: "none",
  params: undefined,
  query: z.object({ chainId: z.coerce.number().pipe(chainIdSchema) }),
  body: undefined,
  response: catalogResponseSchema,
});

// ------------------------------------------------------------------------------------------------ signed calls

export const intentSchema = z.object({
  action: z.union([z.literal(1), z.literal(2)]),
  owner: addressSchema,
  windowId: bytes32Schema,
  band: z.int().min(0).max(MAX_BAND_INDEX),
  ticketId: uintCodec,
  amount: uintCodec,
  limit: uintCodec,
  recipient: addressSchema,
  configVersion: z.int().nonnegative(),
  deadline: uintCodec,
  nonce: uintCodec,
  epoch: z.int().nonnegative(),
});

export const permitSchema = z.object({
  value: uintCodec,
  deadline: uintCodec,
  v: z.int().min(0).max(UINT8_MAX),
  r: bytes32Schema,
  s: bytes32Schema,
});

export const INTENT_STATES = ["received", "submitted", "committed", "filled", "refused", "failed"] as const;

export const intentStatusSchema = z.object({
  /** The EIP-712 digest: the idempotency key (posting the same signed call twice is one call). */
  digest: bytes32Schema,
  state: z.enum(INTENT_STATES),
  ticketId: uintCodec.nullable(),
  txHash: txHashSchema.nullable(),
  /** The fill instant the call waits for (commit + 1 s). */
  target: unixSecondsSchema.nullable(),
  reason: z.string().nullable(),
});

export type IntentStatus = z.output<typeof intentStatusSchema>;

/**
 * The pool's load for one expiry: what the device needs to price a call exactly (the surcharge is
 * `maxSurchargeE6 × reservedByExpiry / maxExpiryReserved`) and to know before signing whether the fill fits (pool
 * liquidity, total exposure, the expiry's cap). Read from the chain, cached a second.
 */
export const windowLoadRoute = defineRoute({
  method: "GET",
  path: "/v1/markets/load",
  auth: "none",
  params: undefined,
  query: z.object({
    chainId: z.coerce.number().pipe(chainIdSchema),
    expiry: z.coerce.number().int().nonnegative(),
  }),
  body: undefined,
  response: z.object({
    expiry: unixSecondsSchema,
    reservedByExpiry: uintCodec,
    liquid: uintCodec,
    reserved: uintCodec,
  }),
});

export type WindowLoad = z.output<typeof windowLoadRoute.response>;

export const submitIntentRoute = defineRoute({
  method: "POST",
  path: "/v1/markets/intents",
  auth: "none",
  params: undefined,
  query: undefined,
  body: z.object({
    chainId: chainIdSchema,
    intent: intentSchema,
    signature: hexSchema,
    permit: permitSchema.nullable(),
    /** Market and cadence of the window, so the relay can open it lazily on the first call (D-278). */
    symbol: symbolSchema,
    cadenceSec: z.int(),
    start: unixSecondsSchema,
  }),
  response: intentStatusSchema,
  status: 202,
});

export const intentStatusRoute = defineRoute({
  method: "GET",
  path: "/v1/markets/intents/:digest",
  auth: "none",
  params: z.object({ digest: bytes32Schema }),
  query: undefined,
  body: undefined,
  response: intentStatusSchema,
});

export const sessionGrantSchema = z.object({
  owner: addressSchema,
  delegate: addressSchema,
  perCallCap: uintCodec,
  sessionCap: uintCodec,
  expiry: uintCodec,
  epoch: z.int().nonnegative(),
  nonce: uintCodec,
});

export const relayResultSchema = z.object({ txHash: txHashSchema, state: z.enum(["proposed", "reverted"]) });

export const grantSessionRoute = defineRoute({
  method: "POST",
  path: "/v1/markets/sessions",
  auth: "none",
  params: undefined,
  query: undefined,
  body: z.object({
    chainId: chainIdSchema,
    grant: sessionGrantSchema,
    signature: hexSchema,
    permit: permitSchema.nullable(),
  }),
  response: relayResultSchema,
});

export const revokeSessionRoute = defineRoute({
  method: "POST",
  path: "/v1/markets/revoke",
  auth: "none",
  params: undefined,
  query: undefined,
  body: z.object({
    chainId: chainIdSchema,
    owner: addressSchema,
    nonce: uintCodec,
    deadline: uintCodec,
    signature: signatureSchema,
  }),
  response: relayResultSchema,
});

/**
 * Send dollars out (Wallet → Withdraw): the owner's EIP-3009 `transferWithAuthorization`, signed under Face ID; the
 * relay submits it on the dollar, so no MON is needed (D-266). The chain checks the signature and the balance.
 */
export const withdrawRoute = defineRoute({
  method: "POST",
  path: "/v1/money/withdraw",
  auth: "none",
  params: undefined,
  query: undefined,
  body: z.object({
    chainId: chainIdSchema,
    authorization: z.object({
      from: addressSchema,
      to: addressSchema,
      value: uintCodec,
      validAfter: uintCodec,
      validBefore: uintCodec,
      nonce: bytes32Schema,
    }),
    signature: signatureSchema,
  }),
  response: relayResultSchema,
});

// ------------------------------------------------------------------------------------------------ tickets

export const TICKET_STATES = ["committed", "open", "closing", "closed", "settled", "refunded"] as const;

/** A share's bid × 1e6 (0 = unset; a share never bids $1). */
const SHARE_E6_MAX = 999_999;
export const shareE6Schema = z.int().min(0).max(SHARE_E6_MAX);

/** A ticket's standing exit (D-292); `trailStopE6` is the trail's stop now (its best bid less the trail). */
export const exitStateSchema = z.object({
  takeProfitE6: shareE6Schema,
  stopLossE6: shareE6Schema,
  floorE6: shareE6Schema,
  trailE6: shareE6Schema,
  trailStopE6: shareE6Schema.nullable(),
  /** 1 take-profit or stop-loss, 2 the trail: what the watcher last fired. */
  firedKind: z.int().nullable(),
});

export const ticketSchema = z.object({
  ticketId: uintCodec,
  windowId: bytes32Schema,
  symbol: symbolSchema,
  cadenceSec: z.int(),
  start: unixSecondsSchema,
  band: z.int(),
  state: z.enum(TICKET_STATES),
  stake: uintCodec,
  payout: uintCodec,
  entryE8: uintCodec.nullable(),
  /** What it paid or would pay out (winnings, refund or proceeds), once known. */
  result: uintCodec.nullable(),
  outcome: z.enum(["win", "lose", "refund"]).nullable(),
  exit: exitStateSchema.nullable(),
  updatedAt: isoTimeSchema,
});

export const ticketsRoute = defineRoute({
  method: "GET",
  path: "/v1/markets/tickets",
  auth: "none",
  params: undefined,
  query: z.object({ chainId: z.coerce.number().pipe(chainIdSchema), owner: addressSchema }),
  body: undefined,
  response: z.object({ tickets: z.array(ticketSchema) }),
});

// ------------------------------------------------------------------------------------------------ account

/** What a gas-free client needs before it signs (apps make no RPC calls, D-272): read at the latest block. */
export const marketAccountRoute = defineRoute({
  method: "GET",
  path: "/v1/markets/account",
  auth: "none",
  params: undefined,
  query: z.object({ chainId: z.coerce.number().pipe(chainIdSchema), owner: addressSchema }),
  body: undefined,
  response: z.object({
    balance: uintCodec,
    allowance: uintCodec,
    /** The dollar's EIP-2612 nonce for the next permit. */
    permitNonce: uintCodec,
    /** The owner's epoch every intent and grant signs (a revoke bumps it). */
    epoch: z.int().nonnegative(),
    session: z
      .object({
        delegate: addressSchema,
        expiry: unixSecondsSchema,
        perCallCap: uintCodec,
        sessionCap: uintCodec,
        spent: uintCodec,
      })
      .nullable(),
  }),
});

// ------------------------------------------------------------------------------------------------ stream ticket

/** A 60 s HMAC ticket for the caller's own `user:<address>` topic (EventSource can't send headers). */
export const streamTicketRoute = defineRoute({
  method: "POST",
  path: "/v1/stream/ticket",
  auth: "session",
  params: undefined,
  query: undefined,
  body: undefined,
  response: z.object({ ticket: z.string(), expiresAt: unixSecondsSchema }),
});

// ------------------------------------------------------------------------------------------------ practice dollars

export const practiceGrantRoute = defineRoute({
  method: "POST",
  path: "/v1/practice/grant",
  auth: "session",
  params: undefined,
  query: undefined,
  body: undefined,
  response: z.object({
    state: z.enum(["granted", "already", "unavailable"]),
    amount: uintCodec,
    txHash: txHashSchema.nullable(),
    nextAt: unixSecondsSchema.nullable(),
  }),
});

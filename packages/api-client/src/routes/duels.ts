/**
 * Duel (S8.6, D-294): a signed entry waits in the matchmaker's queue (its progress also arrives on the caller's stream
 * as `duelQueue`); a paired match's every move reaches both players' streams as `duel`; each swipe is a signed pick
 * relayed gas-free. Matches are read back with their cards (once revealed), picks and results; ratings from the
 * indexer's ladder.
 */
import * as z from "zod";
import {
  addressSchema,
  bytes32Schema,
  chainIdSchema,
  hexSchema,
  intCodec,
  isoTimeSchema,
  uintCodec,
  unixSecondsSchema,
} from "../primitives.ts";
import { defineRoute } from "./define.ts";
import { permitSchema, symbolSchema } from "./markets.ts";

const MAX_TIER = 15;
const CARD_COUNT = 3;
const MAX_BAND_INDEX = 7;

const chainQuery = { chainId: z.coerce.number().pipe(chainIdSchema) };

export const duelEntrySchema = z.object({
  owner: addressSchema,
  tier: z.int().min(0).max(MAX_TIER),
  delegate: addressSchema,
  seed: bytes32Schema,
  deadline: uintCodec,
  nonce: uintCodec,
  epoch: z.int().nonnegative(),
});

export const duelPickSchema = z.object({
  matchId: bytes32Schema,
  player: addressSchema,
  card: z
    .int()
    .min(0)
    .max(CARD_COUNT - 1),
  band: z.int().min(0).max(MAX_BAND_INDEX),
  minPayout: uintCodec,
});

export const DUEL_QUEUE_STATES = ["queued", "paired", "cancelled", "lapsed", "failed"] as const;

export const duelQueueSchema = z.object({
  digest: bytes32Schema,
  state: z.enum(DUEL_QUEUE_STATES),
  tier: z.int(),
  matchId: bytes32Schema.nullable(),
  reason: z.string().nullable(),
  since: isoTimeSchema,
});

export type DuelQueueView = z.output<typeof duelQueueSchema>;

export const enterDuelRoute = defineRoute({
  method: "POST",
  path: "/v1/duel/entries",
  auth: "none",
  params: undefined,
  query: undefined,
  body: z.object({
    chainId: chainIdSchema,
    entry: duelEntrySchema,
    signature: hexSchema,
    permit: permitSchema.nullable(),
  }),
  response: duelQueueSchema,
  status: 202,
});

export const cancelDuelRoute = defineRoute({
  method: "POST",
  path: "/v1/duel/entries/cancel",
  auth: "none",
  params: undefined,
  query: undefined,
  body: z.object({ chainId: chainIdSchema, owner: addressSchema, digest: bytes32Schema }),
  response: duelQueueSchema,
});

export const duelQueueRoute = defineRoute({
  method: "GET",
  path: "/v1/duel/queue",
  auth: "none",
  params: undefined,
  query: z.object({ ...chainQuery, owner: addressSchema }),
  body: undefined,
  response: z.object({ entry: duelQueueSchema.nullable() }),
});

export const duelPickRoute = defineRoute({
  method: "POST",
  path: "/v1/duel/picks",
  auth: "none",
  params: undefined,
  query: undefined,
  body: z.object({ chainId: chainIdSchema, pick: duelPickSchema, signature: hexSchema }),
  response: z.object({ state: z.literal("received") }),
  status: 202,
});

export const DUEL_MATCH_STATES = [
  "opening",
  "sealed",
  "picking",
  "settling",
  "forfeited",
  "refunded",
  "finalized",
  "failed",
] as const;

export const duelSchema = z.object({
  matchId: bytes32Schema,
  tier: z.int(),
  state: z.enum(DUEL_MATCH_STATES),
  players: z.tuple([addressSchema, addressSchema]),
  /** Each seat's swipe key (the device key its entry named), null for the owner only. */
  keys: z.tuple([addressSchema.nullable(), addressSchema.nullable()]),
  pot: uintCodec,
  cardStake: uintCodec,
  deckHash: bytes32Schema,
  /** Published by the reveal: the server's seed and the three cards (empty while the deck is sealed). */
  serverSeed: bytes32Schema.nullable(),
  cards: z.array(
    z.object({
      windowId: bytes32Schema,
      symbol: symbolSchema,
      cadenceSec: z.int(),
      start: unixSecondsSchema,
      expiry: unixSecondsSchema,
    }),
  ),
  pickDeadline: unixSecondsSchema.nullable(),
  picks: z.array(
    z.object({
      card: z.int(),
      seat: z.int(),
      player: addressSchema,
      band: z.int(),
      ticketId: uintCodec,
      /** What the call returned once its card settled, and that less its stake. */
      returned: uintCodec.nullable(),
      result: intCodec.nullable(),
    }),
  ),
  winner: addressSchema.nullable(),
  results: z.tuple([intCodec, intCodec]).nullable(),
  reason: z.string().nullable(),
  createdAt: isoTimeSchema,
  updatedAt: isoTimeSchema,
});

export type DuelView = z.output<typeof duelSchema>;

export const duelRatingSchema = z.object({
  rating: z.int(),
  played: z.int(),
  wins: z.int(),
  losses: z.int(),
  ties: z.int(),
});

export type DuelRatingView = z.output<typeof duelRatingSchema>;

export const duelsRoute = defineRoute({
  method: "GET",
  path: "/v1/duel/matches",
  auth: "none",
  params: undefined,
  query: z.object({ ...chainQuery, owner: addressSchema }),
  body: undefined,
  response: z.object({ duels: z.array(duelSchema), rating: duelRatingSchema.nullable() }),
});

export const duelRoute = defineRoute({
  method: "GET",
  path: "/v1/duel/matches/:matchId",
  auth: "none",
  params: z.object({ matchId: bytes32Schema }),
  query: z.object(chainQuery),
  body: undefined,
  response: duelSchema,
});

export const duelLadderRoute = defineRoute({
  method: "GET",
  path: "/v1/duel/ladder",
  auth: "none",
  params: undefined,
  query: z.object(chainQuery),
  body: undefined,
  response: z.object({
    players: z.array(duelRatingSchema.extend({ owner: addressSchema, handle: z.string().nullable() })),
  }),
});

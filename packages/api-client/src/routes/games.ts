/**
 * Games without a contract (S8.8, D-295): Lucky's seal and reveal (the call itself goes through the ordinary relay),
 * a player's draws, and the arcade's seed, checked score and board. Signed-in only: a draw and a run belong to an
 * account.
 */
import * as z from "zod";
import {
  addressSchema,
  bytes32Schema,
  chainIdSchema,
  isoTimeSchema,
  uintCodec,
  unixSecondsSchema,
} from "../primitives.ts";
import { defineRoute } from "./define.ts";

const SEED_RE = /^[0-9a-f]{8}$/;
const TRACE_MAX = 216_000;
const SYMBOL_MAX = 16;
const MARKETS_MAX = 64;

export const ARCADE_GAME_KEYS = ["line-rider", "candle-hop"] as const;
export const LUCKY_SIDE_KEYS = ["up", "down"] as const;

export const luckySealSchema = z.object({
  drawId: z.uuid(),
  commitment: bytes32Schema,
  markets: z.array(z.string().max(SYMBOL_MAX)).max(MARKETS_MAX),
  marketsHash: bytes32Schema,
  expiresAt: unixSecondsSchema,
});

export const luckyDealtSchema = z.object({
  windowId: bytes32Schema,
  symbol: z.string().max(SYMBOL_MAX),
  cadenceSec: z.int(),
  start: unixSecondsSchema,
  expiry: unixSecondsSchema,
  band: z.int(),
  /** The price per $1 share when dealt (× 1e6). */
  priceE6: uintCodec,
});

export const luckyRevealSchema = z.object({
  drawId: z.uuid(),
  serverSeed: bytes32Schema,
  clientSeed: bytes32Schema,
  digest: bytes32Schema,
  symbol: z.string(),
  side: z.enum(LUCKY_SIDE_KEYS),
  reach: z.int(),
  /** null when nothing on the drawn market has room right now (spin again). */
  dealt: luckyDealtSchema.nullable(),
});

export type LuckySealView = z.output<typeof luckySealSchema>;
export type LuckyRevealView = z.output<typeof luckyRevealSchema>;

export const luckySealRoute = defineRoute({
  method: "POST",
  path: "/v1/lucky/seal",
  auth: "session",
  params: undefined,
  query: undefined,
  body: z.object({}),
  response: luckySealSchema,
});

export const luckyRevealRoute = defineRoute({
  method: "POST",
  path: "/v1/lucky/reveal",
  auth: "session",
  params: undefined,
  query: undefined,
  body: z.object({ drawId: z.uuid(), clientSeed: bytes32Schema }),
  response: luckyRevealSchema,
});

export const luckyPlacedRoute = defineRoute({
  method: "POST",
  path: "/v1/lucky/placed",
  auth: "session",
  params: undefined,
  query: undefined,
  body: z.object({ drawId: z.uuid(), ticketId: uintCodec }),
  response: z.object({ ok: z.literal(true) }),
});

export const luckyDrawSchema = luckyRevealSchema.extend({
  owner: addressSchema,
  commitment: bytes32Schema,
  markets: z.array(z.string()),
  marketsHash: bytes32Schema,
  ticketId: uintCodec.nullable(),
  sealedAt: isoTimeSchema,
});

export type LuckyDrawView = z.output<typeof luckyDrawSchema>;

export const luckyDrawsRoute = defineRoute({
  method: "GET",
  path: "/v1/lucky/draws",
  auth: "none",
  params: undefined,
  query: z.object({ chainId: z.coerce.number().pipe(chainIdSchema), owner: addressSchema }),
  body: undefined,
  response: z.object({ draws: z.array(luckyDrawSchema) }),
});

export const arcadeSeedRoute = defineRoute({
  method: "POST",
  path: "/v1/arcade/seed",
  auth: "session",
  params: undefined,
  query: undefined,
  body: z.object({ game: z.enum(ARCADE_GAME_KEYS) }),
  response: z.object({ seed: z.string().regex(SEED_RE) }),
});

export const arcadeScoreRoute = defineRoute({
  method: "POST",
  path: "/v1/arcade/scores",
  auth: "session",
  params: undefined,
  query: undefined,
  body: z.object({
    game: z.enum(ARCADE_GAME_KEYS),
    seed: z.string().regex(SEED_RE),
    calm: z.boolean(),
    durationMs: z.int().positive(),
    trace: z.array(z.int().nonnegative()).max(TRACE_MAX),
    score: z.int().nonnegative(),
  }),
  response: z.object({ score: z.int(), best: z.int() }),
});

export const arcadeBoardSchema = z.object({
  players: z.array(
    z.object({
      owner: addressSchema,
      handle: z.string().nullable(),
      avatar: z.string().nullable(),
      score: z.int(),
      calm: z.boolean(),
      at: isoTimeSchema,
    }),
  ),
});

export type ArcadeBoardView = z.output<typeof arcadeBoardSchema>;

export const arcadeBoardRoute = defineRoute({
  method: "GET",
  path: "/v1/arcade/board",
  auth: "none",
  params: undefined,
  query: z.object({ game: z.enum(ARCADE_GAME_KEYS) }),
  body: undefined,
  response: arcadeBoardSchema,
});

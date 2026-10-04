import { z } from "zod";
import { PREDICTION_LIMITS as LIMITS } from "../constants.ts";
import { uintCodec, unixSecondsSchema } from "../primitives.ts";
import { defineRoute } from "./define.ts";

export const predictionProviderSchema = z.enum(["polymarket", "castora"]);
export const predictionAssetSchema = z.enum(["all", "BTC", "ETH"]);
export const predictionWindowSchema = z.enum(["5m", "15m", "price-events"]);
const statusSchema = z.enum(["upcoming", "open", "closed", "resolving", "resolved", "disputed"]);
const base = z.object({
  id: z.string().regex(/^\d+$/).max(LIMITS.idDigits),
  title: z.string().max(LIMITS.titleChars),
  asset: z.string().max(24),
  status: statusSchema,
  closesAt: unixSecondsSchema,
  opensAt: unixSecondsSchema.nullable(),
  observedAt: unixSecondsSchema,
  sourceUpdatedAt: unixSecondsSchema.nullable(),
  sourceUrl: z.url(),
  /** Deliberately capability-specific: no quotes, orders, custody or account balances in public discovery. */
  execution: z.literal("view-only"),
});
export const binaryPredictionSchema = base.extend({
  kind: z.literal("binary"),
  provider: z.literal("polymarket"),
  settlementNetwork: z.literal("Polygon"),
  window: z.enum(["5m", "15m"]).nullable(),
  outcomes: z
    .array(
      z.object({
        label: z.enum(["Up", "Down", "Yes", "No"]),
        priceBps: z.int().min(0).max(LIMITS.bps).nullable(),
        tokenId: z.string().regex(/^\d+$/).nullable(),
      }),
    )
    .length(2),
  /** A final winner requires an explicit resolved status, not merely a price near 0 or 1. */
  winner: z.string().nullable(),
  rules: z.string().max(LIMITS.rulesChars),
  resolutionSource: z.string().max(LIMITS.sourceChars).nullable(),
  liquidityUsd6: uintCodec.nullable(),
  volumeUsd6: uintCodec.nullable(),
});
export const priceContestSchema = base.extend({
  kind: z.literal("price-contest"),
  provider: z.literal("castora"),
  settlementNetwork: z.literal("Monad"),
  snapshotAt: unixSecondsSchema,
  stakeUnits: uintCodec,
  stakeSymbol: z.string().max(24),
  stakeDecimals: z.int().min(0).max(LIMITS.decimals).nullable(),
  feesBps: z.int().min(0).max(LIMITS.bps),
  multiplier100: z.int().nonnegative(),
  entries: uintCodec,
  winners: uintCodec,
  claimed: uintCodec,
  paused: z.boolean(),
  blockNumber: uintCodec,
});
export const predictionSchema = z.discriminatedUnion("kind", [binaryPredictionSchema, priceContestSchema]);
export const predictionsRoute = defineRoute({
  method: "GET",
  path: "/v1/predictions",
  auth: "none",
  params: undefined,
  body: undefined,
  query: z.object({
    provider: predictionProviderSchema.default("polymarket"),
    asset: predictionAssetSchema.default("all"),
    window: predictionWindowSchema.default("15m"),
    state: z.enum(["open", "recent"]).default("open"),
  }),
  response: z.object({
    markets: z.array(predictionSchema).max(LIMITS.markets),
    observedAt: unixSecondsSchema,
    /** Bounded discovery window or contract scan; never claim the result is the entire venue. */
    limited: z.boolean(),
  }),
});
export const predictionParamsSchema = z.object({ provider: predictionProviderSchema, id: base.shape.id });
export const predictionDetailRoute = defineRoute({
  method: "GET",
  path: "/v1/predictions/:provider/:id",
  auth: "none",
  params: predictionParamsSchema,
  query: undefined,
  body: undefined,
  response: predictionSchema,
});
export const predictionHistoryRoute = defineRoute({
  method: "GET",
  path: "/v1/predictions/:provider/:id/history",
  auth: "none",
  params: predictionParamsSchema,
  query: z.object({ outcome: z.coerce.number().int().min(0).max(1).default(0) }),
  body: undefined,
  response: z.object({
    observedAt: unixSecondsSchema,
    points: z
      .array(
        z.object({
          t: unixSecondsSchema,
          priceBps: z.int().min(0).max(LIMITS.bps),
          resolutionSec: z.int().nonnegative(),
        }),
      )
      .max(LIMITS.sourceChars),
  }),
});
export type Prediction = z.output<typeof predictionSchema>;
export type BinaryPrediction = z.output<typeof binaryPredictionSchema>;
export type PriceContest = z.output<typeof priceContestSchema>;
export type PredictionProvider = z.output<typeof predictionProviderSchema>;
export type PredictionListQuery = z.output<NonNullable<typeof predictionsRoute.query>>;

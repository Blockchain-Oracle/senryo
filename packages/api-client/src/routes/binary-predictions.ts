/** Owned binary execution reads. Provider discovery remains a separate view-only API. */
import { BINARY_POLICY, BINARY_STATE } from "@senryo/config";
import { z } from "zod";
import { addressSchema, bytes32Schema, intCodec, uintCodec } from "../primitives.ts";
import { defineRoute } from "./define.ts";

const UINT256_BITS = 256n,
  MAX_CURSOR_LENGTH = 512;
const chain = z.literal("10143");
const address = addressSchema.refine((v) => !/^0x0{40}$/i.test(v));
const roundId = bytes32Schema.refine((v) => !/^0x0{64}$/i.test(v));
export const binarySourceSchema = z.object({
  chainId: z.literal(BINARY_POLICY.chainId),
  environmentId: z.string(),
  contract: address,
  configHash: bytes32Schema,
  blockNumber: uintCodec,
  blockHash: bytes32Schema,
  timestamp: uintCodec,
});
const observation = z.object({
  price: intCodec,
  confidence: uintCodec,
  exponent: z.int(),
  publishTime: uintCodec,
  proofHash: bytes32Schema,
  quality: z.boolean(),
});
export const binaryRoundSchema = z.object({
  feed: bytes32Schema,
  start: uintCodec,
  end: uintCodec,
  cutoff: uintCodec,
  duration: z.union([z.literal(BINARY_POLICY.durations[0]), z.literal(BINARY_POLICY.durations[1])]),
  state: z.int().min(BINARY_STATE.Scheduled).max(BINARY_STATE.Void),
  up: uintCodec,
  down: uintCodec,
  totalUp: uintCodec,
  totalDown: uintCodec,
  escrow: uintCodec,
  revision: uintCodec,
  seed: uintCodec,
  opening: observation,
  closing: observation,
});
export const binarySnapshotSchema = z.object({
  source: binarySourceSchema,
  roundId,
  owner: address,
  round: binaryRoundSchema,
  position: z.object({ up: uintCodec, down: uintCodec }),
  creditWei: uintCodec,
  walletMonWei: uintCodec,
  riskPaused: z.boolean(),
});
export const binaryQuoteSchema = z.object({
  input: uintCodec,
  output: uintCodec,
  up: uintCodec,
  down: uintCodec,
  revision: uintCodec,
  cutoff: uintCodec,
  state: z.int().min(BINARY_STATE.Scheduled).max(BINARY_STATE.Void),
  blockNumber: uintCodec,
  timestamp: uintCodec,
  marginalPriceE18: uintCodec,
  executionPriceE18: uintCodec,
  priceImpactBps: uintCodec,
});
export const binaryHistoryEventSchema = z.object({
  id: z.string(),
  event: z.string(),
  blockNumber: uintCodec,
  blockHash: bytes32Schema,
  transactionHash: bytes32Schema,
  logIndex: z.int().nonnegative(),
  values: z.record(z.string(), z.string()),
});
const basis = z.object({ sharesWei: uintCodec, costWei: uintCodec, realizedWei: intCodec });
export const binaryAccountingSchema = z.object({
  positions: z.record(z.string(), z.object({ up: basis, down: basis })),
  creditWei: uintCodec,
  transferredWei: uintCodec,
  claimRealizedWei: intCodec,
});
export const binaryHistorySchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("unavailable"),
    reason: z.enum(["not-configured", "unavailable", "noncanonical", "incomplete"]),
    events: z.null(),
    accounting: z.null(),
    indexedBlock: z.null(),
    nextCursor: z.null(),
  }),
  z.object({
    status: z.enum(["fresh", "lagging"]),
    indexedBlock: uintCodec,
    indexedBlockHash: bytes32Schema,
    blockLag: uintCodec,
    events: z.array(binaryHistoryEventSchema),
    accounting: binaryAccountingSchema,
    nextCursor: z.string().nullable(),
  }),
]);
const scope = z.strictObject({ chainId: chain });
const params = z.strictObject({ contract: address, roundId });
const common = { method: "GET", auth: "none", body: undefined } as const;
export const binaryRoundsRoute = defineRoute({
  ...common,
  path: "/v1/binary-predictions",
  params: undefined,
  query: z.strictObject({
    chainId: chain,
    asset: z.enum(["BTC", "ETH"]),
    duration: z.enum(["300", "900"]).default("900"),
  }),
  response: z.object({ status: z.enum(["inactive", "available"]), rounds: z.array(binarySnapshotSchema) }),
});
export const binaryRoundRoute = defineRoute({
  ...common,
  path: "/v1/binary-predictions/:contract/:roundId",
  params,
  query: scope,
  response: binarySnapshotSchema,
});
export const binaryPositionRoute = defineRoute({
  ...common,
  path: "/v1/binary-predictions/:contract/:roundId/position/:owner",
  params: params.extend({ owner: address }),
  query: scope,
  response: binarySnapshotSchema,
});
export const binaryQuoteRoute = defineRoute({
  ...common,
  path: "/v1/binary-predictions/:contract/:roundId/quote",
  params,
  query: scope.extend({
    owner: address,
    side: z.enum(["up", "down"]),
    action: z.enum(["buy", "sell"]),
    amountWei: uintCodec.refine((v) => v > 0n && v < 2n ** UINT256_BITS),
  }),
  response: z.object({
    snapshot: binarySnapshotSchema,
    side: z.enum(["up", "down"]),
    action: z.enum(["buy", "sell"]),
    quote: binaryQuoteSchema,
  }),
});
export const binaryHistoryRoute = defineRoute({
  ...common,
  path: "/v1/binary-predictions/:contract/history/:owner",
  params: z.strictObject({ contract: address, owner: address }),
  query: scope.extend({
    cursor: z
      .string()
      .min(1)
      .max(MAX_CURSOR_LENGTH)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
  }),
  response: z.object({ source: binarySourceSchema, history: binaryHistorySchema }),
});
export type BinaryHistory = z.output<typeof binaryHistorySchema>;
export type BinaryApiSnapshot = z.output<typeof binarySnapshotSchema>;

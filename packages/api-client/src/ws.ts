import { z } from "zod";
import { API_ERROR_CODES } from "./errors.ts";
import { addressSchema, chainIdSchema, uintCodec } from "./primitives.ts";
import { bucketsSchema, MARKET_STATUSES } from "./routes/info.ts";

/**
 * `wss://api.<rpId>/v1/ws` (specs/services.md §api): channels `prices:{SYMBOL}` (engine oracle, conflated 100 ms),
 * `perpl:{SYMBOL}` (S7 fan-out of Perpl's market-data WS) and `account:{0xaddr}` (bucket deltas on each finalized
 * block where the account changed; needs the session token from `POST /v1/auth/verify`).
 */
export const WS_PATH = "/v1/ws";

const CHANNEL_MAX = 64;

export const wsClientMessageSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("subscribe"),
    channel: z.string().min(1).max(CHANNEL_MAX),
    chainId: chainIdSchema,
    /** Session token (account channels only). */
    token: z.string().optional(),
  }),
  z.object({ op: z.literal("unsubscribe"), channel: z.string().min(1).max(CHANNEL_MAX), chainId: chainIdSchema }),
  z.object({ op: z.literal("ping") }),
]);

export const wsServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("subscribed"), channel: z.string(), chainId: chainIdSchema }),
  z.object({ type: z.literal("unsubscribed"), channel: z.string(), chainId: chainIdSchema }),
  z.object({ type: z.literal("pong") }),
  z.object({ type: z.literal("error"), code: z.enum(API_ERROR_CODES), message: z.string() }),
  z.object({
    type: z.literal("price"),
    channel: z.string(),
    chainId: chainIdSchema,
    marketId: z.int(),
    symbol: z.string(),
    price18: uintCodec,
    latest18: uintCodec,
    status: z.enum(MARKET_STATUSES),
    updatedAt: z.int(),
    spreadBps: z.int(),
  }),
  z.object({
    type: z.literal("account"),
    channel: z.string(),
    chainId: chainIdSchema,
    address: addressSchema,
    finalizedBlock: uintCodec,
    buckets: bucketsSchema,
  }),
]);

export type WsClientMessage = z.input<typeof wsClientMessageSchema>;
export type WsServerMessage = z.output<typeof wsServerMessageSchema>;

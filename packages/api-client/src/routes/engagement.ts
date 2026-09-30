import { z } from "zod";
import { chainIdSchema, isoTimeSchema, uintCodec } from "../primitives.ts";
import { defineRoute } from "./define.ts";

/** Price alerts (D-034), first-party analytics (D-040) and push-token registration (session-authed). */

const EVENT_NAME_MAX = 64;
const EVENTS_PER_BATCH_MAX = 50;
const PUSH_TOKEN_MAX = 256;
const APP_VERSION_MAX = 32;

export const alertSchema = z.object({
  id: z.uuid(),
  chainId: chainIdSchema,
  marketId: z.int().nonnegative(),
  direction: z.enum(["above", "below"]),
  price18: uintCodec,
  status: z.enum(["active", "triggered", "cancelled"]),
  createdAt: isoTimeSchema,
  triggeredAt: isoTimeSchema.nullable(),
});

export const alertCreateRequestSchema = alertSchema.pick({
  chainId: true,
  marketId: true,
  direction: true,
  price18: true,
});
export const alertListResponseSchema = z.object({ alerts: z.array(alertSchema) });
export const alertParamsSchema = z.object({ id: z.uuid() });

export const eventsRequestSchema = z.object({
  platform: z.enum(["ios", "android", "web"]),
  appVersion: z.string().max(APP_VERSION_MAX),
  events: z
    .array(
      z.object({
        name: z.string().min(1).max(EVENT_NAME_MAX),
        at: isoTimeSchema,
        /** Flat, non-PII properties (numbers as strings for money). */
        props: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
      }),
    )
    .min(1)
    .max(EVENTS_PER_BATCH_MAX),
});
export const eventsResponseSchema = z.object({ accepted: z.int().nonnegative() });

export const PUSH_CHANNELS = ["fills", "liquidation", "deposits", "card", "priceAlerts"] as const;

export const pushTokenRequestSchema = z.object({
  token: z.string().min(1).max(PUSH_TOKEN_MAX),
  platform: z.enum(["ios", "android", "web"]),
  kind: z.enum(["expo", "live_activity"]).default("expo"),
  channels: z.partialRecord(z.enum(PUSH_CHANNELS), z.boolean()).default({}),
});
export const pushTokenResponseSchema = z.object({ token: z.string(), channels: z.record(z.string(), z.boolean()) });
export const pushTokenDeleteRequestSchema = z.object({ token: z.string().min(1).max(PUSH_TOKEN_MAX) });

export const alertsListRoute = defineRoute({
  method: "GET",
  path: "/v1/alerts",
  auth: "session",
  params: undefined,
  query: undefined,
  body: undefined,
  response: alertListResponseSchema,
});

export const alertsCreateRoute = defineRoute({
  method: "POST",
  path: "/v1/alerts",
  auth: "session",
  params: undefined,
  query: undefined,
  body: alertCreateRequestSchema,
  response: alertSchema,
});

export const alertsDeleteRoute = defineRoute({
  method: "DELETE",
  path: "/v1/alerts/:id",
  auth: "session",
  params: alertParamsSchema,
  query: undefined,
  body: undefined,
  response: alertSchema,
});

export const eventsRoute = defineRoute({
  method: "POST",
  path: "/v1/events",
  auth: "none",
  params: undefined,
  query: undefined,
  body: eventsRequestSchema,
  response: eventsResponseSchema,
});

export const pushTokenRoute = defineRoute({
  method: "PUT",
  path: "/v1/push/token",
  auth: "session",
  params: undefined,
  query: undefined,
  body: pushTokenRequestSchema,
  response: pushTokenResponseSchema,
});

export const pushTokenDeleteRoute = defineRoute({
  method: "POST",
  path: "/v1/push/token/delete",
  auth: "session",
  params: undefined,
  query: undefined,
  body: pushTokenDeleteRequestSchema,
  response: z.object({ deleted: z.boolean() }),
});

export type Alert = z.output<typeof alertSchema>;
export type PushChannel = (typeof PUSH_CHANNELS)[number];

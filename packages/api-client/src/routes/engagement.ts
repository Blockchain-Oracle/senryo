import * as z from "zod";
import { isoTimeSchema } from "../primitives.ts";
import { defineRoute } from "./define.ts";

/** Price alerts (D-034), first-party analytics (D-040) and push-token registration (session-authed). */

const EVENT_NAME_MAX = 64;
const EVENTS_PER_BATCH_MAX = 50;
const PUSH_TOKEN_MAX = 256;
const APP_VERSION_MAX = 32;

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

/** Kinds of news a device can turn on or off (one `push_tokens` column each). */
export const PUSH_CHANNELS = [
  /** A call's result: won, lost, refunded (with the payout). */
  "results",
  /** Money arrived (test dollars, a deposit from another chain) or a withdrawal finished. */
  "deposits",
  /** A watched stock market opens, a price alert crosses. */
  "priceAlerts",
  /** Referrals and leaderboard places (S8). */
  "social",
] as const;

/** What a device gets when it doesn't say: everything on. */
export const PUSH_CHANNEL_DEFAULTS: Readonly<Record<(typeof PUSH_CHANNELS)[number], boolean>> = {
  results: true,
  deposits: true,
  priceAlerts: true,
  social: true,
};

export const pushTokenRequestSchema = z.object({
  token: z.string().min(1).max(PUSH_TOKEN_MAX),
  platform: z.enum(["ios", "android", "web"]),
  kind: z.enum(["expo", "live_activity"]).default("expo"),
  channels: z.partialRecord(z.enum(PUSH_CHANNELS), z.boolean()).default({}),
});
export const pushTokenResponseSchema = z.object({ token: z.string(), channels: z.record(z.string(), z.boolean()) });
export const pushTokenDeleteRequestSchema = z.object({ token: z.string().min(1).max(PUSH_TOKEN_MAX) });

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

export type PushChannel = (typeof PUSH_CHANNELS)[number];

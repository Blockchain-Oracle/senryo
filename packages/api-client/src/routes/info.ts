import * as z from "zod";
import { chainIdSchema, isoTimeSchema } from "../primitives.ts";
import { defineRoute } from "./define.ts";

/**
 * Read-only app data: config, geo, status (specs/services.md §api, D-040). Markets come from the catalogue
 * (`/v1/catalog`, S3, D-268); positions and history from the indexer over SQL (S4, D-272).
 */

export const HEALTH_STATES = ["ok", "degraded", "down", "unknown"] as const;

export const configResponseSchema = z.object({
  /** Clients below this version show the update blocker. */
  minAppVersion: z.string(),
  features: z.record(z.string(), z.boolean()),
  networks: z.array(
    z.object({
      chainId: chainIdSchema,
      modeLabel: z.enum(["Real", "Practice"]),
      deployed: z.boolean(),
    }),
  ),
  /** The visible contact point for reports and safety questions (App Store 1.2, S12b.6). */
  contact: z.object({ email: z.email(), url: z.url().nullable() }),
});

export const geoResponseSchema = z.object({
  /** ISO 3166-1 alpha-2, or null when the edge did not say. */
  country: z.string().length(2).nullable(),
  /** Practice is never gated; Real (mainnet) calls are gated for sanctioned and restricted countries. */
  realMoneyAllowed: z.boolean(),
  reason: z.string().nullable(),
});

const component = z.object({ state: z.enum(HEALTH_STATES), detail: z.string().nullable() });

/** The Status board's components (P6, D-324), in board order. */
export const STATUS_COMPONENTS = ["prices", "settlement", "relay", "keeper", "chain", "indexer", "deposits"] as const;
export type StatusComponentId = (typeof STATUS_COMPONENTS)[number];

const liveComponent = component.extend({
  id: z.enum(STATUS_COMPONENTS),
  /** The component's numbers now (ages in seconds, counts, blocks, ms); null where not known. */
  metrics: z.record(z.string(), z.number().nullable()),
});

export const statusResponseSchema = z.object({
  at: isoTimeSchema,
  /** Each component's health on the network asked for (P6); empty from an api before P6. */
  components: z.array(liveComponent).default([]),
  chains: z.array(
    z.object({
      chainId: chainIdSchema,
      rpc: component,
      /** Seconds since the finalized head's timestamp. */
      headAgeSec: z.int().nullable(),
      indexerLagBlocks: z.int().nullable(),
    }),
  ),
  /** Prices overall: ok when every open market is live, degraded when any is late or halted, down with none live. */
  prices: component,
  /** Markets per price state, per source (`FeedStates`, 04-pricing R6). */
  priceSources: z.array(
    z.object({ source: z.string(), state: z.enum(HEALTH_STATES), counts: z.record(z.string(), z.int()) }),
  ),
  /** The gateway's own numbers for ops: each Hermes stream, the REST fetcher, the print watch, silences. */
  priceDiagnostics: z.record(z.string(), z.unknown()),
  aurora: component,
  /** Unhandled rejections the api survived (04-pricing R1): any non-zero count is a bug to find in the log. */
  process: z.object({
    unhandledRejections: z.int().nonnegative(),
    lastRejectionAt: isoTimeSchema.nullable(),
    /** The event loop's delay over the last full minute (D-272: p99 ≤ 20 ms); null in the first minute. */
    loopDelayP99Ms: z.number().nonnegative().nullable(),
    loopDelayMaxMs: z.number().nonnegative().nullable(),
  }),
});

export const configRoute = defineRoute({
  method: "GET",
  path: "/v1/config",
  auth: "none",
  params: undefined,
  query: undefined,
  body: undefined,
  response: configResponseSchema,
});

export const geoRoute = defineRoute({
  method: "GET",
  path: "/v1/geo",
  auth: "none",
  params: undefined,
  query: undefined,
  body: undefined,
  response: geoResponseSchema,
});

export const statusRoute = defineRoute({
  method: "GET",
  path: "/v1/status",
  auth: "none",
  params: undefined,
  query: z.object({ chainId: z.coerce.number().pipe(chainIdSchema).optional() }),
  body: undefined,
  response: statusResponseSchema,
});

export const STATUS_RANGES = ["24h", "90d"] as const;
export type StatusRange = (typeof STATUS_RANGES)[number];

/** One bucket of a component's history: minutes recorded, minutes healthy, and the worst state seen; null = no record. */
const bucketSchema = z
  .object({ seen: z.int().nonnegative(), ok: z.int().nonnegative(), worst: z.enum(HEALTH_STATES) })
  .nullable();

/** The Status board's bars (P6, D-324): 24 hourly or 90 daily buckets per component, oldest first, ending now. */
export const statusHistoryRoute = defineRoute({
  method: "GET",
  path: "/v1/status/history",
  auth: "none",
  params: undefined,
  query: z.object({ chainId: z.coerce.number().pipe(chainIdSchema), range: z.enum(STATUS_RANGES) }),
  body: undefined,
  response: z.object({
    range: z.enum(STATUS_RANGES),
    /** The first bucket's start (UTC seconds) and each bucket's length. */
    from: z.int(),
    bucketSec: z.int().positive(),
    components: z.array(z.object({ id: z.enum(STATUS_COMPONENTS), buckets: z.array(bucketSchema) })),
  }),
});
export type StatusHistory = z.output<typeof statusHistoryRoute.response>;

/** The server's clock for the apps' NTP-style sync (04-pricing R16): never cached. */
export const timeRoute = defineRoute({
  method: "GET",
  path: "/v1/time",
  auth: "none",
  params: undefined,
  query: undefined,
  body: undefined,
  response: z.object({ t: z.int() }),
});

export type ConfigResponse = z.output<typeof configResponseSchema>;
export type GeoResponse = z.output<typeof geoResponseSchema>;
export type StatusResponse = z.output<typeof statusResponseSchema>;

import * as z from "zod";
import { unixSecondsSchema } from "../primitives.ts";
import { defineRoute } from "./define.ts";
import { symbolSchema } from "./markets.ts";

/**
 * Prices over HTTP from the one Pyth gateway (D-272): first paint, history and the archived print of an instant. Live
 * ticks only ever travel on `/v1/stream`.
 */

/** `[unix ms, priceE8]` pairs, oldest first (one per second at most). */
const seriesPointsSchema = z.array(z.tuple([z.int(), z.int()]));

export const recentPricesRoute = defineRoute({
  method: "GET",
  path: "/v1/prices/recent",
  auth: "none",
  params: undefined,
  query: z.object({ symbols: z.string().min(1) }),
  body: undefined,
  response: z.object({
    serverTime: z.int(),
    feeds: z.array(z.object({ symbol: symbolSchema, points: seriesPointsSchema })),
  }),
});

export const candleSchema = z.tuple([z.int(), z.int(), z.int(), z.int(), z.int()]);

export const candlesRoute = defineRoute({
  method: "GET",
  path: "/v1/prices/candles",
  auth: "none",
  params: undefined,
  query: z.object({ symbol: symbolSchema, from: z.coerce.number().int(), to: z.coerce.number().int() }),
  body: undefined,
  /** `[minute start (s), open, high, low, close]` in e-8, oldest first. */
  response: z.object({ symbol: symbolSchema, candles: z.array(candleSchema) }),
});

/** The unique print at an instant (a window's K, a fill), as archived: the same bytes the chain verifies. */
export const printRoute = defineRoute({
  method: "GET",
  path: "/v1/prices/print",
  auth: "none",
  params: undefined,
  query: z.object({ symbol: symbolSchema, t: z.coerce.number().int().nonnegative() }),
  body: undefined,
  response: z.object({
    symbol: symbolSchema,
    t: unixSecondsSchema,
    priceE8: z.int(),
    confE8: z.int(),
    publishTime: unixSecondsSchema,
    prevPublishTime: unixSecondsSchema,
  }),
});

/**
 * Every market's newest price and the price states, for a (re)connect (04-pricing R15): about 1 KB where `/recent` for
 * every symbol was ~300 KB. Never cached — it carries the server time.
 */
export const latestPricesRoute = defineRoute({
  method: "GET",
  path: "/v1/prices/latest",
  auth: "none",
  params: undefined,
  query: undefined,
  body: undefined,
  response: z.object({
    serverTime: z.int(),
    /** One state letter per catalogue index (`FEED_STATE_CODE`). */
    states: z.string(),
    /** `[catalogue index, priceE8, publish ms]` for every market with a price. */
    points: z.array(z.tuple([z.int(), z.int(), z.int()])),
  }),
});

/**
 * Each market's last 24 hours (04-pricing R1.19): the open 24 h ago and the high and low since, in e-8, from Senryo's
 * own archive of the settlement prices — never an exchange's data (09-display-terms). A market with no candles in the
 * window is absent rather than guessed. Cached a minute.
 */
export const dayPricesRoute = defineRoute({
  method: "GET",
  path: "/v1/prices/day",
  auth: "none",
  params: undefined,
  query: undefined,
  body: undefined,
  response: z.object({
    from: unixSecondsSchema,
    markets: z.record(z.string(), z.object({ openE8: z.int(), highE8: z.int(), lowE8: z.int() })),
  }),
});

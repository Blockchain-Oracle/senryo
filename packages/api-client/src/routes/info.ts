import { z } from "zod";
import { addressSchema, chainIdSchema, intCodec, isoTimeSchema, uintCodec } from "../primitives.ts";
import { defineRoute } from "./define.ts";

/** Read-only app data: config, geo, status, markets, account (specs/services.md §api, D-040). */

export const MARKET_STATUSES = ["OPEN", "REOPENING", "CLOSED", "STALE", "CIRCUIT", "HALTED"] as const;
export const HEALTH_STATES = ["ok", "degraded", "down", "unknown"] as const;

export const configResponseSchema = z.object({
  /** Clients below this version show the update blocker. */
  minAppVersion: z.string(),
  features: z.record(z.string(), z.boolean()),
  networks: z.array(
    z.object({
      chainId: chainIdSchema,
      modeLabel: z.enum(["Mainnet", "Practice"]),
      deployed: z.boolean(),
      starter: z.boolean(),
      card: z.boolean(),
    }),
  ),
  /** The visible contact point for reports and safety questions (App Store 1.2, S12b.6). */
  contact: z.object({ email: z.email(), url: z.url().nullable() }),
});

export const geoResponseSchema = z.object({
  /** ISO 3166-1 alpha-2, or null when the edge did not say. */
  country: z.string().length(2).nullable(),
  /** D-038: practice is never gated; mainnet new risk is gated for these countries (Perpl list + sanctions). */
  mainnetTradingAllowed: z.boolean(),
  perplAllowed: z.boolean(),
  reason: z.string().nullable(),
});

const component = z.object({ state: z.enum(HEALTH_STATES), detail: z.string().nullable() });

export const statusResponseSchema = z.object({
  at: isoTimeSchema,
  chains: z.array(
    z.object({
      chainId: chainIdSchema,
      rpc: component,
      /** Seconds since the finalized head's timestamp. */
      headAgeSec: z.int().nullable(),
      oracles: z.array(z.object({ symbol: z.string(), status: z.enum(MARKET_STATUSES), ageSec: z.int().nullable() })),
      indexerLagBlocks: z.int().nullable(),
    }),
  ),
  card: component,
  perpl: component,
  aurora: component,
});

/** `chainId` omitted → the api's default chain (`CHAIN_ID`, practice today, D-156); the response names the chain. */
export const marketsQuerySchema = z.object({ chainId: z.coerce.number().pipe(chainIdSchema).optional() });

export const engineMarketSchema = z.object({
  id: z.int().nonnegative(),
  symbol: z.string(),
  name: z.string(),
  venue: z.literal("SENRYO"),
  status: z.enum(MARKET_STATUSES),
  /** Last accepted oracle price (1e18 USD per unit). */
  price18: uintCodec,
  /** Feed's latest answer (1e18), may differ while CIRCUIT. */
  latest18: uintCodec,
  updatedAt: z.int().nonnegative(),
  spreadBps: z.int().nonnegative(),
  imBps: z.int(),
  mmBps: z.int(),
  feeBps: z.int(),
  maxLeverageX: z.int(),
});

export const marketsResponseSchema = z.object({
  chainId: chainIdSchema,
  engine: z.array(engineMarketSchema),
  /** Perpl crypto markets (S7). Empty until then. */
  perpl: z.array(z.object({ symbol: z.string(), marketId: z.int() })),
});

export const accountParamsSchema = z.object({ address: addressSchema });

export const bucketsSchema = z.object({
  freeToTrade: intCodec,
  freeToSpend: intCodec,
  equityInit: intCodec,
  equityLiq: intCodec,
  im: uintCodec,
  mm: uintCodec,
  holds: uintCodec,
  cardDebt: uintCodec,
  envelope: uintCodec,
  ausd: uintCodec,
  usdc: uintCodec,
  nonce: uintCodec,
});

/** Envio-indexed history for one account (the apps query `@senryo/indexer-client` directly for full pages). */
export const accountHistorySchema = z.object({
  /** Indexer progress on this chain: the history covers blocks ≤ this. */
  indexedBlock: uintCodec,
  /** Cumulative stats (usd6; signed where the indexer is signed); null = the address never touched our contracts. */
  stats: z
    .object({
      deposited: intCodec,
      withdrawn: intCodec,
      realizedPnl: intCodec,
      feesPaid: intCodec,
      fundingPaid: intCodec,
      volume: intCodec,
      cardSpent: intCodec,
      tradeCount: z.int(),
      liquidationCount: z.int(),
      openPositions: z.int(),
    })
    .nullable(),
  /** Newest activity first (unified feed: fills, moves, holds, triggers, liquidations). */
  recent: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      timestamp: z.int(),
      block: z.int(),
      txHash: z.string(),
      amount: intCodec.nullable(),
      symbol: z.string().nullable(),
    }),
  ),
});

export const accountResponseSchema = z.object({
  chainId: chainIdSchema,
  address: addressSchema,
  /** Economic view (block ≤ finalized). */
  finalized: bucketsSchema,
  /** Optimistic view (`latest`, may still change). */
  latest: bucketsSchema,
  positions: z.array(
    z.object({ marketId: z.int(), isLong: z.boolean(), size18: uintCodec, entry18: uintCodec, openedBlock: uintCodec }),
  ),
  allowance: z.object({ dailyLimitUsd6: uintCodec, leftUsd6: uintCodec, expiry: uintCodec }),
  /** Indexer view (display only, D-014); null when the indexer is unavailable — never a fabricated empty history. */
  history: accountHistorySchema.nullable(),
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
  query: undefined,
  body: undefined,
  response: statusResponseSchema,
});

export const marketsRoute = defineRoute({
  method: "GET",
  path: "/v1/markets",
  auth: "none",
  params: undefined,
  query: marketsQuerySchema,
  body: undefined,
  response: marketsResponseSchema,
});

export const accountRoute = defineRoute({
  method: "GET",
  path: "/v1/account/:address",
  auth: "none",
  params: accountParamsSchema,
  query: marketsQuerySchema,
  body: undefined,
  response: accountResponseSchema,
});

export type ConfigResponse = z.output<typeof configResponseSchema>;
export type GeoResponse = z.output<typeof geoResponseSchema>;
export type StatusResponse = z.output<typeof statusResponseSchema>;
export type MarketsResponse = z.output<typeof marketsResponseSchema>;
export type AccountResponse = z.output<typeof accountResponseSchema>;

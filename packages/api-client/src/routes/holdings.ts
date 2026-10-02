import { z } from "zod";
import { addressSchema, chainIdSchema, isoTimeSchema, uintCodec } from "../primitives.ts";
import { defineRoute } from "./define.ts";

/**
 * `GET /v1/holdings` (B1, D6): every token at an address — native MON plus any ERC-20 it ever received — with live
 * balances read at one block. Verified = on Monad's token list (matched by address, never symbol). Prices only for
 * verified tokens on mainnet (none on Practice); an unverified token has no price, never counts in the total, and is
 * flagged `lookalike` when its symbol copies a verified one. Zero balances are dropped. Public, cached ~20 s per
 * address. `discovery.complete = false` means some tokens may be missing (the scan is behind or a fallback served it).
 */

export const holdingsQuerySchema = z.object({
  chainId: z.coerce.number().pipe(chainIdSchema),
  address: addressSchema,
});

export const DISCOVERY_SOURCES = ["hypersync", "alchemy", "tokenlist"] as const;
export const PRICE_SOURCES = ["geckoterminal", "alchemy"] as const;

export const holdingSchema = z.object({
  /** `0x000…000` for native MON. */
  address: addressSchema,
  native: z.boolean(),
  symbol: z.string(),
  name: z.string(),
  decimals: z.int().nonnegative(),
  /** Raw base units. */
  balance: uintCodec,
  verified: z.boolean(),
  /** Unverified, with the symbol of a verified token (spam such as a fake "WMON"). */
  lookalike: z.boolean(),
  /** `@senryo/identity` entity id (`token:143:0x…` lower-case, `native:143:MON`); unknown art → a monogram. */
  mark: z.string(),
  /** Token-list logo for verified tokens, else GeckoTerminal's image, else null (the client draws a monogram). */
  logoUrl: z.url().nullable(),
  /** USD × 1e18 per whole token (verified tokens on mainnet only). */
  priceUsd18: uintCodec.nullable(),
  /** balance × price (usd6), null without a price. */
  valueUsd6: uintCodec.nullable(),
  /** 24 h price change (bps, signed), when the price source gives it. */
  change24hBps: z.int().nullable(),
  priceSource: z.enum(PRICE_SOURCES).nullable(),
});

export const holdingsSchema = z.object({
  chainId: chainIdSchema,
  address: addressSchema,
  at: isoTimeSchema,
  /** Every balance was read at this block. */
  blockNumber: uintCodec,
  discovery: z.object({
    source: z.enum(DISCOVERY_SOURCES),
    complete: z.boolean(),
    /** The HyperSync scan covers blocks below this (null when another source served the request). */
    scannedToBlock: uintCodec.nullable(),
    /** Why discovery is partial (rate-limited, no key, scan still running), for logs and the ⓘ. */
    note: z.string().nullable(),
  }),
  /** Verified tokens by value, unpriced verified next, then unverified ("Other tokens") by symbol. */
  tokens: z.array(holdingSchema),
  /** Σ valueUsd6 of verified, priced tokens. */
  totalUsd6: uintCodec,
  /** A verified token has no price, so the total is a lower bound ("≈" + ⓘ). */
  partial: z.boolean(),
  /** False on Practice: balances only. */
  pricesAvailable: z.boolean(),
});

export const holdingsRoute = defineRoute({
  method: "GET",
  path: "/v1/holdings",
  auth: "none",
  params: undefined,
  query: holdingsQuerySchema,
  body: undefined,
  response: holdingsSchema,
});

export type Holding = z.output<typeof holdingSchema>;
export type Holdings = z.output<typeof holdingsSchema>;

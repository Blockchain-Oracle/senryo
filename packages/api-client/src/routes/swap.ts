import { SWAP_MAX_SLIPPAGE_BPS, SWAP_SLIPPAGE_BPS } from "@senryo/config";
import { z } from "zod";
import { addressSchema, chainIdSchema, hexSchema, isoTimeSchema, uintCodec, unixSecondsSchema } from "../primitives.ts";
import { defineRoute } from "./define.ts";

/**
 * `GET /v1/swap/quote` (B6, D6): any ↔ any on mainnet. Monorail and KyberSwap are asked in parallel; the quote with the
 * better minimum output wins. Its `router` is one of the two pinned in `@senryo/config` (a quote aimed elsewhere is
 * dropped as an alternative with an error). Impact is judged against an independent reference price (XAU feed for
 * XAUt0, the market price otherwise) and falls back to the provider's own figure; `impact` applies the rule
 * (warn > 1 %, block > 5 %). Practice answers `unsupported` (no aggregator on 10143).
 */

export const SWAP_PROVIDERS = ["monorail", "kyberswap"] as const;
export const IMPACT_LEVELS = ["ok", "warn", "block"] as const;
export const IMPACT_SOURCES = ["reference", "provider"] as const;
export const REFERENCE_SOURCES = ["xau-feed", "geckoterminal"] as const;

export const swapQuoteQuerySchema = z.object({
  chainId: z.coerce.number().pipe(chainIdSchema),
  /** `0x000…000` = native MON. */
  from: addressSchema,
  to: addressSchema,
  /** Raw base units of `from`. */
  amount: uintCodec,
  /** The account that sends the swap and receives the output (the calldata is built for it). */
  sender: addressSchema,
  slippageBps: z.coerce.number().int().min(1).max(SWAP_MAX_SLIPPAGE_BPS).default(SWAP_SLIPPAGE_BPS),
});

export const swapTokenSchema = z.object({
  address: addressSchema,
  symbol: z.string(),
  decimals: z.int().nonnegative(),
});

export const swapHopSchema = z.object({
  from: addressSchema,
  to: addressSchema,
  fromSymbol: z.string().nullable(),
  toSymbol: z.string().nullable(),
  /** Venues the hop is split across ("uniswap-v4", "pancake-v3", …). */
  venues: z.array(z.string()),
});

export const swapCandidateSchema = z.object({
  provider: z.enum(SWAP_PROVIDERS),
  /** The pinned router the calldata calls. */
  router: addressSchema,
  data: hexSchema,
  /** MON value of the call (equals `amountIn` for a native input, else 0). */
  value: uintCodec,
  amountOut: uintCodec,
  /** What the swap is sent with: the least it may deliver. */
  minOut: uintCodec,
  /** The aggregator's gas metering, and the budget the send list uses (`aggregatorSwapGasLimit`). */
  gasEstimate: uintCodec.nullable(),
  gasLimit: uintCodec,
  /** The aggregator's own impact figure (bps). */
  providerImpactBps: z.int().nullable(),
  /** (refValueIn − refValueOut) / refValueIn (bps, signed: negative = better than the reference). */
  referenceImpactBps: z.int().nullable(),
  /** The figure the rule judged and where it came from. */
  impactBps: z.int().nullable(),
  impactSource: z.enum(IMPACT_SOURCES).nullable(),
  impact: z.enum(IMPACT_LEVELS),
  route: z.array(swapHopSchema),
  quoteId: z.string().nullable(),
  /** Re-quote after this (unix seconds). */
  expiresAt: unixSecondsSchema,
});

export const swapAlternativeSchema = z.object({
  provider: z.enum(SWAP_PROVIDERS),
  amountOut: uintCodec.nullable(),
  minOut: uintCodec.nullable(),
  error: z.string().nullable(),
});

export const swapReferenceSchema = z.object({
  /** USD × 1e18 per whole token. */
  priceInUsd18: uintCodec.nullable(),
  priceOutUsd18: uintCodec.nullable(),
  sourceIn: z.enum(REFERENCE_SOURCES).nullable(),
  sourceOut: z.enum(REFERENCE_SOURCES).nullable(),
});

const common = { chainId: chainIdSchema, at: isoTimeSchema };

export const swapQuoteSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    ...common,
    from: swapTokenSchema,
    to: swapTokenSchema,
    amountIn: uintCodec,
    slippageBps: z.int(),
    quote: swapCandidateSchema,
    alternatives: z.array(swapAlternativeSchema),
    reference: swapReferenceSchema,
  }),
  z.object({
    status: z.literal("no_route"),
    ...common,
    reason: z.string(),
    alternatives: z.array(swapAlternativeSchema),
  }),
  z.object({ status: z.literal("unsupported"), ...common, reason: z.string() }),
]);

export const swapQuoteRoute = defineRoute({
  method: "GET",
  path: "/v1/swap/quote",
  auth: "none",
  params: undefined,
  query: swapQuoteQuerySchema,
  body: undefined,
  response: swapQuoteSchema,
});

export type SwapQuoteResponse = z.output<typeof swapQuoteSchema>;
export type SwapQuoteOk = Extract<SwapQuoteResponse, { status: "ok" }>;
export type SwapCandidate = z.output<typeof swapCandidateSchema>;
export type SwapAlternative = z.output<typeof swapAlternativeSchema>;

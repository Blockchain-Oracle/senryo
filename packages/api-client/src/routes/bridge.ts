import { z } from "zod";
import { addressSchema, chainIdSchema, hexSchema, isoTimeSchema, uintCodec, unixSecondsSchema } from "../primitives.ts";
import { defineRoute } from "./define.ts";

/**
 * Cross-chain routes (B4/B9, D2), proxied by services/api; the app signs only the Monad-side steps.
 *  - `GET /v1/bridge/routes`: which chains an asset can go to (out) or come from (in) — drives the chain picker.
 *  - `GET /v1/bridge/quote`: every provider the route lists is asked; the best minimum received wins.
 *  - `GET /v1/bridge/status`: one provider's delivery state for a request id or source tx hash.
 * Aurora (NEAR Intents) is a placeholder until its key exists; while an incident covers Monad its tiles are hidden.
 */

export const BRIDGE_PROVIDERS = ["cctp", "relay", "across", "lifi", "aurora"] as const;
export const BRIDGE_ASSETS = ["USDC", "USDT0", "AUSD", "XAUt0", "MON"] as const;
export const REMOTE_ASSETS = ["USDC", "USDT", "AUSD", "XAUT", "NATIVE"] as const;
export const BRIDGE_DIRECTIONS = ["out", "in"] as const;
export const BRIDGE_STEP_ACTIONS = ["relayDeposit", "cctpBurn", "acrossDeposit", "lifiBridge"] as const;
export const BRIDGE_STATES = ["unknown", "pending", "delivered", "refunded", "failed"] as const;
export const AURORA_STATES = ["no_key", "ok", "incident", "unreachable"] as const;

/** Longest recipient accepted (EVM 42, Solana ≤ 44, Tron 34 chars; room for others). */
const RECIPIENT_MAX_CHARS = 128;
/** A request id or tx hash ("0x" + 64 hex), with room for provider ids. */
const TRACKING_ID_MAX_CHARS = 130;

const providerSchema = z.enum(BRIDGE_PROVIDERS);
const remoteTokenSchema = z.object({
  asset: z.enum(REMOTE_ASSETS),
  symbol: z.string(),
  /** EVM address, Solana mint or Tron address (non-EVM chains carry Relay's native placeholder). */
  address: z.string(),
  decimals: z.int().nonnegative(),
});

// ---------------------------------------------------------------- routes

export const bridgeRoutesQuerySchema = z.object({
  /** The Monad network (143 Mainnet, 10143 Practice). */
  chainId: z.coerce.number().pipe(chainIdSchema),
  asset: z.enum(BRIDGE_ASSETS),
  direction: z.enum(BRIDGE_DIRECTIONS),
});

export const bridgeRouteChainSchema = z.object({
  /** EVM chain id, or Relay's id for Solana / Tron. */
  chainId: z.int(),
  name: z.string(),
  vm: z.enum(["evm", "svm", "tvm"]),
  /** `@senryo/identity` chain entity id. */
  mark: z.string(),
  /** What arrives (out) or is sent (in) on that chain; the first is the default. */
  remote: z.array(remoteTokenSchema),
  providers: z.array(z.object({ provider: providerSchema, available: z.boolean(), reason: z.string().nullable() })),
  /** At least one provider is available. */
  available: z.boolean(),
  /** Typical time for the fastest available provider (s); a quote gives the real estimate. */
  etaSec: z.int().nonnegative(),
});

export const bridgeRoutesSchema = z.object({
  chainId: chainIdSchema,
  asset: z.enum(BRIDGE_ASSETS),
  direction: z.enum(BRIDGE_DIRECTIONS),
  chains: z.array(bridgeRouteChainSchema),
  aurora: z.object({ state: z.enum(AURORA_STATES), detail: z.string().nullable() }),
});

export const bridgeRoutesRoute = defineRoute({
  method: "GET",
  path: "/v1/bridge/routes",
  auth: "none",
  params: undefined,
  query: bridgeRoutesQuerySchema,
  body: undefined,
  response: bridgeRoutesSchema,
});

// ---------------------------------------------------------------- quote

export const bridgeQuoteQuerySchema = z.object({
  /** One side must be a Monad network (143 or 10143); the other is a chain from `/v1/bridge/routes`. */
  fromChain: z.coerce.number().int(),
  toChain: z.coerce.number().int(),
  /** The Monad-side asset. */
  asset: z.enum(BRIDGE_ASSETS),
  /** Raw base units of the source asset. */
  amount: uintCodec,
  /** The account that signs the source-chain steps. */
  sender: addressSchema,
  /** Where it arrives: an EVM address, a Solana or Tron address. */
  recipient: z.string().min(1).max(RECIPIENT_MAX_CHARS),
  /** The other chain's asset (default: the route's first). */
  remote: z.enum(REMOTE_ASSETS).optional(),
  /** Ask only this provider. */
  provider: providerSchema.optional(),
});

export const bridgeStepSchema = z.discriminatedUnion("kind", [
  /** Exact ERC-20 approval of the provider contract (skipped by the app when the allowance covers it). */
  z.object({
    kind: z.literal("approve"),
    chainId: z.int(),
    token: addressSchema,
    spender: addressSchema,
    amount: uintCodec,
  }),
  z.object({
    kind: z.literal("call"),
    chainId: z.int(),
    to: addressSchema,
    data: hexSchema,
    value: uintCodec,
    /** The gas budget key the sender caps this call with. */
    action: z.enum(BRIDGE_STEP_ACTIONS),
  }),
]);

export const bridgeFeeSchema = z.object({
  kind: z.enum(["relayer", "protocol", "forward", "bridge", "gas"]),
  amount: uintCodec,
  symbol: z.string(),
  decimals: z.int().nonnegative(),
  chainId: z.int(),
  /** Already taken out of `amountOut` (true) or paid on top, e.g. a MON value on the call (false). */
  included: z.boolean(),
  usd6: uintCodec.nullable(),
});

export const bridgeAlternativeSchema = z.object({
  provider: providerSchema,
  minReceived: uintCodec.nullable(),
  etaSec: z.int().nullable(),
  error: z.string().nullable(),
});

const quoteCommon = { at: isoTimeSchema, fromChain: z.int(), toChain: z.int(), asset: z.enum(BRIDGE_ASSETS) };

export const bridgeQuoteSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    ...quoteCommon,
    provider: providerSchema,
    direction: z.enum(BRIDGE_DIRECTIONS),
    remote: remoteTokenSchema,
    /** What arrives: symbol and decimals of `amountOut` / `minReceived`. */
    out: z.object({ symbol: z.string(), decimals: z.int().nonnegative() }),
    amountIn: uintCodec,
    amountOut: uintCodec,
    minReceived: uintCodec,
    fees: z.array(bridgeFeeSchema),
    etaSec: z.int().nonnegative(),
    /** In order; Monad-side steps are what the app signs. */
    steps: z.array(bridgeStepSchema),
    /** Tracking: a Relay request id is known now; the others track by the source tx hash once sent. */
    tracking: z.object({ id: z.string().nullable(), byTxHash: z.boolean() }),
    /** `GET` this (with `{txHash}` filled in when `byTxHash`). */
    statusUrl: z.string(),
    expiresAt: unixSecondsSchema.nullable(),
    alternatives: z.array(bridgeAlternativeSchema),
  }),
  z.object({
    status: z.literal("unsupported"),
    ...quoteCommon,
    reason: z.string(),
    alternatives: z.array(bridgeAlternativeSchema),
  }),
]);

export const bridgeQuoteRoute = defineRoute({
  method: "GET",
  path: "/v1/bridge/quote",
  auth: "none",
  params: undefined,
  query: bridgeQuoteQuerySchema,
  body: undefined,
  response: bridgeQuoteSchema,
});

// ---------------------------------------------------------------- status

export const bridgeStatusQuerySchema = z.object({
  route: providerSchema,
  /** Relay request id, or the source-chain tx hash for CCTP / Across / LI.FI. */
  id: z.string().min(1).max(TRACKING_ID_MAX_CHARS),
  fromChain: z.coerce.number().int(),
  toChain: z.coerce.number().int().optional(),
});

export const bridgeStatusSchema = z.object({
  route: providerSchema,
  id: z.string(),
  state: z.enum(BRIDGE_STATES),
  /** The provider's own word for it (for logs and support). */
  providerStatus: z.string(),
  sourceTxHash: z.string().nullable(),
  destinationTxHash: z.string().nullable(),
  detail: z.string().nullable(),
  at: isoTimeSchema,
});

export const bridgeStatusRoute = defineRoute({
  method: "GET",
  path: "/v1/bridge/status",
  auth: "none",
  params: undefined,
  query: bridgeStatusQuerySchema,
  body: undefined,
  response: bridgeStatusSchema,
});

export type BridgeRoutes = z.output<typeof bridgeRoutesSchema>;
export type BridgeRouteChain = z.output<typeof bridgeRouteChainSchema>;
export type BridgeQuoteResponse = z.output<typeof bridgeQuoteSchema>;
export type BridgeQuoteOk = Extract<BridgeQuoteResponse, { status: "ok" }>;
export type BridgeStepWire = z.output<typeof bridgeStepSchema>;
export type BridgeFee = z.output<typeof bridgeFeeSchema>;
export type BridgeAlternative = z.output<typeof bridgeAlternativeSchema>;
export type BridgeStatus = z.output<typeof bridgeStatusSchema>;

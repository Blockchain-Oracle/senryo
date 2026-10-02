/**
 * The two aggregators behind `/v1/swap/quote` (plan §0.8 B6), each turned into one `Candidate` shape:
 *  - Monorail Pathfinder v4: one GET, amount in human units, `max_slippage` in bps, returns `transaction{to,data,value}`
 *    and `compound_impact` (a percent: "0.0539" on a 10 MON swap, "12.63" on the thin USDC → XAUt0 route).
 *  - KyberSwap: `GET /routes` (raw amount, `0xEeee…` for native) → `POST /route/build` (sender, recipient,
 *    `slippageTolerance` in bps, deadline) → `{routerAddress, data, transactionValue, amountOut, gas}`. Its minimum is
 *    `amountOut × (1 − slippage)`, the same rule the router enforces; impact from its own USD in/out values.
 * Pinning (`to` = the provider's pinned router) and value checks are the caller's (swap-quote.ts).
 */
import { type Address, getAddress, type Hex } from "@senryo/chain";
import {
  KYBERSWAP_API,
  KYBERSWAP_CLIENT_ID,
  KYBERSWAP_NATIVE,
  MONORAIL_QUOTE_URL,
  MONORAIL_SOURCE,
  NATIVE_TOKEN,
  SWAP_DEADLINE_SEC,
  type SwapProvider,
} from "@senryo/config";
import { formatUnits, impactBpsOf } from "@senryo/core";
import { z } from "zod";
import { decimalToUnits, fetchJson, nowSec, percentToBps, UpstreamError } from "./upstream.ts";

export interface SwapHop {
  from: Address;
  to: Address;
  fromSymbol: string | null;
  toSymbol: string | null;
  venues: string[];
}

export interface Candidate {
  provider: SwapProvider;
  router: Address;
  data: Hex;
  value: bigint;
  amountOut: bigint;
  minOut: bigint;
  gasEstimate: bigint | null;
  providerImpactBps: bigint | null;
  route: SwapHop[];
  quoteId: string | null;
}

export interface QuoteRequest {
  from: Address;
  to: Address;
  amountIn: bigint;
  decimalsIn: number;
  sender: Address;
  slippageBps: number;
}

export class NoRouteError extends Error {
  constructor(provider: string, message: string) {
    super(`${provider}: ${message}`);
    this.name = "NoRouteError";
  }
}

const BPS = 10_000n;
const USD6 = 6;
const uint = z.string().regex(/^\d+$/);
const hex = z.string().regex(/^0x[0-9a-fA-F]*$/);

/** Exact human-unit text without trailing zeros ("10", "0.25"). */
function humanAmount(amount: bigint, decimals: number): string {
  const text = formatUnits(amount, decimals, decimals, { grouping: false });
  return text.includes(".") ? text.replace(/\.?0+$/, "") : text;
}

// ---------------------------------------------------------------- Monorail

const monorailSchema = z.object({
  output: uint,
  min_output: uint,
  compound_impact: z.union([z.string(), z.number()]).nullish(),
  gas_estimate: z.number().nullish(),
  quote_id: z.string().nullish(),
  routes: z
    .array(
      z.array(
        z.object({
          from: z.string(),
          to: z.string(),
          from_symbol: z.string().nullish(),
          to_symbol: z.string().nullish(),
          splits: z.array(z.object({ protocol: z.string() })).nullish(),
        }),
      ),
    )
    .nullish(),
  transaction: z.object({ to: z.string(), data: hex, value: z.string() }),
});

export async function monorailQuote(req: QuoteRequest): Promise<Candidate> {
  const params = new URLSearchParams({
    source: MONORAIL_SOURCE,
    from: req.from,
    to: req.to,
    amount: humanAmount(req.amountIn, req.decimalsIn),
    sender: req.sender,
    max_slippage: String(req.slippageBps),
  });
  const res = await fetchJson("monorail", `${MONORAIL_QUOTE_URL}?${params}`);
  const json = res?.json as { transaction?: unknown; message?: string } | undefined;
  if (!json?.transaction) throw new NoRouteError("monorail", json?.message ?? "no route");
  const q = monorailSchema.parse(json);
  return {
    provider: "monorail",
    router: getAddress(q.transaction.to),
    data: q.transaction.data as Hex,
    value: BigInt(q.transaction.value),
    amountOut: BigInt(q.output),
    minOut: BigInt(q.min_output),
    gasEstimate: q.gas_estimate === null || q.gas_estimate === undefined ? null : BigInt(q.gas_estimate),
    providerImpactBps: percentToBps(q.compound_impact ?? undefined) ?? null,
    route: (q.routes ?? []).flatMap((path) =>
      path.map((hop) => ({
        from: getAddress(hop.from),
        to: getAddress(hop.to),
        fromSymbol: hop.from_symbol ?? null,
        toSymbol: hop.to_symbol ?? null,
        venues: [...new Set((hop.splits ?? []).map((s) => s.protocol))],
      })),
    ),
    quoteId: q.quote_id ?? null,
  };
}

// ---------------------------------------------------------------- KyberSwap

const kyberRouteSchema = z.object({
  code: z.number(),
  message: z.string().nullish(),
  data: z
    .object({
      routeSummary: z
        .object({
          amountInUsd: z.string().nullish(),
          amountOutUsd: z.string().nullish(),
          route: z.array(z.array(z.object({ tokenIn: z.string(), tokenOut: z.string(), exchange: z.string() }))),
        })
        .passthrough(),
      routerAddress: z.string(),
    })
    .nullish(),
  requestId: z.string().nullish(),
});
const kyberBuildSchema = z.object({
  code: z.number(),
  message: z.string().nullish(),
  data: z
    .object({
      amountOut: uint,
      amountInUsd: z.string().nullish(),
      amountOutUsd: z.string().nullish(),
      gas: uint.nullish(),
      data: hex,
      routerAddress: z.string(),
      transactionValue: uint.nullish(),
    })
    .nullish(),
});

const kyberToken = (token: Address) => (token.toLowerCase() === NATIVE_TOKEN ? KYBERSWAP_NATIVE : token);
const kyberAddress = (token: string) =>
  getAddress(token.toLowerCase() === KYBERSWAP_NATIVE.toLowerCase() ? NATIVE_TOKEN : token);

function usdImpact(inUsd: string | null | undefined, outUsd: string | null | undefined): bigint | null {
  const a = decimalToUnits(inUsd ?? undefined, USD6);
  const b = decimalToUnits(outUsd ?? undefined, USD6);
  return a !== undefined && b !== undefined && a > 0n ? impactBpsOf(a, b) : null;
}

export async function kyberQuote(req: QuoteRequest): Promise<Candidate> {
  const headers = { "x-client-id": KYBERSWAP_CLIENT_ID };
  const params = new URLSearchParams({
    tokenIn: kyberToken(req.from),
    tokenOut: kyberToken(req.to),
    amountIn: req.amountIn.toString(),
  });
  const raw = (await fetchJson("kyberswap", `${KYBERSWAP_API}/routes?${params}`, { headers }))?.json;
  const routes = kyberRouteSchema.parse(raw);
  if (routes.code !== 0 || !routes.data) throw new NoRouteError("kyberswap", routes.message ?? "no route");
  // `/route/build` needs the summary exactly as `/routes` sent it (pool data, checksum): never the parsed subset.
  const routeSummary = (raw as { data: { routeSummary: unknown } }).data.routeSummary;
  const build = kyberBuildSchema.parse(
    (
      await fetchJson("kyberswap", `${KYBERSWAP_API}/route/build`, {
        method: "POST",
        headers,
        body: {
          routeSummary,
          sender: req.sender,
          recipient: req.sender,
          slippageTolerance: req.slippageBps,
          deadline: nowSec() + SWAP_DEADLINE_SEC,
          source: KYBERSWAP_CLIENT_ID,
        },
      })
    )?.json,
  );
  if (build.code !== 0 || !build.data) throw new UpstreamError("kyberswap", null, build.message ?? "build failed");
  const amountOut = BigInt(build.data.amountOut);
  return {
    provider: "kyberswap",
    router: getAddress(build.data.routerAddress),
    data: build.data.data as Hex,
    value: BigInt(build.data.transactionValue ?? "0"),
    amountOut,
    minOut: (amountOut * (BPS - BigInt(req.slippageBps))) / BPS,
    gasEstimate: build.data.gas ? BigInt(build.data.gas) : null,
    providerImpactBps: usdImpact(build.data.amountInUsd, build.data.amountOutUsd),
    route: routes.data.routeSummary.route.flatMap((path) =>
      path.map((hop) => ({
        from: kyberAddress(hop.tokenIn),
        to: kyberAddress(hop.tokenOut),
        fromSymbol: null,
        toSymbol: null,
        venues: [hop.exchange],
      })),
    ),
    quoteId: routes.requestId ?? null,
  };
}

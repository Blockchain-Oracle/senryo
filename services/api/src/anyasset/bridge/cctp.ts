/**
 * Circle CCTP v2 with the Forwarding Service (developers.circle.com/cctp): burn USDC on the source with
 * `depositForBurnWithHook` and Circle mints on the destination, so the recipient needs no gas there. Fees from Iris
 * `GET /v2/burn/USDC/fees/{src}/{dst}?forward=true`: the protocol fee (`minimumFee`, bps, 0 from Monad on 2 Oct) and
 * the forward fee (low/med/high, USDC base units — 0.055 to Base, 1.18 to Ethereum on 2 Oct). The burn sets
 * `maxFee` = protocol + forward `high`, so the recipient gets at least `amount − maxFee`; the expected arrival uses
 * `med`. Status: `GET /v2/messages/{srcDomain}?transactionHash=` → `status` and `forwardTxHash`.
 */
import { encodeCctpBurn, isAddress } from "@senryo/chain";
import {
  BRIDGE_TYPICAL_ETA_SEC,
  bridgeChain,
  CCTP_DOMAIN,
  CCTP_FAST_FINALITY,
  CCTP_IRIS,
  CCTP_TOKEN_MESSENGER,
  isChainId,
} from "@senryo/config";
import { z } from "zod";
import { decimalToUnits, fetchJson, UpstreamError } from "../upstream.ts";
import {
  approveStep,
  callStep,
  fee,
  type ProviderQuote,
  type QuoteContext,
  type StatusInput,
  type StatusResult,
} from "./types.ts";

/** Iris `minimumFee` is in bps with up to two decimals (1.3 = 1.3 bps); parsed as hundredths of a bp. */
const MIN_FEE_SCALE = 2;
const HUNDREDTHS_BPS_PER_UNIT = 1_000_000n;

const feesSchema = z.array(
  z.object({
    finalityThreshold: z.number(),
    minimumFee: z.union([z.number(), z.string()]),
    forwardFee: z.object({ low: z.number(), med: z.number(), high: z.number() }).nullish(),
  }),
);

/** The CCTP domain of a chain id: Monad (143/10143) is 15, others from the bridge chain table. */
export function cctpDomainOf(chainId: number): number | undefined {
  return isChainId(chainId) ? CCTP_DOMAIN.monad : bridgeChain(chainId)?.cctpDomain;
}

export async function cctpQuote(ctx: QuoteContext): Promise<ProviderQuote> {
  const src = cctpDomainOf(ctx.from.chainId);
  const dst = cctpDomainOf(ctx.to.chainId);
  if (src === undefined || dst === undefined) throw new UpstreamError("cctp", null, "chain has no CCTP domain");
  if (ctx.from.token.symbol !== "USDC" || ctx.to.token.symbol !== "USDC") {
    throw new UpstreamError("cctp", null, "CCTP moves USDC only");
  }
  if (!isAddress(ctx.recipient)) throw new UpstreamError("cctp", null, "CCTP forwarding needs an EVM recipient");
  const res = await fetchJson("cctp", `${CCTP_IRIS[ctx.monadChainId]}/v2/burn/USDC/fees/${src}/${dst}?forward=true`);
  const tiers = feesSchema.parse(res?.json);
  const fast = tiers.find((t) => t.finalityThreshold === CCTP_FAST_FINALITY);
  if (!fast?.forwardFee) throw new UpstreamError("cctp", null, "no forwarding fee for this pair");
  const minFee = decimalToUnits(String(fast.minimumFee), MIN_FEE_SCALE) ?? 0n;
  // Round the protocol fee up so the burn never under-funds it.
  const protocolFee = (ctx.amount * minFee + HUNDREDTHS_BPS_PER_UNIT - 1n) / HUNDREDTHS_BPS_PER_UNIT;
  const maxFee = protocolFee + BigInt(fast.forwardFee.high);
  const expectedFee = protocolFee + BigInt(fast.forwardFee.med);
  if (ctx.amount <= maxFee) throw new UpstreamError("cctp", null, "amount is below the forwarding fee");
  const messenger = CCTP_TOKEN_MESSENGER[ctx.monadChainId];
  const usdc = { symbol: "USDC", decimals: ctx.from.token.decimals, chainId: ctx.from.chainId };
  return {
    provider: "cctp",
    amountOut: ctx.amount - expectedFee,
    minReceived: ctx.amount - maxFee,
    out: { symbol: ctx.to.token.symbol, decimals: ctx.to.token.decimals },
    fees: [
      ...(protocolFee > 0n ? [fee("protocol", protocolFee, usdc, true, protocolFee)] : []),
      fee("forward", BigInt(fast.forwardFee.med), usdc, true, BigInt(fast.forwardFee.med)),
    ],
    etaSec: BRIDGE_TYPICAL_ETA_SEC.cctp,
    steps: [
      approveStep(ctx.from.chainId, ctx.from.token.address, messenger, ctx.amount),
      callStep(
        ctx.from.chainId,
        messenger,
        encodeCctpBurn({
          amount: ctx.amount,
          destinationDomain: dst,
          recipient: ctx.recipient,
          burnToken: ctx.from.token.address as `0x${string}`,
          maxFee,
        }),
        0n,
        "cctpBurn",
      ),
    ],
    trackingId: null,
    expiresAt: null,
  };
}

const messagesSchema = z.object({
  messages: z.array(
    z.object({
      status: z.string(),
      forwardTxHash: z.string().nullish(),
      forwardState: z.string().nullish(),
      transactionHash: z.string().nullish(),
    }),
  ),
});

export async function cctpStatus(input: StatusInput): Promise<StatusResult> {
  const src = cctpDomainOf(input.fromChain);
  if (src === undefined) throw new UpstreamError("cctp", null, "source chain has no CCTP domain");
  const url = `${CCTP_IRIS[input.monadChainId]}/v2/messages/${src}?transactionHash=${encodeURIComponent(input.id)}`;
  const res = await fetchJson("cctp", url, { notFoundAsNull: true });
  const message = res ? messagesSchema.parse(res.json).messages[0] : undefined;
  if (!message) {
    return {
      state: "unknown",
      providerStatus: "not_found",
      sourceTxHash: input.id,
      destinationTxHash: null,
      detail: null,
    };
  }
  const forwardFailed = message.forwardState?.toLowerCase().includes("fail") ?? false;
  const delivered = message.status === "complete" && Boolean(message.forwardTxHash);
  return {
    state: forwardFailed ? "failed" : delivered ? "delivered" : "pending",
    providerStatus: message.forwardState ? `${message.status}/${message.forwardState}` : message.status,
    sourceTxHash: input.id,
    destinationTxHash: message.forwardTxHash ?? null,
    detail:
      message.status === "complete" && !delivered ? "attested; waiting for Circle to mint on the destination" : null,
  };
}

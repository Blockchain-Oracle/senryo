/**
 * LI.FI (li.quest/v1, `order=FASTEST`): `GET /quote` returns the diamond call (`transactionRequest`), the approval
 * target (`estimate.approvalAddress`), expected and minimum output, fee costs and the duration. XAUt0 → Ethereum XAUt
 * goes over glacis (LayerZero OFT) and charges its bridge fee in MON as the call's value (48.5 MON ≈ $1.65 on 2 Oct),
 * so that step sends MON — the reserve rule applies. Status: `GET /status?txHash&fromChain&toChain` (404 until seen).
 */
import { LIFI_API, LIFI_INTEGRATOR } from "@senryo/config";
import { z } from "zod";
import { decimalToUnits, fetchJson, nowSec } from "../upstream.ts";
import {
  approveStep,
  callStep,
  fee,
  isEvmNative,
  type ProviderQuote,
  type QuoteContext,
  type StatusInput,
  type StatusResult,
} from "./types.ts";

const USD6 = 6;
/** 0.5 % — the minimum output LI.FI quotes is the expected amount less this. */
const SLIPPAGE = "0.005";
const QUOTE_TTL_SEC = 60;
const uint = z.string().regex(/^\d+$/);

const quoteSchema = z.object({
  tool: z.string().nullish(),
  action: z.object({ toToken: z.object({ symbol: z.string(), decimals: z.number().int() }) }),
  estimate: z.object({
    approvalAddress: z.string().nullish(),
    toAmount: uint,
    toAmountMin: uint,
    executionDuration: z.number().nullish(),
    feeCosts: z
      .array(
        z.object({
          name: z.string(),
          amount: uint,
          amountUSD: z.string().nullish(),
          included: z.boolean().nullish(),
          token: z.object({ symbol: z.string(), decimals: z.number().int(), chainId: z.number() }),
        }),
      )
      .nullish(),
  }),
  transactionRequest: z.object({ to: z.string(), data: z.string(), value: z.string().nullish(), chainId: z.number() }),
});

export async function lifiQuote(ctx: QuoteContext): Promise<ProviderQuote> {
  const params = new URLSearchParams({
    fromChain: String(ctx.from.chainId),
    toChain: String(ctx.to.chainId),
    fromToken: ctx.from.token.address,
    toToken: ctx.to.token.address,
    fromAmount: ctx.amount.toString(),
    fromAddress: ctx.sender,
    toAddress: ctx.recipient,
    order: "FASTEST",
    slippage: SLIPPAGE,
    integrator: LIFI_INTEGRATOR,
  });
  const res = await fetchJson("lifi", `${LIFI_API}/quote?${params}`);
  const q = quoteSchema.parse(res?.json);
  const tx = q.transactionRequest;
  const steps: ProviderQuote["steps"] = [];
  if (!isEvmNative(ctx.from.token.address) && q.estimate.approvalAddress) {
    steps.push(approveStep(ctx.from.chainId, ctx.from.token.address, q.estimate.approvalAddress, ctx.amount));
  }
  steps.push(callStep(tx.chainId, tx.to, tx.data, BigInt(tx.value ?? "0"), "lifiBridge"));
  return {
    provider: "lifi",
    amountOut: BigInt(q.estimate.toAmount),
    minReceived: BigInt(q.estimate.toAmountMin),
    out: { symbol: q.action.toToken.symbol, decimals: q.action.toToken.decimals },
    fees: (q.estimate.feeCosts ?? []).map((f) =>
      fee(
        f.included === false ? "bridge" : "protocol",
        BigInt(f.amount),
        f.token,
        f.included !== false,
        decimalToUnits(f.amountUSD ?? undefined, USD6) ?? null,
      ),
    ),
    etaSec: q.estimate.executionDuration ?? 0,
    steps,
    trackingId: null,
    expiresAt: nowSec() + QUOTE_TTL_SEC,
  };
}

const statusSchema = z.object({
  status: z.string(),
  substatus: z.string().nullish(),
  substatusMessage: z.string().nullish(),
  sending: z.object({ txHash: z.string().nullish() }).nullish(),
  receiving: z.object({ txHash: z.string().nullish() }).nullish(),
});

export async function lifiStatus(input: StatusInput): Promise<StatusResult> {
  const params = new URLSearchParams({ txHash: input.id, fromChain: String(input.fromChain) });
  if (input.toChain !== undefined) params.set("toChain", String(input.toChain));
  const res = await fetchJson("lifi", `${LIFI_API}/status?${params}`, { notFoundAsNull: true });
  if (!res) {
    return {
      state: "unknown",
      providerStatus: "NOT_FOUND",
      sourceTxHash: input.id,
      destinationTxHash: null,
      detail: null,
    };
  }
  const s = statusSchema.parse(res.json);
  const done = s.status === "DONE";
  const state: StatusResult["state"] =
    done && s.substatus === "REFUNDED"
      ? "refunded"
      : done
        ? "delivered"
        : s.status === "FAILED" || s.status === "INVALID"
          ? "failed"
          : s.status === "NOT_FOUND"
            ? "unknown"
            : "pending";
  return {
    state,
    providerStatus: s.substatus ? `${s.status}/${s.substatus}` : s.status,
    sourceTxHash: s.sending?.txHash ?? input.id,
    destinationTxHash: s.receiving?.txHash ?? null,
    detail: s.substatusMessage ?? null,
  };
}

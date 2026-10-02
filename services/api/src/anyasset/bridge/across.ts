/**
 * Across (app.across.to/api): `GET /swap/approval` (exactInput) returns the allowance it needs (`checks.allowance`),
 * the deposit transaction (`swapTx`) on the spoke, expected and minimum output, fees and the fill time. Live on 2 Oct:
 * 10 USDT0 Monad → Arbitrum USDT0 in ~2 s for $0.009. Status: `GET /deposit/status?originChainId&depositTxnRef=`
 * (404 until indexed).
 */
import { ACROSS_API } from "@senryo/config";
import { z } from "zod";
import { decimalToUnits, fetchJson, UpstreamError } from "../upstream.ts";
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
const uint = z.string().regex(/^\d+$/);

const quoteSchema = z.object({
  checks: z.object({ allowance: z.object({ spender: z.string() }).nullish() }).nullish(),
  expectedOutputAmount: uint,
  minOutputAmount: uint,
  expectedFillTime: z.number().nullish(),
  quoteExpiryTimestamp: z.number().nullish(),
  outputToken: z.object({ symbol: z.string(), decimals: z.number().int() }),
  fees: z
    .object({
      total: z
        .object({
          amount: uint,
          amountUsd: z.string().nullish(),
          token: z.object({ symbol: z.string(), decimals: z.number().int(), chainId: z.number() }),
        })
        .nullish(),
    })
    .nullish(),
  swapTx: z.object({ chainId: z.number(), to: z.string(), data: z.string(), value: uint.nullish() }),
});

export async function acrossQuote(ctx: QuoteContext): Promise<ProviderQuote> {
  const params = new URLSearchParams({
    tradeType: "exactInput",
    amount: ctx.amount.toString(),
    inputToken: ctx.from.token.address,
    outputToken: ctx.to.token.address,
    originChainId: String(ctx.from.chainId),
    destinationChainId: String(ctx.to.chainId),
    depositor: ctx.sender,
    recipient: ctx.recipient,
  });
  const res = await fetchJson("across", `${ACROSS_API}/swap/approval?${params}`);
  const q = quoteSchema.parse(res?.json);
  if (q.swapTx.chainId !== ctx.from.chainId) throw new UpstreamError("across", null, "deposit is on another chain");
  const spender = q.checks?.allowance?.spender;
  const steps: ProviderQuote["steps"] = [];
  if (!isEvmNative(ctx.from.token.address)) {
    if (!spender) throw new UpstreamError("across", null, "no allowance target for an ERC-20 input");
    steps.push(approveStep(ctx.from.chainId, ctx.from.token.address, spender, ctx.amount));
  }
  steps.push(callStep(ctx.from.chainId, q.swapTx.to, q.swapTx.data, BigInt(q.swapTx.value ?? "0"), "acrossDeposit"));
  const total = q.fees?.total;
  return {
    provider: "across",
    amountOut: BigInt(q.expectedOutputAmount),
    minReceived: BigInt(q.minOutputAmount),
    out: { symbol: q.outputToken.symbol, decimals: q.outputToken.decimals },
    fees: total
      ? [
          fee(
            "bridge",
            BigInt(total.amount),
            total.token,
            true,
            decimalToUnits(total.amountUsd ?? undefined, USD6) ?? null,
          ),
        ]
      : [],
    etaSec: q.expectedFillTime ?? 0,
    steps,
    trackingId: null,
    expiresAt: q.quoteExpiryTimestamp ?? null,
  };
}

const statusSchema = z.object({
  status: z.string(),
  depositTxHash: z.string().nullish(),
  depositTxnRef: z.string().nullish(),
  fillTx: z.string().nullish(),
  fillTxnRef: z.string().nullish(),
});

const STATE: Record<string, StatusResult["state"]> = {
  filled: "delivered",
  pending: "pending",
  slowfillrequested: "pending",
  refunded: "refunded",
  expired: "failed",
};

export async function acrossStatus(input: StatusInput): Promise<StatusResult> {
  const params = new URLSearchParams({ originChainId: String(input.fromChain), depositTxnRef: input.id });
  const res = await fetchJson("across", `${ACROSS_API}/deposit/status?${params}`, { notFoundAsNull: true });
  if (!res) {
    return {
      state: "unknown",
      providerStatus: "not_found",
      sourceTxHash: input.id,
      destinationTxHash: null,
      detail: null,
    };
  }
  const s = statusSchema.parse(res.json);
  return {
    state: STATE[s.status.toLowerCase()] ?? "pending",
    providerStatus: s.status,
    sourceTxHash: s.depositTxnRef ?? s.depositTxHash ?? input.id,
    destinationTxHash: s.fillTxnRef ?? s.fillTx ?? null,
    detail:
      s.status.toLowerCase() === "expired" ? "the deposit expired unfilled; Across refunds it on the source" : null,
  };
}

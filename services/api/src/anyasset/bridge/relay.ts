/**
 * Relay (relay.link): `POST /quote` with EXACT_INPUT returns ordered steps — an ERC-20 `approve` (exact, to the
 * depository or Relay's router) and the `deposit` — plus the request id it tracks by, the output amount and its
 * minimum, fees and a time estimate. Live on 2 Oct: 10 USDC Monad → Base delivered 9.968 in ~2 s for $0.03.
 * Status: `GET /intents/status/v2?requestId=` (unknown id → `{"status":"unknown"}`).
 */
import { RELAY_API } from "@senryo/config";
import { z } from "zod";
import { decimalToUnits, fetchJson, nowSec, UpstreamError } from "../upstream.ts";
import {
  approveStep,
  callStep,
  decodeApprove,
  fee,
  type ProviderQuote,
  type QuoteContext,
  type StatusInput,
  type StatusResult,
} from "./types.ts";

const USD6 = 6;
/** Relay quotes are meant to be executed promptly; refresh before review after this. */
const QUOTE_TTL_SEC = 60;

const currencySchema = z.object({ chainId: z.number(), symbol: z.string(), decimals: z.number().int() });
const amountSchema = z.object({
  currency: currencySchema,
  amount: z.string().regex(/^\d+$/),
  amountUsd: z.string().nullish(),
  minimumAmount: z.string().regex(/^\d+$/).nullish(),
});
const quoteSchema = z.object({
  requestId: z.string().nullish(),
  steps: z.array(
    z.object({
      id: z.string(),
      kind: z.string(),
      requestId: z.string().nullish(),
      items: z.array(
        z.object({
          data: z
            .object({ to: z.string(), data: z.string(), value: z.string().nullish(), chainId: z.number() })
            .passthrough(),
        }),
      ),
    }),
  ),
  fees: z.object({ relayer: amountSchema.nullish(), app: amountSchema.nullish() }).passthrough(),
  details: z.object({ currencyOut: amountSchema, timeEstimate: z.number().nullish() }).passthrough(),
});

export async function relayQuote(ctx: QuoteContext): Promise<ProviderQuote> {
  const res = await fetchJson("relay", `${RELAY_API}/quote`, {
    method: "POST",
    body: {
      user: ctx.sender,
      recipient: ctx.recipient,
      originChainId: ctx.from.chainId,
      destinationChainId: ctx.to.chainId,
      originCurrency: ctx.from.token.address,
      destinationCurrency: ctx.to.token.address,
      amount: ctx.amount.toString(),
      tradeType: "EXACT_INPUT",
    },
  });
  const q = quoteSchema.parse(res?.json);
  const steps: ProviderQuote["steps"] = [];
  for (const step of q.steps) {
    if (step.kind !== "transaction") throw new UpstreamError("relay", null, `unsupported step kind ${step.kind}`);
    for (const { data } of step.items) {
      const approval = step.id === "approve" ? decodeApprove(data.data) : null;
      if (approval) {
        // Re-built as an exact approval of what this quote moves (never the provider's raw calldata).
        steps.push(approveStep(data.chainId, data.to, approval.spender, ctx.amount));
      } else {
        steps.push(callStep(data.chainId, data.to, data.data, BigInt(data.value ?? "0"), "relayDeposit"));
      }
    }
  }
  const out = q.details.currencyOut;
  const fees = [q.fees.relayer, q.fees.app].flatMap((f, i) =>
    f && BigInt(f.amount) > 0n
      ? [
          fee(
            i === 0 ? "relayer" : "protocol",
            BigInt(f.amount),
            f.currency,
            true,
            decimalToUnits(f.amountUsd ?? undefined, USD6) ?? null,
          ),
        ]
      : [],
  );
  return {
    provider: "relay",
    amountOut: BigInt(out.amount),
    minReceived: BigInt(out.minimumAmount ?? out.amount),
    out: { symbol: out.currency.symbol, decimals: out.currency.decimals },
    fees,
    etaSec: q.details.timeEstimate ?? 0,
    steps,
    trackingId: q.requestId ?? q.steps.find((s) => s.requestId)?.requestId ?? null,
    expiresAt: nowSec() + QUOTE_TTL_SEC,
  };
}

const statusSchema = z.object({
  status: z.string(),
  inTxHashes: z.array(z.string()).nullish(),
  txHashes: z.array(z.string()).nullish(),
  details: z.string().nullish(),
});

const STATE: Record<string, StatusResult["state"]> = {
  success: "delivered",
  refund: "refunded",
  refunded: "refunded",
  failure: "failed",
  waiting: "pending",
  pending: "pending",
  submitted: "pending",
  delayed: "pending",
  unknown: "unknown",
};

export async function relayStatus(input: StatusInput): Promise<StatusResult> {
  const res = await fetchJson("relay", `${RELAY_API}/intents/status/v2?requestId=${encodeURIComponent(input.id)}`);
  const s = statusSchema.parse(res?.json);
  return {
    state: STATE[s.status] ?? "pending",
    providerStatus: s.status,
    sourceTxHash: s.inTxHashes?.[0] ?? null,
    destinationTxHash: s.txHashes?.[0] ?? null,
    detail: s.details ?? null,
  };
}

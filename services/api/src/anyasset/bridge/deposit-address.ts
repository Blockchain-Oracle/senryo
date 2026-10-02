/**
 * Relay deposit addresses (B4 without a wallet on the other chain; docs.relay.link/features/deposit-addresses, live
 * 2 Oct 2026). `POST /quote/v2` with `useDepositAddress: true` answers a one-step quote whose `depositAddress` is an
 * address on the ORIGIN chain: any plain transfer of the source asset to it is filled to `recipient` on Monad.
 *  - Open mode (no `strict`): the address takes later and different-sized deposits of the same route too — each is
 *    re-quoted and filled under its own request id — so it is tracked by the address, not the quote-time request.
 *  - `refundTo` = the origin's native placeholder → an unfillable deposit (below the minimum, a mismatch) is refunded
 *    to the address it came from (flow book B4); `recoveryAddress` = the user's own address, the same key on every
 *    EVM chain, for a refund Relay can't send back to the depositor.
 *  - EVM origins need no key. A Solana / Bitcoin origin answers "missing an api key" without `RELAY_API_KEY`.
 *  - Before anything is returned, the order Relay describes must pay exactly our recipient, in the route's Monad token,
 *    on the Monad chain — a quote that says otherwise is refused, never shown.
 * Tracking: `GET /requests/v3?depositAddress=` with a key (the canonical read), else `/requests/v2` (keyless,
 * deprecated, retired 24 Nov 2026).
 */
import { MAINNET_CHAIN_ID, RELAY_API } from "@senryo/config";
import { z } from "zod";
import { decimalToUnits, fetchJson, nowSec, UpstreamError } from "../upstream.ts";
import { EVM_NATIVE, fee, type QuoteContext, type StatusResult } from "./types.ts";

const USD6 = 6;
/** The shown rate is re-quoted after this; the open address keeps accepting deposits. */
export const DEPOSIT_QUOTE_TTL_SEC = 60;
const REQUESTS_LIMIT = 20;
const ERC20_TRANSFER = "0xa9059cbb";

const currencySchema = z.object({
  chainId: z.number(),
  address: z.string(),
  symbol: z.string(),
  decimals: z.number().int(),
});
const amountSchema = z.object({
  currency: currencySchema,
  amount: z.string().regex(/^\d+$/),
  amountUsd: z.string().nullish(),
  minimumAmount: z.string().regex(/^\d+$/).nullish(),
});
const paymentSchema = z.object({ recipient: z.string(), currency: z.string(), minimumAmount: z.string().nullish() });
const quoteSchema = z.object({
  requestId: z.string().nullish(),
  steps: z
    .array(
      z.object({
        id: z.string(),
        kind: z.string(),
        requestId: z.string().nullish(),
        depositAddress: z.string().nullish(),
        items: z.array(z.object({ data: z.object({ to: z.string(), data: z.string(), chainId: z.number() }) })),
      }),
    )
    .min(1),
  fees: z.object({ relayer: amountSchema.nullish(), app: amountSchema.nullish() }).passthrough(),
  details: z.object({ recipient: z.string(), currencyOut: amountSchema, timeEstimate: z.number().nullish() }),
  protocol: z
    .object({
      v2: z
        .object({
          orderData: z.object({
            output: z.object({ chainId: z.string(), payments: z.array(paymentSchema), deadline: z.number().nullish() }),
          }),
        })
        .nullish(),
    })
    .nullish(),
});

export interface DepositQuote {
  depositAddress: string;
  amountOut: bigint;
  minReceived: bigint;
  out: { symbol: string; decimals: number };
  fees: ReturnType<typeof fee>[];
  etaSec: number;
  requestId: string | null;
  quoteExpiresAt: number;
  addressExpiresAt: number | null;
}

/** Relay's own name for Monad mainnet in order data. */
const RELAY_MONAD = "monad";

/** Why Relay's order can't be shown as a deposit into `recipient`'s wallet, or null when it pays exactly that. */
export function depositRefusal(
  q: z.output<typeof quoteSchema>,
  recipient: string,
  monadToken: string,
  origin: { chainId: number; token: string },
): string | null {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const step = q.steps[0];
  const address = step?.depositAddress;
  if (!step || !address) return "no deposit address in the quote";
  if (!same(q.details.recipient, recipient)) return "the quote pays another recipient";
  const out = q.details.currencyOut.currency;
  if (out.chainId !== MAINNET_CHAIN_ID || !same(out.address, monadToken)) return "the quote pays another asset";
  const order = q.protocol?.v2?.orderData.output;
  if (order) {
    if (order.chainId !== RELAY_MONAD) return "the order pays another chain";
    if (!order.payments.every((p) => same(p.recipient, recipient) && same(p.currency, monadToken)))
      return "the order pays someone else";
  }
  // The step Relay suggests is a plain transfer of the source asset to the address on the origin chain.
  const item = step.items[0]?.data;
  if (!item || item.chainId !== origin.chainId) return "the deposit step is on another chain";
  const native = same(origin.token, EVM_NATIVE);
  const pays = native
    ? same(item.to, address)
    : same(item.to, origin.token) &&
      item.data.toLowerCase().startsWith(ERC20_TRANSFER) &&
      item.data.toLowerCase().includes(address.slice(2).toLowerCase());
  return pays ? null : "the deposit step doesn't pay the deposit address";
}

export async function relayDepositAddress(
  ctx: QuoteContext,
  recipient: string,
  apiKey: string | undefined,
): Promise<DepositQuote> {
  const res = await fetchJson("relay", `${RELAY_API}/quote/v2`, {
    method: "POST",
    ...(apiKey ? { headers: { "x-api-key": apiKey } } : {}),
    body: {
      user: EVM_NATIVE,
      recipient,
      originChainId: ctx.from.chainId,
      destinationChainId: ctx.to.chainId,
      originCurrency: ctx.from.token.address,
      destinationCurrency: ctx.to.token.address,
      amount: ctx.amount.toString(),
      tradeType: "EXACT_INPUT",
      useDepositAddress: true,
      refundTo: EVM_NATIVE,
      recoveryAddress: recipient,
    },
  });
  const q = quoteSchema.parse(res?.json);
  const why = depositRefusal(q, recipient, ctx.to.token.address, {
    chainId: ctx.from.chainId,
    token: ctx.from.token.address,
  });
  if (why) throw new UpstreamError("relay", null, why);
  const step = q.steps[0];
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
    depositAddress: step?.depositAddress as string,
    amountOut: BigInt(out.amount),
    minReceived: BigInt(out.minimumAmount ?? out.amount),
    out: { symbol: out.currency.symbol, decimals: out.currency.decimals },
    fees,
    etaSec: q.details.timeEstimate ?? 0,
    requestId: q.requestId ?? step?.requestId ?? null,
    quoteExpiresAt: nowSec() + DEPOSIT_QUOTE_TTL_SEC,
    addressExpiresAt: q.protocol?.v2?.orderData.output.deadline ?? null,
  };
}

const txSchema = z.object({ hash: z.string().nullish(), chainId: z.number().nullish() });
const requestsSchema = z.object({
  requests: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      updatedAt: z.string().nullish(),
      data: z
        .object({
          failReason: z.string().nullish(),
          refundFailReason: z.string().nullish(),
          inTxs: z.array(txSchema).nullish(),
          outTxs: z.array(txSchema).nullish(),
          metadata: z
            .object({
              currencyIn: z.object({ amount: z.string().regex(/^\d+$/).nullish() }).nullish(),
              currencyOut: z.object({ amount: z.string().regex(/^\d+$/).nullish() }).nullish(),
            })
            .nullish(),
        })
        .nullish(),
    }),
  ),
});

const STATE: Record<string, StatusResult["state"]> = {
  success: "delivered",
  refund: "refunded",
  refunded: "refunded",
  failure: "failed",
  waiting: "pending",
  pending: "pending",
  depositing: "pending",
  submitted: "pending",
  delayed: "pending",
};
const NOT_APPLICABLE = "N/A";

export interface DepositRow {
  requestId: string;
  state: StatusResult["state"];
  providerStatus: string;
  amountIn: bigint | null;
  amountOut: bigint | null;
  sourceTxHash: string | null;
  destinationTxHash: string | null;
  detail: string | null;
  updatedAt: string | null;
}

/** Every request Relay has opened for deposits to `address`, newest first. */
export async function relayDeposits(address: string, apiKey: string | undefined): Promise<DepositRow[]> {
  const version = apiKey ? "v3" : "v2";
  const url = `${RELAY_API}/requests/${version}?depositAddress=${encodeURIComponent(address)}&sortBy=updatedAt&sortDirection=desc&limit=${REQUESTS_LIMIT}`;
  const res = await fetchJson("relay", url, apiKey ? { headers: { "x-api-key": apiKey } } : {});
  const { requests } = requestsSchema.parse(res?.json);
  return requests.map((r) => {
    const reason = [r.data?.failReason, r.data?.refundFailReason].find((x) => x && x !== NOT_APPLICABLE);
    const amount = (s: string | null | undefined) => (s ? BigInt(s) : null);
    return {
      requestId: r.id,
      state: STATE[r.status] ?? "pending",
      providerStatus: r.status,
      amountIn: amount(r.data?.metadata?.currencyIn?.amount),
      amountOut: amount(r.data?.metadata?.currencyOut?.amount),
      sourceTxHash: r.data?.inTxs?.[0]?.hash ?? null,
      destinationTxHash: r.data?.outTxs?.[0]?.hash ?? null,
      detail: reason ?? null,
      updatedAt: r.updatedAt ?? null,
    };
  });
}

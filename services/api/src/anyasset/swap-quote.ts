/**
 * `/v1/swap/quote` (B6, D6): Monorail and KyberSwap in parallel; a candidate is dropped (kept as an alternative with
 * its reason) when its `to` isn't that provider's pinned router or its MON value doesn't match the input. The best
 * minimum output wins. Impact is judged by `judgedImpact` from `@senryo/core`: the reference figure (XAU feed for
 * XAUt0, the market price otherwise) when both sides have a reference, else the provider's own.
 */
import type { SwapAlternative, SwapQuoteResponse } from "@senryo/api-client";
import { type Address, getAddress, type ReadClient, readTokenMetadata } from "@senryo/chain";
import {
  aggregatorSwapGasLimit,
  type ChainId,
  isPinnedSwapRouter,
  NATIVE_TOKEN,
  networkOf,
  type SwapProvider,
  swapsSupported,
} from "@senryo/config";
import { impactBpsOf, judgedImpact } from "@senryo/core";
import { HTTP_STATUS, HttpError, type Logger } from "@senryo/service-common";
import { type Candidate, kyberQuote, monorailQuote, NoRouteError, type QuoteRequest } from "./aggregators.ts";
import { METADATA_TTL_MS, SWAP_QUOTE_TTL_SEC } from "./constants.ts";
import type { ReferencePrices } from "./reference.ts";
import type { TokenListService } from "./token-list.ts";
import { errorText, nowSec, settleAll, TtlCache } from "./upstream.ts";

const TEN = 10n;
const TOKEN_CACHE_MAX = 5_000;

export interface SwapQuoteDeps {
  log: Logger;
  read: (chainId: ChainId) => ReadClient;
  tokenList: TokenListService;
  reference: ReferencePrices;
}

export interface SwapQuoteInput {
  chainId: ChainId;
  from: Address;
  to: Address;
  amount: bigint;
  sender: Address;
  slippageBps: number;
}

interface TokenRef {
  address: Address;
  symbol: string;
  decimals: number;
}

const PROVIDERS: ReadonlyArray<readonly [SwapProvider, (req: QuoteRequest) => Promise<Candidate>]> = [
  ["monorail", monorailQuote],
  ["kyberswap", kyberQuote],
];

/** Why a candidate can't be sent, or null when it can. */
function refusal(c: Candidate, input: SwapQuoteInput): string | null {
  if (!isPinnedSwapRouter(c.router, c.provider)) return `router ${c.router} is not pinned`;
  const nativeIn = input.from.toLowerCase() === NATIVE_TOKEN;
  if (c.value !== (nativeIn ? input.amount : 0n)) return "call value does not match the input";
  if (c.minOut <= 0n || c.minOut > c.amountOut) return "minimum output is not positive";
  return null;
}

/** Value of `amount` raw units at `priceUsd18` per whole token, in USD × 1e18. */
const valueUsd18 = (amount: bigint, decimals: number, priceUsd18: bigint) =>
  (amount * priceUsd18) / TEN ** BigInt(decimals);

export class SwapQuoteService {
  private readonly tokens = new TtlCache<TokenRef | null>(TOKEN_CACHE_MAX);

  constructor(private readonly deps: SwapQuoteDeps) {}

  async quote(input: SwapQuoteInput): Promise<SwapQuoteResponse> {
    const at = new Date().toISOString();
    const { chainId } = input;
    if (!swapsSupported(chainId)) {
      return { status: "unsupported", chainId, at, reason: "Swaps are Mainnet only (no aggregator serves Practice)" };
    }
    if (input.from.toLowerCase() === input.to.toLowerCase()) {
      throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "from and to are the same token");
    }
    if (input.amount <= 0n) throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", "amount must be positive");
    const [from, to] = await Promise.all([this.token(chainId, input.from), this.token(chainId, input.to)]);
    const request: QuoteRequest = { ...input, amountIn: input.amount, decimalsIn: from.decimals };
    const settled = await settleAll(PROVIDERS.map(([name, run]) => [name, () => run(request)] as const));
    const alternatives: SwapAlternative[] = [];
    const usable: Candidate[] = [];
    for (const result of settled) {
      if (!result.ok) {
        const reason = result.error instanceof NoRouteError ? result.error.message : errorText(result.error);
        if (!(result.error instanceof NoRouteError)) this.deps.log.warn({ err: reason }, "swap quote failed");
        alternatives.push({ provider: result.key, amountOut: null, minOut: null, error: reason });
        continue;
      }
      const why = refusal(result.value, input);
      if (why) {
        this.deps.log.error({ provider: result.key, router: result.value.router, why }, "swap quote refused");
        alternatives.push({ provider: result.key, amountOut: result.value.amountOut, minOut: null, error: why });
      } else usable.push(result.value);
    }
    usable.sort((a, b) => (a.minOut === b.minOut ? 0 : a.minOut > b.minOut ? -1 : 1));
    const [best, ...rest] = usable;
    for (const c of rest)
      alternatives.push({ provider: c.provider, amountOut: c.amountOut, minOut: c.minOut, error: null });
    if (!best) return { status: "no_route", chainId, at, reason: "No route for this pair", alternatives };

    const refs = await this.deps.reference.of([from.address, to.address]);
    const refIn = refs.get(from.address.toLowerCase());
    const refOut = refs.get(to.address.toLowerCase());
    let referenceImpact: bigint | null = null;
    if (refIn && refOut) {
      const valueIn = valueUsd18(input.amount, from.decimals, refIn.priceUsd18);
      const valueOut = valueUsd18(best.amountOut, to.decimals, refOut.priceUsd18);
      referenceImpact = valueIn > 0n ? impactBpsOf(valueIn, valueOut) : null;
    }
    const judged = judgedImpact(referenceImpact, best.providerImpactBps);
    return {
      status: "ok",
      chainId,
      at,
      from,
      to,
      amountIn: input.amount,
      slippageBps: input.slippageBps,
      quote: {
        provider: best.provider,
        router: best.router,
        data: best.data,
        value: best.value,
        amountOut: best.amountOut,
        minOut: best.minOut,
        gasEstimate: best.gasEstimate,
        gasLimit: aggregatorSwapGasLimit(best.gasEstimate ?? undefined),
        providerImpactBps: toInt(best.providerImpactBps),
        referenceImpactBps: toInt(referenceImpact),
        impactBps: toInt(judged.bps),
        impactSource: judged.source,
        impact: judged.level,
        route: best.route,
        quoteId: best.quoteId,
        expiresAt: nowSec() + SWAP_QUOTE_TTL_SEC,
      },
      alternatives,
      reference: {
        priceInUsd18: refIn?.priceUsd18 ?? null,
        priceOutUsd18: refOut?.priceUsd18 ?? null,
        sourceIn: refIn?.source ?? null,
        sourceOut: refOut?.source ?? null,
      },
    };
  }

  /** Symbol and decimals: native MON, the token list, else the token itself (cached); unreadable → 400. */
  private async token(chainId: ChainId, address: Address): Promise<TokenRef> {
    if (address.toLowerCase() === NATIVE_TOKEN) {
      const { symbol, decimals } = networkOf(chainId).nativeCurrency;
      return { address: NATIVE_TOKEN, symbol, decimals };
    }
    const listed = (await this.deps.tokenList.get(chainId)).byAddress.get(address.toLowerCase());
    if (listed) return { address: listed.address, symbol: listed.symbol, decimals: listed.decimals };
    const ref = await this.tokens.load(`${chainId}:${address.toLowerCase()}`, METADATA_TTL_MS, async () => {
      const [meta] = await readTokenMetadata(this.deps.read(chainId), [address]);
      return meta ? { address: getAddress(address), symbol: meta.symbol, decimals: meta.decimals } : null;
    });
    if (!ref) throw new HttpError(HTTP_STATUS.badRequest, "BAD_REQUEST", `${address} is not a readable ERC-20`);
    return ref;
  }
}

/** bps as a JSON int (the wire schema); impacts are far inside the safe-integer range. */
const toInt = (bps: bigint | null): number | null => (bps === null ? null : Number(bps));

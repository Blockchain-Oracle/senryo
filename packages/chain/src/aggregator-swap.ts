/**
 * Any↔any swap sends (D6, plan §0.8 B6): `[approve(router, exactAmountIn)?, call(router, data, value)]` from the
 * user's own account, for a Monorail or KyberSwap quote served by `/v1/swap/quote`. The router must be one of the two
 * pinned in `@senryo/config` (`MAINNET_EXTERNAL.aggregators`) — calldata aimed anywhere else is refused here, before
 * anything is signed. The approval is exact (never unlimited) and skipped when the allowance on file already covers
 * the input.
 *
 * Monad reserve rule (context/02-monad/differences-from-ethereum.md §2): an EIP-7702-delegated account whose MON
 * value send leaves it below 10 MON can revert while still paying gas, so a native-MON input keeps `reserveWei`
 * (default `SENDER_RESERVE_MON`) plus the swap's own gas cost on the account.
 */
import {
  aggregatorSwapGasLimit,
  isPinnedSwapRouter,
  NATIVE_TOKEN,
  SENDER_RESERVE_MON,
  type SwapProvider,
} from "@senryo/config";
import { ONE_E18 } from "@senryo/core";
import { type Address, erc20Abi, type Hex } from "viem";
import { externalCall } from "./calls.ts";
import type { ReadClient } from "./clients.ts";
import type { TxRequest } from "./send.ts";
import { readAllowances } from "./token-reads.ts";

/** The default MON an account keeps after a native-MON swap (wei). */
export const AGGREGATOR_MON_RESERVE_WEI = SENDER_RESERVE_MON * ONE_E18;

/** What the send list needs from a quote (`/v1/swap/quote` `quote`). */
export interface AggregatorSwapQuote {
  provider: SwapProvider;
  /** The aggregator's `to`; must be the pinned router of `provider`. */
  router: Address;
  data: Hex;
  value: bigint;
  /** `address(0)` for native MON. */
  tokenIn: Address;
  amountIn: bigint;
  /** The aggregator's own gas metering, sizing the call's budget. */
  gasEstimate?: bigint | null | undefined;
}

export class UnpinnedTargetError extends Error {
  constructor(
    readonly to: string,
    readonly kind: string,
  ) {
    super(`${kind}: ${to} is not a pinned contract — refusing to build the send`);
    this.name = "UnpinnedTargetError";
  }
}

export class MonReserveError extends Error {
  constructor(
    /** The most MON this send may spend while keeping the reserve and its gas (wei; 0 when none). */
    readonly maxSpendWei: bigint,
    readonly reserveWei: bigint,
  ) {
    super(`a native-MON send must leave ${reserveWei} wei on the account; at most ${maxSpendWei} wei can go`);
    this.name = "MonReserveError";
  }
}

const isNativeIn = (quote: Pick<AggregatorSwapQuote, "tokenIn">) =>
  quote.tokenIn.toLowerCase() === NATIVE_TOKEN.toLowerCase();

/** Checks the quote's shape before any send exists: pinned router, and value only for a native input. */
export function assertAggregatorQuote(quote: AggregatorSwapQuote): void {
  if (!isPinnedSwapRouter(quote.router, quote.provider)) throw new UnpinnedTargetError(quote.router, quote.provider);
  const expectedValue = isNativeIn(quote) ? quote.amountIn : 0n;
  if (quote.value !== expectedValue) {
    throw new Error(
      `${quote.provider}: call value ${quote.value} does not match the input (${expectedValue} expected)`,
    );
  }
  if (quote.amountIn <= 0n) throw new Error("aggregator swap: the input amount must be positive");
}

/** MON spendable as a value send: balance less the reserve and the sends' gas cost (limit × max fee). */
export function spendableNative(balanceWei: bigint, gasCostWei: bigint, reserveWei = AGGREGATOR_MON_RESERVE_WEI) {
  const spendable = balanceWei - reserveWei - gasCostWei;
  return spendable > 0n ? spendable : 0n;
}

export interface AggregatorSwapParams {
  quote: AggregatorSwapQuote;
  /** ERC-20 allowance owner → router on file; omitted → the approval is sent. */
  allowance?: bigint | undefined;
}

/** The ordered sends for one quoted swap: [approve?, call]. Send them in order and stop at the first failure. */
export function buildAggregatorSwap({ quote, allowance }: AggregatorSwapParams): TxRequest[] {
  assertAggregatorQuote(quote);
  const meta = { kind: "aggregatorSwap", provider: quote.provider, tokenIn: quote.tokenIn };
  const requests: TxRequest[] = [];
  if (!isNativeIn(quote) && (allowance === undefined || allowance < quote.amountIn)) {
    requests.push(
      externalCall(quote.tokenIn, erc20Abi, "approve", [quote.router, quote.amountIn], "approve", {
        meta: { ...meta, step: "approve" },
      }),
    );
  }
  requests.push({
    to: quote.router,
    data: quote.data,
    value: quote.value,
    action: "aggregatorSwap",
    gasCap: aggregatorSwapGasLimit(quote.gasEstimate ?? undefined),
    meta: { ...meta, step: "swap" },
  });
  return requests;
}

export interface PrepareAggregatorSwapOptions {
  /** MON kept on the account after a native-MON input (default 10 MON). */
  reserveWei?: bigint | undefined;
  /** The sends' gas cost (Σ limit × max fee) the balance must also cover; default 0. */
  gasCostWei?: bigint | undefined;
}

/**
 * Reads what the chain says now — the router allowance for an ERC-20 input, the MON balance for a native one — and
 * builds the sends; a native input that would break the reserve throws `MonReserveError` with the most it may spend.
 */
export async function prepareAggregatorSwap(
  read: ReadClient,
  owner: Address,
  quote: AggregatorSwapQuote,
  options: PrepareAggregatorSwapOptions = {},
): Promise<TxRequest[]> {
  assertAggregatorQuote(quote);
  if (isNativeIn(quote)) {
    const reserveWei = options.reserveWei ?? AGGREGATOR_MON_RESERVE_WEI;
    const balance = await read.getBalance({ address: owner, blockTag: "latest" });
    const max = spendableNative(balance, options.gasCostWei ?? 0n, reserveWei);
    if (quote.amountIn > max) throw new MonReserveError(max, reserveWei);
    return buildAggregatorSwap({ quote });
  }
  const [allowance] = await readAllowances(read, owner, [{ token: quote.tokenIn, spender: quote.router }]);
  return buildAggregatorSwap({ quote, allowance });
}

/**
 * "Pay with" any asset for a dollar act (flow book C3 step 4, D1 step 2; plan §0.5 rule 4, §0.7 decisions 4–5): the
 * ticket's margin and the pool's deposit are AUSD (USDC also funds the trading account). Any other verified holding
 * pays through a swap to AUSD composed into the same operation — sized so its MINIMUM covers what the act needs, the
 * impact rule applied (warn > 1 %, block > 5 %), re-quoted right before it is signed (`@senryo/query` swapLeg).
 * Practice has no aggregator on the test network: dollars only, and the picker says so in ≤ 4 words — test USDC pays
 * for the pool through the par swap to test AUSD (D-252), wallet part only.
 * Unverified tokens never fund an act (BD-7). Shared by the phone and the web.
 */
import type { SwapQuoteOk } from "@senryo/api-client";
import { isPracticeSwapPair, PRACTICE_SWAP_ROUTE } from "@senryo/chain";
import { isChainId, MAINNET_CHAIN_ID } from "@senryo/config";
import { RISK } from "@senryo/core";
import { useEffect, useState } from "react";
import { useSwapQuote } from "./anyasset.ts";
import { swapLeg } from "./compose.ts";
import type { QueryEnv } from "./env.tsx";
import { type MoneyAsset, spendableOf, unitsOfValue, valueOfUnits } from "./money-assets.ts";
import { practiceSwapLeg } from "./practice-swap.ts";
import { collateralTokenOf } from "./withdraw.ts";

/** The input is sized this much above the need, so the quote's minimum (slippage, impact) still covers it. */
const SIZE_BUFFER_BPS = 300n;
const QUOTE_DEBOUNCE_MS = 350;

export type PayAct = "trade" | "pool";
/** What Practice can pay with, in ≤ 4 words (no aggregator on the test network): the chip's note and a row's reason. */
export function practiceNote(): string {
  return "Practice: dollars only";
}

/** Practice (D-252): test USDC brings test AUSD through the par swap — the only swap a Practice act composes. */
export function paysAtPar(asset: MoneyAsset, chainId: number): boolean {
  return (
    isChainId(chainId) &&
    asset.collateral === "USDC" &&
    isPracticeSwapPair(chainId, asset.address, collateralTokenOf(chainId, "AUSD"))
  );
}

/** Does `asset` pay for this act directly (dollars the act takes as they are) or through a swap to AUSD? */
export function paysDirectly(asset: MoneyAsset, act: PayAct): boolean {
  return asset.collateral === "AUSD" || (act === "trade" && asset.collateral === "USDC");
}

/** Why `asset` can't pay for this act here (≤ 4 words), or undefined when it can. */
export function payWithReason(asset: MoneyAsset, act: PayAct, chainId: number): string | undefined {
  if (!asset.verified) return "Unverified · can't fund";
  if (paysDirectly(asset, act)) return asset.wallet + asset.tradingFree > 0n ? undefined : "None to use";
  if (paysAtPar(asset, chainId)) return asset.wallet > 0n ? undefined : "None to use";
  if (chainId !== MAINNET_CHAIN_ID) return practiceNote();
  if (asset.priceUsd18 === null) return "No price";
  return spendableOf(asset) > 0n ? undefined : asset.native ? "Keeps 10 MON for fees" : "None to use";
}

/** usd6 the asset can bring through a swap (its spendable value, less the sizing buffer; at par, its wallet part). */
export function swappableUsd6(asset: MoneyAsset, chainId?: number): bigint {
  if (chainId !== undefined && paysAtPar(asset, chainId)) return asset.wallet;
  if (asset.priceUsd18 === null) return 0n;
  const value = valueOfUnits(spendableOf(asset), asset.decimals, asset.priceUsd18);
  return (value * RISK.BPS) / (RISK.BPS + SIZE_BUFFER_BPS);
}

export type PaySwap =
  | { status: "none" }
  | { status: "quoting" }
  | { status: "ok"; quote: SwapQuoteOk; amountIn: bigint }
  /** Practice par swap (D-252): exactly the need in, the same out — nothing to quote. */
  | { status: "par"; amountIn: bigint }
  | { status: "blocked"; reason: string };

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

/**
 * The swap `asset` → AUSD that brings at least `needUsd6` (AUSD units): the input sized from the asset's price plus a
 * buffer, quoted live; "blocked" names why it can't (too big for its balance, no route, impact over 5 %, price moved).
 */
export function usePaySwap(
  chainId: number,
  asset: MoneyAsset | undefined,
  needUsd6: bigint,
  owner: `0x${string}` | undefined,
): PaySwap {
  const need = useDebounced(needUsd6, QUOTE_DEBOUNCE_MS);
  const swapping = asset !== undefined && asset.priceUsd18 !== null && needUsd6 > 0n && chainId === MAINNET_CHAIN_ID;
  const amountIn =
    swapping && asset.priceUsd18 !== null
      ? unitsOfValue((need * (RISK.BPS + SIZE_BUFFER_BPS)) / RISK.BPS, asset.decimals, asset.priceUsd18)
      : 0n;
  const fits = swapping && amountIn <= spendableOf(asset);
  const quote = useSwapQuote(
    swapping && fits && owner && amountIn > 0n
      ? { from: asset.address, to: collateralTokenOf(MAINNET_CHAIN_ID, "AUSD"), amount: amountIn, sender: owner }
      : undefined,
  );
  if (asset !== undefined && needUsd6 > 0n && paysAtPar(asset, chainId)) {
    return needUsd6 <= asset.wallet
      ? { status: "par", amountIn: needUsd6 }
      : { status: "blocked", reason: `Not enough ${asset.symbol}` };
  }
  if (!swapping) return { status: "none" };
  if (need !== needUsd6) return { status: "quoting" };
  if (!fits) return { status: "blocked", reason: `Not enough ${asset.symbol}` };
  const value = quote.status === "fresh" || quote.status === "stale" ? quote.value : undefined;
  if (quote.status === "failed") return { status: "blocked", reason: "Quote unavailable · try again" };
  if (!value) return { status: "quoting" };
  if (value.status !== "ok") return { status: "blocked", reason: `No route from ${asset.symbol}` };
  if (value.amountIn !== amountIn) return { status: "quoting" };
  if (value.quote.impact === "block") return { status: "blocked", reason: "Too big · price impact over 5%" };
  if (value.quote.minOut < need) return { status: "blocked", reason: "Price moved · try again" };
  return { status: "ok", quote: value, amountIn };
}

/** The swap leg as composed steps ("Approve MON"?, "Swap MON → AUSD"), re-quoted before it signs. */
export function paySwapSteps(env: QueryEnv, owner: `0x${string}`, asset: MoneyAsset, quote: SwapQuoteOk) {
  return swapLeg(
    env,
    owner,
    quote,
    { approve: `Approve ${asset.symbol}`, swap: `Swap ${asset.symbol} → AUSD` },
    "swap",
  );
}

/** The par swap leg ("Approve USDC"?, "Swap USDC → AUSD"): exactly what was reviewed, nothing re-quoted (D-252). */
export function parPaySteps(env: QueryEnv, owner: `0x${string}`, asset: MoneyAsset, amountIn: bigint) {
  return practiceSwapLeg(
    env,
    owner,
    asset.address,
    amountIn,
    { approve: `Approve ${asset.symbol}`, swap: `Swap ${asset.symbol} → AUSD` },
    "swap",
  );
}

/** What the reviewed intent states about the payment: the asset, what it pays and the AUSD minimum it brings. */
export function payIntent(asset: MoneyAsset, swap: PaySwap): Record<string, string> {
  if (swap.status === "par") {
    const paid = swap.amountIn.toString();
    const base = { payWith: asset.symbol, payWithAsset: asset.key, paidDecimals: String(asset.decimals) };
    return { ...base, paid, minReceived: paid, route: PRACTICE_SWAP_ROUTE };
  }
  if (swap.status !== "ok") return { payWith: asset.symbol };
  return {
    payWith: asset.symbol,
    payWithAsset: asset.key,
    paid: swap.amountIn.toString(),
    paidDecimals: String(asset.decimals),
    minReceived: swap.quote.quote.minOut.toString(),
    route: swap.quote.quote.provider,
  };
}

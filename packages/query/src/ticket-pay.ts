/**
 * The ticket's "Pay with" (flow book C3 step 4; plan §0.9 Ticket "Buying power P$x · Pay with AUSD ⌄"): buying power
 * is Free to trade plus what the chosen asset brings. Whatever Free to trade doesn't cover (margin + fee) comes from
 * the chosen asset inside the same operation — wallet AUSD / USDC moved to the trading account ([approve] → deposit),
 * or, on Mainnet once the core is deployed, any other verified holding swapped to AUSD first (its minimum covers the
 * shortfall; impact rule; re-quoted before it signs) — then the open. Practice has no aggregator: dollars only, and the
 * chip says so. A swap leg always asks for the passkey (rule 11), which signs every leg. Shared by the phone and the
 * web: each passes the account's assets as its own `useMoneyAssets` reads them.
 */
import { addressOf, erc20Abi, isDeployed } from "@senryo/chain";
import { type ChainId, MAINNET_CHAIN_ID } from "@senryo/config";
import { useState } from "react";
import { type ComposedStep, moveToTradingSteps } from "./compose.ts";
import type { QueryEnv } from "./env.tsx";
import type { MoneyAsset, MoneyAssetsView } from "./money-assets.ts";
import {
  type PaySwap,
  payIntent,
  paySwapSteps,
  paysDirectly,
  payWithReason,
  practiceNote,
  swappableUsd6,
  usePaySwap,
} from "./pay-with.ts";
import { collateralTokenOf } from "./withdraw.ts";

/**
 * What the order takes from Free to trade, as the core preview counts it: the fee, the margin it locks, the spread its
 * entry costs at once, and the safety buffer — so "Pay with" brings enough for the order to pass the same check the
 * chain makes (margin + fee alone left a wide-spread or 20× order short by the entry's spread).
 */
export function ticketNeedUsd6(
  preview: { freeToTradeAfter: bigint } | undefined,
  freeToTradeUsd6: bigint | undefined,
): bigint {
  if (!preview || freeToTradeUsd6 === undefined) return 0n;
  const need = freeToTradeUsd6 - preview.freeToTradeAfter;
  return need > 0n ? need : 0n;
}

/** The move leg's Details word (`moveToTradingSteps` labels its deposit the same). */
export const MOVE_LABEL = "Move to trading";
/** One cent over the shortfall: the core's own rounding never leaves the open a hair short. */
const CENT_USD6 = 10_000n;

export interface TicketPay {
  /** The chosen asset (default: AUSD — the trading balance, then wallet AUSD). */
  payWith: MoneyAsset | undefined;
  choose: (key: string) => void;
  /** Free to trade + what the chosen asset can bring (usd6), when known. */
  buyingPowerUsd6: bigint | undefined;
  /** AUSD (or USDC) the composed steps add to Free to trade before the open (usd6). */
  incomingUsd6: bigint;
  /** What Free to trade doesn't cover (usd6, 0 when it does). */
  shortfallUsd6: bigint;
  swap: PaySwap;
  /** A swap leg is composed (passkey). */
  swapping: boolean;
  /** Why the chosen asset can't pay for this order right now (one line), when it can't. */
  block: string | undefined;
  /** Practice's ≤ 4 words on the chip. */
  note: string | undefined;
  reasonFor: (asset: MoneyAsset) => string | undefined;
  assets: readonly MoneyAsset[];
  other: readonly MoneyAsset[];
  /** The facts the reviewed intent adds about the payment. */
  intent: Record<string, string>;
  /** The composed steps that come before the open ([swap] → [approve] → deposit), read fresh. */
  steps: (env: QueryEnv, owner: `0x${string}`) => Promise<ComposedStep[]>;
  /** Those steps' Details words, known before the slide (approvals fold into their step; the receipt lists them). */
  labels: string[];
}

export function useTicketPay(
  chainId: ChainId,
  owner: `0x${string}` | undefined,
  freeToTradeUsd6: bigint | undefined,
  needUsd6: bigint,
  money: MoneyAssetsView,
): TicketPay {
  const [payKey, setPayKey] = useState<string>();
  const coreReady = isDeployed(chainId, "SenryoCore");
  const ausd = money.assets.find((a) => a.collateral === "AUSD");
  const payWith = (payKey ? money.find(payKey) : undefined) ?? ausd;
  const shortfall =
    freeToTradeUsd6 !== undefined && needUsd6 > freeToTradeUsd6 ? needUsd6 - freeToTradeUsd6 + CENT_USD6 : 0n;
  const direct = payWith !== undefined && paysDirectly(payWith, "trade");
  const swap = usePaySwap(chainId, payWith && !direct && coreReady ? payWith : undefined, shortfall, owner);
  const swapping = !direct && shortfall > 0n && payWith !== undefined;
  const brings = !payWith ? 0n : direct ? payWith.wallet : swappableUsd6(payWith);
  const incoming =
    shortfall === 0n || !payWith
      ? 0n
      : direct
        ? payWith.wallet >= shortfall
          ? shortfall
          : 0n
        : swap.status === "ok"
          ? swap.quote.quote.minOut
          : 0n;
  const block =
    shortfall === 0n || !payWith
      ? undefined
      : direct
        ? payWith.wallet >= shortfall
          ? undefined
          : `Not enough ${payWith.symbol}`
        : swap.status === "blocked"
          ? swap.reason
          : swap.status === "ok"
            ? undefined
            : "Getting a quote";
  return {
    payWith,
    choose: setPayKey,
    buyingPowerUsd6: freeToTradeUsd6 === undefined ? undefined : freeToTradeUsd6 + brings,
    incomingUsd6: incoming,
    shortfallUsd6: shortfall,
    swap,
    swapping,
    block,
    note: chainId === MAINNET_CHAIN_ID ? undefined : practiceNote(),
    reasonFor: (a) => payWithReason(a, "trade", chainId),
    assets: money.assets,
    other: money.other,
    intent: payWith && shortfall > 0n ? { ...payIntent(payWith, swap), movedUsd6: incoming.toString() } : {},
    labels:
      !payWith || incoming === 0n
        ? []
        : direct
          ? [MOVE_LABEL]
          : swap.status === "ok"
            ? [`Swap ${payWith.symbol} → AUSD`, MOVE_LABEL]
            : [],
    steps: async (env, me) => {
      if (!payWith || shortfall === 0n || incoming === 0n) return [];
      const symbol = direct && payWith.collateral ? payWith.collateral : "AUSD";
      const allowance = await env.read.readContract({
        address: collateralTokenOf(chainId, symbol),
        abi: erc20Abi,
        functionName: "allowance",
        args: [me, addressOf(chainId, "SenryoCore")],
        blockTag: "latest",
      });
      const move = moveToTradingSteps(chainId, symbol, incoming, allowance);
      if (direct || swap.status !== "ok") return move;
      return [...(await paySwapSteps(env, me, payWith, swap.quote)), ...move];
    },
  };
}

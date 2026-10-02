/**
 * The Perpl ticket's words (flow book C4 "States", C3 blocker table): what stops an order, in the order checked, as
 * one slide label and at most one line with one fix; the steps of a composed operation; the outcome nouns.
 */
import type { PerplPosition } from "@senryo/chain";
import type { GasAction } from "@senryo/config";
import { formatUnits } from "@senryo/core";
import type { TraceWords } from "~/features/trade/TradeTrace";
import { monText, perplUsd } from "./format";

/** Millionths read as a percent: 345 ppm → 0.0345 %. */
const PPM_AS_PCT_DECIMALS = 4;

export type PerplBlock =
  | { code: "offline" }
  | { code: "practice" }
  | { code: "region" }
  | { code: "guest" }
  | { code: "halted" }
  | { code: "paused" }
  | { code: "frozen" }
  | { code: "opposite"; held: PerplPosition }
  | { code: "leverage"; maxX: number }
  | { code: "size"; minUsd6: bigint }
  | { code: "wallet-short"; shortCNS: bigint }
  | { code: "fees"; shortWei: bigint };

export type PerplFix = "addMoney" | "maxLeverage" | "closePosition" | "why";

export interface PerplBlockCopy {
  /** On the disabled slide. */
  label: string;
  /** The one line above it, when the label alone doesn't carry the amount. */
  line?: string;
  fix?: PerplFix;
}

export function blockCopy(block: PerplBlock, symbol: string): PerplBlockCopy {
  switch (block.code) {
    case "offline":
      return { label: "You’re offline" };
    case "practice":
      return { label: "Mainnet only", fix: "why" };
    case "region":
      return { label: "Not available in your region" };
    case "guest":
      return { label: "Create an account to trade" };
    case "halted":
      return { label: "Perpl paused" };
    case "paused":
      return { label: `${symbol} paused on Perpl` };
    case "frozen":
      return { label: "Perpl account frozen" };
    case "opposite":
      return { label: `You’re ${block.held.side} · close it first`, fix: "closePosition" };
    case "leverage":
      return { label: `Max leverage is ${block.maxX}×`, fix: "maxLeverage" };
    case "size":
      return { label: `Minimum ${perplUsd(block.minUsd6)}` };
    case "wallet-short":
      return {
        label: `Add ${perplUsd(block.shortCNS)} AUSD`,
        line: `${perplUsd(block.shortCNS)} AUSD short`,
        fix: "addMoney",
      };
    case "fees":
      return { label: "Add MON for network fees", line: `${monText(block.shortWei)} short`, fix: "addMoney" };
  }
}

/** One composed step, as Details and the running outcome name it. */
export function stepLabel(action: GasAction, depositCNS: bigint): string {
  switch (action) {
    case "perplApprove":
      return "Approve AUSD";
    case "perplCreateAccount":
      return `Open Perpl account · ${perplUsd(depositCNS)}`;
    case "perplDeposit":
      return `Move ${perplUsd(depositCNS)} to Perpl`;
    case "perplWithdraw":
      return "Move back to wallet";
    default:
      return "Order";
  }
}

/** The order's nouns on the outcome surface. */
export function openWords(side: "long" | "short", symbol: string): TraceWords {
  return {
    thing: "order",
    again: "place it again",
    landed: "Confirmed — reading the fill.",
    reverted: "It reverted onchain. Only the network fee was paid.",
    done: "Done",
    back: "Back to ticket",
    leave: "You can leave — it continues and can’t be cancelled.",
    pending: `Opening ${side}`,
    success: `${side === "long" ? "Long" : "Short"} ${symbol} opened`,
  };
}

export const CLOSE_WORDS: TraceWords = {
  thing: "close",
  again: "close it again",
  landed: "Confirmed — reading the fill.",
  reverted: "It reverted onchain. Only the network fee was paid.",
  done: "Done",
  back: "Back to position",
  leave: "You can leave — it continues and can’t be cancelled.",
};

export const WITHDRAW_WORDS: TraceWords = {
  thing: "transfer",
  again: "move it again",
  landed: "Confirmed — the AUSD is in your wallet.",
  reverted: "It reverted onchain. Only the network fee was paid.",
  done: "Done",
  back: "Back",
  leave: "You can leave — it continues and can’t be cancelled.",
  pending: "Moving back to your wallet",
  success: "Moved back to your wallet",
};

/** "0.0345%" from a fee in millionths. */
export const feePct = (ppm: bigint) => `${formatUnits(ppm, PPM_AS_PCT_DECIMALS, PPM_AS_PCT_DECIMALS)}%`;

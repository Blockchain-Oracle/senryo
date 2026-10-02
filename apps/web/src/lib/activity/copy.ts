/**
 * Words and figures for an indexed activity row. The amount's meaning follows the indexer exactly
 * (indexer/schema.graphql `Activity.amount`, and each handler's `addActivity`): money and card rows carry the signed
 * change they made, trades and LP rows a size, and setting rows the value that was set — so each kind says which, and
 * a size is never printed with a sign it does not have.
 */
import type { ActivityKind, IndexedActivity } from "@senryo/indexer-client";
import { clockTime, price18, priceDecimalsOf, signedMoney as signedUsd, money as usd } from "@/lib/format";
import { engineMarketIndex } from "./market-id";

export const ACTIVITY_FILTERS = [
  { value: "all", label: "All" },
  { value: "trades", label: "Trades" },
  { value: "money", label: "Money" },
  { value: "card", label: "Card" },
] as const;
export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number]["value"];

/** The indexer kinds behind each filter chip; "all" sends no filter. */
export const FILTER_KINDS: Record<Exclude<ActivityFilter, "all">, readonly ActivityKind[]> = {
  // TP/SL legs are part of trading (flow book B12: All · Trades · Money · Card; no Orders chip).
  trades: [
    "TRADE",
    "LIQUIDATION",
    "INTENT_EXECUTED",
    "INTENT_SKIPPED",
    "TRIGGER_PLACED",
    "TRIGGER_CANCELLED",
    "TRIGGER_EXECUTED",
  ],
  money: [
    "DEPOSIT",
    "WITHDRAW",
    "SWAP",
    "INBOX_ARRIVED",
    "VOUCHER",
    "STARTER",
    "LP_DEPOSIT",
    "LP_REDEEM_REQUESTED",
    "LP_REDEEMED",
    "PERPL_DEPOSIT",
    "PERPL_WITHDRAW",
  ],
  card: [
    "CARD_HOLD",
    "CARD_HOLD_INCREASED",
    "CARD_CAPTURE",
    "CARD_RELEASE",
    "CARD_REFUND",
    "CARD_DEBT_REPAID",
    "CARD_ALLOWANCE",
    "CARD_ENVELOPE",
  ],
};

/** Which group a row belongs to (its icon when it has no entity of its own). */
export function groupOf(kind: ActivityKind): Exclude<ActivityFilter, "all"> {
  if (FILTER_KINDS.card.includes(kind)) return "card";
  if (FILTER_KINDS.money.includes(kind)) return "money";
  return "trades";
}

const FILL_VERB: Record<NonNullable<IndexedActivity["fill"]>["kind"], string> = {
  OPEN: "Opened",
  INCREASE: "Added to",
  DECREASE: "Reduced",
  CLOSE: "Closed",
  LIQUIDATE: "Liquidated",
  TRIGGER: "TP/SL closed",
  INVERT: "Flipped to",
  DELEVERAGE: "Deleveraged",
};
/** Fills that realise a result: the row shows that result rather than the size traded. */
const REALISING = new Set(["DECREASE", "CLOSE", "LIQUIDATE", "TRIGGER", "DELEVERAGE"]);

const PLAIN_TITLE: Record<
  Exclude<ActivityKind, "TRADE" | "TRIGGER_PLACED" | "TRIGGER_CANCELLED" | "TRIGGER_EXECUTED">,
  string
> = {
  DEPOSIT: "Deposit",
  WITHDRAW: "Withdrawal",
  SWAP: "Swapped AUSD ↔ USDC",
  INBOX_ARRIVED: "Deposit received",
  CARD_HOLD: "Card hold",
  CARD_HOLD_INCREASED: "Card hold increased",
  CARD_CAPTURE: "Card payment",
  CARD_RELEASE: "Card hold released",
  CARD_REFUND: "Card refund",
  CARD_DEBT_REPAID: "Card debt repaid",
  CARD_ALLOWANCE: "Daily spend limit set",
  CARD_ENVELOPE: "Spending envelope set",
  LIQUIDATION: "Liquidation",
  LP_DEPOSIT: "Pool deposit",
  LP_REDEEM_REQUESTED: "Pool redemption requested",
  LP_REDEEMED: "Pool redemption claimed",
  VOUCHER: "Voucher redeemed",
  STARTER: "Practice funds claimed",
  INTENT_EXECUTED: "Deposit-and-open order filled",
  INTENT_SKIPPED: "Deposit landed · its order was skipped",
  PERPL_DEPOSIT: "Moved to Perpl",
  PERPL_WITHDRAW: "Moved back from Perpl",
};

const TRIGGER_WORD = { TRIGGER_PLACED: "set", TRIGGER_CANCELLED: "cancelled", TRIGGER_EXECUTED: "executed" } as const;

export function activityTitle(row: IndexedActivity): string {
  if (row.kind === "TRADE") {
    const market = row.market?.symbol ?? row.symbol;
    if (!row.fill) return market ? `Trade · ${market}` : "Trade";
    const what = `${FILL_VERB[row.fill.kind]} ${row.fill.side === "LONG" ? "long" : "short"}`;
    return market ? `${what} · ${market}` : what;
  }
  if (row.kind === "TRIGGER_PLACED" || row.kind === "TRIGGER_CANCELLED" || row.kind === "TRIGGER_EXECUTED") {
    const leg = row.trigger ? (row.trigger.takeProfit ? "Take profit" : "Stop loss") : "TP/SL";
    return `${leg} ${TRIGGER_WORD[row.kind]}`;
  }
  const title = PLAIN_TITLE[row.kind];
  return row.symbol && groupOf(row.kind) === "money" && row.kind !== "SWAP" ? `${title} · ${row.symbol}` : title;
}

/** Kinds whose amount is the signed change they made to the balance. */
const SIGNED = new Set<ActivityKind>([
  "DEPOSIT",
  "WITHDRAW",
  "INBOX_ARRIVED",
  "VOUCHER",
  "STARTER",
  "CARD_HOLD",
  "CARD_HOLD_INCREASED",
  "CARD_CAPTURE",
  "CARD_RELEASE",
  "CARD_REFUND",
  "CARD_DEBT_REPAID",
]);

export interface ActivityFigure {
  text: string;
  /** Up / down when the figure is a signed change or a realised result; plain otherwise. */
  tone: "up" | "down" | "plain";
}

/** The figure at the row's right, or undefined when the event carries none. */
export function activityFigure(row: IndexedActivity): ActivityFigure | undefined {
  if (row.kind === "TRADE" && row.fill && REALISING.has(row.fill.kind)) {
    const pnl = row.fill.realizedPnl;
    return { text: signedUsd(pnl), tone: pnl < 0n ? "down" : "up" };
  }
  if (row.kind === "LIQUIDATION" && row.liquidation) {
    const pnl = row.liquidation.realizedPnl;
    return { text: signedUsd(pnl), tone: pnl < 0n ? "down" : "up" };
  }
  if (row.amount === undefined) return undefined;
  if (SIGNED.has(row.kind)) return { text: signedUsd(row.amount), tone: row.amount < 0n ? "down" : "up" };
  return { text: usd(row.amount < 0n ? -row.amount : row.amount), tone: "plain" };
}

/** What the figure is, when the title does not already say (a size, a penalty, a trigger price). */
export function activityNote(row: IndexedActivity): string | undefined {
  if (row.kind === "TRADE" && row.fill) {
    return REALISING.has(row.fill.kind) ? "realised" : "exposure";
  }
  if (row.kind === "LIQUIDATION" && row.liquidation) return `penalty ${usd(row.liquidation.penalty)}`;
  if (row.trigger) {
    const index = row.market ? engineMarketIndex(row.market.id) : undefined;
    return `at ${price18(row.trigger.triggerPrice, index === undefined ? undefined : priceDecimalsOf(index))}`;
  }
  return undefined;
}

const MS_PER_SECOND = 1000;

/** "14:02" today, "12 Sep · 14:02" on another day (device time). */
export function activityTime(timestampSec: number, now: Date = new Date()): string {
  const ms = timestampSec * MS_PER_SECOND;
  const at = new Date(ms);
  if (at.toDateString() === now.toDateString()) return clockTime(ms);
  return `${at.toLocaleDateString(undefined, { day: "numeric", month: "short" })} · ${clockTime(ms)}`;
}

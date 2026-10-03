/**
 * Journal operations as Activity rows (B12; activity-feed.ts has the merge): what this device sent, with the words the
 * user reviewed, including the ones still in flight. Journal intents are read by the money flows' convention (all
 * strings, any may be absent): `kind` (send · withdraw · swap · bridge · ramp), `symbol`, `amount` (raw base units),
 * `decimals`, `asset` (token address), `recipient`, `recipientLabel` ("@kai" or a saved name), `outSymbol`,
 * `outAsset`, `minOut`, `quotedOut`, `outDecimals` (swap), `destination` (chain name), `destinationChainId`,
 * `provider`, `trackingId`, `direction` (bridge), `fee` (text), `steps` (added by the runner); older spot trades carry
 * preformatted `paid` / `quoted` / `atLeast`.
 */
import { MAINNET_CHAIN_ID } from "@senryo/config";
import { ids } from "@senryo/identity";
import {
  type FeedFigure,
  type FeedFormat,
  type FeedGroup,
  type FeedItem,
  type FeedMark,
  type FeedStatus,
  symbolMark,
} from "./activity-feed.ts";
import type { OperationRecord } from "./operations.ts";

const USD6_DECIMALS = 6;
const MON_DECIMALS = 18;
/** A journal record that never got a signature for this long was abandoned before signing: nothing to show. */
const STALE_PREPARING_MS = 600_000;

const BRIDGE_ACTIONS = new Set(["relayDeposit", "cctpBurn", "acrossDeposit", "lifiBridge"]);
const SWAP_ACTIONS = new Set([
  "aggregatorSwap",
  "spotSwap",
  "uniswapSwap",
  "swapCollateral",
  "swapToken",
  "practiceSwap",
]);
const POOL_ACTIONS = new Set(["lpDeposit", "lpRequestRedeem", "lpClaimRedeem"]);
const TRADE_ACTIONS = new Set(["increase", "decrease", "close", "placeTrigger", "executeTrigger"]);
const CARD_ACTIONS = new Set(["setSpendAllowance", "revokeSpendAllowance", "setCardEnvelope", "repayCardDebt"]);
const TRADE_WORDS: Record<string, string> = {
  increase: "Position opened",
  decrease: "Position reduced",
  close: "Position closed",
  placeTrigger: "Take profit / stop loss set",
};
const CARD_WORDS: Record<string, string> = {
  setSpendAllowance: "Card limit set",
  revokeSpendAllowance: "Card frozen",
  setCardEnvelope: "Spending envelope set",
  repayCardDebt: "Card debt repaid",
};
const POOL_WORDS: Record<string, string> = {
  lpDeposit: "Pool deposit",
  lpRequestRedeem: "Pool redemption requested",
  lpClaimRedeem: "Pool redemption claimed",
};

function decimalsOf(symbol: string | undefined, given: string | undefined): number | undefined {
  if (given !== undefined && /^\d+$/.test(given)) return Number.parseInt(given, 10);
  if (symbol === "AUSD" || symbol === "USDC") return USD6_DECIMALS;
  if (symbol === "MON") return MON_DECIMALS;
  return undefined;
}

/** "20.00 AUSD" from a journal intent's raw amount, or its preformatted `paid` text. */
function intentAmount(
  format: FeedFormat,
  i: Record<string, string>,
  raw = i.amount,
  symbol = i.symbol,
): string | undefined {
  if (raw === i.amount && i.paid) return i.paid;
  const decimals = decimalsOf(symbol, raw === i.amount ? i.decimals : i.outDecimals);
  if (!raw || !/^\d+$/.test(raw) || decimals === undefined) return symbol;
  return format.tokenAmount(BigInt(raw), decimals, symbol);
}

export type JournalKind =
  | "send"
  | "withdraw"
  | "move"
  | "swap"
  | "bridge"
  | "ramp"
  | "pool"
  | "trade"
  | "card"
  | "perpl"
  | "other";

export function journalKind(record: OperationRecord, me: string): JournalKind {
  const intent = record.reviewedIntent;
  const k = intent.kind;
  if (intent.venue === "perpl") return "perpl";
  if (k === "send" || k === "withdraw" || k === "swap" || k === "bridge" || k === "ramp") return k;
  const actions = new Set([record.kind, ...record.plannedActions]);
  const has = (set: ReadonlySet<string>) => [...actions].some((a) => set.has(a));
  if (has(BRIDGE_ACTIONS)) return "bridge";
  if (has(SWAP_ACTIONS)) return "swap";
  if (has(POOL_ACTIONS)) return "pool";
  if (has(TRADE_ACTIONS)) return "trade";
  if (has(CARD_ACTIONS)) return "card";
  const toOther = intent.recipient !== undefined && intent.recipient.toLowerCase() !== me.toLowerCase();
  if (actions.has("erc20Transfer") || actions.has("transfer")) return toOther ? "send" : "move";
  if (actions.has("withdraw")) return toOther ? "send" : "move";
  return "other";
}

function journalStatus(record: OperationRecord): FeedStatus | undefined {
  switch (record.outcome) {
    case "completed":
      return "done";
    case "partial":
      return "partial";
    case "reverted":
    case "abandoned":
      return "failed";
    case "not-sent":
      return undefined;
    default: {
      const signed = record.steps.some((s) => s.hash !== undefined);
      if (signed) return "checking";
      return Date.now() - record.updatedAt > STALE_PREPARING_MS ? undefined : "pending";
    }
  }
}

/**
 * A Perpl journey's row (D1): what the order did as the receipt's own events say (a fill fact, or none — an IOC that
 * matched nobody is "nothing filled", never "opened"), or the AUSD moved back to the wallet.
 */
function perplTitle(record: OperationRecord, format: FeedFormat): string {
  const i = record.reviewedIntent;
  const side = i.side === "short" ? "short" : "long";
  const symbol = i.symbol ?? "Perpl";
  if (i.intent === "withdraw") return `Moved ${intentAmount(format, i, i.withdraw, "AUSD") ?? "AUSD"} back from Perpl`;
  const order = record.steps.find((s) => s.action === "perplOrder" && s.outcome === "completed");
  if (!order) {
    const moved = record.steps.some(
      (s) => (s.action === "perplCreateAccount" || s.action === "perplDeposit") && s.outcome === "completed",
    );
    return moved ? "Moved to Perpl" : `Perpl ${side} ${symbol}`;
  }
  const filled = order.facts?.some((f) => f.event === "TakerOrderFilledV2");
  if (!filled) return `Perpl order · nothing ${i.intent === "close" ? "closed" : "opened"}`;
  if (i.intent === "close") return `${i.closingAll === "false" ? "Reduced" : "Closed"} ${side} ${symbol} · Perpl`;
  return `Opened ${side} ${symbol} · Perpl`;
}

function journalTitle(kind: JournalKind, record: OperationRecord, format: FeedFormat): string {
  const i = record.reviewedIntent;
  if (kind === "perpl") return perplTitle(record, format);
  const amount = intentAmount(format, i) ?? "money";
  const out = i.outSymbol ?? i.toSymbol;
  switch (kind) {
    case "send":
      return `Sent ${amount} to ${i.recipientLabel ?? format.shortAddress(i.recipient ?? "")}`;
    case "withdraw":
      return i.destination ? `Withdrew ${amount} to ${i.destination}` : `Withdrew ${amount}`;
    case "move":
      return `Moved ${amount} to your wallet`;
    case "swap":
      return out ? `Swapped ${i.symbol ?? "tokens"} → ${out}` : `Swapped ${i.symbol ?? "tokens"}`;
    case "bridge":
      return `Bridged ${i.symbol ?? "money"} ${i.direction === "in" ? "from" : "to"} ${i.destination ?? "another chain"}`;
    case "ramp":
      return `Bought ${amount} · Ramp`;
    case "pool":
      return POOL_WORDS[record.plannedActions.find((a) => POOL_ACTIONS.has(a)) ?? ""] ?? "Pool";
    case "trade":
      return TRADE_WORDS[record.plannedActions.find((a) => TRADE_ACTIONS.has(a)) ?? ""] ?? "Trade";
    case "card":
      return CARD_WORDS[record.plannedActions.find((a) => CARD_ACTIONS.has(a)) ?? ""] ?? "Card";
    default:
      return "Transaction";
  }
}

function journalMarks(kind: JournalKind, record: OperationRecord): FeedMark[] {
  const i = record.reviewedIntent;
  const chainId = record.chainId;
  if (kind === "swap") {
    const out = i.outSymbol ?? i.toSymbol;
    return [symbolMark(chainId, i.symbol, i.asset), ...(out ? [symbolMark(chainId, out, i.outAsset)] : [])];
  }
  if (kind === "perpl") {
    const perp = i.marketId === undefined ? undefined : Number(i.marketId);
    return i.intent === "withdraw" || perp === undefined || !Number.isInteger(perp)
      ? [{ id: ids.venue("perpl"), label: "Perpl" }]
      : [{ id: ids.perplMarket(MAINNET_CHAIN_ID, perp), label: i.symbol ?? "Perpl" }];
  }
  if (kind === "trade" || kind === "card" || kind === "other") return [];
  if (kind === "pool") return [{ id: ids.brand("senryo"), label: "Senryo pool" }];
  return i.symbol || i.asset ? [symbolMark(chainId, i.symbol, i.asset)] : [];
}

function journalFigure(kind: JournalKind, record: OperationRecord, format: FeedFormat): FeedFigure | undefined {
  const i = record.reviewedIntent;
  if (kind === "ramp") {
    const amount = intentAmount(format, i);
    return amount ? { text: `+${amount}`, tone: "up" } : undefined;
  }
  if (kind === "swap") {
    const out = i.quoted ?? intentAmount(format, i, i.quotedOut, i.outSymbol ?? i.toSymbol);
    return out ? { text: `+${out}`, tone: "up" } : undefined;
  }
  if (kind === "send" || kind === "withdraw" || kind === "bridge") {
    const amount = intentAmount(format, i);
    return amount ? { text: `−${amount}`, tone: "plain" } : undefined;
  }
  return undefined;
}

const GROUP_OF: Record<JournalKind, FeedGroup> = {
  send: "money",
  withdraw: "money",
  move: "money",
  swap: "money",
  bridge: "money",
  ramp: "money",
  pool: "money",
  other: "money",
  trade: "trades",
  card: "card",
  perpl: "trades",
};

export function journalItem(record: OperationRecord, me: string, format: FeedFormat): FeedItem | undefined {
  const status = journalStatus(record);
  if (!status) return undefined;
  const kind = journalKind(record, me);
  return {
    id: `journal:${record.id}`,
    at: record.updatedAt,
    group: kind === "perpl" && record.reviewedIntent.intent === "withdraw" ? "money" : GROUP_OF[kind],
    title: journalTitle(kind, record, format),
    marks: journalMarks(kind, record),
    figure: journalFigure(kind, record, format),
    status,
    hashes: record.steps.flatMap((s) => (s.hash ? [s.hash.toLowerCase()] : [])),
    source: { kind: "journal", record },
  };
}

/**
 * One Activity list from three sources (flow book B12): the indexer's onchain events for this account; this phone's
 * operation journal — the sends, withdrawals, swaps, bridges and purchases made here, including the ones still in
 * flight; and the wallet's own movements (D8, `/v1/activity/wallet`: tokens and MON received from anyone, sent
 * anywhere, swaps made outside the app — wallet-item.ts). All become the same `FeedItem` (subject marks, a verb title,
 * a signed figure, a status), deduplicated by transaction hash: the journal's words win, the indexer's event is the
 * proof it landed (and keeps a trade's fill and result), and a wallet movement shows only when neither explains it.
 *
 * Journal intents are read by the money flows' convention (all strings, any may be absent): `kind` (send · withdraw ·
 * swap · bridge · ramp), `symbol`, `amount` (raw base units), `decimals`, `asset` (token address), `recipient`,
 * `recipientLabel` ("@kai" or a saved name), `outSymbol`, `outAsset`, `minOut`, `quotedOut`, `outDecimals` (swap),
 * `destination` (chain name), `destinationChainId`, `provider`, `trackingId`, `direction` (bridge), `fee` (text),
 * `steps` (added by the runner); older spot trades carry preformatted `paid` / `quoted` / `atLeast`.
 */
import type { WalletActivityItem } from "@senryo/api-client";
import { MAINNET_CHAIN_ID, SPOT_TOKENS } from "@senryo/config";
import { collateralId, ids } from "@senryo/identity";
import type { IndexedActivity } from "@senryo/indexer-client";
import type { OperationRecord } from "@senryo/query";
import { activityFigure, activityTitle, groupOf } from "~/features/portfolio/activity-copy";
import { indexedMarketMark } from "~/features/portfolio/market-id";
import { tokenAmount } from "~/features/tokens/format";
import { shortAddress } from "~/lib/format";

export type FeedGroup = "trades" | "money" | "card";
export type FeedStatus = "done" | "pending" | "checking" | "partial" | "failed";

/** A subject mark: an entity id (with its label for the fallback) or, without one, the group's glyph. */
export interface FeedMark {
  id: string | undefined;
  label: string;
}

export interface FeedItem {
  id: string;
  /** ms since epoch. */
  at: number;
  group: FeedGroup;
  title: string;
  marks: FeedMark[];
  figure?: { text: string; tone: "up" | "down" | "plain" } | undefined;
  status: FeedStatus;
  hashes: string[];
  source:
    | { kind: "indexed"; row: IndexedActivity }
    | { kind: "journal"; record: OperationRecord }
    | { kind: "wallet"; item: WalletActivityItem };
}

/** A paged source's rows so far (newest first) and whether older pages remain. */
export interface FeedPage {
  items: readonly FeedItem[];
  complete: boolean;
  /** ms of the oldest row read, when rows were left out after reading (otherwise the last item's time). */
  reach?: number | undefined;
}

const MS_PER_SECOND = 1000;
const USD6_DECIMALS = 6;
const MON_DECIMALS = 18;
/** A journal record that never got a signature for this long was abandoned before signing: nothing to show. */
const STALE_PREPARING_MS = 600_000;

const BRIDGE_ACTIONS = new Set(["relayDeposit", "cctpBurn", "acrossDeposit", "lifiBridge"]);
const SWAP_ACTIONS = new Set(["aggregatorSwap", "spotSwap", "uniswapSwap", "swapCollateral", "swapToken"]);
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

/** A token's mark from what a row knows: its address, else its symbol on this network. */
export function symbolMark(chainId: number, symbol: string | undefined, token?: string): FeedMark {
  const label = symbol ?? "Token";
  if (symbol === "AUSD" || symbol === "USDC") return { id: collateralId(chainId, symbol), label };
  if (symbol === "MON") return { id: ids.native(chainId, "MON"), label };
  if (token) return { id: ids.token(chainId, token), label };
  const spot = chainId === MAINNET_CHAIN_ID ? SPOT_TOKENS.find((t) => t.symbol === symbol) : undefined;
  return { id: spot?.mark, label };
}

function decimalsOf(symbol: string | undefined, given: string | undefined): number | undefined {
  if (given !== undefined && /^\d+$/.test(given)) return Number.parseInt(given, 10);
  if (symbol === "AUSD" || symbol === "USDC") return USD6_DECIMALS;
  if (symbol === "MON") return MON_DECIMALS;
  return undefined;
}

/** "20.00 AUSD" from a journal intent's raw amount, or its preformatted `paid` text. */
function intentAmount(i: Record<string, string>, raw = i.amount, symbol = i.symbol): string | undefined {
  if (raw === i.amount && i.paid) return i.paid;
  const decimals = decimalsOf(symbol, raw === i.amount ? i.decimals : i.outDecimals);
  if (!raw || !/^\d+$/.test(raw) || decimals === undefined) return symbol;
  return tokenAmount(BigInt(raw), decimals, symbol);
}

// ---------------------------------------------------------------- indexer rows

/** The verb title of an indexed money row ("Sent 20.00 AUSD to 0x12…ab"); other rows keep the shared copy. */
function indexedTitle(row: IndexedActivity, me: string): string {
  const amount = row.amount === undefined ? undefined : row.amount < 0n ? -row.amount : row.amount;
  const what = amount === undefined ? (row.symbol ?? "") : tokenAmount(amount, USD6_DECIMALS, row.symbol ?? undefined);
  switch (row.kind) {
    case "DEPOSIT":
      return `Added ${what} to trades`;
    case "WITHDRAW": {
      const to = row.move?.counterparty?.toLowerCase();
      if (!to || to === me) return `Moved ${what} to your wallet`;
      return `Sent ${what} to ${shortAddress(to)}`;
    }
    case "INBOX_ARRIVED":
      return `Received ${what}`;
    default:
      return activityTitle(row);
  }
}

/** Outgoing money is plain ink with a minus; only incoming money and realised gains are green (losses red). */
function indexedFigure(row: IndexedActivity): FeedItem["figure"] {
  const figure = activityFigure(row);
  if (!figure) return undefined;
  if (row.kind === "TRADE" || row.kind === "LIQUIDATION") return figure;
  return { ...figure, tone: figure.tone === "down" ? "plain" : figure.tone };
}

export function indexedItem(row: IndexedActivity, chainId: number, me: string): FeedItem {
  const market = row.market ? indexedMarketMark(chainId, row.market.id) : undefined;
  const marks = market
    ? [{ id: market, label: row.market?.symbol ?? "Market" }]
    : row.symbol
      ? [symbolMark(chainId, row.symbol, row.move?.token ?? undefined)]
      : [];
  return {
    id: `indexed:${row.id}`,
    at: row.timestamp * MS_PER_SECOND,
    group: groupOf(row.kind),
    title: indexedTitle(row, me.toLowerCase()),
    marks,
    figure: indexedFigure(row),
    status: "done",
    hashes: [row.txHash.toLowerCase()],
    source: { kind: "indexed", row },
  };
}

// ---------------------------------------------------------------- journal records

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
function perplTitle(record: OperationRecord): string {
  const i = record.reviewedIntent;
  const side = i.side === "short" ? "short" : "long";
  const symbol = i.symbol ?? "Perpl";
  if (i.intent === "withdraw") return `Moved ${intentAmount(i, i.withdraw, "AUSD") ?? "AUSD"} back from Perpl`;
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

function journalTitle(kind: JournalKind, record: OperationRecord): string {
  const i = record.reviewedIntent;
  if (kind === "perpl") return perplTitle(record);
  const amount = intentAmount(i) ?? "money";
  const out = i.outSymbol ?? i.toSymbol;
  switch (kind) {
    case "send":
      return `Sent ${amount} to ${i.recipientLabel ?? shortAddress(i.recipient ?? "")}`;
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

function journalFigure(kind: JournalKind, record: OperationRecord): FeedItem["figure"] {
  const i = record.reviewedIntent;
  if (kind === "ramp") {
    const amount = intentAmount(i);
    return amount ? { text: `+${amount}`, tone: "up" } : undefined;
  }
  if (kind === "swap") {
    const out = i.quoted ?? intentAmount(i, i.quotedOut, i.outSymbol ?? i.toSymbol);
    return out ? { text: `+${out}`, tone: "up" } : undefined;
  }
  if (kind === "send" || kind === "withdraw" || kind === "bridge") {
    const amount = intentAmount(i);
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

export function journalItem(record: OperationRecord, me: string): FeedItem | undefined {
  const status = journalStatus(record);
  if (!status) return undefined;
  const kind = journalKind(record, me);
  return {
    id: `journal:${record.id}`,
    at: record.updatedAt,
    group: kind === "perpl" && record.reviewedIntent.intent === "withdraw" ? "money" : GROUP_OF[kind],
    title: journalTitle(kind, record),
    marks: journalMarks(kind, record),
    figure: journalFigure(kind, record),
    status,
    hashes: record.steps.flatMap((s) => (s.hash ? [s.hash.toLowerCase()] : [])),
    source: { kind: "journal", record },
  };
}

/** Kinds whose transaction also emits the trading-account credit it paid ("Added P$100 to trades"). */
const CLAIM_KINDS = new Set(["STARTER", "VOUCHER"]);

/** A claim or voucher is one row: its own DEPOSIT event in the same transaction folds into it. */
function foldClaims(rows: readonly FeedItem[]): FeedItem[] {
  const claims = new Set(
    rows.flatMap((r) => (r.source.kind === "indexed" && CLAIM_KINDS.has(r.source.row.kind) ? r.hashes : [])),
  );
  if (claims.size === 0) return [...rows];
  return rows.filter(
    (r) => !(r.source.kind === "indexed" && r.source.row.kind === "DEPOSIT" && r.hashes.some((h) => claims.has(h))),
  );
}

/**
 * The merged list, newest first: unsettled journal items first, then everything by time. For money, a finalized
 * journal item replaces the indexed event with the same hash (its words name the recipient and the route); for trades
 * and the card the indexed event wins (it carries the fill and the realised result). A wallet movement is the last
 * word: one whose transaction the journal or the indexer already tells is dropped. While a paged source (indexer,
 * wallet) has older pages, settled items older than its last loaded row wait for that page, so a later page never
 * slots rows in above ones already shown.
 */
export function mergeFeed(indexed: FeedPage, journal: readonly FeedItem[], wallet: FeedPage): FeedItem[] {
  const rows = foldClaims(indexed.items);
  const indexedHashes = new Set(rows.flatMap((row) => row.hashes));
  const own = journal.filter((j) => j.group === "money" || !j.hashes.some((h) => indexedHashes.has(h)));
  const journalHashes = new Set(own.flatMap((j) => j.hashes));
  const kept = rows.filter((row) => !row.hashes.some((h) => journalHashes.has(h)));
  const told = new Set([...indexedHashes, ...journal.flatMap((j) => j.hashes)]);
  const moves = wallet.items.filter((w) => !w.hashes.some((h) => told.has(h)));
  let frontier: number | undefined;
  for (const page of [indexed, wallet]) {
    const oldest = page.reach ?? page.items.at(-1)?.at;
    if (!page.complete && oldest !== undefined && (frontier === undefined || oldest > frontier)) frontier = oldest;
  }
  const live = (s: FeedStatus) => s === "pending" || s === "checking";
  const shown = (item: FeedItem) => frontier === undefined || item.at >= frontier || item.status !== "done";
  return [...kept, ...own, ...moves].filter(shown).sort((a, b) => {
    if (live(a.status) !== live(b.status)) return live(a.status) ? -1 : 1;
    return b.at - a.at;
  });
}

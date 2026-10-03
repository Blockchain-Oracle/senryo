/**
 * The Activity model both apps share (flow book B12): one list from three sources — the indexer's onchain events for
 * this account; this device's operation journal (the sends, withdrawals, swaps, bridges and purchases made here,
 * including the ones still in flight; activity-journal.ts); and the wallet's own movements (D8, `/v1/activity/wallet`:
 * tokens and MON received from anyone, sent anywhere, swaps made outside the app; activity-wallet.ts). All become the
 * same `FeedItem` (subject marks, a verb title, a signed figure, a status), deduplicated by transaction hash: the
 * journal's words win, the indexer's event is the proof it landed (and keeps a trade's fill and result), and a wallet
 * movement shows only when neither explains it.
 *
 * Pure: no React, no platform. What differs per app — number formatting and the indexed rows' shared copy — comes in
 * through a `FeedFormat` each app builds once from its own modules.
 */
import type { WalletActivityItem } from "@senryo/api-client";
import { MAINNET_CHAIN_ID, SPOT_TOKENS } from "@senryo/config";
import { collateralId, ids } from "@senryo/identity";
import type { ActivityKind, IndexedActivity } from "@senryo/indexer-client";
import type { OperationRecord } from "./operations.ts";

export type FeedGroup = "trades" | "money" | "card";
export type FeedStatus = "done" | "pending" | "checking" | "partial" | "failed";

/** A subject mark: an entity id (with its label for the fallback) or, without one, the group's glyph. */
export interface FeedMark {
  id: string | undefined;
  label: string;
}

export interface FeedFigure {
  text: string;
  tone: "up" | "down" | "plain";
}

export interface FeedItem {
  id: string;
  /** ms since epoch. */
  at: number;
  group: FeedGroup;
  title: string;
  marks: FeedMark[];
  figure?: FeedFigure | undefined;
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

/** The platform pieces of the model, built once per app from its own format and activity-copy modules. */
export interface FeedFormat {
  /** "0.0012 WBTC", "1,250.00 MON" from raw base units. */
  tokenAmount: (raw: bigint, decimals: number, symbol?: string) => string;
  /** "0x12ab…cdef". */
  shortAddress: (address: string) => string;
  /** The shared verb title of an indexed row ("Opened long · XAU"). */
  activityTitle: (row: IndexedActivity) => string;
  /** The figure at an indexed row's right (a signed change, a realised result or a size). */
  activityFigure: (row: IndexedActivity) => FeedFigure | undefined;
  /** Which tab an indexer kind belongs to. */
  groupOf: (kind: ActivityKind) => FeedGroup;
  /** The identity of an indexed market ("ours-0", "perpl-16") on a network, for its real mark. */
  marketMark: (chainId: number, marketId: string) => string | undefined;
}

const MS_PER_SECOND = 1000;
const USD6_DECIMALS = 6;

/** A token's mark from what a row knows: its address, else its symbol on this network. */
export function symbolMark(chainId: number, symbol: string | undefined, token?: string): FeedMark {
  const label = symbol ?? "Token";
  if (symbol === "AUSD" || symbol === "USDC") return { id: collateralId(chainId, symbol), label };
  if (symbol === "MON") return { id: ids.native(chainId, "MON"), label };
  if (token) return { id: ids.token(chainId, token), label };
  const spot = chainId === MAINNET_CHAIN_ID ? SPOT_TOKENS.find((t) => t.symbol === symbol) : undefined;
  return { id: spot?.mark, label };
}

// ---------------------------------------------------------------- indexer rows

/** The verb title of an indexed money row ("Sent 20.00 AUSD to 0x12…ab"); other rows keep the shared copy. */
function indexedTitle(row: IndexedActivity, me: string, format: FeedFormat): string {
  const amount = row.amount === undefined ? undefined : row.amount < 0n ? -row.amount : row.amount;
  const what =
    amount === undefined ? (row.symbol ?? "") : format.tokenAmount(amount, USD6_DECIMALS, row.symbol ?? undefined);
  switch (row.kind) {
    case "DEPOSIT":
      return `Added ${what} to trades`;
    case "WITHDRAW": {
      const to = row.move?.counterparty?.toLowerCase();
      if (!to || to === me) return `Moved ${what} to your wallet`;
      return `Sent ${what} to ${format.shortAddress(to)}`;
    }
    case "INBOX_ARRIVED":
      return `Received ${what}`;
    default:
      return format.activityTitle(row);
  }
}

/** Outgoing money is plain ink with a minus; only incoming money and realised gains are green (losses red). */
function indexedFigure(row: IndexedActivity, format: FeedFormat): FeedFigure | undefined {
  const figure = format.activityFigure(row);
  if (!figure) return undefined;
  if (row.kind === "TRADE" || row.kind === "LIQUIDATION") return figure;
  return { ...figure, tone: figure.tone === "down" ? "plain" : figure.tone };
}

export function indexedItem(row: IndexedActivity, chainId: number, me: string, format: FeedFormat): FeedItem {
  const market = row.market ? format.marketMark(chainId, row.market.id) : undefined;
  const marks = market
    ? [{ id: market, label: row.market?.symbol ?? "Market" }]
    : row.symbol
      ? [symbolMark(chainId, row.symbol, row.move?.token ?? undefined)]
      : [];
  return {
    id: `indexed:${row.id}`,
    at: row.timestamp * MS_PER_SECOND,
    group: format.groupOf(row.kind),
    title: indexedTitle(row, me.toLowerCase(), format),
    marks,
    figure: indexedFigure(row, format),
    status: "done",
    hashes: [row.txHash.toLowerCase()],
    source: { kind: "indexed", row },
  };
}

// ---------------------------------------------------------------- the merge

/** Kinds whose transaction also emits the trading-account credit it paid ("Added P$100 to trades"). */
const CLAIM_KINDS = new Set(["STARTER", "VOUCHER"]);

/** A claim or voucher is one row: its own DEPOSIT event in the same transaction folds into it. */
export function foldClaims(rows: readonly FeedItem[]): FeedItem[] {
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

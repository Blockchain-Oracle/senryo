/**
 * Social words (the phone's `features/social/format.ts`): names, handles, compact ages, the market a feed row is about,
 * the fill verbs, and one short line per API error.
 */
import { ApiError, type FeedTrade } from "@senryo/api-client";
import { type ChainId, engineMarket, PERPL_MARKETS } from "@senryo/config";
import { shortAddress } from "@senryo/core";
import { entity, ids } from "@senryo/identity";

type Who = { address: string; handle: string | null; displayName: string | null };

export const nameOf = (who: Who) => who.displayName || who.handle || shortAddress(who.address);
export const handleOf = (who: Who) => (who.handle ? `@${who.handle}` : shortAddress(who.address));
export const sameAddress = (a: string | undefined, b: string | undefined) =>
  a !== undefined && b !== undefined && a.toLowerCase() === b.toLowerCase();

const SECOND_MS = 1_000;
const MINUTE_S = 60;
const HOUR_S = 3_600;
const DAY_S = 86_400;
const WEEK_S = 604_800;
const NOW_S = 5;

/** F15's compact age: "now", "4s", "33m", "2h", "5d", then the date ("12 Sep"). */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "";
  const age = Math.max(0, Math.floor((now - then) / SECOND_MS));
  if (age < NOW_S) return "now";
  if (age < MINUTE_S) return `${age}s`;
  if (age < HOUR_S) return `${Math.floor(age / MINUTE_S)}m`;
  if (age < DAY_S) return `${Math.floor(age / HOUR_S)}h`;
  if (age < WEEK_S) return `${Math.floor(age / DAY_S)}d`;
  return new Date(then).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** "Sep 2026" for a profile's "Joined" line. */
export function monthYear(iso: string): string {
  const at = Date.parse(iso);
  return Number.isNaN(at) ? "" : new Date(at).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export interface MarketRef {
  mark: string | undefined;
  symbol: string;
  engineId: number | undefined;
}

const MARKET_ID = /^(ours|perpl)-(\d+)$/;

/** The market a feed row is about, from the indexer's market id ("ours-0", "perpl-16"). */
export function marketOfId(chainId: ChainId, marketId: string | null, symbol?: string): MarketRef | undefined {
  const match = marketId ? MARKET_ID.exec(marketId) : null;
  if (!match) {
    const meta = symbol ? engineMarket(symbol) : undefined;
    return meta
      ? { mark: ids.engineMarket(chainId, meta.id), symbol: meta.symbol, engineId: meta.id }
      : symbol
        ? { mark: undefined, symbol, engineId: undefined }
        : undefined;
  }
  const id = Number(match[2]);
  if (match[1] === "ours") {
    const meta = engineMarket(id);
    return meta ? { mark: ids.engineMarket(chainId, id), symbol: meta.symbol, engineId: id } : undefined;
  }
  const listed = Object.entries(PERPL_MARKETS[chainId] ?? {}).find(([, perplId]) => perplId === id)?.[0];
  const ticker = symbol ?? listed;
  if (!ticker) return undefined;
  const mark = ids.perplMarket(chainId, id);
  return { mark: entity(mark) ? mark : undefined, symbol: ticker, engineId: undefined };
}

export const TRADE_VERB: Record<FeedTrade["fillKind"], string> = {
  OPEN: "Opened",
  INCREASE: "Increased",
  DECREASE: "Reduced",
  CLOSE: "Closed",
  LIQUIDATE: "Liquidated",
  TRIGGER: "TP/SL filled",
  INVERT: "Flipped",
  DELEVERAGE: "Deleveraged",
};

const OPENING_KINDS: ReadonlySet<FeedTrade["fillKind"]> = new Set(["OPEN", "INCREASE"]);

/** A trade row offers Trade this while its position is still open and was opened or added to. */
export const tradeIsOpen = (trade: FeedTrade) => OPENING_KINDS.has(trade.fillKind) && trade.positionStatus === "OPEN";

const HTTP_NOT_FOUND = 404;
export const isNotFound = (error: unknown) => error instanceof ApiError && error.status === HTTP_NOT_FOUND;

/** One short line per social write error. */
export function socialErrorCopy(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  switch (error.code) {
    case "NOT_LISTED":
      return "Make your profile public to post";
    case "CONTENT_BLOCKED":
      return "That text can’t be posted";
    case "RATE_LIMITED":
      return "Posting limit · try again soon";
    case "BLOCKED":
      return "Blocked · you can’t interact";
    case "FOLLOW_LIMIT":
      return "Limit reached · 1,000 follows";
    case "NOT_FOUND":
      return "Not available any more";
    default:
      return fallback;
  }
}

/**
 * Display helpers for Social (J8, S1b.14): who a row is about, how long ago, which market a feed row or a board row
 * names (the indexer's `ours-0` / `perpl-16` ids and bare symbols → the canonical mark), the verb per fill kind, and
 * the copy per API error code. Pure: nothing here reads the network.
 */
import { ApiError, type FeedTrade, type SocialIdentity } from "@senryo/api-client";
import { type ChainId, engineMarket } from "@senryo/config";
import { shortAddress } from "@senryo/core";
import { entity, ids, PERPL_MARKETS, perplMarketId } from "@senryo/identity";

type Who = Pick<SocialIdentity, "address" | "handle" | "displayName">;

/** The name a person is shown by: their display name, else their handle, else the short address. */
export function nameOf(who: Who): string {
  return who.displayName || who.handle || shortAddress(who.address);
}

/** `@handle`, or the short address when the account has no handle on this network. */
export function handleOf(who: Who): string {
  return who.handle ? `@${who.handle}` : shortAddress(who.address);
}

export function sameAddress(a: string | undefined, b: string | undefined): boolean {
  return a !== undefined && b !== undefined && a.toLowerCase() === b.toLowerCase();
}

const SECOND_MS = 1_000;
const MINUTE_S = 60;
const HOUR_S = 3_600;
const DAY_S = 86_400;
const WEEK_S = 604_800;
/** Under this a row reads "now" (the clock of the phone and the server never agree to the second). */
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

/** "25 Sep" in UTC, for a leaderboard window that is counted in UTC days. */
export function utcDay(iso: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "";
  return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
}

export interface MarketRef {
  /** Canonical mark id, when the registry keys this market on this network. */
  mark: string | undefined;
  symbol: string;
  name: string | undefined;
  /** Our engine's market id when the market trades on it (it then has a detail page and a live price). */
  engineId: number | undefined;
}

const MARKET_ID = /^(ours|perpl)-(\d+)$/;

/** The indexer's id of one of our engine's markets, as posts carry it (`ours-0` = XAU). */
export function engineMarketId(engineId: number): string {
  return `ours-${engineId}`;
}

/** A feed row's market from the indexer id (`ours-0`, `perpl-16`); `symbol` is what the fill itself called it. */
export function marketOfId(chainId: ChainId, marketId: string | null, symbol?: string): MarketRef | undefined {
  const match = marketId ? MARKET_ID.exec(marketId) : null;
  if (!match) return symbol ? marketOfSymbol(chainId, symbol) : undefined;
  const id = Number(match[2]);
  if (match[1] === "ours") {
    const meta = engineMarket(id);
    if (!meta) return symbol ? { mark: undefined, symbol, name: undefined, engineId: undefined } : undefined;
    return { mark: ids.engineMarket(chainId, id), symbol: meta.symbol, name: meta.name, engineId: id };
  }
  const listed = Object.entries(PERPL_MARKETS[chainId] ?? {}).find(([, perplId]) => perplId === id)?.[0];
  const ticker = symbol ?? listed;
  if (!ticker) return undefined;
  const mark = ids.perplMarket(chainId, id);
  return { mark, symbol: ticker, name: entity(mark)?.name, engineId: undefined };
}

/** A board row's market from its bare symbol ("XAU", "BTC"): our engine first, then Perpl on this network. */
export function marketOfSymbol(chainId: ChainId, symbol: string): MarketRef {
  const meta = engineMarket(symbol);
  if (meta)
    return { mark: ids.engineMarket(chainId, meta.id), symbol: meta.symbol, name: meta.name, engineId: meta.id };
  const mark = perplMarketId(chainId, symbol);
  return { mark, symbol, name: mark ? entity(mark)?.name : undefined, engineId: undefined };
}

/** What a fill did, as the feed says it (direction §9: fills, position changes and theses stay distinct). */
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

export const SIDE_WORD: Record<FeedTrade["side"], string> = { LONG: "Long", SHORT: "Short" };

const SECONDS_PER_MINUTE = 60;

/** Copy per API error code for a social write (one short line, F4/F3 states); `fallback` when the code says nothing. */
export function socialErrorCopy(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  switch (error.code) {
    case "NOT_LISTED":
      return "Make your profile public to post";
    case "CONTENT_BLOCKED":
      return "That text can’t be posted";
    case "RATE_LIMITED": {
      const minutes = error.retryAfterSec ? Math.ceil(error.retryAfterSec / SECONDS_PER_MINUTE) : undefined;
      return minutes ? `Posting limit · try in ${minutes} min` : "Posting limit · try again soon";
    }
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

const HTTP_NOT_FOUND = 404;
const HTTP_UNAVAILABLE = 503;

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === HTTP_NOT_FOUND;
}

export function isNotListed(error: unknown): boolean {
  return error instanceof ApiError && error.code === "NOT_LISTED";
}

/** The board answers 503 until its first snapshot of a network exists. */
export function isNotComputed(error: unknown): boolean {
  return error instanceof ApiError && error.status === HTTP_UNAVAILABLE;
}

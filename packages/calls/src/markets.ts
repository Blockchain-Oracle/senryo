/**
 * Markets as rows (S7.3, D-289): the catalogue in its kind groups with a search, and each row's second line — the
 * 1-minute window's countdown while the market trades, its session in words while it doesn't ("Opens Mon 09:30 ET").
 * Both apps draw these; neither decides them.
 */
import { CADENCES_SEC, CALENDARS, LOCKOUT_SEC, MARKETS, type MarketKind, type MarketSpec } from "@senryo/config";
import {
  BASKET_BASE_POINTS_E8,
  basketPointsE8,
  clockText,
  formatPrice,
  laneLabel,
  type PriceUnit,
  type SessionNow,
  scheduleOf,
  sessionNow,
  windowCountdown,
} from "@senryo/core";

export const MARKET_GROUPS: readonly { kind: MarketKind; label: string }[] = [
  { kind: "crypto", label: "Crypto" },
  { kind: "equity", label: "Stocks" },
  { kind: "metal", label: "Metals" },
  { kind: "fx", label: "Currencies" },
  { kind: "basket", label: "Baskets" },
];

/** The Markets filter: every kind, or one. */
export const MARKET_FILTERS = [
  { value: "all", label: "All" },
  ...MARKET_GROUPS.map((g) => ({ value: g.kind, label: g.label })),
] as const;
export type MarketFilter = "all" | MarketKind;

const FIRST_CADENCE = CADENCES_SEC[0];
/** A basket starts at this many points; one point × 1e8 is the base over it. */
const BASKET_START_POINTS = 1000n;
const BASKET_ONE_E8 = BASKET_BASE_POINTS_E8 / BASKET_START_POINTS;

export function marketOf(symbol: string): MarketSpec | undefined {
  return MARKETS.find((m) => m.symbol === symbol);
}

/** The groups (one, under a filter) with at least one market matching `query` (symbol or name), in catalogue order. */
export function groupMarkets<T extends { symbol: string; name: string; kind: string }>(
  markets: readonly T[],
  query = "",
  filter: MarketFilter = "all",
): { label: string; markets: T[] }[] {
  const q = query.trim().toLowerCase();
  const hit = (m: T) => !q || m.symbol.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
  return MARKET_GROUPS.filter((g) => filter === "all" || g.kind === filter)
    .map((g) => ({ label: g.label, markets: markets.filter((m) => m.kind === g.kind && hit(m)) }))
    .filter((g) => g.markets.length > 0);
}

/** What a market's value reads in: points for a basket (D-286), dollars otherwise. */
export function unitOf(symbol: string): PriceUnit {
  return marketOf(symbol)?.kind === "basket" ? "points" : "usd";
}

/** A market's session now; always-open markets (crypto) have no words. */
export function marketSession(symbol: string, nowSec: number): SessionNow {
  const m = marketOf(symbol);
  return sessionNow(scheduleOf(CALENDARS[m?.calendarId ?? 0].schedule), nowSec);
}

export interface MarketLine {
  /** False while the market is closed or paused: no calls, the price is the last print. */
  trading: boolean;
  text: string;
  /** No price source at all (D-310): read-only until it returns, unlike a session that opens on its own. */
  paused: boolean;
}

/**
 * "1m closes in 0:42" while trading (with "· Closes 16:00 ET" near a session's end), else the session words — or the
 * api's reason when the market is paused (`catalog.markets[].paused`).
 */
export function marketLine(session: SessionNow, nowSec: number, pausedText: string | null = null): MarketLine {
  if (pausedText) return { trading: false, text: pausedText, paused: true };
  if (!session.open) return { trading: false, text: session.text ?? "Closed", paused: false };
  const w = windowCountdown(nowSec, FIRST_CADENCE, LOCKOUT_SEC);
  const lane = `${laneLabel(FIRST_CADENCE)} ${w.open ? `closes in ${clockText(w.closesIn)}` : `calls reopen in ${clockText(w.endsIn)}`}`;
  return { trading: true, text: session.text ? `${lane} · ${session.text}` : lane, paused: false };
}

/** The panel a market shows when it takes no calls: closed for its session, or paused without a price source. */
export function closedWords(symbol: string, line: MarketLine): { title: string; note: string } {
  return line.paused
    ? { title: `${symbol} is paused`, note: "Its price feed is offline. Calls come back when it returns." }
    : { title: `${symbol} is closed`, note: "The price shown is its last print. Calls open with the market." };
}

/** A basket's members in definition order: symbol, name, weight and base (empty for a single market). */
export function basketOf(symbol: string): { symbol: string; name: string; weightBps: number; baseE8: bigint }[] {
  const m = marketOf(symbol);
  if (m?.source.kind !== "basket") return [];
  return m.source.members.map((x) => ({ ...x, name: marketOf(x.symbol)?.name ?? x.symbol }));
}

const PERCENT = 100;
const PCT_DECIMALS = 2;
const BPS_PER_PERCENT = 100;

/**
 * One member's line on the basket screen: its weight, its move since the basket was 1,000 points, and what it adds to
 * the basket now (`BasketPrintVerifier`'s per-member term, floored the same way).
 */
export function memberLine(
  member: { weightBps: number; baseE8: bigint },
  priceE8: number | undefined,
): { weight: string; move: string | null; tone: "up" | "down" | "muted"; points: string | null } {
  const weight = `${member.weightBps / BPS_PER_PERCENT}%`;
  if (priceE8 === undefined) return { weight, move: null, tone: "muted", points: null };
  const value = BigInt(Math.round(priceE8));
  const ratio = Number(value) / Number(member.baseE8) - 1;
  const term = basketPointsE8([{ weightBps: member.weightBps, baseE8: member.baseE8, valueE8: value }]) ?? 0n;
  return {
    weight,
    move: `${ratio >= 0 ? "+" : "−"}${Math.abs(ratio * PERCENT).toFixed(PCT_DECIMALS)}%`,
    tone: ratio > 0 ? "up" : ratio < 0 ? "down" : "muted",
    points: formatPrice(Number(term) / Number(BASKET_ONE_E8), PCT_DECIMALS, "points"),
  };
}

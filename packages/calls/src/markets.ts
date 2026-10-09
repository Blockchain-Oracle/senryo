/**
 * Markets as rows (S7.3, D-289): the catalogue in its kind groups with a search, and each row's second line — the
 * 1-minute window's countdown while the market trades, its session in words while it doesn't ("Opens Mon 09:30 ET").
 * Both apps draw these; neither decides them.
 */
import { CADENCES_SEC, CALENDARS, LOCKOUT_SEC, MARKETS, type MarketKind, type MarketSpec } from "@senryo/config";
import { clockText, laneLabel, type SessionNow, scheduleOf, sessionNow, windowCountdown } from "@senryo/core";

export const MARKET_GROUPS: readonly { kind: MarketKind; label: string }[] = [
  { kind: "crypto", label: "Crypto" },
  { kind: "equity", label: "Stocks" },
  { kind: "metal", label: "Metals" },
  { kind: "fx", label: "Currencies" },
];

/** The Markets filter: every kind, or one. */
export const MARKET_FILTERS = [
  { value: "all", label: "All" },
  ...MARKET_GROUPS.map((g) => ({ value: g.kind, label: g.label })),
] as const;
export type MarketFilter = "all" | MarketKind;

const FIRST_CADENCE = CADENCES_SEC[0];

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

/** A market's session now; always-open markets (crypto) have no words. */
export function marketSession(symbol: string, nowSec: number): SessionNow {
  const m = marketOf(symbol);
  return sessionNow(scheduleOf(CALENDARS[m?.calendarId ?? 0].schedule), nowSec);
}

export interface MarketLine {
  /** False while the market is closed: no calls, the price is the last print. */
  trading: boolean;
  text: string;
}

/** "1m closes in 0:42" while trading (with "· Closes 16:00 ET" near a session's end), else the session words. */
export function marketLine(session: SessionNow, nowSec: number): MarketLine {
  if (!session.open) return { trading: false, text: session.text ?? "Closed" };
  const w = windowCountdown(nowSec, FIRST_CADENCE, LOCKOUT_SEC);
  const lane = `${laneLabel(FIRST_CADENCE)} ${w.open ? `closes in ${clockText(w.closesIn)}` : `calls reopen in ${clockText(w.endsIn)}`}`;
  return { trading: true, text: session.text ? `${lane} · ${session.text}` : lane };
}

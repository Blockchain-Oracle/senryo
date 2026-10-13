/**
 * Search's entries and results (R6, D-336): the shared entries (every market with its hidden Up, Down, Ride and lanes,
 * the games, help) with what's live — your open positions (earliest ending first), the event board, a pasted id's
 * lookup — and what the app gives (its places and actions). The index is rebuilt only when that set changes; rows read
 * their own prices and values. Nothing typed: Recent, your positions, Hot · 24 h, Go to.
 */
import type { LookupHit } from "@senryo/api-client";
import { type ChainId, GAMES, helpOn, MARKETS } from "@senryo/config";
import { laneLabel } from "@senryo/core";
import { useEventBoard, useLookup, useQueryEnv } from "@senryo/query";
import {
  createIndex,
  emptySections,
  gameEntries,
  helpEntries,
  marketEntries,
  marketEntryId,
  type PastedId,
  type PlaceLike,
  pastedId,
  placeEntries,
  rank,
  recentIds,
  recordVisit,
  type SearchEntry,
  type SearchSection,
  shortHash,
} from "@senryo/search";
import { useVisitsVersion } from "@senryo/search/react";
import { useEffect, useMemo, useState } from "react";
import type { BookEntry } from "./book.ts";
import { positionIntent } from "./position-live.ts";
import { useBookPositions } from "./use-live-book.ts";
import { useHotSymbols } from "./use-market-picker.ts";

/** A complete id waits this long before the lookup asks (the local results answer at once). */
export const LOOKUP_DEBOUNCE_MS = 180;
const RECENTS_READ = 12;
const BPS = 10_000;

const MARKET_ENTRIES: readonly SearchEntry[] = MARKETS.flatMap(marketEntries);
const GAME_ENTRIES: readonly SearchEntry[] = gameEntries(GAMES);
const HELP_ENTRIES = { web: helpEntries(helpOn("web")), phone: helpEntries(helpOn("phone")) } as const;

/** A position's id carries its network, so a Practice position is never a Real recent (D-337). */
export const positionEntryId = (chainId: ChainId, key: string): string => `position:${chainId}:${key}`;

function positionEntry(chainId: ChainId, e: BookEntry): SearchEntry {
  const market = MARKETS.find((m) => m.symbol === e.symbol);
  const kind = e.ride
    ? `Ride · ${(e.ride.leverageBps / BPS).toFixed(0)}×`
    : `Call${e.call ? ` · ${laneLabel(e.call.cadenceSec)}` : ""}`;
  return {
    id: positionEntryId(chainId, e.key),
    group: "positions",
    title: `${e.symbol} ${e.label}`,
    subtitle: kind,
    keywords: [e.symbol, market?.name ?? "", e.kind, "position", "open", "cash out", "close"],
    target: { kind: "terminal", intent: positionIntent(e) },
  };
}

interface EventLike {
  eventId: string;
  league: string;
  question: string;
  home: { name: string; abbr: string };
  away: { name: string; abbr: string };
}

function eventEntry(e: EventLike): SearchEntry {
  return {
    id: `event:${e.eventId.toLowerCase()}`,
    group: "events",
    title: e.question,
    subtitle: `${e.away.name} @ ${e.home.name} · ${e.league}`,
    keywords: [e.home.name, e.away.name, e.home.abbr, e.away.abbr, e.league, "event", "yes", "no"],
    target: { kind: "event", eventId: e.eventId },
  };
}

function receiptEntry(chainId: ChainId, h: LookupHit): SearchEntry {
  const market = h.symbol ? ` · ${h.symbol}` : "";
  const base = { group: "receipts", ...(h.symbol ? { symbol: h.symbol } : {}) } as const;
  switch (h.kind) {
    case "call":
    case "ride":
      return {
        ...base,
        id: `receipt:${chainId}:${h.kind}:${h.id}`,
        title: `${h.kind === "call" ? "Call" : "Ride"} #${h.id}${market}`,
        subtitle: "Open receipt",
        target: { kind: "receipt", of: h.kind, id: h.id },
      };
    case "window":
      return {
        ...base,
        id: `receipt:${chainId}:window:${h.id}`,
        title: `Window ${shortHash(h.id)}${market}`,
        subtitle: "Its opening and closing prints",
        target: { kind: "window", windowId: h.id },
      };
    case "event":
      return {
        ...base,
        id: `receipt:${chainId}:event:${h.ref ?? h.id}`,
        title: h.ref ? `Event call #${h.ref}` : "Event",
        subtitle: "Open the event",
        target: { kind: "event", eventId: h.id },
      };
    case "parlay":
      return {
        ...base,
        id: `receipt:${chainId}:parlay:${h.id}`,
        title: `Parlay #${h.id}`,
        subtitle: "Your parlays",
        target: { kind: "place", key: "parlay" },
      };
    case "duel":
      return {
        ...base,
        id: `receipt:${chainId}:duel:${h.id}`,
        title: `Duel ${shortHash(h.id)}`,
        subtitle: "Duel",
        target: { kind: "place", key: "duel" },
      };
  }
}

export type LookupState =
  | { state: "idle" }
  | { state: "looking"; id: PastedId }
  | { state: "found"; id: PastedId }
  | { state: "none"; id: PastedId }
  | { state: "failed"; id: PastedId };

export interface SearchInput {
  query: string;
  app: "web" | "phone";
  /** Read the event board only while search is open. */
  open: boolean;
  places: readonly PlaceLike[];
  /** The app's actions (`actionEntries` with its own state). */
  actions: readonly SearchEntry[];
  /** Go to's places, in their key order (the empty view). */
  goTo: readonly string[];
  favourites?: readonly string[];
}

export interface SearchView {
  sections: SearchSection[];
  lookup: LookupState;
  /** Nothing typed. */
  empty: boolean;
}

const FAVOURITE_BOOST = 1.15;

function useDebounced(value: string | null, ms: number): string | null {
  const [held, setHeld] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setHeld(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return value === null ? null : held;
}

export function useSearch(o: SearchInput): SearchView {
  const { chainId } = useQueryEnv();
  const positions = useBookPositions();
  const board = useEventBoard(o.open);
  const events = "value" in board ? board.value.events : undefined;
  const pasted = useMemo(() => pastedId(o.query), [o.query]);
  const lookupKey = useDebounced(pasted?.value ?? null, LOOKUP_DEBOUNCE_MS);
  const lookup = useLookup(pasted && lookupKey === pasted.value ? lookupKey : null);
  // Hot holds still while search is open (Codex direction 13): a minute's refresh never reshuffles it under the pointer.
  const liveHot = useHotSymbols(MARKETS);
  const [hot, setHot] = useState<string[]>(liveHot);
  useEffect(() => {
    if (!o.open || hot.length === 0) setHot(liveHot);
  }, [o.open, liveHot, hot.length]);
  const visits = useVisitsVersion();
  // The visits' version is the trigger (frecency moves too).
  const recents = useMemo(() => recentIds(RECENTS_READ), [visits]);

  const positionEntries = useMemo(
    () =>
      [...positions]
        .sort((a, b) => (a.endsAt ?? Number.POSITIVE_INFINITY) - (b.endsAt ?? Number.POSITIVE_INFINITY))
        .map((e) => positionEntry(chainId, e)),
    [positions, chainId],
  );
  const eventEntries = useMemo(() => (events ?? []).map(eventEntry), [events]);
  const placeList = useMemo(() => placeEntries(o.places), [o.places]);
  const receipts = useMemo(() => {
    if (!pasted || !("value" in lookup)) return [];
    // A folio names its kind (`N° C-…` is a call): only that kind's row.
    const want = pasted.kind === "number" ? pasted.of : undefined;
    const hits = lookup.value.filter((h) => want === undefined || h.kind === want);
    if (hits.length > 0) return hits.map((h) => receiptEntry(chainId, h));
    return pasted.kind === "hash"
      ? [
          {
            id: `explorer:${pasted.value}`,
            group: "receipts",
            title: "No Senryo receipt found",
            subtitle: "View transaction on explorer",
            target: { kind: "explorer", hash: pasted.value },
          } satisfies SearchEntry,
        ]
      : [];
  }, [pasted, lookup, chainId]);

  const index = useMemo(
    () =>
      createIndex([
        ...receipts,
        ...positionEntries,
        ...MARKET_ENTRIES,
        ...eventEntries,
        ...GAME_ENTRIES,
        ...placeList,
        ...o.actions,
        ...HELP_ENTRIES[o.app],
      ]),
    [receipts, positionEntries, eventEntries, placeList, o.actions, o.app],
  );

  const favourites = o.favourites;
  const sections = useMemo(() => {
    if (!o.query.trim()) {
      return emptySections(index, {
        recents,
        positions: positionEntries,
        hot: hot.map((s) => index.byId.get(marketEntryId(s))).filter((e): e is SearchEntry => e !== undefined),
        places: o.goTo.map((k) => index.byId.get(`place:${k}`)).filter((e): e is SearchEntry => e !== undefined),
      });
    }
    const favs = new Set(favourites ?? []);
    const ranked = rank(index, o.query, {
      boost: (e) => (e.group === "markets" && e.symbol && favs.has(e.symbol) ? FAVOURITE_BOOST : 1),
    });
    // A pasted id's receipts lead whatever the words matched.
    return receipts.length > 0
      ? [
          { key: "receipts", label: "Receipts", hits: receipts.map((entry) => ({ entry, score: 0 })) },
          ...ranked
            .filter((s) => s.key !== "receipts")
            .map((s) => ({
              ...s,
              hits: s.hits.filter((h) => h.entry.group !== "receipts"),
            }))
            .filter((s) => s.hits.length > 0),
        ]
      : ranked;
  }, [index, o.query, o.goTo, positionEntries, hot, favourites, receipts, recents]);

  const lookupState: LookupState = !pasted
    ? { state: "idle" }
    : lookup.status === "failed"
      ? { state: "failed", id: pasted }
      : "value" in lookup && lookupKey === pasted.value
        ? { state: receipts.length > 0 && receipts[0]?.target.kind !== "explorer" ? "found" : "none", id: pasted }
        : { state: "looking", id: pasted };

  return { sections, lookup: lookupState, empty: !o.query.trim() };
}

/** The terminal opened a market: a visit (search's Recents, the picker's recent markets). */
export function useMarketVisit(symbol: string | undefined): void {
  useEffect(() => {
    if (symbol) recordVisit(marketEntryId(symbol));
  }, [symbol]);
}

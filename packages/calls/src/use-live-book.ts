/**
 * The live book on both apps (R5.1): every open call and ride the caller holds, valued with `book.ts` from the live
 * prices at most `BOOK_HZ` times a second and once a second for time (a call's value decays, its lockout starts),
 * replacing the snapshot only when a figure moved — so a list re-renders on change, never per frame. Calls in any
 * market or lane are here, not only the window on screen; parlays ride along read-only. One source per app
 * (`LiveBookProvider` at the shell); every surface reads it with `useLiveBook`.
 */
import type { Address } from "@senryo/account";
import { printRoute, type TicketView } from "@senryo/api-client";
import { type CadenceSec, quoteCurve, RIDE_TERMS } from "@senryo/config";
import { bandName } from "@senryo/core";
import { useLive } from "@senryo/live/react";
import {
  useCatalog,
  useMarketAccount,
  useParlays,
  useQueryEnv,
  useRideCatalog,
  useRides,
  useTickets,
} from "@senryo/query";
import { useQueries } from "@tanstack/react-query";
import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { type BookEntry, type BookTotals, bookTotals, valueCall } from "./book.ts";
import { valueRide } from "./book-ride.ts";
import type { PoolTerms } from "./quote.ts";
import { fillMark } from "./sigma.ts";
import { useReplayRecorder } from "./use-replay.ts";

/** Tradash's store commits at most every 200 ms per symbol. */
export const BOOK_HZ = 5;
const SECOND_MS = 1_000;
const BOOK_MS = SECOND_MS / BOOK_HZ;
const OPEN_CALL = new Set(["committed", "open", "closing"]);
const OPEN_RIDE = new Set(["committed", "open", "closing"]);
const OPEN_PARLAY = new Set(["committed", "open"]);
const PRINT_RETRY_MS = 1_000;
const PRINT_RETRIES = 10;

export interface LiveBook {
  /** Open positions, newest first. */
  entries: readonly BookEntry[];
  totals: BookTotals;
  /** Open parlays: shown, not valued (no live executable price). */
  parlays: number;
  /** Tickets and rides have loaded (an empty book means empty, not loading). */
  ready: boolean;
}

const EMPTY: LiveBook = {
  entries: [],
  totals: bookTotals([], undefined),
  parlays: 0,
  ready: false,
};

class BookStore {
  private snapshot: LiveBook = EMPTY;
  private readonly listeners = new Set<() => void>();
  get = (): LiveBook => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  set(next: LiveBook): void {
    if (sameBook(this.snapshot, next)) return;
    this.snapshot = next;
    for (const l of this.listeners) l();
  }
}

const sameEntry = (a: BookEntry, b: BookEntry): boolean =>
  a.key === b.key &&
  a.state === b.state &&
  a.pnl === b.pnl &&
  a.closeValue === b.closeValue &&
  a.worth === b.worth &&
  a.fees === b.fees &&
  a.cost === b.cost &&
  a.markE8 === b.markE8 &&
  a.ride?.exit?.trailStopE8 === b.ride?.exit?.trailStopE8 &&
  a.ride?.exit?.trailBps === b.ride?.exit?.trailBps &&
  a.call?.exit?.trailStopE6 === b.call?.exit?.trailStopE6 &&
  a.call?.exit?.trailE6 === b.call?.exit?.trailE6;

function sameBook(a: LiveBook, b: LiveBook): boolean {
  if (a.ready !== b.ready || a.parlays !== b.parlays || a.entries.length !== b.entries.length) return false;
  if (a.totals.equity !== b.totals.equity) return false;
  return a.entries.every((e, i) => {
    const other = b.entries[i];
    return other !== undefined && sameEntry(e, other);
  });
}

const Ctx = createContext<BookStore | null>(null);

/**
 * Values the caller's book, records it for replays (R5.19) and serves it to every surface below (mount once, at the
 * app's shell).
 */
export function LiveBookProvider({ owner, children }: { owner: Address | undefined; children: ReactNode }) {
  const store = useMemo(() => new BookStore(), []);
  useBookSource(store, owner);
  useReplayRecorder(store.get, useQueryEnv().chainId);
  return createElement(Ctx.Provider, { value: store }, children);
}

/** The caller's live book (empty for a guest). */
export function useLiveBook(): LiveBook {
  const store = useContext(Ctx);
  if (!store) throw new Error("useLiveBook needs a LiveBookProvider");
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/** What a position is, not what it's worth: changes when one opens, closes or changes state. */
const bookShape = (b: LiveBook): string =>
  `${b.ready}|${b.entries.map((e) => `${e.key}:${e.state}:${e.endsAt ?? ""}`).join(",")}`;

/**
 * The open positions without their moving values (search's rows read those themselves): re-renders when a position
 * opens, closes or changes state, not at the book's 5 Hz.
 */
export function useBookPositions(): readonly BookEntry[] {
  const store = useContext(Ctx);
  if (!store) throw new Error("useBookPositions needs a LiveBookProvider");
  const shape = useSyncExternalStore(
    store.subscribe,
    () => bookShape(store.get()),
    () => bookShape(store.get()),
  );
  // The shape is the trigger; the entries are read at that moment.
  return useMemo(() => store.get().entries, [shape, store]);
}

/** One position from the book by key ("call:12", "ride:3"), or undefined once it has closed. */
export function useBookEntry(key: string | undefined): BookEntry | undefined {
  const book = useLiveBook();
  return key ? book.entries.find((e) => e.key === key) : undefined;
}

/** K for every open call's window, from the api's archive (cached for good; the window's open print never changes). */
function useLines(calls: readonly TicketView[]): Map<string, bigint> {
  const { api } = useQueryEnv();
  const results = useQueries({
    queries: calls.map((c) => ({
      queryKey: ["prices", "print", c.symbol, c.start] as const,
      queryFn: async () => BigInt((await api.call(printRoute, { query: { symbol: c.symbol, t: c.start } })).priceE8),
      staleTime: Number.POSITIVE_INFINITY,
      retry: PRINT_RETRIES,
      retryDelay: PRINT_RETRY_MS,
    })),
  });
  // One string for every line in hand: the memo below changes only when a print arrives.
  const got = results.map((r) => (r.data === undefined ? "" : r.data.toString())).join(",");
  return useMemo(() => {
    const values = got.split(",");
    const lines = new Map<string, bigint>();
    calls.forEach((c, i) => {
      const k = values[i];
      if (k) lines.set(`${c.symbol}:${c.start}`, BigInt(k));
    });
    return lines;
  }, [calls, got]);
}

function useBookSource(store: BookStore, owner: Address | undefined): void {
  const live = useLive();
  const env = useQueryEnv();
  const tickets = useTickets(owner);
  const rides = useRides(owner);
  const parlays = useParlays(owner);
  const catalog = useCatalog();
  const rideCatalog = useRideCatalog();
  const account = useMarketAccount(owner);

  const calls = useMemo(
    () => ("value" in tickets ? tickets.value.tickets.filter((t) => OPEN_CALL.has(t.state)) : []),
    [tickets],
  );
  const openRides = useMemo(
    () => ("value" in rides ? rides.value.rides.filter((r) => OPEN_RIDE.has(r.state)) : []),
    [rides],
  );
  const parlayCount = "value" in parlays ? parlays.value.parlays.filter((p) => OPEN_PARLAY.has(p.state)).length : 0;
  const lines = useLines(calls);
  const cash = "value" in account ? account.value.balance : undefined;
  const ready = !owner || ("value" in tickets && "value" in rides);

  const inputs = useRef({ calls, openRides, lines, cash, ready, parlayCount, catalog, rideCatalog });
  inputs.current = { calls, openRides, lines, cash, ready, parlayCount, catalog, rideCatalog };

  const symbols = useMemo(
    () => [...new Set([...calls.map((c) => c.symbol), ...openRides.map((r) => r.symbol)])].sort().join(","),
    [calls, openRides],
  );

  useEffect(() => {
    let last = 0;
    let queued: ReturnType<typeof setTimeout> | undefined;
    const value = () => {
      last = performance.now();
      queued = undefined;
      const i = inputs.current;
      const nowSec = live.clock.nowSec();
      const markets = "value" in i.catalog ? i.catalog.value.markets : [];
      const terms = "value" in i.catalog ? (i.catalog.value.terms as PoolTerms) : undefined;
      const fees = "value" in i.rideCatalog ? i.rideCatalog.value.markets : [];
      const spot = (symbol: string): bigint | undefined => {
        const tick = live.prices.latest(symbol);
        return tick && !live.prices.isStale(symbol) ? BigInt(Math.round(tick.priceE8)) : undefined;
      };
      const callEntries = i.calls.map((c) => {
        const series = markets.find((m) => m.symbol === c.symbol)?.series.find((s) => s.cadenceSec === c.cadenceSec);
        const band = series?.bands[c.band];
        return valueCall(
          c,
          {
            band,
            lineE8: i.lines.get(`${c.symbol}:${c.start}`),
            mark: series ? fillMark(live.sigma, c.symbol, series, nowSec) : undefined,
            spotE8: spot(c.symbol),
            terms: terms && quoteCurve(terms, c.cadenceSec as CadenceSec),
          },
          nowSec,
          band ? bandName(band.kind) : "Call",
        );
      });
      const rideEntries = i.openRides.map((r) =>
        valueRide(
          r,
          spot(r.symbol),
          fees.find((m) => m.symbol === r.symbol)?.takerFeeBps,
          RIDE_TERMS[env.chainId],
          nowSec,
        ),
      );
      const entries = [...rideEntries, ...callEntries].sort((a, b) => ((b.endsAt ?? 0) > (a.endsAt ?? 0) ? 1 : -1));
      store.set({ entries, totals: bookTotals(entries, i.cash), parlays: i.parlayCount, ready: i.ready });
    };
    // Leading edge, then at most one more per BOOK_MS.
    const schedule = () => {
      if (queued) return;
      const wait = BOOK_MS - (performance.now() - last);
      if (wait <= 0) value();
      else queued = setTimeout(value, wait);
    };
    value();
    const offs = symbols ? symbols.split(",").map((s) => live.prices.subscribe(s, schedule)) : [];
    // While anything is held the book keeps the price stream open itself: the screen in front may show no price at
    // all (a receipt, Calls) while the tabs that do rest behind their Activity (D-332).
    const release = symbols ? live.stream.acquire() : undefined;
    const timer = setInterval(schedule, SECOND_MS);
    return () => {
      release?.();
      for (const off of offs) off();
      clearInterval(timer);
      if (queued) clearTimeout(queued);
    };
    // A change in what's held re-subscribes; prices and the clock re-value through `schedule`.
  }, [live, store, symbols, env.chainId, calls, openRides, lines, cash, ready, parlayCount]);
}

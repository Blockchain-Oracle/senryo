// The app's live layer, created once: one stream, the server clock, prices, boundary prints and the user's events.
// The stream's topics follow the signed-in address (`setUser`); `/v1/prices/latest` (about 1 KB) reseeds every market
// and its state on each (re)connect, and a terminal loads its own market's recent history (`loadHistory`) so its line
// opens on real movement (04-pricing R15).
import { ServerClock } from "./clock.ts";
import { PriceBook } from "./prices.ts";
import { PrintBook } from "./prints.ts";
import { LiveStream, type StreamStatus } from "./sse.ts";

/** The user's durable events on `user:<address>` (fills, results, payouts, sessions, dollars). */
export type UserEvent =
  | "ticket"
  | "intent"
  | "session"
  | "dollars"
  | "earn"
  | "parlay"
  | "duel"
  | "duelQueue"
  | "duelPick"
  | "eventCall";
const USER_EVENTS = new Set<string>([
  "ticket",
  "intent",
  "session",
  "dollars",
  "earn",
  "parlay",
  "duel",
  "duelQueue",
  "duelPick",
  "eventCall",
]);
/** Public market activity on `markets`: a yes/no question listed, called, answered or settled (D-296). */
export type MarketEvent = "event";
const MARKET_EVENTS = new Set<string>(["event"]);
const PUBLIC_TOPICS = ["prices", "prints", "markets"] as const;

export interface RecentPrices {
  serverTime: number;
  feeds: readonly { symbol: string; points: readonly (readonly [number, number])[] }[];
}

export interface LatestPrices {
  serverTime: number;
  states: string;
  points: readonly (readonly [number, number, number])[];
}

/** A market whose ring already spans this much needs no history fetch (a chart shows ~10 s). */
const HISTORY_SPAN_MS = 15_000;

export interface LiveOptions {
  origin: string;
  fetch: typeof globalThis.fetch;
  /** `/v1/prices/recent` for these symbols. */
  recent: (symbols: readonly string[]) => Promise<RecentPrices>;
  /** `/v1/prices/latest`: every market's newest price and state. */
  latest: () => Promise<LatestPrices>;
  /** A stream ticket for the signed-in user (`POST /v1/stream/ticket`). */
  ticket: () => Promise<string | undefined>;
}

type Listener<T> = (data: T) => void;

export class Live {
  readonly clock = new ServerClock();
  readonly prices = new PriceBook();
  readonly prints = new PrintBook();
  readonly stream: LiveStream;
  private user: string | null = null;
  private status: StreamStatus = "idle";
  private readonly statusListeners = new Set<() => void>();
  private readonly userListeners = new Map<string, Set<Listener<unknown>>>();
  private readonly marketListeners = new Map<string, Set<Listener<unknown>>>();
  private readonly resetListeners = new Set<() => void>();

  constructor(private readonly o: LiveOptions) {
    this.stream = new LiveStream({
      origin: o.origin,
      fetch: o.fetch,
      topics: () => (this.user ? [...PUBLIC_TOPICS, `user:${this.user}`] : [...PUBLIC_TOPICS]),
      ticket: o.ticket,
      onEvent: (event, data) => this.onEvent(event, data),
      onStatus: (status) => this.onStatus(status),
    });
  }

  /** The signed-in address (lower-case) or null; the stream reconnects with or without its `user:` topic. */
  setUser(address: string | null): void {
    const next = address?.toLowerCase() ?? null;
    if (next === this.user) return;
    this.user = next;
    this.stream.restart();
  }

  get streamStatus(): StreamStatus {
    return this.status;
  }

  onStreamStatus(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** The user's durable events (the query layer invalidates on them). */
  onUser<T = unknown>(event: UserEvent, listener: Listener<T>): () => void {
    const set = this.userListeners.get(event) ?? new Set();
    set.add(listener as Listener<unknown>);
    this.userListeners.set(event, set);
    return () => set.delete(listener as Listener<unknown>);
  }

  /** Public market activity (the query layer invalidates the board on it). */
  onMarket<T = unknown>(event: MarketEvent, listener: Listener<T>): () => void {
    const set = this.marketListeners.get(event) ?? new Set();
    set.add(listener as Listener<unknown>);
    this.marketListeners.set(event, set);
    return () => set.delete(listener as Listener<unknown>);
  }

  /**
   * The api couldn't replay what this client missed (it restarted, or the gap outran its ring, 04-pricing R10): every
   * query the stream keeps true must be refetched.
   */
  onReset(listener: () => void): () => void {
    this.resetListeners.add(listener);
    return () => this.resetListeners.delete(listener);
  }

  /**
   * Every market's newest price and state, after a (re)connect: `/v1/prices/latest`, or — from an api before it —
   * `/v1/prices/recent` for every symbol.
   */
  async reseed(): Promise<void> {
    let latest: LatestPrices;
    try {
      latest = await this.o.latest();
    } catch {
      return this.seedRecent(this.prices.symbols);
    }
    const now = Date.now();
    this.clock.sample(latest.serverTime);
    this.prices.setStates(latest.states, now);
    for (const [i, priceE8, publishMs] of latest.points) {
      this.prices.push(i, priceE8, publishMs, now - Math.max(0, latest.serverTime - publishMs));
    }
  }

  /** A terminal's market: its recent points, unless the ring already holds a chart's worth. */
  async loadHistory(symbol: string): Promise<void> {
    const h = this.prices.history(symbol);
    const first = h.t[0];
    const last = h.t[h.t.length - 1];
    if (first !== undefined && last !== undefined && last - first >= HISTORY_SPAN_MS) return;
    await this.seedRecent([symbol]);
  }

  private async seedRecent(symbols: readonly string[]): Promise<void> {
    const recent = await this.o.recent(symbols);
    const now = Date.now();
    for (const f of recent.feeds) this.prices.seed(f.symbol, f.points, now, recent.serverTime);
  }

  private onStatus(status: StreamStatus): void {
    this.status = status;
    if (status === "live") void this.reseed().catch(() => {});
    for (const l of this.statusListeners) l();
  }

  private onEvent(event: string, data: unknown): void {
    // A flush of ticks (04-pricing R13): `[[catalogue index, priceE8, publish ms], …]`.
    if (event === "pp" && Array.isArray(data)) {
      const receivedMs = Date.now();
      for (const t of data as [number, number, number][]) this.prices.push(t[0], t[1], t[2], receivedMs);
      return;
    }
    if (event === "p" && Array.isArray(data)) {
      const [i, priceE8, publishMs] = data as [number, number, number];
      this.prices.push(i, priceE8, publishMs);
      return;
    }
    if (event === "time" && data && typeof data === "object") {
      const beat = data as { t: number; h?: unknown };
      this.clock.sample(beat.t);
      if (typeof beat.h === "string") this.prices.setStates(beat.h);
      return;
    }
    // The price states (04-pricing R6): sent on every change, repeated in each beat.
    if (event === "h" && data && typeof data === "object") {
      const s = (data as { s?: unknown }).s;
      if (typeof s === "string") this.prices.setStates(s);
      return;
    }
    if (event === "print" && data && typeof data === "object") {
      const p = data as { symbol: string; t: number; priceE8: string; publishTime: number };
      this.prints.add({ symbol: p.symbol, t: p.t, priceE8: BigInt(p.priceE8), publishTime: p.publishTime });
      return;
    }
    if (event === "reset") {
      for (const l of this.resetListeners) l();
      void this.reseed().catch(() => {});
      return;
    }
    if (USER_EVENTS.has(event)) for (const l of this.userListeners.get(event) ?? []) l(data);
    if (MARKET_EVENTS.has(event)) for (const l of this.marketListeners.get(event) ?? []) l(data);
  }
}

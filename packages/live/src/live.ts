// The app's live layer, created once: one stream, the server clock, prices, boundary prints and the user's events.
// The stream's topics follow the signed-in address (`setUser`); `/v1/prices/recent` reseeds on every (re)connect so a
// chart never starts empty or jumps after a gap.
import { ServerClock } from "./clock.ts";
import { PriceBook } from "./prices.ts";
import { PrintBook } from "./prints.ts";
import { LiveStream, type StreamStatus } from "./sse.ts";

/** The user's durable events on `user:<address>` (fills, results, payouts, sessions, dollars). */
export type UserEvent = "ticket" | "intent" | "session" | "dollars";
const USER_EVENTS = new Set<string>(["ticket", "intent", "session", "dollars"]);
const PUBLIC_TOPICS = ["prices", "prints"] as const;

export interface RecentPrices {
  serverTime: number;
  feeds: readonly { symbol: string; points: readonly (readonly [number, number])[] }[];
}

export interface LiveOptions {
  origin: string;
  fetch: typeof globalThis.fetch;
  /** `/v1/prices/recent` for these symbols. */
  recent: (symbols: readonly string[]) => Promise<RecentPrices>;
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

  /** Reseed prices (and the clock) from `/v1/prices/recent`. */
  async reseed(symbols: readonly string[] = this.prices.symbols): Promise<void> {
    const recent = await this.o.recent(symbols);
    this.clock.sample(recent.serverTime);
    for (const f of recent.feeds) this.prices.seed(f.symbol, f.points);
  }

  private onStatus(status: StreamStatus): void {
    this.status = status;
    if (status === "live") void this.reseed().catch(() => {});
    for (const l of this.statusListeners) l();
  }

  private onEvent(event: string, data: unknown): void {
    if (event === "p" && Array.isArray(data)) {
      const [i, priceE8, publishMs] = data as [number, number, number];
      this.prices.push(i, priceE8, publishMs);
      return;
    }
    if (event === "time" && data && typeof data === "object") {
      this.clock.sample((data as { t: number }).t);
      return;
    }
    if (event === "print" && data && typeof data === "object") {
      const p = data as { symbol: string; t: number; priceE8: string; publishTime: number };
      this.prints.add({ symbol: p.symbol, t: p.t, priceE8: BigInt(p.priceE8), publishTime: p.publishTime });
      return;
    }
    if (USER_EVENTS.has(event)) for (const l of this.userListeners.get(event) ?? []) l(data);
  }
}

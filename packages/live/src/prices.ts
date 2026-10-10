// Per-market live prices (D-272 "per-key stores, Float64 rings, a plain subscribe for the chart and odometer"). Ticks
// never enter React state or TanStack: the terminal reads them through `subscribe` into Reanimated shared values;
// lists use `useLivePrice`, which re-renders at most once per frame.
import { FEED_STATES, type FeedState, feedStateOfCode, feedTimingOf, isQuotable, MARKETS } from "@senryo/config";
import { frameScheduler } from "./frame.ts";

/** Recent ticks kept per market (seeded from `/v1/prices/recent`, then the stream). */
export const HISTORY = 512;
/**
 * The server's states (`h`, 04-pricing R6) are trusted this long after the last digest: two 5 s beats and a margin
 * (state changes also arrive at once). Older, or never sent (an older api): judged here from receipt time.
 */
export const STATES_FRESH_MS = 12_000;
/** `state[i]`: 0 while unknown, else 1 + the state's index in `FEED_STATES`. */
const UNKNOWN = 0;

export interface Tick {
  priceE8: number;
  publishMs: number;
  receivedMs: number;
}

type Listener = () => void;

export class PriceBook {
  readonly symbols: readonly string[] = MARKETS.map((m) => m.symbol);
  private readonly index = new Map(this.symbols.map((s, i) => [s, i]));
  private readonly price = new Float64Array(this.symbols.length);
  private readonly publish = new Float64Array(this.symbols.length);
  private readonly received = new Float64Array(this.symbols.length);
  private readonly state = new Uint8Array(this.symbols.length);
  private statesAt = 0;
  private readonly ringT = this.symbols.map(() => new Float64Array(HISTORY));
  private readonly ringP = this.symbols.map(() => new Float64Array(HISTORY));
  private readonly ringStart = new Int32Array(this.symbols.length);
  private readonly ringSize = new Int32Array(this.symbols.length);
  private readonly listeners = this.symbols.map(() => new Set<Listener>());
  private readonly dirty = new Set<number>();
  private readonly schedule = frameScheduler(() => this.flush());

  indexOf(symbol: string): number | undefined {
    return this.index.get(symbol);
  }

  /** A stream tick `[catalogue index, priceE8, publish ms]`. */
  push(i: number, priceE8: number, publishMs: number, receivedMs: number = Date.now()): void {
    if (i < 0 || i >= this.symbols.length || publishMs < (this.publish[i] ?? 0)) return;
    this.price[i] = priceE8;
    this.publish[i] = publishMs;
    this.received[i] = receivedMs;
    this.record(i, publishMs, priceE8);
    this.dirty.add(i);
    this.schedule();
  }

  /** The server's digest: one state letter per catalogue index (changes notify that market's listeners). */
  setStates(digest: string, receivedMs: number = Date.now()): void {
    for (let i = 0; i < this.symbols.length; i += 1) {
      const s = feedStateOfCode(digest[i] ?? "");
      const next = s ? FEED_STATES.indexOf(s) + 1 : UNKNOWN;
      if (next === this.state[i]) continue;
      this.state[i] = next;
      this.dirty.add(i);
    }
    this.statesAt = receivedMs;
    if (this.dirty.size > 0) this.schedule();
  }

  /**
   * A market's state: the server's while its digest is fresh; otherwise judged here from when the newest tick arrived,
   * against the market's own source cadence (a RedStone price ticks every 10 s and is not stale at 5 s).
   */
  stateOf(symbol: string, nowMs: number = Date.now()): FeedState {
    const i = this.index.get(symbol);
    if (i === undefined) return "stale";
    const code = this.state[i] ?? UNKNOWN;
    if (code !== UNKNOWN && nowMs - this.statesAt <= STATES_FRESH_MS) return FEED_STATES[code - 1] ?? "stale";
    const t = this.latest(symbol);
    const market = MARKETS[i];
    if (!t || !market) return "stale";
    const timing = feedTimingOf(market);
    const age = nowMs - t.receivedMs;
    return age <= timing.delayedMs ? "live" : age <= timing.staleMs ? "delayed" : "stale";
  }

  /**
   * Points `[ms, priceE8]` from `/v1/prices/recent`, merged with what the stream already delivered (the connect
   * snapshot usually lands first): history is rebuilt in time order, and a point newer than the latest tick becomes it —
   * aged by how old it already was at the server (`serverMs`), so a stopped feed never looks fresh after a reseed.
   */
  seed(
    symbol: string,
    points: readonly (readonly [number, number])[],
    receivedMs: number = Date.now(),
    serverMs: number = receivedMs,
  ): void {
    const i = this.index.get(symbol);
    if (i === undefined || points.length === 0) return;
    const merged = new Map<number, number>();
    for (const [t, p] of points) merged.set(t, p);
    const have = this.history(symbol);
    for (let k = 0; k < have.t.length; k += 1) merged.set(have.t[k] ?? 0, have.p[k] ?? 0);
    const ordered = [...merged.entries()].sort((a, b) => a[0] - b[0]).slice(-HISTORY);
    this.ringStart[i] = 0;
    this.ringSize[i] = 0;
    for (const [t, p] of ordered) this.record(i, t, p);
    const newest = ordered.at(-1);
    if (newest && newest[0] > (this.publish[i] ?? 0)) {
      this.price[i] = newest[1];
      this.publish[i] = newest[0];
      this.received[i] = receivedMs - Math.max(0, serverMs - newest[0]);
    }
    this.dirty.add(i);
    this.schedule();
  }

  latest(symbol: string): Tick | undefined {
    const i = this.index.get(symbol);
    if (i === undefined || !this.publish[i]) return undefined;
    return { priceE8: this.price[i] ?? 0, publishMs: this.publish[i] ?? 0, receivedMs: this.received[i] ?? 0 };
  }

  /** Not a live settlement price: nothing may be quoted on it (04 §6.3). */
  isStale(symbol: string, nowMs: number = Date.now()): boolean {
    return !isQuotable(this.stateOf(symbol, nowMs));
  }

  /** The last `n` ticks, oldest first, as parallel arrays (a chart seed, a sparkline). */
  history(symbol: string, n: number = HISTORY): { t: Float64Array; p: Float64Array } {
    const i = this.index.get(symbol);
    if (i === undefined) return { t: new Float64Array(0), p: new Float64Array(0) };
    const size = Math.min(n, this.ringSize[i] ?? 0);
    const t = new Float64Array(size);
    const p = new Float64Array(size);
    const start = this.ringStart[i] ?? 0;
    const total = this.ringSize[i] ?? 0;
    for (let k = 0; k < size; k += 1) {
      const at = (start + total - size + k) % HISTORY;
      t[k] = this.ringT[i]?.[at] ?? 0;
      p[k] = this.ringP[i]?.[at] ?? 0;
    }
    return { t, p };
  }

  /** Called at most once per frame after this market ticks. */
  subscribe(symbol: string, listener: Listener): () => void {
    const i = this.index.get(symbol);
    if (i === undefined) return () => {};
    this.listeners[i]?.add(listener);
    return () => this.listeners[i]?.delete(listener);
  }

  private record(i: number, t: number, p: number): void {
    const size = this.ringSize[i] ?? 0;
    const start = this.ringStart[i] ?? 0;
    const at = (start + size) % HISTORY;
    const ringT = this.ringT[i];
    const ringP = this.ringP[i];
    if (!ringT || !ringP) return;
    ringT[at] = t;
    ringP[at] = p;
    if (size < HISTORY) this.ringSize[i] = size + 1;
    else this.ringStart[i] = (start + 1) % HISTORY;
  }

  private flush(): void {
    const changed = [...this.dirty];
    this.dirty.clear();
    for (const i of changed) for (const l of this.listeners[i] ?? []) l();
  }
}

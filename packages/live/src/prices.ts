// Per-market live prices (D-272 "per-key stores, Float64 rings, a plain subscribe for the chart and odometer"). Ticks
// never enter React state or TanStack: the terminal reads them through `subscribe` into Reanimated shared values;
// lists use `useLivePrice`, which re-renders at most once per frame.
import { MARKETS } from "@senryo/config";
import { frameScheduler } from "./frame.ts";

/** Recent ticks kept per market (seeded from `/v1/prices/recent`, then the stream). */
export const HISTORY = 512;
/** A crypto feed prints about once a second; this long without a tick reads as stale. */
export const STALE_MS = 5_000;

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

  /**
   * Points `[ms, priceE8]` from `/v1/prices/recent`, merged with what the stream already delivered (the connect
   * snapshot usually lands first): history is rebuilt in time order, and a point newer than the latest tick becomes it.
   */
  seed(symbol: string, points: readonly (readonly [number, number])[], receivedMs: number = Date.now()): void {
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
      this.received[i] = receivedMs;
    }
    this.dirty.add(i);
    this.schedule();
  }

  latest(symbol: string): Tick | undefined {
    const i = this.index.get(symbol);
    if (i === undefined || !this.publish[i]) return undefined;
    return { priceE8: this.price[i] ?? 0, publishMs: this.publish[i] ?? 0, receivedMs: this.received[i] ?? 0 };
  }

  /** No tick for `STALE_MS` (by local receipt time): the price must not be traded on. */
  isStale(symbol: string, nowMs: number = Date.now()): boolean {
    const t = this.latest(symbol);
    return !t || nowMs - t.receivedMs > STALE_MS;
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

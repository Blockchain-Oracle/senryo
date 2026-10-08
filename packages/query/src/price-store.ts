/**
 * Engine price store (specs/client.md "PriceStore"): socket ticks land in a pending buffer and one animation-frame
 * flush publishes them, so a burst of ticks costs one render. Components read through `usePriceTick`
 * (`useSyncExternalStore`). A tick older than `PRICE_STALE_MS` is shown with its age, never as live.
 */
import type { ChainId } from "@senryo/config";
import type { MarketStatus } from "@senryo/core";
import { FRAME_FALLBACK_MS } from "./constants.ts";

export interface PriceTick {
  chainId: ChainId;
  marketId: number;
  symbol: string;
  price18: bigint;
  latest18: bigint;
  status: MarketStatus;
  /** Oracle round time (unix seconds). */
  updatedAt: bigint;
  spreadBps: bigint;
  /** When this client received it (ms), for "live" vs "stale". */
  receivedAt: number;
  epoch?: number;
  /** Actual observed oracle rounds, bounded independently of historical candles. */
  samples?: readonly { t: number; value: bigint }[];
}

const MS_PER_SECOND = 1000;
const MAX_SAMPLES = 600;
type Listener = () => void;
const keyOf = (chainId: ChainId, symbol: string) => `${chainId}|${symbol}`;
const nextFrame: (run: () => void) => void =
  typeof globalThis.requestAnimationFrame === "function"
    ? (run) => globalThis.requestAnimationFrame(() => run())
    : (run) => setTimeout(run, FRAME_FALLBACK_MS);

export class PriceStore {
  private published = new Map<string, PriceTick>();
  private readonly pending = new Map<string, PriceTick>();
  private readonly listeners = new Set<Listener>();
  private scheduled = false;

  private epoch = 0;
  beginEpoch(): void {
    this.epoch += 1;
  }

  push(tick: PriceTick): void {
    const key = keyOf(tick.chainId, tick.symbol);
    const previous = this.pending.get(key) ?? this.published.get(key);
    if (previous && tick.updatedAt < previous.updatedAt) return;
    // Equal rounds may change market status/spread, but never invent another price sample.
    const sample = { t: Number(tick.updatedAt) * MS_PER_SECOND, value: tick.price18 };
    const samples = previous?.samples ?? [];
    this.pending.set(key, {
      ...tick,
      epoch: this.epoch,
      samples: previous?.updatedAt === tick.updatedAt ? samples : [...samples, sample].slice(-MAX_SAMPLES),
    });
    if (this.scheduled) return;
    this.scheduled = true;
    nextFrame(() => this.flush());
  }

  get(chainId: ChainId, symbol: string): PriceTick | undefined {
    return this.published.get(keyOf(chainId, symbol));
  }

  /** The whole published map — a new reference per flush (for list screens). */
  all = (): ReadonlyMap<string, PriceTick> => this.published;

  static key = keyOf;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private flush(): void {
    this.scheduled = false;
    if (this.pending.size === 0) return;
    // A new Map per publish keeps `get` referentially stable between publishes (useSyncExternalStore contract).
    const next = new Map(this.published);
    for (const [key, tick] of this.pending) next.set(key, tick);
    this.pending.clear();
    this.published = next;
    for (const listener of this.listeners) listener();
  }
}

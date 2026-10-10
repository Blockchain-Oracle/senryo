import type { Logger } from "@senryo/service-common";
import type { Tick } from "../../stream/bus.ts";
import { BASIS_FRESH_MS } from "../constants.ts";
import { Basis } from "./basis.ts";
import { DisplayFeed, type DisplayStatus, type DisplayTick } from "./display-feed.ts";

/**
 * The gateway's display line (D-302): the exchange feed's newest trade per market, shifted onto the settlement price by
 * its basis, handed out once per flush. Display only — the gateway never prices, fills or settles from it.
 */
export class DisplayLine {
  private readonly feed: DisplayFeed;
  private readonly basis = new Basis();
  private readonly latest = new Map<number, { symbol: string; priceE8: bigint; timeMs: number; receivedAt: number }>();
  private readonly moved = new Set<number>();

  constructor(
    private readonly indexOf: (symbol: string) => number | undefined,
    log: Logger,
  ) {
    this.feed = new DisplayFeed((t) => this.onTrade(t), log);
  }

  start(): void {
    this.feed.start();
  }

  stop(): void {
    this.feed.stop();
  }

  /** A settlement update for a market: a basis sample while its display tick is fresh. */
  onSettlement(index: number, settlementE8: bigint): void {
    const shown = this.latest.get(index);
    if (shown && Date.now() - shown.receivedAt <= BASIS_FRESH_MS) {
      this.basis.sample(shown.symbol, shown.priceE8, settlementE8);
    }
  }

  /** When the market's line last moved (ms), or null. */
  movedAt(index: number): number | null {
    return this.latest.get(index)?.receivedAt ?? null;
  }

  /** The ticks that moved since the last call, on the settlement footing. */
  take(): Tick[] {
    const out: Tick[] = [];
    for (const i of this.moved) {
      const d = this.latest.get(i);
      if (d) out.push([i, Number(this.basis.adjust(d.symbol, d.priceE8)), d.timeMs]);
    }
    this.moved.clear();
    return out;
  }

  status(): DisplayStatus & { basis: Record<string, string> } {
    return { ...this.feed.status(), basis: this.basis.snapshot() };
  }

  private onTrade(t: DisplayTick): void {
    const index = this.indexOf(t.symbol);
    if (index === undefined) return;
    this.latest.set(index, { symbol: t.symbol, priceE8: t.priceE8, timeMs: t.timeMs, receivedAt: Date.now() });
    if (this.basis.ready(t.symbol)) this.moved.add(index);
  }
}

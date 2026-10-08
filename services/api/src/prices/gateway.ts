import { type Hex, seriesIdOf } from "@senryo/chain";
import { MARKETS, type MarketSpec } from "@senryo/config";
import { type Db, type Logger, MS_PER_SECOND, nowSec } from "@senryo/service-common";
import type { StreamBus } from "../stream/bus.ts";
import { PriceArchive } from "./archive.ts";
import { FRAME_GAP_MS, PRINT_WAIT_MS, RING_KEEP_SEC } from "./constants.ts";
import { type HermesStatus, HermesStream } from "./hermes.ts";
import { FeedRing, type PriceUpdate, toE8 } from "./ring.ts";

/**
 * The one Pyth gateway (D-272): the only holder of the Pyth key. One Hermes stream for every catalogue feed fans out
 * as compact ticks on `/v1/stream` (one coalescer per feed for the whole process), folds 1-minute candles, archives
 * every minute boundary with its proof the moment it streams (`prints` topic + `pyth_prints`), and answers the relay's
 * "the unique print of t" from the ring, the stream, the archive, then Hermes REST — in that order.
 */
export interface GatewayFeed {
  index: number;
  market: MarketSpec;
  ring: FeedRing;
}

export class PythGateway {
  readonly feeds: GatewayFeed[];
  private readonly byId = new Map<Hex, GatewayFeed>();
  private readonly archive: PriceArchive;
  private readonly lastFrameAt = new Map<Hex, number>();
  private readonly pendingFrame = new Map<Hex, ReturnType<typeof setTimeout>>();
  private hermes: HermesStream | undefined;

  constructor(
    db: Db,
    private readonly bus: StreamBus,
    private readonly log: Logger,
    private readonly key: string | undefined,
  ) {
    this.archive = new PriceArchive(db, log);
    this.feeds = MARKETS.map((market, index) => ({ index, market, ring: new FeedRing(market.pythFeedId) }));
    for (const f of this.feeds) this.byId.set(f.market.pythFeedId, f);
  }

  /**
   * Archives the print of every pending fill instant still in the ring (the relay's own and anyone else's), so the
   * keeper can back-fill from the archive even if this process restarts between a commit and its fill.
   */
  async archivePending(db: Db): Promise<void> {
    const rows = await db<{ series_id: string; target: bigint }[]>`
      SELECT DISTINCT series_id, target FROM market_tickets
      WHERE state IN ('committed', 'closing') AND target IS NOT NULL AND target > ${nowSec() - RING_KEEP_SEC}`;
    for (const r of rows) {
      const feed = this.feeds.find((f) =>
        f.market.cadences.some((c) => seriesIdOf(f.market.symbol, c) === r.series_id),
      );
      if (feed) await this.printAt(feed.market.pythFeedId, Number(r.target), 0);
    }
  }

  start(): void {
    if (!this.key) {
      this.log.warn("PYTH_API_KEY unset — prices and prints are off");
      return;
    }
    this.hermes = new HermesStream(
      this.key,
      this.feeds.map((f) => f.market.pythFeedId),
      (u) => this.onUpdate(u),
      this.log,
    );
    this.hermes.start();
  }

  stop(): void {
    this.hermes?.stop();
  }

  status(): HermesStatus & { keyed: boolean } {
    return {
      keyed: Boolean(this.key),
      ...(this.hermes?.status ?? { connected: false, lastFrameAt: 0, lastError: null, lastBadStatus: null }),
    };
  }

  feedOf(symbol: string): GatewayFeed | undefined {
    return this.feeds.find((f) => f.market.symbol === symbol);
  }

  candles(feedId: Hex, from: number, to: number) {
    return this.archive.candles(feedId, from, to);
  }

  /**
   * The unique print of `t` for a feed, with the bytes the chain verifies: the ring, then waiting for it to stream
   * (up to `waitMs` — a fill asks a second ahead), then the archive, then Hermes REST. Archived on the way, so the
   * keeper and Proof find it later.
   */
  async printAt(feedId: Hex, t: number, waitMs: number = PRINT_WAIT_MS): Promise<PriceUpdate | undefined> {
    const feed = this.byId.get(feedId);
    const streamed = feed ? await feed.ring.wait(t, waitMs) : undefined;
    if (streamed) {
      await this.archive.savePrint(streamed, t, "stream");
      return streamed;
    }
    const archived = await this.archive.printAt(feedId, t);
    if (archived) return archived;
    const rest = await this.hermes?.printAt(feedId, t);
    if (rest) await this.archive.savePrint(rest, t, "rest");
    return rest;
  }

  /** The latest tick per feed, as frames for a new subscriber. */
  snapshot(): string[] {
    const frames: string[] = [];
    for (const f of this.feeds) {
      const u = f.ring.latest();
      if (u) frames.push(`event: p\ndata: ${JSON.stringify({ topic: "prices", data: tickOf(f.index, u) })}\n\n`);
    }
    return frames;
  }

  private onUpdate(u: PriceUpdate): void {
    const feed = this.byId.get(u.feedId);
    if (!feed) return;
    feed.ring.push(u);
    this.archive.foldCandle(u);
    for (const t of this.archive.boundariesOf(u)) {
      void this.archive
        .savePrint(u, t, "stream")
        .catch((error) => this.log.warn({ err: (error as Error).message, t }, "boundary archive failed"));
      this.bus.emit("prints", "print", {
        symbol: feed.market.symbol,
        t,
        priceE8: toE8(u.price, u.expo).toString(),
        publishTime: u.publishTime,
      });
    }
    this.coalesce(feed, u);
  }

  /** Owarine's coalescer, once per feed for the process: the first tick after a quiet gap goes at once, the newest
   *  value inside a gap is sent when it ends. */
  private coalesce(feed: GatewayFeed, u: PriceUpdate): void {
    const id = feed.market.pythFeedId;
    if (this.pendingFrame.has(id)) return;
    const wait = (this.lastFrameAt.get(id) ?? 0) + FRAME_GAP_MS - Date.now();
    const send = () => {
      this.pendingFrame.delete(id);
      this.lastFrameAt.set(id, Date.now());
      const latest = feed.ring.latest() ?? u;
      this.bus.tick("prices", "p", tickOf(feed.index, latest));
    };
    if (wait <= 0) send();
    else this.pendingFrame.set(id, setTimeout(send, wait));
  }
}

/** Compact tick `[catalogue index, priceE8, publish ms]` (D-272: ≤ 1 KB/s per client). */
function tickOf(index: number, u: PriceUpdate): [number, number, number] {
  return [index, Number(toE8(u.price, u.expo)), u.publishTime * MS_PER_SECOND];
}

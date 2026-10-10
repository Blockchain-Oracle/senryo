import { type Hex, seriesIdOf } from "@senryo/chain";
import { basketMembers, feedIdOf, MARKETS, type MarketSpec } from "@senryo/config";
import { basketPointsE8 } from "@senryo/core";
import { type Db, type Logger, MS_PER_SECOND } from "@senryo/service-common";
import type { StreamBus } from "../stream/bus.ts";
import { PriceArchive } from "./archive.ts";
import { FRAME_GAP_MS, PRINT_WAIT_MS, REDSTONE_PRINT_WAIT_MS } from "./constants.ts";
import { type HermesStatus, HermesStream } from "./hermes.ts";
import { PrintFetcher, type PrintFetchStats, type PrintSourceKind } from "./print-fetcher.ts";
import { PrintWatch, type PrintWatchStats } from "./print-watch.ts";
import { type RedStoneGateway, RedStoneReader } from "./redstone.ts";
import { FeedRing, type PriceUpdate, toE8 } from "./ring.ts";

/**
 * The one Pyth gateway (D-272): the only holder of the Pyth key. One Hermes stream for every catalogue feed fans out
 * as compact ticks on `/v1/stream` (one coalescer per feed for the whole process), folds 1-minute candles, archives
 * every minute boundary with its proof the moment it streams (`prints` topic + `pyth_prints`), and answers the relay's
 * "the unique print of t" from the ring, the stream, the archive, then upstream REST through the `PrintFetcher` (its
 * own rate and backoff, 04-pricing R2) — in that order. A basket (D-286)
 * is its members: its live value is recomputed on every member tick (chart, candles and ticks as for any market), and
 * its print of t is every member's print of t composed — the index, the members' updates in member order — archived
 * under the basket's id the moment the last member's arrives.
 */
export interface GatewayFeed {
  index: number;
  market: MarketSpec;
  ring: FeedRing;
  /** A basket's member feeds, in its definition's order (empty for a single feed). */
  members: GatewayFeed[];
  /** The baskets this feed is a member of. */
  baskets: GatewayFeed[];
}

const PRINT_EXPO = -8;

export class PythGateway {
  readonly feeds: GatewayFeed[];
  private readonly byId = new Map<Hex, GatewayFeed>();
  private readonly bySeries = new Map<string, GatewayFeed>();
  private readonly archive: PriceArchive;
  private readonly watch: PrintWatch;
  private readonly lastFrameAt = new Map<Hex, number>();
  private readonly pendingFrame = new Map<Hex, ReturnType<typeof setTimeout>>();
  private hermes: HermesStream | undefined;
  private redstone: RedStoneReader | undefined;
  private fetcher: PrintFetcher | undefined;

  constructor(
    db: Db,
    private readonly bus: StreamBus,
    private readonly log: Logger,
    private readonly key: string | undefined,
    private readonly redstoneGateways: RedStoneGateway[] | undefined = undefined,
  ) {
    this.archive = new PriceArchive(db, log);
    this.feeds = MARKETS.map((market, index) => ({
      index,
      market,
      ring: new FeedRing(feedIdOf(market)),
      members: [],
      baskets: [],
    }));
    for (const f of this.feeds) {
      this.byId.set(feedIdOf(f.market), f);
      for (const c of f.market.cadences) this.bySeries.set(seriesIdOf(f.market.symbol, c), f);
    }
    this.watch = new PrintWatch(db, this, log);
    for (const f of this.feeds) {
      for (const { market } of basketMembers(f.market)) {
        const member = this.byId.get(feedIdOf(market));
        if (!member) continue;
        f.members.push(member);
        member.baskets.push(f);
      }
    }
  }

  /** The market a series trades (the print watch's lookup). */
  marketOfSeries(seriesId: string): MarketSpec | undefined {
    return this.bySeries.get(seriesId)?.market;
  }

  /** Markets priced by the Hermes stream (a gap in it is back-filled for each). */
  pythMarkets(): MarketSpec[] {
    return this.feeds.filter((f) => f.market.source.kind === "pyth").map((f) => f.market);
  }

  start(): void {
    const redstoneFeeds = new Map(
      this.feeds.flatMap((f) =>
        f.market.source.kind === "redstone" ? [[f.market.source.feed, feedIdOf(f.market)] as const] : [],
      ),
    );
    this.redstone = new RedStoneReader(redstoneFeeds, (u) => this.onUpdate(u), this.log, this.redstoneGateways);
    this.redstone.start();
    this.fetcher = new PrintFetcher(this.key, this.redstone, this.log);
    this.watch.start();
    if (!this.key) {
      this.log.warn("PYTH_API_KEY unset — prices and prints are off");
      return;
    }
    this.hermes = new HermesStream(
      this.key,
      this.feeds.filter((f) => f.market.source.kind === "pyth").map((f) => feedIdOf(f.market)),
      (u) => this.onUpdate(u),
      this.log,
      (from, to) => this.watch.onGap(from, to),
    );
    this.hermes.start();
  }

  stop(): void {
    this.watch.stop();
    this.hermes?.stop();
    this.redstone?.stop();
  }

  status(): HermesStatus & {
    keyed: boolean;
    rest: Record<PrintSourceKind, PrintFetchStats> | null;
    watch: PrintWatchStats;
  } {
    return {
      keyed: Boolean(this.key),
      ...(this.hermes?.status ?? { connected: false, lastFrameAt: 0, lastError: null, lastBadStatus: null }),
      rest: this.fetcher?.stats() ?? null,
      watch: { ...this.watch.stats },
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
   * (up to `waitMs` — a fill asks a second ahead), then the archive, then upstream REST (catalogue feeds only).
   * Archived on the way, so the keeper and Proof find it later.
   */
  async printAt(feedId: Hex, t: number, waitMs?: number): Promise<PriceUpdate | undefined> {
    const feed = this.byId.get(feedId);
    const redstone = feed?.market.source.kind === "redstone";
    // A RedStone print of t is the next 10-second grid point: up to a grid step away, plus the read.
    const wait = waitMs ?? (redstone ? REDSTONE_PRINT_WAIT_MS : PRINT_WAIT_MS);
    if (feed && feed.members.length > 0) return this.basketPrintAt(feed, t, wait);
    const streamed = feed ? await feed.ring.wait(t, wait) : undefined;
    if (streamed) {
      await this.archive.savePrint(streamed, t, "stream");
      return streamed;
    }
    const archived = await this.archive.printAt(feedId, t);
    if (archived) return archived;
    const rest = feed ? await this.fetcher?.printAt(feed.market, t) : undefined;
    if (rest) await this.archive.savePrint(rest, t, "rest");
    return rest;
  }

  /** A basket's print of t: every member's print of t, composed and archived (none while any member has none). */
  private async basketPrintAt(basket: GatewayFeed, t: number, waitMs: number): Promise<PriceUpdate | undefined> {
    const archived = await this.archive.printAt(feedIdOf(basket.market), t);
    if (archived) return archived;
    const prints = await Promise.all(basket.members.map((m) => this.printAt(feedIdOf(m.market), t, waitMs)));
    if (prints.some((p) => !p)) return undefined;
    const composed = this.compose(basket, prints as PriceUpdate[]);
    if (composed) await this.archive.savePrint(composed, t, "stream");
    return composed;
  }

  /** The basket's value from one update per member, in member order (`BasketPrintVerifier`'s maths). */
  private compose(basket: GatewayFeed, prints: PriceUpdate[]): PriceUpdate | undefined {
    const members = basketMembers(basket.market);
    const terms = (pick: (p: PriceUpdate) => bigint) =>
      members.map(({ member }, i) => {
        const p = prints[i];
        return { weightBps: member.weightBps, baseE8: member.baseE8, valueE8: p ? toE8(pick(p), p.expo) : undefined };
      });
    const price = basketPointsE8(terms((p) => p.price));
    const conf = basketPointsE8(terms((p) => p.conf));
    if (price === null || conf === null) return undefined;
    return {
      feedId: feedIdOf(basket.market),
      publishTime: Math.max(...prints.map((p) => p.publishTime)),
      prevPublishTime: Math.max(...prints.map((p) => p.prevPublishTime)),
      price,
      conf,
      expo: PRINT_EXPO,
      updates: prints.flatMap((p) => p.updates),
      receivedAt: Math.max(...prints.map((p) => p.receivedAt)),
    };
  }

  /** A member ticked: each basket it is in gets a new live value from its members' latest (display only). */
  private onMemberTick(feed: GatewayFeed): void {
    for (const basket of feed.baskets) {
      const latest = basket.members.map((m) => m.ring.latest());
      if (latest.some((u) => !u)) continue;
      const value = this.compose(basket, latest as PriceUpdate[]);
      if (!value) continue;
      basket.ring.push(value);
      this.archive.foldCandle(value);
      this.coalesce(basket, value);
    }
  }

  /**
   * A member's boundary print landed: each basket it is in is composed from the archive alone once all its members
   * have theirs (the last member's arrival completes it) — never by asking Hermes for the others.
   */
  private async onMemberBoundary(feed: GatewayFeed, t: number): Promise<void> {
    for (const basket of feed.baskets) {
      const prints = await Promise.all(basket.members.map((m) => this.archive.printAt(feedIdOf(m.market), t)));
      if (prints.some((p) => !p)) continue;
      const u = this.compose(basket, prints as PriceUpdate[]);
      if (!u) continue;
      await this.archive.savePrint(u, t, "stream");
      this.bus.emit("prints", "print", {
        symbol: basket.market.symbol,
        t,
        priceE8: u.price.toString(),
        publishTime: u.publishTime,
      });
    }
  }

  /** A feed's newest price (e-8) and its publish time, for the exit watcher. */
  latestE8(feedId: Hex): { priceE8: bigint; publishTime: number } | undefined {
    const u = this.byId.get(feedId)?.ring.latest();
    return u ? { priceE8: toE8(u.price, u.expo), publishTime: u.publishTime } : undefined;
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
        .then(() => this.onMemberBoundary(feed, t))
        .catch((error) => this.log.warn({ err: (error as Error).message, t }, "boundary archive failed"));
      this.bus.emit("prints", "print", {
        symbol: feed.market.symbol,
        t,
        priceE8: toE8(u.price, u.expo).toString(),
        publishTime: u.publishTime,
      });
    }
    this.coalesce(feed, u);
    this.onMemberTick(feed);
  }

  /** Owarine's coalescer, once per feed for the process: the first tick after a quiet gap goes at once, the newest
   *  value inside a gap is sent when it ends. */
  private coalesce(feed: GatewayFeed, u: PriceUpdate): void {
    const id = feedIdOf(feed.market);
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

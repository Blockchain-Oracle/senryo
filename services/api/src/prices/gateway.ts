import { type Hex, seriesIdOf } from "@senryo/chain";
import { basketMembers, type FeedState, feedIdOf, MARKETS, type MarketSpec, pauseOf } from "@senryo/config";
import { type Db, type Logger, MS_PER_SECOND, nowSec } from "@senryo/service-common";
import { batchFrame, legacyFrames, type StreamBus, type Tick } from "../stream/bus.ts";
import { PriceArchive } from "./archive.ts";
import { composeBasket } from "./basket-compose.ts";
import { PRINT_WAIT_MS, REDSTONE_PRINT_WAIT_MS, TICK_FLUSH_MS } from "./constants.ts";
import type { DisplayStatus } from "./display/display-feed.ts";
import { DisplayLine } from "./display/display-line.ts";
import { FeedStates } from "./feed-state.ts";
import { HERMES_CLASSES, type HermesClass, type HermesStatus, HermesStream, hermesClassOf } from "./hermes.ts";
import { PrintFetcher, type PrintFetchStats, type PrintSourceKind } from "./print-fetcher.ts";
import { PrintWatch, type PrintWatchStats } from "./print-watch.ts";
import { type RedStoneGateway, RedStoneReader } from "./redstone.ts";
import { FeedRing, type PriceUpdate, toE8 } from "./ring.ts";
import { type SilenceStats, SilenceWatch } from "./silence-watch.ts";

/**
 * The one Pyth gateway (D-272): the only holder of the Pyth key. One Hermes stream per entitlement class (crypto,
 * tradfi; 04-pricing R5), watched per feed for silence, fans out
 * as compact ticks on `/v1/stream` (every feed that moved, batched into one frame each 100 ms), folds 1-minute candles, archives
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

/** Where prices come from: the Pyth key and Hermes's base, and RedStone's gateways (D-284). */
export interface GatewayUpstream {
  pythKey: string | undefined;
  hermesOrigin: string;
  redstoneGateways: RedStoneGateway[] | undefined;
  /**
   * The exchange display line (D-302). Off unless a licence allows showing that data to users: on 10 Oct 2026 none of
   * the five venues' free terms did (docs/research/replan-2026-10-10/09-display-terms.md).
   */
  displayFeed: boolean;
}

export interface GatewayStatus {
  keyed: boolean;
  /** Markets per state, per source. */
  states: Record<string, Record<FeedState, number>>;
  hermes: Partial<Record<HermesClass, HermesStatus>>;
  silence: SilenceStats | null;
  /** The exchange line (D-302): its socket, the markets on the REST median, each market's basis (e-8). */
  display: (DisplayStatus & { basis: Record<string, string> }) | null;
  rest: Record<PrintSourceKind, PrintFetchStats> | null;
  watch: PrintWatchStats;
}

export class PythGateway {
  readonly feeds: GatewayFeed[];
  private readonly byId = new Map<Hex, GatewayFeed>();
  private readonly bySeries = new Map<string, GatewayFeed>();
  private readonly archive: PriceArchive;
  private readonly watch: PrintWatch;
  private readonly states: FeedStates;
  /** Catalogue indexes that moved since the last flush. */
  private readonly moved = new Set<number>();
  /** The exchange line (D-302): display only. */
  private readonly display: DisplayLine;
  private flushTimer: ReturnType<typeof setInterval> | undefined;
  private readonly streams = new Map<HermesClass, HermesStream>();
  private silence: SilenceWatch | undefined;
  private redstone: RedStoneReader | undefined;
  private fetcher: PrintFetcher | undefined;

  constructor(
    db: Db,
    private readonly bus: StreamBus,
    private readonly log: Logger,
    private readonly upstream: GatewayUpstream,
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
    this.display = new DisplayLine((symbol) => this.feedOf(symbol)?.index, log);
    this.states = new FeedStates(
      this.feeds.map((f) => ({
        index: f.index,
        market: f.market,
        latest: () => f.ring.latest(),
        displayAt: () => this.display.movedAt(f.index),
        members: f.members.map((m) => m.index),
      })),
      (digest) => this.bus.tick("prices", "h", { s: digest }),
    );
  }

  /** A market's state now (`FeedStates`): what exits, decks, the relay and `/status` read. */
  feedState(feedId: Hex): FeedState {
    const feed = this.byId.get(feedId);
    return feed ? this.states.stateOf(feed.index) : "stale";
  }

  /** One letter per catalogue index; rides every beat. */
  healthDigest(): string {
    return this.states.digest();
  }

  /** Why a market takes no calls at all (no price source, D-310), or null — the catalogue and the relays ask here. */
  pausedReason(m: MarketSpec): string | null {
    return pauseOf(m, nowSec(), Boolean(this.upstream.redstoneGateways?.length));
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
    const { pythKey, hermesOrigin, redstoneGateways } = this.upstream;
    this.redstone = new RedStoneReader(redstoneFeeds, (u) => this.onUpdate(u), this.log, redstoneGateways);
    this.redstone.start();
    this.archive.start();
    this.states.start();
    this.flushTimer = setInterval(() => this.flushTicks(), TICK_FLUSH_MS);
    if (this.upstream.displayFeed) this.display.start();
    const access = pythKey ? { origin: hermesOrigin, key: pythKey } : undefined;
    const fetcher = new PrintFetcher(access, this.redstone, this.log);
    this.fetcher = fetcher;
    this.watch.start();
    if (!access) {
      this.log.error("PYTH_API_KEY unset — Pyth prices and prints are off");
      return;
    }
    const pyth = this.pythMarkets();
    const silence = new SilenceWatch(
      pyth,
      (m) => fetcher.latestOf(m),
      (m, reason) => this.streams.get(hermesClassOf(m.kind))?.restart(reason),
      this.log,
    );
    this.silence = silence;
    silence.start();
    for (const name of HERMES_CLASSES) {
      const markets = pyth.filter((m) => hermesClassOf(m.kind) === name);
      if (markets.length === 0) continue;
      const stream = new HermesStream({
        name,
        ...access,
        feedIds: markets.map(feedIdOf),
        onUpdate: (u) => {
          silence.observe(u);
          this.onUpdate(u);
        },
        onResume: (from, to) => this.watch.onGap(from, to, markets),
        log: this.log,
      });
      this.streams.set(name, stream);
      stream.start();
    }
  }

  /** Stops the streams and timers, then writes the open candles. */
  async stop(): Promise<void> {
    clearInterval(this.flushTimer);
    this.display.stop();
    this.states.stop();
    this.watch.stop();
    this.silence?.stop();
    for (const stream of this.streams.values()) stream.stop();
    this.redstone?.stop();
    await this.archive.flush();
  }

  status(): GatewayStatus {
    return {
      keyed: Boolean(this.upstream.pythKey),
      states: this.states.counts(),
      hermes: Object.fromEntries([...this.streams].map(([name, s]) => [name, { ...s.status }])),
      silence: this.silence?.stats() ?? null,
      display: this.upstream.displayFeed ? this.display.status() : null,
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

  /** Each feed's last 24 h from the archive: the open at `since` (a minute), and the high and low from then on. */
  daySince(since: number) {
    return this.archive.daySince(since);
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

  /**
   * The print of t only if it is already known — the ring (single feeds) or the archive. Never waits and never asks
   * upstream: the public print route reads this, so anonymous traffic can't spend the key's budget (04-pricing R4, F5).
   */
  async knownPrintAt(feedId: Hex, t: number): Promise<PriceUpdate | undefined> {
    const feed = this.byId.get(feedId);
    const streamed = feed && feed.members.length === 0 ? feed.ring.proving(t) : undefined;
    return streamed ?? (await this.archive.printAt(feedId, t));
  }

  /** A basket's print of t: every member's print of t, composed and archived (none while any member has none). */
  private async basketPrintAt(basket: GatewayFeed, t: number, waitMs: number): Promise<PriceUpdate | undefined> {
    const archived = await this.archive.printAt(feedIdOf(basket.market), t);
    if (archived) return archived;
    const prints = await Promise.all(basket.members.map((m) => this.printAt(feedIdOf(m.market), t, waitMs)));
    if (prints.some((p) => !p)) return undefined;
    const composed = composeBasket(basket.market, prints as PriceUpdate[]);
    if (composed) await this.archive.savePrint(composed, t, "stream");
    return composed;
  }

  /** A member ticked: each basket it is in gets a new live value from its members' latest (display only). */
  private onMemberTick(feed: GatewayFeed): void {
    for (const basket of feed.baskets) {
      const latest = basket.members.map((m) => m.ring.latest());
      if (latest.some((u) => !u)) continue;
      const value = composeBasket(basket.market, latest as PriceUpdate[]);
      if (!value) continue;
      basket.ring.push(value);
      this.archive.foldCandle(value);
      this.moved.add(basket.index);
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
      const u = composeBasket(basket.market, prints as PriceUpdate[]);
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

  /** Every market's newest price as a tick (`/v1/prices/latest` and a new subscriber's snapshot). */
  latestTicks(): Tick[] {
    return this.feeds.flatMap((f) => {
      const u = f.ring.latest();
      return u ? [tickOf(f.index, u)] : [];
    });
  }

  /** The states, then the latest tick per feed (one `pp` batch, or `p` frames for an app before R1.13). */
  snapshot(batched: boolean): string[] {
    const ticks = this.latestTicks();
    const states = `event: h\ndata: ${JSON.stringify({ topic: "prices", data: { s: this.healthDigest() } })}\n\n`;
    if (ticks.length === 0) return [states];
    return [states, batched ? batchFrame(PRICES_TOPIC, ticks) : legacyFrames(PRICES_TOPIC, ticks)];
  }

  private onUpdate(u: PriceUpdate): void {
    const feed = this.byId.get(u.feedId);
    if (!feed) return;
    this.display.onSettlement(feed.index, toE8(u.price, u.expo));
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
    this.moved.add(feed.index);
    this.onMemberTick(feed);
  }

  /**
   * Every feed that moved since the last flush, newest value each, in one frame (04-pricing R13): one write per socket
   * per 100 ms however many feeds tick, at most 10 Hz per feed.
   */
  private flushTicks(): void {
    const ticks = [...this.moved].flatMap((i) => {
      const u = this.feeds[i]?.ring.latest();
      return u ? [tickOf(i, u)] : [];
    });
    this.moved.clear();
    this.bus.ticks(PRICES_TOPIC, ticks, this.display.take());
  }
}

const PRICES_TOPIC = "prices";

/** Compact tick `[catalogue index, priceE8, publish ms]` (D-272: ≤ 1 KB/s per client). */
function tickOf(index: number, u: PriceUpdate): Tick {
  return [index, Number(toE8(u.price, u.expo)), u.publishTime * MS_PER_SECOND];
}

import type { Hex } from "@senryo/chain";
import { CALENDARS, feedIdOf, type MarketSpec } from "@senryo/config";
import { isOpenAt, scheduleOf } from "@senryo/core";
import { type Logger, MS_PER_SECOND } from "@senryo/service-common";
import { FEED_SILENCE_MS, SILENCE_CHECK_MS } from "./constants.ts";
import type { PriceUpdate } from "./ring.ts";

/**
 * Per-feed silence on the Hermes streams (04-pricing R5e). Hermes sends a frame a second for every feed of a class,
 * open or closed (a closed market's publish time stays frozen at its close), so a frame proves nothing. A market is
 * silent when its calendar says open and its publish time hasn't moved for `FEED_SILENCE_MS`. Each silence is probed
 * once on Hermes REST `latest`:
 * - newer there → the stream stopped carrying the feed: that class's stream reconnects;
 * - not newer (or no answer) → the feed is stale upstream: counted and logged; R1.9's FeedState shows it to users.
 */
export interface SilenceStats {
  episodes: number;
  streamDropped: number;
  upstreamStale: number;
  silentNow: string[];
}

interface FeedClock {
  publishSec: number;
  movedAt: number;
}

export class SilenceWatch {
  private readonly stats_ = { episodes: 0, streamDropped: 0, upstreamStale: 0 };
  private readonly clocks = new Map<Hex, FeedClock>();
  private readonly openSince = new Map<Hex, number>();
  private readonly silent = new Map<Hex, string>();
  private readonly startedAt = Date.now();
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly markets: readonly MarketSpec[],
    private readonly probe: (m: MarketSpec) => Promise<PriceUpdate | undefined>,
    private readonly reconnect: (m: MarketSpec, reason: string) => void,
    private readonly log: Logger,
  ) {}

  start(): void {
    this.timer = setInterval(() => this.check(Date.now()), SILENCE_CHECK_MS);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  stats(): SilenceStats {
    return { ...this.stats_, silentNow: [...this.silent.values()] };
  }

  /** Every streamed update; only a newer publish time counts as the feed moving. */
  observe(u: PriceUpdate): void {
    const clock = this.clocks.get(u.feedId);
    if (clock && u.publishTime <= clock.publishSec) return;
    this.clocks.set(u.feedId, { publishSec: u.publishTime, movedAt: u.receivedAt });
    const symbol = this.silent.get(u.feedId);
    if (symbol && this.silent.delete(u.feedId)) this.log.info({ symbol }, "feed moving again");
  }

  check(now: number): void {
    for (const m of this.markets) {
      const id = feedIdOf(m);
      if (!isOpenAt(scheduleOf(CALENDARS[m.calendarId].schedule), Math.floor(now / MS_PER_SECOND))) {
        this.openSince.delete(id);
        continue;
      }
      const opened = this.openSince.get(id) ?? now;
      this.openSince.set(id, opened);
      const since = Math.max(this.clocks.get(id)?.movedAt ?? this.startedAt, opened);
      if (now - since <= FEED_SILENCE_MS || this.silent.has(id)) continue;
      this.silent.set(id, m.symbol);
      this.stats_.episodes += 1;
      this.log.warn({ symbol: m.symbol, silentMs: now - since }, "feed silent while its market is open");
      void this.diagnose(m, id).catch((error) =>
        this.log.warn({ symbol: m.symbol, err: (error as Error).message }, "silence probe failed"),
      );
    }
  }

  private async diagnose(m: MarketSpec, id: Hex): Promise<void> {
    const latest = await this.probe(m);
    const streamed = this.clocks.get(id)?.publishSec ?? 0;
    if (latest && latest.publishTime > streamed) {
      this.stats_.streamDropped += 1;
      this.log.error(
        { symbol: m.symbol, streamed, upstream: latest.publishTime },
        "hermes stream stopped carrying a feed; reconnecting",
      );
      this.reconnect(m, `${m.symbol} silent on the stream`);
      return;
    }
    this.stats_.upstreamStale += 1;
    this.log.warn({ symbol: m.symbol, publishTime: latest?.publishTime ?? null }, "feed stale upstream");
  }
}

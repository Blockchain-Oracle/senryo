import type { Hex } from "@senryo/chain";
import { admissionSecOf, CALENDARS, feedIdOf, MARKETS, type MarketSpec } from "@senryo/config";
import { isOpenAt, scheduleOf } from "@senryo/core";
import { archivedKeys, type Db, instantsAwaitingPrints, type Logger, nowSec, printKey } from "@senryo/service-common";
import {
  BOUNDARY_SEC,
  GAP_RETRY_MAX_MS,
  PRINT_GRACE_SEC,
  PRINT_WATCH_MS,
  PRINT_WATCH_NEARING_SHARE,
} from "./constants.ts";
import type { PriceUpdate } from "./ring.ts";

/**
 * PrintWatch (04-pricing R3, F6). The keeper settles only from the archive and voids a window once its admission
 * passes, so a boundary the stream missed (a reconnect, a deploy, a 429) used to become a refund for everyone in it.
 * - **Every 2 s:** each instant a live position needs — fill and close targets, window starts and expiries, parlay
 *   legs — with no archived print by t + 2 s is asked of the gateway (ring → archive → `PrintFetcher`), which archives
 *   it. This replaces the fill-only `archivePending`.
 * - **After a Hermes gap** (a reconnect, or the first frame after a restart): every minute boundary in the gap, for
 *   each of that stream's markets open at the boundary, one boundary at a time, so the REST budget is never queued
 *   past its limit. A boundary that doesn't come (the fetcher resting or throttled, upstream slow) is retried on the
 *   tick, its wait doubling to 30 s — no position may need it yet, but one opened in the gap will (the R1.23 cut
 *   check found a gap's boundaries dropped after one try).
 * - Only within the market's admission (past it, the keeper voids anyway). Counted for `/status`; an instant still
 *   missing at half its admission is logged as an error once.
 */
export interface PrintWatchStats {
  checks: number;
  /** Distinct instants found unarchived by t + 2 s. */
  misses: number;
  backfilled: number;
  /** Instants still missing at half their admission (logged as errors). */
  nearing: number;
  /** Gap boundaries that needed at least one feed back-filled. */
  gapBoundaries: number;
  /** Gap prints still missing and waiting for their next try. */
  retrying: number;
  lastMissAt: string | null;
}

/** What the watch needs of the gateway. */
export interface WatchedFeeds {
  marketOfSeries(seriesId: string): MarketSpec | undefined;
  printAt(feedId: Hex, t: number, waitMs?: number): Promise<PriceUpdate | undefined>;
}

interface Wanted {
  market: MarketSpec;
  feedId: Hex;
  t: number;
}

/** A gap boundary still missing, and when it is next asked for. */
interface Retry {
  w: Wanted;
  dueMs: number;
  waitMs: number;
}

/** No market's admission is longer: nothing older can still settle from a print. */
const HORIZON_SEC = Math.max(...MARKETS.map(admissionSecOf));

export class PrintWatch {
  readonly stats: PrintWatchStats = {
    checks: 0,
    misses: 0,
    backfilled: 0,
    nearing: 0,
    gapBoundaries: 0,
    retrying: 0,
    lastMissAt: null,
  };
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  private gaps: Promise<void> = Promise.resolve();
  /** Missed instants (key → t) and those already logged as nearing admission; pruned past the horizon. */
  private readonly missed = new Map<string, number>();
  private readonly warned = new Set<string>();
  /** Gap boundaries still missing, by key. */
  private readonly retries = new Map<string, Retry>();

  constructor(
    private readonly db: Db,
    private readonly feeds: WatchedFeeds,
    private readonly log: Logger,
  ) {}

  start(): void {
    this.timer = setInterval(() => void this.tick(), PRINT_WATCH_MS);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  /**
   * A stream of these markets resumed after `fromSec` (0: nothing seen since the process started) with a print at
   * `toSec`.
   */
  onGap(fromSec: number, toSec: number, markets: readonly MarketSpec[]): void {
    const from = fromSec > 0 ? fromSec : toSec - HORIZON_SEC;
    this.gaps = this.gaps
      .then(() => this.backfillGap(from, toSec, markets))
      .catch((error) => this.log.warn({ err: (error as Error).message }, "gap back-fill failed"));
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const now = nowSec();
      const rows = await instantsAwaitingPrints(this.db, now - HORIZON_SEC, now - PRINT_GRACE_SEC);
      this.stats.checks += 1;
      const wanted = rows.flatMap((r): Wanted[] => {
        const market = this.feeds.marketOfSeries(r.series_id);
        const t = Number(r.t);
        if (!market || now - t > admissionSecOf(market)) return [];
        return [{ market, feedId: feedIdOf(market), t }];
      });
      await this.recoverMissing(wanted, now);
      await this.retryGaps(now);
      this.prune(now);
      this.stats.retrying = this.retries.size;
    } catch (error) {
      this.log.warn({ err: (error as Error).message }, "print watch failed");
    } finally {
      this.running = false;
    }
  }

  /** Every minute boundary in (fromSec, toSec], for each market open then, oldest first, one boundary at a time. */
  private async backfillGap(fromSec: number, toSec: number, markets: readonly MarketSpec[]): Promise<void> {
    const now = nowSec();
    const first = (Math.floor(Math.max(fromSec, now - HORIZON_SEC) / BOUNDARY_SEC) + 1) * BOUNDARY_SEC;
    for (let t = first; t <= Math.min(toSec, now - PRINT_GRACE_SEC); t += BOUNDARY_SEC) {
      const wanted = markets
        .filter((market) => isOpenAt(scheduleOf(CALENDARS[market.calendarId].schedule), t))
        .map((market) => ({ market, feedId: feedIdOf(market), t }));
      const { missing, unfilled } = await this.recoverMissing(wanted, now);
      if (missing > 0) this.stats.gapBoundaries += 1;
      for (const w of unfilled) {
        const key = printKey(w.feedId, w.t);
        if (!this.retries.has(key))
          this.retries.set(key, { w, dueMs: Date.now() + PRINT_WATCH_MS, waitMs: PRINT_WATCH_MS });
      }
    }
  }

  /** The gap boundaries due again; a filled (or meanwhile archived) one is done, the rest wait twice as long. */
  private async retryGaps(now: number): Promise<void> {
    const nowMs = Date.now();
    const due = [...this.retries.values()].filter((r) => r.dueMs <= nowMs);
    if (due.length === 0) return;
    const { unfilled } = await this.recoverMissing(
      due.map((r) => r.w),
      now,
    );
    const left = new Set(unfilled.map((w) => printKey(w.feedId, w.t)));
    for (const r of due) {
      const key = printKey(r.w.feedId, r.w.t);
      if (!left.has(key)) {
        this.retries.delete(key);
        continue;
      }
      r.waitMs = Math.min(r.waitMs * 2, GAP_RETRY_MAX_MS);
      r.dueMs = Date.now() + r.waitMs;
    }
  }

  /** Asks for every wanted print the archive lacks: how many were missing, and those still missing after the ask. */
  private async recoverMissing(
    wanted: readonly Wanted[],
    now: number,
  ): Promise<{ missing: number; unfilled: Wanted[] }> {
    const archived = await archivedKeys(this.db, wanted);
    const missing = wanted.filter((w) => !archived.has(printKey(w.feedId, w.t)));
    const filled = await Promise.all(missing.map((w) => this.recover(w, now)));
    return { missing: missing.length, unfilled: missing.filter((_w, i) => !filled[i]) };
  }

  /** Asks the gateway for one missing print; true when it was found (and so archived). */
  private async recover(w: Wanted, now: number): Promise<boolean> {
    const key = printKey(w.feedId, w.t);
    if (!this.missed.has(key)) {
      this.missed.set(key, w.t);
      this.stats.misses += 1;
      this.stats.lastMissAt = new Date().toISOString();
    }
    try {
      const print = await this.feeds.printAt(w.feedId, w.t, 0);
      if (print) {
        this.stats.backfilled += 1;
        this.log.info({ symbol: w.market.symbol, t: w.t, publishTime: print.publishTime }, "print back-filled");
        return true;
      }
    } catch (error) {
      this.log.warn({ symbol: w.market.symbol, t: w.t, err: (error as Error).message }, "print back-fill failed");
    }
    const admissionSec = admissionSecOf(w.market);
    if (now - w.t > admissionSec * PRINT_WATCH_NEARING_SHARE && !this.warned.has(key)) {
      this.warned.add(key);
      this.stats.nearing += 1;
      this.log.error(
        { symbol: w.market.symbol, t: w.t, ageSec: now - w.t, admissionSec },
        "print still missing near admission; its windows will void",
      );
    }
    return false;
  }

  private prune(now: number): void {
    for (const [key, r] of this.retries) if (now - r.w.t > admissionSecOf(r.w.market)) this.retries.delete(key);
    for (const [key, t] of this.missed) {
      if (now - t <= HORIZON_SEC) continue;
      this.missed.delete(key);
      this.warned.delete(key);
    }
  }
}

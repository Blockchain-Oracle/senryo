import type { Hex } from "@senryo/chain";
import { feedIdOf, type MarketSpec } from "@senryo/config";
import { type Logger, MS_PER_SECOND, nowSec } from "@senryo/service-common";
import {
  HERMES_REST_BURST,
  HERMES_REST_RATE_PER_SEC,
  PRINT_BATCH_COLLECT_MS,
  PRINT_FETCH_BACKOFF_MAX_MS,
  PRINT_FETCH_BACKOFF_MIN_MS,
  PRINT_FETCH_MAX_QUEUE_MS,
  PRINT_GRACE_SEC,
  REDSTONE_GRID_MS,
  REDSTONE_HISTORY_BURST,
  REDSTONE_HISTORY_CACHE_MS,
  REDSTONE_HISTORY_RATE_PER_SEC,
  REDSTONE_POLL_OFFSET_MS,
} from "./constants.ts";
import { hermesClassOf } from "./hermes.ts";
import { type HermesAccess, hermesLatest, hermesPrintsAt } from "./hermes-rest.ts";
import type { RedStoneReader } from "./redstone.ts";
import type { PriceUpdate } from "./ring.ts";
import { Backoff, sleep, TokenBucket, type UpstreamOutcome } from "./upstream.ts";

/**
 * The only way a print is fetched from upstream REST (04-pricing R2; F2, F5). Every caller — a fill, a parlay leg,
 * Lucky, a duel, the pending archive, later the boundary watch — goes through here, so the key's budget is spent in one
 * place:
 * - **Never early.** The print of t is asked for only once it can exist (Pyth: t + 2 s; RedStone: its grid point +
 *   the poll offset).
 * - **Shared.** Asks for one instant share one Hermes call per entitlement class (single-flight per (feed, t) falls out
 *   of it); one RedStone `historical` read serves every RedStone feed at its grid point, cached for a minute.
 * - **Rated.** A token bucket per source (Hermes 1/s, burst 5; RedStone 0.5/s). A caller waits at most 3 s for a token;
 *   past that it is refused and its own retry decides.
 * - **Its own backoff.** A refusal rests this source only — never the live stream or the live poll.
 * Undefined means no print now: not yet, refused, resting or missing — the counters say which.
 */
export type PrintSourceKind = "pyth" | "redstone";

/** Per upstream source; `asked` counts callers, the rest count what became of them or of the calls they made. */
export interface PrintFetchStats {
  asked: number;
  /** Joined a call already collecting or in flight, or a cached history read. */
  joined: number;
  /** Asked before the print could exist. */
  early: number;
  /** Refused by the rate budget. */
  throttled: number;
  /** Refused while the source rests after a failure. */
  resting: number;
  /** Upstream calls answered with prints. */
  fetched: number;
  /** Upstream calls answered "no such print". */
  missing: number;
  failed: number;
  lastFailure: string | null;
}

interface Source {
  bucket: TokenBucket;
  backoff: Backoff;
  stats: PrintFetchStats;
}

/** One Hermes call for one instant and class: open while it collects and waits for its token. */
interface HermesBatch {
  feeds: Set<Hex>;
  open: boolean;
  done: Promise<ReadonlyMap<Hex, PriceUpdate>>;
}

interface HistoryRead {
  expiresAt: number;
  done: Promise<PriceUpdate[] | undefined>;
}

const NO_PRINTS: ReadonlyMap<Hex, PriceUpdate> = new Map();
const REDSTONE_GRID_SEC = REDSTONE_GRID_MS / MS_PER_SECOND;

function source(ratePerSec: number, burst: number): Source {
  return {
    bucket: new TokenBucket(ratePerSec, burst),
    backoff: new Backoff(PRINT_FETCH_BACKOFF_MIN_MS, PRINT_FETCH_BACKOFF_MAX_MS),
    stats: {
      asked: 0,
      joined: 0,
      early: 0,
      throttled: 0,
      resting: 0,
      fetched: 0,
      missing: 0,
      failed: 0,
      lastFailure: null,
    },
  };
}

export class PrintFetcher {
  private readonly hermes = source(HERMES_REST_RATE_PER_SEC, HERMES_REST_BURST);
  private readonly redstone = source(REDSTONE_HISTORY_RATE_PER_SEC, REDSTONE_HISTORY_BURST);
  /** The newest batch per `class:t`. */
  private readonly batches = new Map<string, HermesBatch>();
  /** History reads per grid point (ms). */
  private readonly history = new Map<number, HistoryRead>();

  constructor(
    private readonly hermesAccess: HermesAccess | undefined,
    private readonly redstoneReader: RedStoneReader | undefined,
    private readonly log: Logger,
  ) {}

  stats(): Record<PrintSourceKind, PrintFetchStats> {
    return { pyth: { ...this.hermes.stats }, redstone: { ...this.redstone.stats } };
  }

  /** The unique print of t for a single-feed market from upstream REST (a basket is composed by the gateway). */
  async printAt(market: MarketSpec, t: number): Promise<PriceUpdate | undefined> {
    if (market.source.kind === "pyth") return this.hermesAt(market, t);
    if (market.source.kind === "redstone") return this.redstoneAt(feedIdOf(market), t);
    return undefined;
  }

  /** A Pyth market's latest update on Hermes REST (the silence watch's probe), under the same budget. */
  async latestOf(market: MarketSpec): Promise<PriceUpdate | undefined> {
    this.hermes.stats.asked += 1;
    if (!this.hermesAccess || market.source.kind !== "pyth") return undefined;
    if (!(await this.admit(this.hermes))) return undefined;
    const feedId = feedIdOf(market);
    return this.record(this.hermes, "hermes", await hermesLatest(this.hermesAccess, [feedId]))?.get(feedId);
  }

  private async hermesAt(market: MarketSpec, t: number): Promise<PriceUpdate | undefined> {
    const stats = this.hermes.stats;
    stats.asked += 1;
    if (!this.hermesAccess) return undefined;
    if (t > nowSec() - PRINT_GRACE_SEC) {
      stats.early += 1;
      return undefined;
    }
    const feedId = feedIdOf(market);
    const key = `${hermesClassOf(market.kind)}:${t}`;
    let batch = this.batches.get(key);
    if (batch && (batch.open || batch.feeds.has(feedId))) stats.joined += 1;
    else batch = this.openBatch(key, this.hermesAccess, t);
    if (batch.open) batch.feeds.add(feedId);
    return (await batch.done).get(feedId);
  }

  private openBatch(key: string, access: HermesAccess, t: number): HermesBatch {
    const batch: HermesBatch = { feeds: new Set(), open: true, done: Promise.resolve(NO_PRINTS) };
    batch.done = this.sendBatch(batch, access, t).finally(() => {
      batch.open = false;
      if (this.batches.get(key) === batch) this.batches.delete(key);
    });
    this.batches.set(key, batch);
    return batch;
  }

  private async sendBatch(batch: HermesBatch, access: HermesAccess, t: number): Promise<ReadonlyMap<Hex, PriceUpdate>> {
    await sleep(PRINT_BATCH_COLLECT_MS);
    if (!(await this.admit(this.hermes))) return NO_PRINTS;
    batch.open = false;
    const outcome = await hermesPrintsAt(access, [...batch.feeds], t);
    return this.record(this.hermes, "hermes", outcome) ?? NO_PRINTS;
  }

  private async redstoneAt(feedId: Hex, t: number): Promise<PriceUpdate | undefined> {
    const stats = this.redstone.stats;
    stats.asked += 1;
    if (!this.redstoneReader) return undefined;
    // A RedStone print of t is the next grid point's package (at or after t).
    const atMs = Math.ceil(t / REDSTONE_GRID_SEC) * REDSTONE_GRID_MS;
    const now = Date.now();
    if (atMs > now - REDSTONE_POLL_OFFSET_MS) {
      stats.early += 1;
      return undefined;
    }
    let read = this.history.get(atMs);
    if (read && read.expiresAt > now) stats.joined += 1;
    else read = this.readHistory(this.redstoneReader, atMs, now);
    return (await read.done)?.find((u) => u.feedId === feedId);
  }

  private readHistory(reader: RedStoneReader, atMs: number, now: number): HistoryRead {
    for (const [at, r] of this.history) if (r.expiresAt <= now) this.history.delete(at);
    const read: HistoryRead = { expiresAt: now + REDSTONE_HISTORY_CACHE_MS, done: Promise.resolve(undefined) };
    read.done = (async () => {
      if (!(await this.admit(this.redstone))) return undefined;
      const updates = await reader.historical(atMs);
      const outcome: UpstreamOutcome<PriceUpdate[]> = updates
        ? { kind: "ok", value: updates }
        : { kind: "failed", reason: reader.lastError ?? "unavailable", rest: true };
      return this.record(this.redstone, "redstone", outcome);
    })();
    // Only an answer is cached: a refusal or a failure lets the next caller try (under the backoff).
    const forget = () => {
      if (this.history.get(atMs) === read) this.history.delete(atMs);
    };
    void read.done.then((updates) => (updates ? undefined : forget()), forget);
    this.history.set(atMs, read);
    return read;
  }

  /** Not resting, and a token within the queue limit (waited for). */
  private async admit(s: Source): Promise<boolean> {
    if (s.backoff.resting()) {
      s.stats.resting += 1;
      return false;
    }
    const waitMs = s.bucket.reserve(PRINT_FETCH_MAX_QUEUE_MS);
    if (waitMs === null) {
      s.stats.throttled += 1;
      return false;
    }
    if (waitMs > 0) await sleep(waitMs);
    return true;
  }

  private record<T>(s: Source, name: string, outcome: UpstreamOutcome<T>): T | undefined {
    if (outcome.kind === "ok") {
      s.backoff.ok();
      s.stats.fetched += 1;
      return outcome.value;
    }
    if (outcome.kind === "missing") {
      s.backoff.ok();
      s.stats.missing += 1;
      return undefined;
    }
    s.stats.failed += 1;
    s.stats.lastFailure = outcome.reason;
    const restMs = outcome.rest ? s.backoff.fail() : 0;
    this.log.warn({ source: name, err: outcome.reason, restMs }, "print fetch failed");
    return undefined;
  }
}

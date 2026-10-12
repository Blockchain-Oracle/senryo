import { type Hex, type SignedSigmaMark, type Signer, signSigmaMark } from "@senryo/chain";
import { type ChainId, feedIdOf, type MarketSpec, sigmaBoundsOf, sigmaE8Of } from "@senryo/config";
import { clampMark, markMinuteOf, SIGMA_MARK_STEP_SEC, type SigmaPair } from "@senryo/core";
import {
  type Db,
  type Logger,
  MS_PER_SECOND,
  marketOpenAt,
  nowSec,
  type SigmaMarkValue,
  sigmaMarkFor,
  sigmaMarksAt,
} from "@senryo/service-common";
import type { StreamBus } from "../stream/bus.ts";

/**
 * The api's σ marks (R4.3, D-313). The keeper writes every feed's mark just after each minute (`sigma_marks`); a
 * little later this desk makes sure each exists — computing any the keeper missed — and streams the minute to the apps
 * (`sigma` on `prints`), so a device quotes with the mark its fill will carry. The relay's fills sign the stored mark
 * of their instant (`signed`); the exit watcher, Lucky and the relay's checks price with it (`quoteMark`). Marks are
 * cached per feed and minute — a stored mark never changes.
 */
const PUBLISH_AFTER_MS = 4_500;
/** Feed-minutes cached (every feed's last few minutes). */
const CACHE_KEEP = 512;
const KEEP_FRAMES = 2;

export interface SigmaFrameOut {
  minute: number;
  marks: [string, bigint, bigint][];
}

export class SigmaDesk {
  private readonly markets = new Map<Hex, MarketSpec[]>();
  private readonly cache = new Map<string, Promise<SigmaMarkValue>>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly d: { db: Db; bus: StreamBus; log: Logger; markets: readonly MarketSpec[] }) {
    for (const m of d.markets) {
      const feed = feedIdOf(m).toLowerCase() as Hex;
      this.markets.set(feed, [...(this.markets.get(feed) ?? []), m]);
    }
  }

  start(): void {
    const now = Date.now();
    const minuteMs = SIGMA_MARK_STEP_SEC * MS_PER_SECOND;
    const next = now - (now % minuteMs) + PUBLISH_AFTER_MS;
    const at = next > now ? next : next + minuteMs;
    this.timer = setTimeout(() => {
      const minute = Math.floor((Date.now() - PUBLISH_AFTER_MS) / minuteMs) * SIGMA_MARK_STEP_SEC;
      void this.publish(minute).catch((error) =>
        this.d.log.warn({ err: (error as Error).message, minute }, "σ marks not published"),
      );
      this.start();
    }, at - now);
  }

  stop(): void {
    clearTimeout(this.timer);
  }

  /** `feedId`'s stored mark through `minute` (computed and stored first if nobody has). */
  markAt(feedId: Hex, minute: number): Promise<SigmaMarkValue> {
    const feed = feedId.toLowerCase() as Hex;
    const key = `${feed}:${minute}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const market = this.markets.get(feed)?.[0];
    if (!market) return Promise.reject(new Error(`no market for feed ${feedId}`));
    const work = sigmaMarkFor(this.d.db, feed, minute, sigmaE8Of(market), marketOpenAt(market));
    this.cache.set(key, work);
    work.catch(() => this.cache.delete(key));
    if (this.cache.size > CACHE_KEEP) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    return work;
  }

  /** The mark a fill at `target` carries, signed under `chainId`'s reserve domain by an allowed signer. */
  async signed(signer: Signer, chainId: ChainId, feedId: Hex, target: number): Promise<SignedSigmaMark> {
    const m = await this.markAt(feedId, markMinuteOf(target));
    return signSigmaMark(signer, chainId, { feedId, minute: m.minute, fastE8: m.fastE8, slowE8: m.slowE8 });
  }

  /** The σ a fill at `fillAt` prices `market` on, held to its series' bounds as the reserve holds it. */
  async quoteMark(market: MarketSpec, fillAt: number): Promise<SigmaPair> {
    const m = await this.markAt(feedIdOf(market), markMinuteOf(fillAt));
    const { floorE8, capE8 } = sigmaBoundsOf(market);
    return clampMark(m, BigInt(floorE8), BigInt(capE8));
  }

  /** The last two minutes' marks, for a reconnecting app (`GET /v1/markets/sigma`). */
  async frames(now = nowSec()): Promise<SigmaFrameOut[]> {
    const latest = markMinuteOf(now);
    const minutes = Array.from({ length: KEEP_FRAMES }, (_, i) => latest - i * SIGMA_MARK_STEP_SEC);
    const rows = await sigmaMarksAt(this.d.db, minutes);
    return minutes
      .map((minute) => ({ minute, marks: this.marksOf(rows.filter((r) => r.minute === minute)) }))
      .filter((f) => f.marks.length > 0)
      .reverse();
  }

  /** Every feed's mark through `minute`, then the minute to every app. */
  private async publish(minute: number): Promise<void> {
    const values: SigmaMarkValue[] = [];
    for (const feed of this.markets.keys()) {
      try {
        values.push(await this.markAt(feed, minute));
      } catch (error) {
        this.d.log.warn({ err: (error as Error).message, feed, minute }, "σ mark not computed");
      }
    }
    this.d.bus.tick("prints", "sigma", { minute, marks: this.marksOf(values) });
  }

  private marksOf(values: readonly SigmaMarkValue[]): [string, bigint, bigint][] {
    return values.flatMap((v) =>
      (this.markets.get(v.feedId.toLowerCase() as Hex) ?? []).map(
        (m) => [m.symbol, v.fastE8, v.slowE8] as [string, bigint, bigint],
      ),
    );
  }
}

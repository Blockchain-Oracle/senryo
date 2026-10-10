import type { Hex } from "@senryo/chain";
import { archivedPrint, type Db, type Logger, MS_PER_SECOND, nowSec } from "@senryo/service-common";
import { BOUNDARY_SEC, CANDLE_CLOSE_GRACE_SEC } from "./constants.ts";
import { type PriceUpdate, provesInstant, toE8 } from "./ring.ts";

/**
 * The `pyth_prints` archive and the 1-minute candles (D-272). Every window boundary (each minute) is archived the
 * moment its unique print streams in — Hermes forgets after ~640 s, the chain may need it later (settlement, a late
 * keeper, Proof). Fill instants are archived when the relay asks for them. A minute's candle is written when the
 * feed's next minute starts, by a minute timer when no next minute comes (a closed market, a silent feed), and on
 * shutdown — merged, so a minute split by a restart keeps its first open and its last close (04-pricing R18).
 */
interface Candle {
  minute: number;
  open: bigint;
  high: bigint;
  low: bigint;
  close: bigint;
}

export class PriceArchive {
  private readonly openCandles = new Map<Hex, Candle>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly db: Db,
    private readonly log: Logger,
  ) {}

  /** Each minute boundary this update proves (usually none or one). */
  boundariesOf(u: PriceUpdate): number[] {
    const out: number[] = [];
    const first = u.prevPublishTime + 1;
    for (
      let t = first + ((BOUNDARY_SEC - (first % BOUNDARY_SEC)) % BOUNDARY_SEC);
      t <= u.publishTime;
      t += BOUNDARY_SEC
    ) {
      if (provesInstant(u, t)) out.push(t);
    }
    return out;
  }

  async savePrint(u: PriceUpdate, t: number, source: "stream" | "rest"): Promise<void> {
    if (!provesInstant(u, t)) return;
    await this.db`
      INSERT INTO pyth_prints (feed_id, t, publish_time, prev_publish_time, price, conf, expo, update_hex, source)
      VALUES (${u.feedId}, ${t}, ${u.publishTime}, ${u.prevPublishTime}, ${u.price}, ${u.conf}, ${u.expo},
              ${u.updates.join(",")}, ${source})
      ON CONFLICT (feed_id, t) DO NOTHING`;
  }

  /** Each minute, a little after it ends: candles no next minute has closed. */
  start(): void {
    const now = Date.now();
    const minuteMs = BOUNDARY_SEC * MS_PER_SECOND;
    const next = now - (now % minuteMs) + minuteMs + CANDLE_CLOSE_GRACE_SEC * MS_PER_SECOND;
    this.timer = setTimeout(() => {
      this.closeEnded(nowSec());
      this.start();
    }, next - now);
  }

  /** Writes every open candle, the running minute's too (shutdown). */
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    const open = [...this.openCandles];
    this.openCandles.clear();
    await Promise.all(open.map(([feedId, c]) => this.writeCandle(feedId, c)));
  }

  async printAt(feedId: Hex, t: number): Promise<PriceUpdate | undefined> {
    const p = await archivedPrint(this.db, feedId, t);
    return p ? { ...p, receivedAt: p.recordedAt } : undefined;
  }

  /** Folds a price into its minute; a finished minute is written when the next one starts. */
  foldCandle(u: PriceUpdate): void {
    const minute = u.publishTime - (u.publishTime % BOUNDARY_SEC);
    const e8 = toE8(u.price, u.expo);
    const c = this.openCandles.get(u.feedId);
    if (!c || c.minute !== minute) {
      if (c && c.minute < minute) void this.writeCandle(u.feedId, c);
      this.openCandles.set(u.feedId, { minute, open: e8, high: e8, low: e8, close: e8 });
      return;
    }
    if (e8 > c.high) c.high = e8;
    if (e8 < c.low) c.low = e8;
    c.close = e8;
  }

  async candles(feedId: Hex, from: number, to: number) {
    return this.db<{ minute: bigint; open: bigint; high: bigint; low: bigint; close: bigint }[]>`
      SELECT minute, open, high, low, close FROM price_candles
      WHERE feed_id = ${feedId} AND minute >= ${from} AND minute <= ${to} ORDER BY minute`;
  }

  private closeEnded(now: number): void {
    for (const [feedId, c] of this.openCandles) {
      if (c.minute + BOUNDARY_SEC + CANDLE_CLOSE_GRACE_SEC > now) continue;
      this.openCandles.delete(feedId);
      void this.writeCandle(feedId, c);
    }
  }

  /** The first write keeps its open; a later part of the same minute widens high/low and brings the close. */
  private async writeCandle(feedId: Hex, c: Candle) {
    try {
      await this.db`
        INSERT INTO price_candles (feed_id, minute, open, high, low, close)
        VALUES (${feedId}, ${c.minute}, ${c.open}, ${c.high}, ${c.low}, ${c.close})
        ON CONFLICT (feed_id, minute) DO UPDATE SET
          high = GREATEST(price_candles.high, EXCLUDED.high),
          low = LEAST(price_candles.low, EXCLUDED.low),
          close = EXCLUDED.close`;
    } catch (error) {
      this.log.warn({ err: (error as Error).message, feedId }, "candle write failed");
    }
  }
}

import type { Hex } from "@senryo/chain";
import { REDSTONE_KEYLESS_END_SEC } from "@senryo/config";
import { type Logger, nowSec } from "@senryo/service-common";
import {
  REDSTONE_BACKOFF_MAX_MS,
  REDSTONE_BACKOFF_MIN_MS,
  REDSTONE_FETCH_TIMEOUT_MS,
  REDSTONE_GRID_MS,
  REDSTONE_POLL_OFFSET_MS,
  REDSTONE_PUBLIC_GATEWAYS,
  REDSTONE_SERVICE,
} from "./constants.ts";
import { isJsonObject, medianAndConf, payloadOf } from "./redstone-packages.ts";
import { RedStoneParser } from "./redstone-parser.ts";
import type { PriceUpdate } from "./ring.ts";
import { Backoff } from "./upstream.ts";

/**
 * RedStone's signed packages (D-284) for the markets it prices: one "latest" read a little after each 10-second grid
 * point (the gateway answers every feed at once, ~2 MB), each listed feed's packages rebuilt byte for byte into the wire
 * payload `RedStonePrintVerifier` checks (feedId ‖ value ‖ ts ‖ 32 ‖ 1 ‖ r ‖ s ‖ v per package, then N ‖ 0 ‖ marker),
 * and handed to the gateway as an update whose instant is its grid point — so archiving, boundary prints, candles, ticks
 * and baskets work as for Pyth. Values are read from the response's exact decimal text (a float would change the
 * signed bytes). Keys (`REDSTONE_GATEWAYS`) travel only in `x-api-key`, never in a log; without one the public pair
 * answers outside RedStone's refusal windows (until 29 Oct 2026), and a refusal rests the live poll, doubling to
 * 10 min. `historical` never rests the poll: the `PrintFetcher` calls it under its own rate and backoff (R2, F2).
 * A 2xx is trusted only when it is the gateway's JSON and decodes (04-pricing F1): gateway-1 answers unknown and
 * `historical` paths with a 200 `text/html` "Hello! I am working correctly", which once threw out of the poll and
 * would have exited the api. The ~2 MB answer is parsed in a worker (`RedStoneParser`, 04-pricing R14).
 */
export interface RedStoneGateway {
  url: string;
  apiKey: string | null;
}

const E8_DECIMALS = 8;
const MS = 1000;

export class RedStoneReader {
  private readonly gateways: RedStoneGateway[];
  private readonly wanted: ReadonlySet<string>;
  private readonly parser: RedStoneParser;
  private readonly keyed: boolean;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private readonly backoff = new Backoff(REDSTONE_BACKOFF_MIN_MS, REDSTONE_BACKOFF_MAX_MS);
  lastOkAt = 0;
  lastError: string | null = null;

  constructor(
    private readonly feeds: ReadonlyMap<string, Hex>,
    private readonly onUpdate: (u: PriceUpdate) => void,
    private readonly log: Logger,
    configured: RedStoneGateway[] | undefined,
  ) {
    this.keyed = Boolean(configured?.length);
    this.gateways = this.keyed ? (configured ?? []) : REDSTONE_PUBLIC_GATEWAYS.map((url) => ({ url, apiKey: null }));
    this.wanted = new Set(feeds.keys());
    this.parser = new RedStoneParser(log);
  }

  start(): void {
    if (this.feeds.size === 0) return;
    this.schedule();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.parser.stop();
  }

  /**
   * Each feed's update at the grid point `ms` from the gateway's history (the print a fill or boundary missed), or
   * undefined when every gateway failed (`lastError` says why).
   */
  async historical(ms: number): Promise<PriceUpdate[] | undefined> {
    return this.read(`data-packages/historical/${REDSTONE_SERVICE}/${ms}`, (body) => this.updates(body));
  }

  /** The public gateways are gone after 29 Oct (D-310): without a key there is nothing to call. */
  private keylessEnded(): boolean {
    return !this.keyed && nowSec() >= REDSTONE_KEYLESS_END_SEC;
  }

  private schedule(): void {
    if (this.keylessEnded()) {
      this.log.warn("RedStone's keyless access has ended; its markets stay paused until REDSTONE_GATEWAYS is set");
      return;
    }
    const now = Date.now();
    // The next instant `REDSTONE_POLL_OFFSET_MS` after a grid point (this cycle's, if it is still ahead).
    const thisCycle = now - (now % REDSTONE_GRID_MS) + REDSTONE_POLL_OFFSET_MS;
    const next = thisCycle > now ? thisCycle : thisCycle + REDSTONE_GRID_MS;
    this.timer = setTimeout(() => {
      void this.poll()
        .catch((error) => this.log.warn({ err: (error as Error).message }, "redstone poll failed"))
        .finally(() => this.schedule());
    }, Math.max(next, this.backoff.until) - now);
  }

  private async poll(): Promise<void> {
    const updates = await this.read(`data-packages/latest/${REDSTONE_SERVICE}`, (body) => this.updates(body));
    if (!updates) {
      const restMs = this.backoff.fail();
      this.log.warn({ err: this.lastError, restMs }, "redstone unavailable; resting");
      return;
    }
    this.backoff.ok();
    for (const u of updates) this.onUpdate(u);
  }

  private async updates(body: ArrayBuffer): Promise<PriceUpdate[]> {
    const parsed = await this.parser.parse(body, this.wanted);
    const now = Date.now();
    return [...parsed].flatMap(([feed, packages]) => {
      const feedId = this.feeds.get(feed);
      const first = packages[0];
      if (!feedId || !first) return [];
      const { median, conf } = medianAndConf(packages.map((p) => p.value));
      const at = first.ts / MS;
      return [
        {
          feedId,
          publishTime: at,
          prevPublishTime: at - REDSTONE_GRID_MS / MS,
          price: median,
          conf,
          expo: -E8_DECIMALS,
          updates: [payloadOf(packages)],
          receivedAt: now,
        },
      ];
    });
  }

  /**
   * One read across the gateways in order. A gateway fails on a refusal (403/429/5xx), a timeout, a 2xx that isn't its
   * JSON, or a body that doesn't decode; the next one is tried. Undefined when every gateway failed.
   */
  private async read<T>(path: string, decode: (body: ArrayBuffer) => Promise<T>): Promise<T | undefined> {
    if (this.keylessEnded()) {
      this.lastError = "keyless access ended";
      return undefined;
    }
    for (const g of this.gateways) {
      let host = g.url;
      try {
        host = new URL(g.url).host;
        const res = await fetch(`${g.url.replace(/\/+$/, "")}/${path}`, {
          headers: g.apiKey ? { "x-api-key": g.apiKey } : {},
          signal: AbortSignal.timeout(REDSTONE_FETCH_TIMEOUT_MS),
        });
        if (!res.ok) {
          this.lastError = `HTTP ${res.status} from ${host}`;
          continue;
        }
        const body = await res.arrayBuffer();
        if (!isJsonObject(res.headers.get("content-type"), body)) {
          this.lastError = `non-JSON ${res.status} from ${host}`;
          continue;
        }
        const value = await decode(body);
        this.lastOkAt = Date.now();
        this.lastError = null;
        return value;
      } catch (error) {
        this.lastError = `${(error as Error).name} from ${host}`;
      }
    }
    return undefined;
  }
}

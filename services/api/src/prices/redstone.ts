import type { Hex } from "@senryo/chain";
import type { Logger } from "@senryo/service-common";
import {
  REDSTONE_BACKOFF_MAX_MS,
  REDSTONE_BACKOFF_MIN_MS,
  REDSTONE_FETCH_TIMEOUT_MS,
  REDSTONE_GRID_MS,
  REDSTONE_POLL_OFFSET_MS,
  REDSTONE_PUBLIC_GATEWAYS,
  REDSTONE_SERVICE,
} from "./constants.ts";
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
 * would have exited the api.
 */
export interface RedStoneGateway {
  url: string;
  apiKey: string | null;
}

interface Package {
  ts: number;
  value: bigint;
  signature: Uint8Array;
  feed: string;
}

const E8_DECIMALS = 8;
const DECIMAL = /^(\d+)(?:\.(\d+))?$/;
const VALUE_BYTES = 32;
/** Every package carries one 32-byte value (`RedStonePayload`). */
const VALUE_SIZE = 32n;
const DECIMAL_BASE = 10n;
const TS_BYTES = 6;
const SIZE_BYTES = 4;
const COUNT_BYTES = 3;
const FEED_BYTES = 32;
const N_BYTES = 2;
const META_BYTES = 3;
const MARKER = "000002ed57011e0000";
const HEX = 16;
const MS = 1000;
const HALF = 2n;
const JSON_CONTENT_TYPE = "application/json";
/** Every RedStone route answers one JSON object keyed by feed. */
const JSON_OBJECT_START = /^\s*\{/;

const hexOf = (n: bigint, bytes: number) => n.toString(HEX).padStart(bytes * 2, "0");

/** The gateway's JSON, not a placeholder page, a CDN interstitial or a refusal served as 200. */
function isJsonObject(contentType: string | null, text: string): boolean {
  return (contentType ?? "").toLowerCase().includes(JSON_CONTENT_TYPE) && JSON_OBJECT_START.test(text);
}

/** "229.57362253" → 22957362253 (× 1e8, exact); null for more than 8 decimals or a non-plain number. */
export function decimalToE8(text: string): bigint | null {
  const m = DECIMAL.exec(text);
  if (!m) return null;
  const frac = m[2] ?? "";
  if (frac.length > E8_DECIMALS) return null;
  return BigInt(m[1] ?? "0") * DECIMAL_BASE ** BigInt(E8_DECIMALS) + BigInt(frac.padEnd(E8_DECIMALS, "0") || "0");
}

/** The wire payload for one feed's packages at one timestamp (`RedStonePayload`). */
export function payloadOf(packages: readonly Package[]): Hex {
  const body = packages
    .map((p) => {
      const feed = Buffer.from(p.feed, "ascii")
        .toString("hex")
        .padEnd(FEED_BYTES * 2, "0");
      const signed = `${feed}${hexOf(p.value, VALUE_BYTES)}${hexOf(BigInt(p.ts), TS_BYTES)}${hexOf(VALUE_SIZE, SIZE_BYTES)}${hexOf(1n, COUNT_BYTES)}`;
      return `${signed}${Buffer.from(p.signature).toString("hex")}`;
    })
    .join("");
  return `0x${body}${hexOf(BigInt(packages.length), N_BYTES)}${hexOf(0n, META_BYTES)}${MARKER}`;
}

/** The verifier's median (even count: floored average) and half the spread. */
export function medianAndConf(values: readonly bigint[]): { median: bigint; conf: bigint } {
  const v = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mid = Math.floor(v.length / Number(HALF));
  const median = v.length % 2 === 1 ? (v[mid] ?? 0n) : ((v[mid - 1] ?? 0n) + (v[mid] ?? 0n)) / HALF;
  return { median, conf: ((v.at(-1) ?? 0n) - (v[0] ?? 0n)) / HALF };
}

/** Parses the gateway's answer, keeping each value's source text (`JSON.parse` source access, Node ≥ 21). */
function parse(text: string, wanted: ReadonlySet<string>): Map<string, Package[]> {
  const raw = JSON.parse(text, (key, value, context?: { source?: string }) =>
    key === "value" && typeof value === "number" && context?.source ? context.source : value,
  ) as Record<
    string,
    { timestampMilliseconds: number; signature: string; dataPoints: { dataFeedId: string; value: string }[] }[]
  >;
  const out = new Map<string, Package[]>();
  for (const feed of wanted) {
    const packages = raw[feed] ?? [];
    const latest = Math.max(0, ...packages.map((p) => p.timestampMilliseconds));
    const at = packages.flatMap((p) => {
      const dp = p.dataPoints[0];
      const value = dp ? decimalToE8(String(dp.value)) : null;
      if (p.timestampMilliseconds !== latest || !dp || dp.dataFeedId !== feed || value === null) return [];
      return [{ ts: latest, value, signature: Buffer.from(p.signature, "base64"), feed }];
    });
    if (at.length > 0) out.set(feed, at);
  }
  return out;
}

export class RedStoneReader {
  private readonly gateways: RedStoneGateway[];
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
    this.gateways = configured?.length ? configured : REDSTONE_PUBLIC_GATEWAYS.map((url) => ({ url, apiKey: null }));
  }

  start(): void {
    if (this.feeds.size === 0) return;
    this.schedule();
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  /**
   * Each feed's update at the grid point `ms` from the gateway's history (the print a fill or boundary missed), or
   * undefined when every gateway failed (`lastError` says why).
   */
  async historical(ms: number): Promise<PriceUpdate[] | undefined> {
    return this.read(`data-packages/historical/${REDSTONE_SERVICE}/${ms}`, (text) => this.updates(text));
  }

  private schedule(): void {
    const now = Date.now();
    const next = now - (now % REDSTONE_GRID_MS) + REDSTONE_GRID_MS + REDSTONE_POLL_OFFSET_MS;
    this.timer = setTimeout(() => {
      void this.poll()
        .catch((error) => this.log.warn({ err: (error as Error).message }, "redstone poll failed"))
        .finally(() => this.schedule());
    }, Math.max(next, this.backoff.until) - now);
  }

  private async poll(): Promise<void> {
    const updates = await this.read(`data-packages/latest/${REDSTONE_SERVICE}`, (text) => this.updates(text));
    if (!updates) {
      const restMs = this.backoff.fail();
      this.log.warn({ err: this.lastError, restMs }, "redstone unavailable; resting");
      return;
    }
    this.backoff.ok();
    for (const u of updates) this.onUpdate(u);
  }

  private updates(text: string): PriceUpdate[] {
    const now = Date.now();
    return [...parse(text, new Set(this.feeds.keys()))].flatMap(([feed, packages]) => {
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
  private async read<T>(path: string, decode: (text: string) => T | Promise<T>): Promise<T | undefined> {
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
        const text = await res.text();
        if (!isJsonObject(res.headers.get("content-type"), text)) {
          this.lastError = `non-JSON ${res.status} from ${host}`;
          continue;
        }
        const value = await decode(text);
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

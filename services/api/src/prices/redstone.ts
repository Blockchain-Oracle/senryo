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

/**
 * RedStone's signed packages (D-284) for the markets it prices: one "latest" read a little after each 10-second grid
 * point (the gateway answers every feed at once, ~2 MB), each listed feed's packages rebuilt byte for byte into the wire
 * payload `RedStonePrintVerifier` checks (feedId ‖ value ‖ ts ‖ 32 ‖ 1 ‖ r ‖ s ‖ v per package, then N ‖ 0 ‖ marker),
 * and handed to the gateway as an update whose instant is its grid point — so archiving, boundary prints, candles, ticks
 * and baskets work as for Pyth. Values are read from the response's exact decimal text (a float would change the
 * signed bytes). Keys (`REDSTONE_GATEWAYS`) travel only in `x-api-key`, never in a log; without one the public pair
 * answers outside RedStone's refusal windows (until 29 Oct 2026), and a refusal rests the reader, doubling to 10 min.
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

const hexOf = (n: bigint, bytes: number) => n.toString(HEX).padStart(bytes * 2, "0");

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
  private restUntil = 0;
  private backoffMs = REDSTONE_BACKOFF_MIN_MS;
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

  /** Each feed's update at the grid point `ms` from the gateway's history (the print a fill or boundary missed). */
  async historical(ms: number): Promise<PriceUpdate[]> {
    const text = await this.fetch(`data-packages/historical/${REDSTONE_SERVICE}/${ms}`);
    return text ? this.updates(text) : [];
  }

  private schedule(): void {
    const now = Date.now();
    const next = now - (now % REDSTONE_GRID_MS) + REDSTONE_GRID_MS + REDSTONE_POLL_OFFSET_MS;
    this.timer = setTimeout(
      () => void this.poll().finally(() => this.schedule()),
      Math.max(next, this.restUntil) - now,
    );
  }

  private async poll(): Promise<void> {
    const text = await this.fetch(`data-packages/latest/${REDSTONE_SERVICE}`);
    if (!text) return;
    for (const u of this.updates(text)) this.onUpdate(u);
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

  /** One read across the gateways in order; a refusal (403/429/5xx) rests the reader with a doubling backoff. */
  private async fetch(path: string): Promise<string | undefined> {
    for (const g of this.gateways) {
      try {
        const res = await fetch(`${g.url.replace(/\/+$/, "")}/${path}`, {
          headers: g.apiKey ? { "x-api-key": g.apiKey } : {},
          signal: AbortSignal.timeout(REDSTONE_FETCH_TIMEOUT_MS),
        });
        if (res.ok) {
          this.lastOkAt = Date.now();
          this.lastError = null;
          this.backoffMs = REDSTONE_BACKOFF_MIN_MS;
          return await res.text();
        }
        this.lastError = `HTTP ${res.status} from ${new URL(g.url).host}`;
      } catch (error) {
        this.lastError = `${(error as Error).name} from ${new URL(g.url).host}`;
      }
    }
    this.restUntil = Date.now() + this.backoffMs;
    this.log.warn({ err: this.lastError, restMs: this.backoffMs }, "redstone unavailable; resting");
    this.backoffMs = Math.min(this.backoffMs * 2, REDSTONE_BACKOFF_MAX_MS);
    return undefined;
  }
}

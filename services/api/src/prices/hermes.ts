import type { Hex } from "@senryo/chain";
import type { MarketKind } from "@senryo/config";
import { HTTP_STATUS, type Logger } from "@senryo/service-common";
import { createParser } from "eventsource-parser";
import {
  BACKOFF_MAX_MS,
  BACKOFF_MIN_MS,
  HERMES_ORIGIN,
  REST_TIMEOUT_MS,
  ROTATE_AFTER_MS,
  WATCHDOG_MS,
} from "./constants.ts";
import type { PriceUpdate } from "./ring.ts";
import type { UpstreamOutcome } from "./upstream.ts";

/**
 * Hermes over raw `fetch` + `eventsource-parser` (D-272): the key travels only in the `Authorization` header (never a
 * URL — `@pythnetwork/hermes-client` puts it in the query), one stream for all feeds, a watchdog, jittered backoff and
 * an overlapping rotation before Hermes closes the stream at 24 h. Errors are counted by status for `/status`. Prints
 * the stream missed come from `hermesPrintsAt`, called only by the `PrintFetcher` (its own rate and backoff).
 */

interface HermesParsed {
  id: string;
  price: { price: string; conf: string; expo: number; publish_time: number };
  metadata?: { prev_publish_time?: number };
}

interface HermesMessage {
  binary: { encoding: string; data: string[] };
  parsed: HermesParsed[];
}

export interface HermesStatus {
  connected: boolean;
  lastFrameAt: number;
  lastError: string | null;
  /** Last HTTP status that was not 200 (401/403/429 mean the key, the entitlement or the rate). */
  lastBadStatus: number | null;
}

export function updatesOf(message: HermesMessage, receivedAt: number): PriceUpdate[] {
  const updates = message.binary.data.map((d) => `0x${d}` as Hex);
  return message.parsed.map((p) => ({
    feedId: `0x${p.id}` as Hex,
    publishTime: p.price.publish_time,
    prevPublishTime: p.metadata?.prev_publish_time ?? p.price.publish_time,
    price: BigInt(p.price.price),
    conf: BigInt(p.price.conf),
    expo: p.price.expo,
    updates,
    receivedAt,
  }));
}

function query(feedIds: readonly Hex[]): string {
  return feedIds.map((id) => `ids[]=${id.slice(2)}`).join("&");
}

/**
 * The key's entitlement classes (04-pricing R5): a feed the key isn't entitled to makes Hermes refuse the whole request
 * (403, D-281), so crypto and the rest (equities, metals, fx) never share one call.
 */
export type HermesClass = "crypto" | "tradfi";

export function hermesClassOf(kind: MarketKind): HermesClass {
  return kind === "crypto" ? "crypto" : "tradfi";
}

/** Statuses that mean the key, the entitlement, the rate or the service: the caller rests. Other 4xx are our asks. */
function rests(status: number): boolean {
  return (
    status === HTTP_STATUS.unauthorized ||
    status === HTTP_STATUS.forbidden ||
    status === HTTP_STATUS.tooMany ||
    status >= HTTP_STATUS.internal
  );
}

/**
 * Hermes REST: for each feed, the first update whose publish time is ≥ t (the unique print of t) — one call for many
 * feeds of one class. Unknown ids are ignored rather than failing the call. 404 is "no such print", not a failure.
 */
export async function hermesPrintsAt(
  key: string,
  feedIds: readonly Hex[],
  t: number,
): Promise<UpstreamOutcome<Map<Hex, PriceUpdate>>> {
  const url = `${HERMES_ORIGIN}/v2/updates/price/${t}?${query(feedIds)}&encoding=hex&parsed=true&ignore_invalid_price_ids=true`;
  try {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(REST_TIMEOUT_MS),
    });
    if (res.status === HTTP_STATUS.notFound) return { kind: "missing" };
    if (!res.ok) return { kind: "failed", reason: `HTTP ${res.status}`, rest: rests(res.status) };
    const updates = updatesOf((await res.json()) as HermesMessage, Date.now());
    return { kind: "ok", value: new Map(updates.map((u) => [u.feedId, u])) };
  } catch (error) {
    return { kind: "failed", reason: (error as Error).name, rest: true };
  }
}

export class HermesStream {
  readonly status: HermesStatus = { connected: false, lastFrameAt: 0, lastError: null, lastBadStatus: null };
  private controller: AbortController | undefined;
  private stopped = false;
  private attempt = 0;

  constructor(
    private readonly key: string,
    private readonly feedIds: readonly Hex[],
    private readonly onUpdate: (u: PriceUpdate) => void,
    private readonly log: Logger,
  ) {}

  start(): void {
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.controller?.abort();
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const controller = new AbortController();
    this.controller = controller;
    const url = `${HERMES_ORIGIN}/v2/updates/price/stream?${query(this.feedIds)}&encoding=hex&parsed=true&allow_unordered=false&benchmarks_only=false`;
    let watchdog: ReturnType<typeof setInterval> | undefined;
    let rotate: ReturnType<typeof setTimeout> | undefined;
    try {
      const res = await fetch(url, {
        headers: { authorization: `Bearer ${this.key}`, accept: "text/event-stream" },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        this.status.lastBadStatus = res.status;
        throw new Error(`hermes stream ${res.status}`);
      }
      this.status.connected = true;
      this.status.lastFrameAt = Date.now();
      this.attempt = 0;
      watchdog = setInterval(() => {
        if (Date.now() - this.status.lastFrameAt > WATCHDOG_MS) controller.abort();
      }, WATCHDOG_MS / 2);
      rotate = setTimeout(() => {
        this.log.info("rotating hermes stream before its 24 h close");
        void this.connect(); // the new stream starts before this one is aborted, so no instant is missed
        setTimeout(() => controller.abort(), WATCHDOG_MS);
      }, ROTATE_AFTER_MS);
      const parser = createParser({
        onEvent: (event) => {
          this.status.lastFrameAt = Date.now();
          try {
            for (const u of updatesOf(JSON.parse(event.data) as HermesMessage, Date.now())) this.onUpdate(u);
          } catch (error) {
            this.status.lastError = (error as Error).message;
          }
        },
      });
      const decoder = new TextDecoder();
      for await (const chunk of res.body) parser.feed(decoder.decode(chunk, { stream: true }));
    } catch (error) {
      if (!controller.signal.aborted || this.controller === controller) {
        this.status.lastError = (error as Error).message;
      }
    } finally {
      clearInterval(watchdog);
      clearTimeout(rotate);
      if (this.controller === controller) {
        this.status.connected = false;
        this.reconnect();
      }
    }
  }

  private reconnect(): void {
    if (this.stopped) return;
    const ceiling = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** this.attempt);
    this.attempt += 1;
    const delay = BACKOFF_MIN_MS + Math.random() * (ceiling - BACKOFF_MIN_MS);
    this.log.warn({ delayMs: Math.round(delay), err: this.status.lastError }, "hermes stream down; reconnecting");
    setTimeout(() => void this.connect(), delay);
  }
}

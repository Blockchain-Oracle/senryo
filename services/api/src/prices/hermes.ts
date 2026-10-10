import type { Hex } from "@senryo/chain";
import type { MarketKind } from "@senryo/config";
import { HTTP_STATUS, type Logger } from "@senryo/service-common";
import { createParser } from "eventsource-parser";
import {
  BACKOFF_MAX_MS,
  BACKOFF_MIN_MS,
  HERMES_CHANNEL,
  HERMES_HEADERS_TIMEOUT_MS,
  HERMES_HEALTHY_RESET_MS,
  ROTATE_AFTER_MS,
  WATCHDOG_MS,
} from "./constants.ts";
import type { PriceUpdate } from "./ring.ts";

/**
 * Hermes over raw `fetch` + `eventsource-parser` (D-272): the key travels only in the `Authorization` header (never a
 * URL — `@pythnetwork/hermes-client` puts it in the query). One stream per entitlement class (04-pricing R5), each with:
 * - a timeout until the headers arrive (undici's own is 300 s);
 * - `ignore_invalid_price_ids` and an explicit `channel`;
 * - a frame watchdog, and a jittered backoff that resets only after 30 s of streaming;
 * - a rotation before Hermes closes the stream at 24 h that retires the old connection only once the new one has
 *   streamed its first frame (a rotation during a hiccup used to turn a healthy stream into an outage);
 * - 401/403 counted and logged as errors (the key or its entitlement), never just retried quietly.
 * Prints the stream missed come from `hermes-rest.ts`, called only by the `PrintFetcher`.
 */

interface HermesParsed {
  id: string;
  price: { price: string; conf: string; expo: number; publish_time: number };
  metadata?: { prev_publish_time?: number };
}

export interface HermesMessage {
  binary: { encoding: string; data: string[] };
  parsed: HermesParsed[];
}

export interface HermesStatus {
  connected: boolean;
  lastFrameAt: number;
  lastError: string | null;
  /** Last HTTP status that was not 200 (401/403/429 mean the key, the entitlement or the rate). */
  lastBadStatus: number | null;
  /** 401/403 answers on connect: the key or its entitlement. */
  authRefusals: number;
  reconnects: number;
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

export function idsQuery(feedIds: readonly Hex[]): string {
  return feedIds.map((id) => `ids[]=${id.slice(2)}`).join("&");
}

/**
 * The key's entitlement classes (04-pricing R5): a feed the key isn't entitled to makes Hermes refuse the whole request
 * (403, D-281), so crypto and the rest (equities, metals, fx) never share a stream or a call.
 */
export const HERMES_CLASSES = ["crypto", "tradfi"] as const;
export type HermesClass = (typeof HERMES_CLASSES)[number];

export function hermesClassOf(kind: MarketKind): HermesClass {
  return kind === "crypto" ? "crypto" : "tradfi";
}

export function isAuthRefusal(status: number): boolean {
  return status === HTTP_STATUS.unauthorized || status === HTTP_STATUS.forbidden;
}

export interface HermesStreamOptions {
  name: HermesClass;
  origin: string;
  key: string;
  feedIds: readonly Hex[];
  onUpdate: (u: PriceUpdate) => void;
  /**
   * On each connection's first frame: the newest publish time streamed before it (0 after a restart — the gap is
   * unknown) and the first one after, so the boundaries in between can be back-filled.
   */
  onResume: (lastPublishSec: number, firstPublishSec: number) => void;
  log: Logger;
}

export class HermesStream {
  readonly status: HermesStatus = {
    connected: false,
    lastFrameAt: 0,
    lastError: null,
    lastBadStatus: null,
    authRefusals: 0,
    reconnects: 0,
  };
  private controller: AbortController | undefined;
  /** A rotated-out connection, retired once its successor streams. */
  private retiring: AbortController | undefined;
  private stopped = false;
  private attempt = 0;
  private restartedAt = 0;
  /** The newest publish time streamed (0 until the first frame). */
  private lastPublishSec = 0;

  constructor(private readonly o: HermesStreamOptions) {}

  start(): void {
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.retiring?.abort();
    this.controller?.abort();
  }

  /** Drop the connection and reconnect (a feed went silent on it but not upstream). At most once per watchdog span. */
  restart(reason: string): void {
    if (Date.now() - this.restartedAt < WATCHDOG_MS) return;
    this.restartedAt = Date.now();
    this.controller?.abort(new Error(reason));
  }

  private url(): string {
    return (
      `${this.o.origin}/v2/updates/price/stream?${idsQuery(this.o.feedIds)}&encoding=hex&parsed=true` +
      `&allow_unordered=false&benchmarks_only=false&ignore_invalid_price_ids=true&channel=${HERMES_CHANNEL}`
    );
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const controller = new AbortController();
    this.controller = controller;
    const headersTimer = setTimeout(() => controller.abort(new Error("no headers in time")), HERMES_HEADERS_TIMEOUT_MS);
    let watchdog: ReturnType<typeof setInterval> | undefined;
    let rotate: ReturnType<typeof setTimeout> | undefined;
    try {
      const res = await fetch(this.url(), {
        headers: { authorization: `Bearer ${this.o.key}`, accept: "text/event-stream" },
        signal: controller.signal,
      });
      clearTimeout(headersTimer);
      if (!res.ok || !res.body) {
        this.refused(res.status);
        throw new Error(`hermes stream ${res.status}`);
      }
      this.status.connected = true;
      const openedAt = Date.now();
      this.status.lastFrameAt = openedAt;
      watchdog = setInterval(() => {
        if (Date.now() - this.status.lastFrameAt > WATCHDOG_MS) controller.abort(new Error("no frame in time"));
      }, WATCHDOG_MS / 2);
      rotate = setTimeout(() => this.rotate(controller), ROTATE_AFTER_MS);
      let first = true;
      const parser = createParser({
        onEvent: (event) => {
          const now = Date.now();
          this.status.lastFrameAt = now;
          if (this.attempt > 0 && now - openedAt >= HERMES_HEALTHY_RESET_MS) this.attempt = 0;
          try {
            const updates = updatesOf(JSON.parse(event.data) as HermesMessage, now);
            if (first && updates.length > 0) {
              first = false;
              this.firstFrame(controller, Math.max(...updates.map((u) => u.publishTime)));
            }
            for (const u of updates) {
              this.lastPublishSec = Math.max(this.lastPublishSec, u.publishTime);
              this.o.onUpdate(u);
            }
          } catch (error) {
            this.status.lastError = (error as Error).message;
          }
        },
      });
      const decoder = new TextDecoder();
      for await (const chunk of res.body) parser.feed(decoder.decode(chunk, { stream: true }));
    } catch (error) {
      if (this.controller === controller || !controller.signal.aborted) {
        this.status.lastError = (error as Error).message;
      }
    } finally {
      clearTimeout(headersTimer);
      clearInterval(watchdog);
      clearTimeout(rotate);
      if (this.controller === controller) {
        this.status.connected = false;
        this.reconnect();
      }
    }
  }

  /** Open the successor; this connection keeps streaming until the successor's first frame retires it. */
  private rotate(old: AbortController): void {
    this.o.log.info({ stream: this.o.name }, "rotating hermes stream before its 24 h close");
    this.retiring = old;
    void this.connect();
  }

  private firstFrame(controller: AbortController, firstPublishSec: number): void {
    if (this.retiring && this.retiring !== controller) {
      this.retiring.abort();
      this.retiring = undefined;
      this.o.log.info({ stream: this.o.name }, "hermes stream rotated");
    }
    this.o.onResume(this.lastPublishSec, firstPublishSec);
  }

  private refused(status: number): void {
    this.status.lastBadStatus = status;
    if (!isAuthRefusal(status)) return;
    this.status.authRefusals += 1;
    this.o.log.error({ stream: this.o.name, status }, "hermes refused the key or its entitlement");
  }

  private reconnect(): void {
    if (this.stopped) return;
    const ceiling = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** this.attempt);
    this.attempt += 1;
    this.status.reconnects += 1;
    const delay = BACKOFF_MIN_MS + Math.random() * (ceiling - BACKOFF_MIN_MS);
    this.o.log.warn(
      { stream: this.o.name, delayMs: Math.round(delay), err: this.status.lastError },
      "hermes stream down; reconnecting",
    );
    setTimeout(() => void this.connect(), delay);
  }
}

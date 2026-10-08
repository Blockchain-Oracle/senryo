// The one SSE connection per app (D-272): `GET /v1/stream?topics=…` read through a fetch whose body streams —
// `expo/fetch` on native (no native module, D-270), the browser's fetch on web. Opened by the first subscriber, kept
// LINGER_MS across route changes, closed after HIDDEN_CLOSE_MS in the background; reconnects with the server's
// `retry` (jittered, capped) and `Last-Event-ID`, so durable events (fills, results, payouts) are never missed.
import { createParser, type EventSourceMessage } from "eventsource-parser";

/** Kept open this long after the last subscriber leaves (a route change re-subscribes within it). */
export const LINGER_MS = 5_000;
/** Closed after this long in the background. */
export const HIDDEN_CLOSE_MS = 60_000;
/** The server beats every 15 s; this long without any frame means the socket is dead. */
export const SILENCE_MS = 20_000;
const DEFAULT_RETRY_MS = 3_000;
const MAX_RETRY_MS = 30_000;
const BACKOFF_FACTOR = 2;
const JITTER = 0.25;

export type StreamStatus = "idle" | "connecting" | "live" | "reconnecting";

export interface StreamOptions {
  origin: string;
  /** A fetch whose `Response.body` streams (`expo/fetch` on native). */
  fetch: typeof globalThis.fetch;
  /** The topics wanted now (`prices`, `prints`, `user:0x…`); read on every (re)connect. */
  topics: () => readonly string[];
  /** A stream ticket for the `user:` topic, when signed in. */
  ticket?: () => Promise<string | undefined>;
  onEvent: (event: string, data: unknown, id: string | undefined) => void;
  onStatus?: (status: StreamStatus) => void;
}

export class LiveStream {
  private status: StreamStatus = "idle";
  private holders = 0;
  private visible = true;
  private lastEventId: string | undefined;
  private retryMs = DEFAULT_RETRY_MS;
  private failures = 0;
  private abort: AbortController | null = null;
  private lingerTimer: ReturnType<typeof setTimeout> | null = null;
  private hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly o: StreamOptions) {}

  /** Hold the stream open; the returned function lets go. */
  acquire(): () => void {
    this.holders += 1;
    this.clear("linger");
    if (this.status === "idle" && this.visible) this.connect();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.holders -= 1;
      if (this.holders === 0) this.lingerTimer = setTimeout(() => this.stop(), LINGER_MS);
    };
  }

  /** The app went to the background (false) or came back (true). */
  setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible) {
      this.clear("hidden");
      if (this.holders > 0 && this.status === "idle") this.connect();
    } else if (!this.hiddenTimer) {
      this.hiddenTimer = setTimeout(() => {
        this.hiddenTimer = null;
        this.stop();
      }, HIDDEN_CLOSE_MS);
    }
  }

  /** Reconnect now with the current topics (sign-in added `user:`, sign-out removed it). */
  restart(): void {
    if (this.status === "idle") return;
    this.teardown();
    this.connect();
  }

  get current(): StreamStatus {
    return this.status;
  }

  private stop(): void {
    this.teardown();
    this.clear("retry");
    this.setStatus("idle");
  }

  private teardown(): void {
    this.abort?.abort();
    this.abort = null;
    this.clear("silence");
  }

  private clear(which: "linger" | "hidden" | "retry" | "silence"): void {
    const timer = {
      linger: this.lingerTimer,
      hidden: this.hiddenTimer,
      retry: this.retryTimer,
      silence: this.silenceTimer,
    }[which];
    if (timer) clearTimeout(timer);
    if (which === "linger") this.lingerTimer = null;
    if (which === "hidden") this.hiddenTimer = null;
    if (which === "retry") this.retryTimer = null;
    if (which === "silence") this.silenceTimer = null;
  }

  private setStatus(status: StreamStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.o.onStatus?.(status);
  }

  private heard(): void {
    this.clear("silence");
    this.silenceTimer = setTimeout(() => this.fail(), SILENCE_MS);
  }

  private fail(): void {
    this.teardown();
    if (this.holders === 0 || !this.visible) {
      this.stop();
      return;
    }
    this.setStatus("reconnecting");
    this.failures += 1;
    const base = Math.min(MAX_RETRY_MS, this.retryMs * BACKOFF_FACTOR ** Math.max(0, this.failures - 1));
    const wait = base * (1 - JITTER + Math.random() * 2 * JITTER);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, wait);
  }

  private connect(): void {
    if (this.abort) return;
    const abort = new AbortController();
    this.abort = abort;
    if (this.status !== "reconnecting") this.setStatus("connecting");
    void this.run(abort).catch(() => {
      if (this.abort === abort) this.fail();
    });
  }

  private async run(abort: AbortController): Promise<void> {
    const params = new URLSearchParams({ topics: this.o.topics().join(",") });
    const ticket = this.o.topics().some((t) => t.startsWith("user:")) ? await this.o.ticket?.() : undefined;
    if (ticket) params.set("ticket", ticket);
    const headers: Record<string, string> = { accept: "text/event-stream" };
    if (this.lastEventId) headers["last-event-id"] = this.lastEventId;
    const res = await this.o.fetch(`${this.o.origin}/v1/stream?${params}`, { headers, signal: abort.signal });
    if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
    const parser = createParser({
      onEvent: (m: EventSourceMessage) => this.dispatch(m),
      onRetry: (ms: number) => {
        this.retryMs = ms;
      },
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    this.heard();
    for (;;) {
      const { done, value } = await reader.read();
      if (done || abort.signal.aborted) break;
      this.heard();
      parser.feed(decoder.decode(value, { stream: true }));
    }
    if (this.abort === abort) this.fail();
  }

  private dispatch(m: EventSourceMessage): void {
    if (m.id) this.lastEventId = m.id;
    if (this.status !== "live") {
      this.failures = 0;
      this.setStatus("live");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(m.data);
    } catch {
      return;
    }
    // Bus frames wrap their payload as `{ topic, data }`; the `time` beat is bare.
    const data = parsed && typeof parsed === "object" && "data" in parsed ? (parsed as { data: unknown }).data : parsed;
    this.o.onEvent(m.event ?? "message", data, m.id);
  }
}

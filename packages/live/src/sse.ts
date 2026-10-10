// The one SSE connection per app (D-272): `GET /v1/stream?topics=…` read through a fetch whose body streams —
// `expo/fetch` on native (no native module, D-270), the browser's fetch on web. Opened by the first subscriber, kept
// LINGER_MS across route changes, closed after HIDDEN_CLOSE_MS in the background; reconnects with the server's
// `retry` (jittered, capped) and `Last-Event-ID`, so durable events (fills, results, payouts) are never missed.
// Prices never wait on the user's ticket (04-pricing R8, F9): a ticket is awaited at most TICKET_WAIT_MS, then the public
// topics connect without it and `user:` joins once it arrives; a refused or failed ticket is retried later, never in
// the way of a price.
import { createParser, type EventSourceMessage } from "eventsource-parser";

/** Kept open this long after the last subscriber leaves (a route change re-subscribes within it). */
export const LINGER_MS = 5_000;
/** Closed after this long in the background. */
export const HIDDEN_CLOSE_MS = 60_000;
/**
 * With prices subscribed a frame lands every second or so (and the api beats every 5 s), so 5 s of silence means a
 * dead socket — a half-open one after a Wi-Fi ↔ LTE handover, a NAT expiry (04-pricing R9, F10). Without prices, two
 * beats and a margin.
 */
export const SILENCE_MS = 5_000;
export const QUIET_SILENCE_MS = 12_000;
/** The first retry waits 0.5–1.5 s (this, jittered ±50%), then doubles to MAX_RETRY_MS. The api's `retry:` sets it. */
const DEFAULT_RETRY_MS = 1_000;
const MAX_RETRY_MS = 15_000;
const BACKOFF_FACTOR = 2;
const JITTER = 0.5;
/** Back in front, or back online: a socket that hasn't spoken for this long is replaced at once. */
export const NUDGE_STALE_MS = 2_000;
const PRICES_TOPIC = "prices";
/** The longest a (re)connect waits for a stream ticket before the public topics go without it. */
export const TICKET_WAIT_MS = 1_500;
/** A ticket the api refused, or that failed to mint, isn't asked for again sooner than this. */
export const TICKET_RETRY_MS = 30_000;
/** Tickets live 60 s at the api; one is reused across reconnects for this long. */
export const TICKET_REUSE_MS = 45_000;
const UNAUTHORIZED = 401;
const USER_PREFIX = "user:";
const LATE = Symbol("late");

/** The api refused the ticket for the whole request (an api before R1.10): reconnect public-only at once. */
class TicketRefused extends Error {}

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
  private ticket: { value: string; at: number } | undefined;
  private ticketFailedAt = 0;
  private ticketPending: Promise<string | undefined> | undefined;
  private lastFrameAt = 0;
  private reconnects = 0;

  constructor(private readonly o: StreamOptions) {}

  /** For diagnostics: when the last frame arrived and how many reconnects this stream has made. */
  diagnostics(): { status: StreamStatus; lastFrameAt: number; reconnects: number } {
    return { status: this.status, lastFrameAt: this.lastFrameAt, reconnects: this.reconnects };
  }

  /**
   * The app came to the front or the network came back: a socket that hasn't spoken for NUDGE_STALE_MS is replaced
   * now rather than at its next retry (iOS kills sockets in the background without a word).
   */
  nudge(): void {
    if (this.holders === 0 || !this.visible) return;
    if (this.status === "idle") {
      this.connect();
      return;
    }
    if (this.status === "live" && Date.now() - this.lastFrameAt <= NUDGE_STALE_MS) return;
    this.clear("retry");
    this.teardown();
    this.failures = 0;
    this.connect();
  }

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
      this.nudge();
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
    this.lastFrameAt = Date.now();
    this.clear("silence");
    const silence = this.o.topics().includes(PRICES_TOPIC) ? SILENCE_MS : QUIET_SILENCE_MS;
    this.silenceTimer = setTimeout(() => this.fail(), silence);
  }

  private fail(): void {
    this.teardown();
    if (this.holders === 0 || !this.visible) {
      this.stop();
      return;
    }
    this.setStatus("reconnecting");
    this.failures += 1;
    this.reconnects += 1;
    const base = Math.min(MAX_RETRY_MS, this.retryMs * BACKOFF_FACTOR ** Math.max(0, this.failures - 1));
    const wait = Math.min(MAX_RETRY_MS, base * (1 - JITTER + Math.random() * 2 * JITTER));
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
    void this.run(abort).catch((error) => {
      if (this.abort !== abort) return;
      if (error instanceof TicketRefused) {
        this.teardown();
        this.connect();
        return;
      }
      this.fail();
    });
  }

  /** A ticket for the `user:` topic within TICKET_WAIT_MS, or none (the topic joins on a restart once it comes). */
  private async ticketNow(): Promise<string | undefined> {
    if (!this.o.ticket) return undefined;
    const now = Date.now();
    if (this.ticket && now - this.ticket.at < TICKET_REUSE_MS) return this.ticket.value;
    if (now - this.ticketFailedAt < TICKET_RETRY_MS) return undefined;
    const mint = this.o.ticket;
    this.ticketPending ??= mint()
      .then(
        (value) => {
          if (value) this.ticket = { value, at: Date.now() };
          else this.ticketFailedAt = Date.now();
          return value;
        },
        () => {
          this.ticketFailedAt = Date.now();
          return undefined;
        },
      )
      .finally(() => {
        this.ticketPending = undefined;
      });
    const pending = this.ticketPending;
    const first = await Promise.race([
      pending,
      new Promise<typeof LATE>((r) => setTimeout(() => r(LATE), TICKET_WAIT_MS)),
    ]);
    if (first !== LATE) return first;
    void pending.then((value) => {
      if (value) this.restart();
    });
    return undefined;
  }

  private dropTicket(): void {
    this.ticket = undefined;
    this.ticketFailedAt = Date.now();
  }

  private async run(abort: AbortController): Promise<void> {
    const wanted = this.o.topics();
    const ticket = wanted.some((t) => t.startsWith(USER_PREFIX)) ? await this.ticketNow() : undefined;
    if (abort.signal.aborted) return;
    const topics = ticket ? wanted : wanted.filter((t) => !t.startsWith(USER_PREFIX));
    const params = new URLSearchParams({ topics: topics.join(",") });
    if (ticket) params.set("ticket", ticket);
    const headers: Record<string, string> = { accept: "text/event-stream" };
    if (this.lastEventId) headers["last-event-id"] = this.lastEventId;
    const res = await this.o.fetch(`${this.o.origin}/v1/stream?${params}`, { headers, signal: abort.signal });
    if (res.status === UNAUTHORIZED && ticket) {
      this.dropTicket();
      throw new TicketRefused();
    }
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
    // The api granted the rest but not the user topic (its ticket expired or was refused): mint a new one later.
    if (m.event === "topic-error" && m.data.includes(USER_PREFIX)) this.dropTicket();
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

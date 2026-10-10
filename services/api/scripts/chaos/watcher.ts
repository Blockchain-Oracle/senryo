import { type FeedState, feedStateOfCode } from "@senryo/config";
import { createParser } from "eventsource-parser";

/**
 * Reads `/v1/stream?topics=prices,prints&pp=1` as an app does: the states' digest, ticks per market, `reset`s, and its
 * own reconnects (0.5–1.5 s after a drop, with `Last-Event-ID`). What the chaos checks look at from the client's side.
 */
const RETRY_MIN_MS = 500;
const RETRY_SPAN_MS = 1_000;

export class StreamWatcher {
  readonly ticks = new Map<string, number>();
  resets = 0;
  connects = 0;
  connected = false;
  lastFrameAt = 0;
  private digest = "";
  private lastId: string | undefined;
  private abort: AbortController | null = null;
  private stopped = false;

  constructor(
    private readonly origin: string,
    private readonly symbols: readonly string[],
  ) {}

  start(): void {
    void this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.abort?.abort();
  }

  state(symbol: string): FeedState | undefined {
    const i = this.symbols.indexOf(symbol);
    return i < 0 ? undefined : feedStateOfCode(this.digest[i] ?? "");
  }

  tickCount(symbol: string): number {
    return this.ticks.get(symbol) ?? 0;
  }

  private async connect(): Promise<void> {
    if (this.stopped) return;
    const abort = new AbortController();
    this.abort = abort;
    try {
      const headers: Record<string, string> = { accept: "text/event-stream" };
      if (this.lastId) headers["last-event-id"] = this.lastId;
      const res = await fetch(`${this.origin}/v1/stream?topics=prices,prints&pp=1`, { headers, signal: abort.signal });
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
      this.connects += 1;
      this.connected = true;
      const parser = createParser({ onEvent: (e) => this.onEvent(e.event, e.data, e.id) });
      const decoder = new TextDecoder();
      for await (const chunk of res.body) {
        this.lastFrameAt = Date.now();
        parser.feed(decoder.decode(chunk, { stream: true }));
      }
    } catch {
      // dropped or refused: retried below
    }
    this.connected = false;
    if (!this.stopped) setTimeout(() => void this.connect(), RETRY_MIN_MS + Math.random() * RETRY_SPAN_MS);
  }

  private onEvent(event: string | undefined, raw: string, id: string | undefined): void {
    if (id) this.lastId = id;
    if (event === "reset") {
      this.resets += 1;
      return;
    }
    let body: { data?: unknown; t?: number; h?: string };
    try {
      body = JSON.parse(raw) as typeof body;
    } catch {
      return;
    }
    if (event === "time" && typeof body.h === "string") this.digest = body.h;
    const data = body.data as { s?: string } | [number, number, number][] | undefined;
    if (event === "h" && data && !Array.isArray(data) && typeof data.s === "string") this.digest = data.s;
    if (event === "pp" && Array.isArray(data)) {
      for (const [i] of data) {
        const s = this.symbols[i];
        if (s) this.ticks.set(s, (this.ticks.get(s) ?? 0) + 1);
      }
    }
  }
}

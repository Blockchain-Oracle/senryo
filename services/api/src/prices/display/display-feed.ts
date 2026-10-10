import type { Logger } from "@senryo/service-common";
import { DISPLAY_SYMBOLS, type DisplayVenue, decimalE8, readMedian } from "./venues.ts";

/**
 * The display plane (D-302; port of Owarine `crypto-spot.ts`): each crypto market's last exchange trade for the line,
 * the pill and live PnL at ~8 Hz — never a quote, a fill or a settlement (04-pricing §6.3).
 * - **Coinbase's public socket** (`ticker`: every match) is the fast path. Its `heartbeat` channel (one product, every
 *   second) proves the socket alive: 5 s with no message at all and it is closed and reopened — Node's browser-style
 *   WebSocket has no ping, and both references had no such check.
 * - **The five-venue REST median** stands in for a market when the socket is dead, or alive but silent on that market
 *   for 30 s (a halted product) — after two looks in a row, and back to the socket after two of its trades (hysteresis).
 * - Coinbase may deliver out of order ("handle sequence gaps and out of order messages"): an older trade is dropped.
 */
export interface DisplayTick {
  symbol: string;
  priceE8: bigint;
  timeMs: number;
  source: "coinbase" | "median";
}

export interface DisplayStatus {
  socket: "open" | "closed";
  lastMessageAt: number;
  reopens: number;
  onMedian: string[];
  lastMedianFailed: DisplayVenue[];
}

/** The slice of a WebSocket the feed uses (Node's global `WebSocket`, or a fake). */
export interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}
export type SocketFactory = (url: string) => SocketLike;

export const COINBASE_WS_URL = "wss://ws-feed.exchange.coinbase.com";
/** No message at all (trades or the 1 s heartbeat) for this long: the socket is dead. */
const SOCKET_SILENT_MS = 5_000;
/** Alive but no trade on a market for this long: that market goes to the median (a halted product). */
const MARKET_QUIET_MS = 30_000;
/** Looks in a row before a market changes source. */
const SWITCH_LOOKS = 2;
const LOOK_MS = 1_000;
/** The five-venue read runs at most this often (Bitfinex allows about 30 ticker calls a minute). */
const MEDIAN_EVERY_MS = 3_000;
const RETRY_MIN_MS = 1_000;
const RETRY_MAX_MS = 30_000;
const HEARTBEAT_PRODUCT = "BTC-USD";
const USD_SUFFIX = "-USD";

interface Market {
  mode: "socket" | "median";
  lastTradeMs: number;
  lastHeardAt: number;
  looks: number;
}

/** One `ticker` message → its trade, or null for anything else. */
export function parseTicker(
  raw: string,
  symbols: ReadonlySet<string>,
): { symbol: string; priceE8: bigint; timeMs: number } | null {
  let body: { type?: unknown; product_id?: unknown; price?: unknown; time?: unknown };
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    return null;
  }
  if (body.type !== "ticker" || typeof body.product_id !== "string" || !body.product_id.endsWith(USD_SUFFIX))
    return null;
  const symbol = body.product_id.slice(0, -USD_SUFFIX.length);
  const priceE8 = decimalE8(body.price);
  if (!symbols.has(symbol) || !priceE8) return null;
  const timeMs = typeof body.time === "string" ? Date.parse(body.time) : Number.NaN;
  return { symbol, priceE8, timeMs: Number.isFinite(timeMs) ? timeMs : Date.now() };
}

const defaultSocket: SocketFactory | null =
  typeof globalThis.WebSocket === "function" ? (url) => new globalThis.WebSocket(url) as unknown as SocketLike : null;

export class DisplayFeed {
  private readonly markets = new Map<string, Market>();
  private readonly set: ReadonlySet<string>;
  private socket: SocketLike | null = null;
  private lastMessageAt = 0;
  private reopens = 0;
  private retryMs = RETRY_MIN_MS;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private lastMedianAt = 0;
  private lastMedianFailed: DisplayVenue[] = [];

  constructor(
    private readonly onTick: (t: DisplayTick) => void,
    private readonly log: Logger,
    private readonly symbols: readonly string[] = DISPLAY_SYMBOLS,
    private readonly makeSocket: SocketFactory | null = defaultSocket,
  ) {
    this.set = new Set(symbols);
    for (const s of symbols) this.markets.set(s, { mode: "socket", lastTradeMs: 0, lastHeardAt: 0, looks: 0 });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    // A market's quiet clock starts now, not at 0 (which would send every market to the median before its first trade).
    const now = Date.now();
    for (const m of this.markets.values()) m.lastHeardAt = now;
    this.open();
    this.timer = setInterval(() => void this.look(), LOOK_MS);
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    if (this.retry) clearTimeout(this.retry);
    const ws = this.socket;
    this.socket = null;
    ws?.close();
  }

  status(): DisplayStatus {
    return {
      socket: this.socket ? "open" : "closed",
      lastMessageAt: this.lastMessageAt,
      reopens: this.reopens,
      onMedian: [...this.markets].filter(([, m]) => m.mode === "median").map(([s]) => s),
      lastMedianFailed: this.lastMedianFailed,
    };
  }

  private publish(symbol: string, priceE8: bigint, timeMs: number, source: DisplayTick["source"]): void {
    const m = this.markets.get(symbol);
    if (!m || timeMs < m.lastTradeMs) return;
    m.lastTradeMs = timeMs;
    this.onTick({ symbol, priceE8, timeMs, source });
  }

  private open(): void {
    if (!this.running || !this.makeSocket || this.socket) return;
    let ws: SocketLike;
    try {
      ws = this.makeSocket(COINBASE_WS_URL);
    } catch (error) {
      this.log.warn({ err: (error as Error).message }, "display socket failed to open");
      this.scheduleOpen();
      return;
    }
    this.socket = ws;
    this.lastMessageAt = Date.now();
    ws.onopen = () => {
      this.retryMs = RETRY_MIN_MS;
      // Coinbase drops a connection with no subscribe within 5 s.
      ws.send(
        JSON.stringify({
          type: "subscribe",
          channels: [
            { name: "ticker", product_ids: this.symbols.map((s) => `${s}${USD_SUFFIX}`) },
            { name: "heartbeat", product_ids: [HEARTBEAT_PRODUCT] },
          ],
        }),
      );
    };
    ws.onmessage = (event) => {
      if (this.socket !== ws) return;
      this.lastMessageAt = Date.now();
      const trade = typeof event.data === "string" ? parseTicker(event.data, this.set) : null;
      if (!trade) return;
      const m = this.markets.get(trade.symbol);
      if (!m) return;
      m.lastHeardAt = this.lastMessageAt;
      if (m.mode === "median") {
        m.looks += 1;
        if (m.looks < SWITCH_LOOKS) return;
        m.mode = "socket";
        m.looks = 0;
      }
      this.publish(trade.symbol, trade.priceE8, trade.timeMs, "coinbase");
    };
    ws.onerror = () => undefined;
    ws.onclose = () => {
      if (this.socket !== ws) return;
      this.socket = null;
      this.scheduleOpen();
    };
  }

  private scheduleOpen(): void {
    if (!this.running || this.retry) return;
    this.retry = setTimeout(() => {
      this.retry = null;
      this.open();
    }, this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, RETRY_MAX_MS);
  }

  /** Each second: a silent socket is replaced; markets change source after two looks; the median runs if needed. */
  private async look(): Promise<void> {
    const now = Date.now();
    const socketAlive = this.socket !== null && now - this.lastMessageAt < SOCKET_SILENT_MS;
    if (this.socket && !socketAlive) {
      this.log.warn({ silentMs: now - this.lastMessageAt }, "display socket silent; reopening");
      this.reopens += 1;
      const ws = this.socket;
      this.socket = null;
      ws.close();
      this.open();
    }
    for (const m of this.markets.values()) {
      if (m.mode !== "socket") continue;
      const quiet = !socketAlive || now - m.lastHeardAt >= MARKET_QUIET_MS;
      m.looks = quiet ? m.looks + 1 : 0;
      if (m.looks >= SWITCH_LOOKS) {
        m.mode = "median";
        m.looks = 0;
      }
    }
    const onMedian = [...this.markets].filter(([, m]) => m.mode === "median").map(([s]) => s);
    if (onMedian.length === 0 || now - this.lastMedianAt < MEDIAN_EVERY_MS) return;
    this.lastMedianAt = now;
    const r = await readMedian(onMedian, now);
    this.lastMedianFailed = r.failed;
    for (const [symbol, { trade }] of r.bySymbol) this.publish(symbol, trade.priceE8, trade.timeMs, "median");
  }
}

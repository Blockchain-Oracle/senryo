import { type ChainId, MAINNET_CHAIN_ID, PERPL_MARKET_SCALES } from "@senryo/config";
import { rescale } from "@senryo/core";

const JITTER_MIN = 0.8;
const JITTER_RANGE = 0.4;
const MAX_SAMPLES = 600;
const MAX_AGE_MS = 15_000;
const CHECK_MS = 5_000;
const RETRY_BASE_MS = 1500;
const RETRY_DOUBLE = 2;
const RETRY_QUAD = 4;
const RETRY_SLOW_MS = 15_000;
const RETRY_MAX_MS = 30_000;
const BACKOFF_MS = [
  RETRY_BASE_MS,
  RETRY_BASE_MS * RETRY_DOUBLE,
  RETRY_BASE_MS * RETRY_QUAD,
  RETRY_SLOW_MS,
  RETRY_MAX_MS,
];
const SUBSCRIPTION_RESPONSE = 6;
const MARKET_STATE_UPDATE = 9;
const LOCAL_POLL_MS = 500;
const E18 = 18;
const FUTURE_TOLERANCE_MS = 5_000;
export interface PerplTick {
  at: number;
  price18: bigint;
}
export interface PerplLivePrice extends PerplTick {
  receivedAt: number;
  samples: readonly PerplTick[];
}

/** Validate the venue's scaled integer and source block time, never stamp an old mark with receipt time. */
export function decodePerplTick(
  marketId: number,
  value: unknown,
  now: number,
  chainId: ChainId = MAINNET_CHAIN_ID,
): PerplTick | undefined {
  const scale = PERPL_MARKET_SCALES[chainId]?.[marketId];
  if (!scale || !value || typeof value !== "object") return;
  const row = value as { mrk?: unknown; at?: { t?: unknown } };
  const price = row.mrk;
  const at = row.at?.t;
  if (
    typeof price !== "number" ||
    !Number.isSafeInteger(price) ||
    price <= 0 ||
    typeof at !== "number" ||
    !Number.isSafeInteger(at) ||
    at <= 0 ||
    at > now + FUTURE_TOLERANCE_MS
  )
    return;
  return { at, price18: rescale(BigInt(price), scale.priceDecimals, E18) };
}

/** One public subscription for all markets. Consumers share the socket; no account or API key is transmitted. */
export class PerplPriceStream {
  constructor(
    private readonly chainId: ChainId = MAINNET_CHAIN_ID,
    private readonly snapshot?: (() => Promise<unknown>) | undefined,
  ) {}
  private connection: "idle" | "connecting" | "connected" | "disconnected" | "background" = "idle";
  private epoch = 0;
  getConnection = () => this.connection;
  getEpoch = () => this.epoch;
  private setConnection(state: typeof this.connection): void {
    if (state === this.connection) return;
    this.connection = state;
    for (const listener of this.listeners) listener();
  }
  private socket: WebSocket | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private polling: ReturnType<typeof setInterval> | undefined;
  private pollBusy = false;
  private watchdog: ReturnType<typeof setInterval> | undefined;
  private active = true;
  private attempt = 0;
  private receivedAt = 0;
  private version = 0;
  getVersion = (): number => this.version;
  private readonly listeners = new Set<() => void>();
  private readonly prices = new Map<number, PerplLivePrice>();

  get = (marketId: number): PerplLivePrice | undefined => this.prices.get(marketId);
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.active && !this.socket && !this.retry && !this.polling) this.connect();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.disconnect();
    };
  };
  setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.disconnect();
      this.setConnection("background");
    } else if (this.listeners.size > 0 && !this.socket && !this.retry && !this.polling) this.connect();
  }
  reset(): void {
    this.prices.clear();
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
  private disconnect(): void {
    clearInterval(this.polling);
    this.polling = undefined;
    clearTimeout(this.retry);
    clearInterval(this.watchdog);
    this.retry = undefined;
    const previous = this.socket;
    this.socket = undefined;
    previous?.close();
  }
  private connect(): void {
    if (!this.active || this.listeners.size === 0) return;
    this.epoch += 1;
    const epoch = this.epoch;
    this.setConnection("connecting");
    if (this.snapshot) {
      const poll = async () => {
        if (this.pollBusy || !this.active) return;
        this.pollBusy = true;
        try {
          const packet = await this.snapshot?.();
          if (this.active && this.listeners.size > 0 && this.epoch === epoch) {
            this.accept(packet);
            this.setConnection("connected");
          }
        } catch {
          if (this.epoch === epoch && this.active) this.setConnection("disconnected");
          /* The last source timestamp keeps ageing; never manufacture a fresh tick. */
        } finally {
          this.pollBusy = false;
        }
      };
      this.polling = setInterval(() => void poll(), LOCAL_POLL_MS);
      void poll();
      return;
    }
    const socket = new WebSocket(
      `wss://${this.chainId === MAINNET_CHAIN_ID ? "app" : "testnet"}.perpl.xyz/ws/v1/market-data`,
    );
    this.socket = socket;
    this.receivedAt = Date.now();
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.setConnection("connected");
      socket.send(JSON.stringify({ mt: 5, subs: [{ stream: `market-state@${this.chainId}`, subscribe: true }] }));
      // Market-data streams do not require client pings (which consume the venue's request budget).
      this.watchdog = setInterval(() => {
        if (Date.now() - this.receivedAt > MAX_AGE_MS) socket.close();
      }, CHECK_MS);
    };
    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      this.receivedAt = Date.now();
      let message: { mt?: number; d?: unknown; subs?: Array<{ status?: { code?: number } }> };
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (!message || typeof message !== "object") return;
      if (message.mt === SUBSCRIPTION_RESPONSE && message.subs?.some((s) => (s.status?.code ?? 0) !== 0)) {
        socket.close();
        return;
      }
      this.accept(message);
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      if (this.socket !== socket) return;
      clearInterval(this.watchdog);
      this.socket = undefined;
      this.setConnection(this.active ? "disconnected" : "background");
      if (!this.active || this.listeners.size === 0) return;
      const delay = BACKOFF_MS[Math.min(this.attempt++, BACKOFF_MS.length - 1)];
      this.retry = setTimeout(
        () => {
          this.retry = undefined;
          this.connect();
        },
        (delay ?? RETRY_MAX_MS) * (JITTER_MIN + Math.random() * JITTER_RANGE),
      );
    };
  }
  private accept(packet: unknown): void {
    if (!packet || typeof packet !== "object") return;
    const message = packet as { mt?: unknown; d?: unknown };
    if (message.mt !== MARKET_STATE_UPDATE || !message.d || typeof message.d !== "object") return;
    const now = Date.now();
    let changed = false;
    for (const [id, value] of Object.entries(message.d)) {
      const marketId = Number(id);
      const tick = decodePerplTick(marketId, value, now, this.chainId);
      const previous = this.prices.get(marketId);
      if (!tick || (previous && tick.at <= previous.at)) continue;
      this.prices.set(marketId, {
        ...tick,
        receivedAt: now,
        samples: [...(previous?.samples ?? []), tick].slice(-MAX_SAMPLES),
      });
      changed = true;
    }
    if (changed) {
      this.version += 1;
      this.attempt = 0;
      for (const listener of this.listeners) listener();
    }
  }
}

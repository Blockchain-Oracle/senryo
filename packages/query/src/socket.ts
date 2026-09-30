/**
 * The engine socket (`wss://api.<rpId>/v1/ws`, specs/services.md §api): `prices:{SYMBOL}` ticks go to the
 * `PriceStore`; `account:{addr}` (session token) reports a finalized change → the app invalidates that account's
 * queries. One socket per app; reconnects with backoff and re-subscribes; messages are zod-parsed (never trusted raw).
 */
import { WS_PATH, type WsClientMessage, wsServerMessageSchema } from "@senryo/api-client";
import { type ChainId, ENGINE_MARKETS } from "@senryo/config";
import type { Address } from "@senryo/core";
import { SOCKET_BACKOFF_MS, SOCKET_PING_MS } from "./constants.ts";
import type { PriceStore } from "./price-store.ts";

export interface EngineSocketOptions {
  /** API origin, e.g. `https://api.senryo.xyz` (→ `wss://…/v1/ws`). */
  origin: string;
  chainId: ChainId;
  prices: PriceStore;
  /** A finalized change for a watched account (buckets moved). */
  onAccount?: (address: Address, finalizedBlock: bigint) => void;
  onStatus?: (connected: boolean) => void;
}

export function wsUrl(origin: string): string {
  return `${origin.replace(/^http/, "ws")}${WS_PATH}`;
}

export class EngineSocket {
  private socket: WebSocket | undefined;
  private attempt = 0;
  private stopped = true;
  private ping: ReturnType<typeof setInterval> | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private account: { address: Address; token: string } | undefined;

  constructor(private readonly opts: EngineSocketOptions) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    clearInterval(this.ping);
    clearTimeout(this.retry);
    this.socket?.close();
    this.socket = undefined;
  }

  /** Follow one account's finalized bucket changes (own address + session token; undefined stops). */
  watchAccount(account: { address: Address; token: string } | undefined): void {
    const previous = this.account;
    this.account = account;
    if (previous) this.send({ op: "unsubscribe", channel: `account:${previous.address}`, chainId: this.opts.chainId });
    if (account) this.subscribeAccount(account);
  }

  private connect(): void {
    const socket = new WebSocket(wsUrl(this.opts.origin));
    this.socket = socket;
    socket.onopen = () => {
      this.attempt = 0;
      this.opts.onStatus?.(true);
      for (const m of ENGINE_MARKETS) {
        this.send({ op: "subscribe", channel: `prices:${m.symbol}`, chainId: this.opts.chainId });
      }
      if (this.account) this.subscribeAccount(this.account);
      this.ping = setInterval(() => this.send({ op: "ping" }), SOCKET_PING_MS);
    };
    socket.onmessage = (event) => this.onMessage(String(event.data));
    socket.onclose = () => {
      clearInterval(this.ping);
      this.opts.onStatus?.(false);
      if (this.stopped) return;
      const delay = SOCKET_BACKOFF_MS[Math.min(this.attempt, SOCKET_BACKOFF_MS.length - 1)];
      this.attempt += 1;
      this.retry = setTimeout(() => this.connect(), delay);
    };
  }

  private subscribeAccount(account: { address: Address; token: string }): void {
    this.send({
      op: "subscribe",
      channel: `account:${account.address}`,
      chainId: this.opts.chainId,
      token: account.token,
    });
  }

  private send(message: WsClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private onMessage(text: string): void {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return;
    }
    const parsed = wsServerMessageSchema.safeParse(json);
    if (!parsed.success) return;
    const msg = parsed.data;
    if (msg.type === "price" && msg.chainId === this.opts.chainId) {
      this.opts.prices.push({
        chainId: msg.chainId,
        marketId: msg.marketId,
        symbol: msg.symbol,
        price18: msg.price18,
        latest18: msg.latest18,
        status: msg.status,
        updatedAt: BigInt(msg.updatedAt),
        spreadBps: BigInt(msg.spreadBps),
        receivedAt: Date.now(),
      });
    } else if (msg.type === "account" && msg.chainId === this.opts.chainId) {
      this.opts.onAccount?.(msg.address, msg.finalizedBlock);
    }
  }
}

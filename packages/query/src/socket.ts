/**
 * The engine socket (`wss://api.<rpId>/v1/ws`, specs/services.md §api): `prices:{SYMBOL}` ticks go to the
 * `PriceStore`; `account:{addr}` (session token) reports a finalized change → the app invalidates that account's
 * queries; `feed:{chainId}` (S12b.4) carries "New activity" while at least one screen listens (`onFeed`).
 * One socket per app; reconnects with backoff and re-subscribes; messages are zod-parsed (never trusted raw).
 */
import { feedChannel, WS_PATH, type WsClientMessage, wsServerMessageSchema } from "@senryo/api-client";
import { type ChainId, engineMarketsOn } from "@senryo/config";
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
  private readonly feedListeners = new Set<(latestId: string) => void>();

  constructor(private readonly opts: EngineSocketOptions) {}

  /** Listen for "New activity" on this network's feed; the channel is subscribed only while someone listens. */
  onFeed(listener: (latestId: string) => void): () => void {
    this.feedListeners.add(listener);
    if (this.feedListeners.size === 1) this.subscribeFeed("subscribe");
    return () => {
      this.feedListeners.delete(listener);
      if (this.feedListeners.size === 0) this.subscribeFeed("unsubscribe");
    };
  }

  private subscribeFeed(op: "subscribe" | "unsubscribe"): void {
    this.send({ op, channel: feedChannel(this.opts.chainId), chainId: this.opts.chainId });
  }

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
      if (this.socket !== socket || this.stopped) return;
      this.opts.prices.beginEpoch();
      this.attempt = 0;
      this.opts.onStatus?.(true);
      for (const m of engineMarketsOn(this.opts.chainId)) {
        this.send({ op: "subscribe", channel: `prices:${m.symbol}`, chainId: this.opts.chainId });
      }
      if (this.account) this.subscribeAccount(this.account);
      if (this.feedListeners.size > 0) this.subscribeFeed("subscribe");
      this.ping = setInterval(() => this.send({ op: "ping" }), SOCKET_PING_MS);
    };
    socket.onmessage = (event) => {
      if (this.socket === socket && !this.stopped) this.onMessage(String(event.data));
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
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
    } else if (msg.type === "feed" && msg.chainId === this.opts.chainId) {
      for (const listener of this.feedListeners) listener(msg.latestId);
    }
  }
}

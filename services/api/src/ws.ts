import { WS_PATH, type WsServerMessage, wsClientMessageSchema, wsServerMessageSchema } from "@senryo/api-client";
import { getAddress, isAddress, type OracleView, readAccountSnapshot, readOracles } from "@senryo/chain";
import { type ChainId, ENGINE_MARKETS } from "@senryo/config";
import type { HttpServer } from "@senryo/service-common";
import type { WebSocket } from "ws";
import { bucketsOf } from "./buckets.ts";
import { ACCOUNT_POLL_MS, PRICE_POLL_MS, WS_BACKPRESSURE_BYTES, WS_MAX_SUBSCRIPTIONS } from "./constants.ts";
import type { ApiContext } from "./context.ts";

/**
 * WS hub (specs/services.md §api): `prices:{SYMBOL}` from the oracle (`peek`, pushed on change), `account:{addr}`
 * bucket deltas on finalized account changes (session token required, own address only), `perpl:*` in S7.
 * Under backpressure intermediate ticks are dropped (the next one supersedes them).
 */
const MARKET_IDS = ENGINE_MARKETS.map((m) => m.id);

type Key = string;
const keyOf = (chainId: ChainId, channel: string): Key => `${chainId}|${channel}`;

export class WsHub {
  private readonly subs = new Map<Key, Set<WebSocket>>();
  private readonly lastPrice = new Map<Key, string>();
  private readonly lastNonce = new Map<Key, bigint>();
  private timers: ReturnType<typeof setInterval>[] = [];

  constructor(private readonly ctx: ApiContext) {}

  start(): void {
    this.timers.push(setInterval(() => void this.pushPrices(), PRICE_POLL_MS));
    this.timers.push(setInterval(() => void this.pushAccounts(), ACCOUNT_POLL_MS));
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
    for (const set of this.subs.values()) for (const socket of set) socket.close();
  }

  register(app: HttpServer): void {
    app.get(WS_PATH, { websocket: true }, (socket) => {
      const mine = new Set<Key>();
      socket.on("message", (raw) => void this.onMessage(socket, mine, raw.toString()));
      socket.on("close", () => {
        for (const key of mine) this.subs.get(key)?.delete(socket);
      });
    });
  }

  private send(socket: WebSocket, message: WsServerMessage): void {
    if (socket.bufferedAmount > WS_BACKPRESSURE_BYTES) return;
    socket.send(JSON.stringify(wsServerMessageSchema.encode(message)));
  }

  private async onMessage(socket: WebSocket, mine: Set<Key>, text: string): Promise<void> {
    let parsed: ReturnType<typeof wsClientMessageSchema.safeParse>;
    try {
      parsed = wsClientMessageSchema.safeParse(JSON.parse(text));
    } catch {
      return this.send(socket, { type: "error", code: "BAD_REQUEST", message: "not JSON" });
    }
    if (!parsed.success) return this.send(socket, { type: "error", code: "BAD_REQUEST", message: "bad message" });
    const msg = parsed.data;
    if (msg.op === "ping") return this.send(socket, { type: "pong" });
    const key = keyOf(msg.chainId, msg.channel);
    if (msg.op === "unsubscribe") {
      mine.delete(key);
      this.subs.get(key)?.delete(socket);
      return this.send(socket, { type: "unsubscribed", channel: msg.channel, chainId: msg.chainId });
    }
    const denied = await this.authorize(msg.channel, msg.chainId, msg.token);
    if (denied)
      return this.send(socket, { type: "error", code: denied, message: `cannot subscribe to ${msg.channel}` });
    if (mine.size >= WS_MAX_SUBSCRIPTIONS)
      return this.send(socket, { type: "error", code: "RATE_LIMITED", message: "too many subscriptions" });
    mine.add(key);
    const set = this.subs.get(key) ?? new Set<WebSocket>();
    set.add(socket);
    this.subs.set(key, set);
    this.lastPrice.delete(key);
    this.lastNonce.delete(key);
    this.send(socket, { type: "subscribed", channel: msg.channel, chainId: msg.chainId });
  }

  private async authorize(channel: string, chainId: ChainId, token: string | undefined) {
    const chain = this.ctx.chains.get(chainId);
    if (!chain?.deployed) return "NOT_DEPLOYED" as const;
    const [kind, target] = channel.split(":");
    if (kind === "prices") return ENGINE_MARKETS.some((m) => m.symbol === target) ? undefined : ("NOT_FOUND" as const);
    if (kind === "account") {
      const session = token && this.ctx.sessions ? await this.ctx.sessions.verify(token) : undefined;
      const own = session && target && isAddress(target) && getAddress(target) === session.address;
      return own ? undefined : ("UNAUTHORIZED" as const);
    }
    return "NOT_DEPLOYED" as const; // perpl:* arrives with S7
  }

  private channelsOf(chainId: ChainId, prefix: string): string[] {
    return [...this.subs.keys()]
      .filter((k) => k.startsWith(`${chainId}|${prefix}:`) && (this.subs.get(k)?.size ?? 0) > 0)
      .map((k) => k.split("|")[1] ?? "");
  }

  private async pushPrices(): Promise<void> {
    for (const chain of this.ctx.chains.values()) {
      if (this.channelsOf(chain.chainId, "prices").length === 0) continue;
      const views = await readOracles(chain.read, chain.chainId, MARKET_IDS).catch(() => [] as OracleView[]);
      for (const view of views) {
        const symbol = ENGINE_MARKETS.find((m) => m.id === view.marketId)?.symbol ?? "";
        const channel = `prices:${symbol}`;
        const key = keyOf(chain.chainId, channel);
        const fingerprint = `${view.price18}|${view.latest18}|${view.status}|${view.updatedAt}|${view.spreadBps}`;
        if (this.lastPrice.get(key) === fingerprint) continue;
        this.lastPrice.set(key, fingerprint);
        for (const socket of this.subs.get(key) ?? []) {
          this.send(socket, {
            type: "price",
            channel,
            chainId: chain.chainId,
            marketId: view.marketId,
            symbol,
            price18: view.price18,
            latest18: view.latest18,
            status: view.status,
            updatedAt: Number(view.updatedAt),
            spreadBps: view.spreadBps,
          });
        }
      }
    }
  }

  private async pushAccounts(): Promise<void> {
    for (const chain of this.ctx.chains.values()) {
      for (const channel of this.channelsOf(chain.chainId, "account")) {
        const address = getAddress(channel.split(":")[1] ?? "");
        const key = keyOf(chain.chainId, channel);
        const snap = await readAccountSnapshot(chain.read, chain.chainId, address, "finalized").catch(() => undefined);
        if (!snap || this.lastNonce.get(key) === snap.nonce) continue;
        this.lastNonce.set(key, snap.nonce);
        const buckets = bucketsOf(snap);
        for (const socket of this.subs.get(key) ?? []) {
          this.send(socket, {
            type: "account",
            channel,
            chainId: chain.chainId,
            address,
            finalizedBlock: chain.heads.current().finalized,
            buckets,
          });
        }
      }
    }
  }
}

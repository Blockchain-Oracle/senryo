import {
  feedChannel,
  WS_PATH,
  type WsServerMessage,
  wsClientMessageSchema,
  wsServerMessageSchema,
} from "@senryo/api-client";
import { getAddress, isAddress, type OracleView, readAccountSnapshot, readOracles } from "@senryo/chain";
import { type ChainId, ENGINE_MARKETS, engineMarketsOn } from "@senryo/config";
import type { HttpServer } from "@senryo/service-common";
import type { WebSocket } from "ws";
import { bucketsOf } from "./buckets.ts";
import {
  ACCOUNT_POLL_MS,
  PRICE_POLL_MS,
  WS_ABUSE_FACTOR,
  WS_BACKPRESSURE_BYTES,
  WS_MAX_SOCKETS_PER_IP,
  WS_MAX_SUBSCRIPTIONS,
  WS_MESSAGE_WINDOW_MS,
  WS_MESSAGES_PER_WINDOW,
  WS_POLICY_CLOSE,
} from "./constants.ts";
import type { ApiContext } from "./context.ts";
import { FEED_NOTICE_MIN_MS } from "./social/constants.ts";

/**
 * WS hub (specs/services.md §api): `prices:{SYMBOL}` from the oracle (`peek`, pushed on change), `account:{addr}`
 * bucket deltas on finalized account changes (session token required, own address only), `feed:{chainId}` "New
 * activity" notices (S12b.4, conflated per network), `perpl:*` in S7.
 * Under backpressure intermediate ticks are dropped (the next one supersedes them). Caps: WS_MAX_SOCKETS_PER_IP
 * concurrent sockets per client IP, WS_MAX_SUBSCRIPTIONS per socket, and WS_MESSAGES_PER_WINDOW client messages per
 * socket per window (refused past it, closed past WS_ABUSE_FACTOR × it).
 */

type Key = string;
const keyOf = (chainId: ChainId, channel: string): Key => `${chainId}|${channel}`;

export class WsHub {
  private readonly subs = new Map<Key, Set<WebSocket>>();
  private readonly lastPrice = new Map<Key, string>();
  private readonly lastNonce = new Map<Key, bigint>();
  private readonly perIp = new Map<string, number>();
  /** Feed notices waiting out FEED_NOTICE_MIN_MS per network (only the newest id is sent). */
  private readonly feedPending = new Map<ChainId, { latestId: bigint; timer: ReturnType<typeof setTimeout> }>();
  private timers: ReturnType<typeof setInterval>[] = [];
  private unsubscribeFeed: (() => void) | undefined;

  constructor(private readonly ctx: ApiContext) {}

  start(): void {
    this.timers.push(setInterval(() => void this.pushPrices(), PRICE_POLL_MS));
    this.timers.push(setInterval(() => void this.pushAccounts(), ACCOUNT_POLL_MS));
    this.unsubscribeFeed = this.ctx.social.notifier.on((chainId, latestId) => this.queueFeed(chainId, latestId));
  }

  stop(): void {
    for (const t of this.timers) clearInterval(t);
    for (const pending of this.feedPending.values()) clearTimeout(pending.timer);
    this.unsubscribeFeed?.();
    for (const set of this.subs.values()) for (const socket of set) socket.close();
  }

  register(app: HttpServer): void {
    app.get(WS_PATH, { websocket: true }, (socket, request) => {
      const ip = request.ip;
      const open = (this.perIp.get(ip) ?? 0) + 1;
      if (open > WS_MAX_SOCKETS_PER_IP) {
        this.send(socket, { type: "error", code: "RATE_LIMITED", message: "too many sockets from this address" });
        socket.close(WS_POLICY_CLOSE, "too many sockets");
        return;
      }
      this.perIp.set(ip, open);
      const mine = new Set<Key>();
      const budget = { windowStart: Date.now(), count: 0 };
      socket.on("message", (raw) => {
        const now = Date.now();
        if (now - budget.windowStart >= WS_MESSAGE_WINDOW_MS) Object.assign(budget, { windowStart: now, count: 0 });
        budget.count += 1;
        if (budget.count > WS_MESSAGES_PER_WINDOW * WS_ABUSE_FACTOR) return socket.close(WS_POLICY_CLOSE, "flooding");
        if (budget.count > WS_MESSAGES_PER_WINDOW) {
          return this.send(socket, { type: "error", code: "RATE_LIMITED", message: "too many messages" });
        }
        void this.onMessage(socket, mine, raw.toString());
      });
      socket.on("close", () => {
        for (const key of mine) this.subs.get(key)?.delete(socket);
        const left = (this.perIp.get(ip) ?? 1) - 1;
        if (left <= 0) this.perIp.delete(ip);
        else this.perIp.set(ip, left);
      });
    });
  }

  /** Conflate "New activity" per network: at most one notice per FEED_NOTICE_MIN_MS, carrying the newest id. */
  private queueFeed(chainId: ChainId, latestId: bigint): void {
    const pending = this.feedPending.get(chainId);
    if (pending) {
      if (latestId > pending.latestId) pending.latestId = latestId;
      return;
    }
    const timer = setTimeout(() => {
      const due = this.feedPending.get(chainId);
      this.feedPending.delete(chainId);
      if (!due) return;
      const channel = feedChannel(chainId);
      for (const socket of this.subs.get(keyOf(chainId, channel)) ?? []) {
        this.send(socket, { type: "feed", channel, chainId, latestId: due.latestId.toString() });
      }
    }, FEED_NOTICE_MIN_MS);
    this.feedPending.set(chainId, { latestId, timer });
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
    // The feed needs only a served network (it reads the api database, not the chain).
    if (channel.startsWith("feed:")) {
      return channel === feedChannel(chainId) && this.ctx.chains.has(chainId) ? undefined : ("NOT_FOUND" as const);
    }
    const chain = this.ctx.chains.get(chainId);
    if (!chain?.deployed) return "NOT_DEPLOYED" as const;
    const [kind, target] = channel.split(":");
    if (kind === "prices") {
      return engineMarketsOn(chainId).some((m) => m.symbol === target) ? undefined : ("NOT_FOUND" as const);
    }
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
      const ids = engineMarketsOn(chain.chainId).map((m) => m.id);
      const views = await readOracles(chain.read, chain.chainId, ids).catch(() => [] as OracleView[]);
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

  /** A tick still reading when the next fires is skipped, never stacked (S8.5b #6). */
  private accountsBusy = false;

  private async pushAccounts(): Promise<void> {
    if (this.accountsBusy) return;
    this.accountsBusy = true;
    try {
      await this.pushAccountsOnce();
    } finally {
      this.accountsBusy = false;
    }
  }

  private async pushAccountsOnce(): Promise<void> {
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

import { randomBytes } from "node:crypto";
import {
  type ApiClient,
  ApiError,
  type ApiErrorCode,
  createApiClient,
  type RouteDef,
  SUPPORT_EMAIL,
} from "@senryo/api-client";
import { type Address, getAddress } from "@senryo/chain";
import { type ChainId, MAINNET_CHAIN_ID, TESTNET_CHAIN_ID } from "@senryo/config";
import {
  createDb,
  createHttpServer,
  createLogger,
  type Db,
  type HttpServer,
  migrate,
  requireSecret,
  SessionKeys,
} from "@senryo/service-common";
import { registerFollowRoutes } from "../src/routes/follow.ts";
import { registerHolderRoutes } from "../src/routes/holders.ts";
import { registerLeaderboardRoutes } from "../src/routes/leaderboard.ts";
import { registerModerationRoutes } from "../src/routes/moderation.ts";
import { registerPostRoutes } from "../src/routes/posts.ts";
import { registerProfileRoutes } from "../src/routes/profile.ts";
import { FeedPoller } from "../src/social/feed-poller.ts";
import { HoldersService, type Mark } from "../src/social/holders.ts";
import { LeaderboardService } from "../src/social/leaderboard.ts";
import { FeedNotifier, type SocialRuntime } from "../src/social/runtime.ts";
import { MockIndexer } from "./mock-indexer.ts";

/**
 * In-process harness for the social check: every social route on a Fastify instance, a real Postgres
 * (`DATABASE_URL`, migrated here), the real leaderboard service and feed poller over an in-memory indexer
 * (`MockIndexer`), and `@senryo/api-client` clients whose fetch is `app.inject` — the same encode / decode path the
 * apps use, with no port and no chain (market Holders read their mark from `marks`). Rate limits are not registered
 * (they are per-IP config only).
 */

const ORIGIN = "http://social-check.local";
const SESSION_SECRET_BYTES = 32;
const ADDRESS_BYTES = 20;
const HANDLE_SUFFIX_BYTES = 4;
/** Enough connections for the concurrent-claim and cap races (each holds one inside its transaction). */
const CHECK_POOL_MAX = 16;
/** A per-run operator secret for the review-queue routes. */
const ADMIN_SECRET_BYTES = 32;

export interface Harness {
  db: Db;
  app: HttpServer;
  anon: ApiClient;
  mock: MockIndexer;
  social: SocialRuntime["social"];
  poller: FeedPoller;
  /** Feed notices emitted (chain, newest id). */
  notices: Array<{ chainId: ChainId; latestId: bigint }>;
  /** Accepted prices the Holders mark reader answers, by `chainId:marketId`; a missing one reads as RPC down. */
  marks: Map<string, Mark>;
  /** Added to the Holders service's clock, so a check can expire its cache without waiting. */
  clock: { skewMs: number };
  /** Call an `auth: "admin"` route with `secret` (default: the right one) — the app client never sends one. */
  admin(
    route: RouteDef,
    input: { body?: unknown; query?: Record<string, string> },
    secret?: string,
  ): Promise<AdminReply>;
  /** A fresh account with a session on `chainId` (practice by default). */
  user(chainId?: ChainId): User;
  /** The same account with a session on another network. */
  on(user: User, chainId: ChainId): User;
  /** Every address the run created (for cleanup). */
  addresses: string[];
  close(): Promise<void>;
}

export interface AdminReply {
  status: number;
  json: unknown;
}

export interface User {
  address: Address;
  lower: string;
  api: ApiClient;
}

/** A unique handle per run: `chk_` + hex (hex + folding can't spell a blocked word or reserved token). */
export function freshHandle(): string {
  return `chk_${randomBytes(HANDLE_SUFFIX_BYTES).toString("hex")}`;
}

export function randomAddress(): Address {
  return `0x${randomBytes(ADDRESS_BYTES).toString("hex")}`;
}

function injectFetch(app: HttpServer): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const res = await app.inject({
      method: (init?.method ?? "GET") as "GET",
      url: `${url.pathname}${url.search}`,
      headers: (init?.headers ?? {}) as Record<string, string>,
      ...(init?.body === undefined || init.body === null ? {} : { payload: String(init.body) }),
    });
    return new Response(res.body, {
      status: res.statusCode,
      headers: { "content-type": String(res.headers["content-type"] ?? "application/json") },
    });
  }) as typeof fetch;
}

export async function openHarness(): Promise<Harness> {
  const log = createLogger("social-check", "warn");
  const db = createDb(requireSecret("DATABASE_URL"), "senryo-social-check", CHECK_POOL_MAX);
  await migrate(db, log);
  const sessions = new SessionKeys(randomBytes(SESSION_SECRET_BYTES).toString("hex"));
  const mock = new MockIndexer();
  const chainIds = [TESTNET_CHAIN_ID, MAINNET_CHAIN_ID] as const;
  const notifier = new FeedNotifier();
  const notices: Harness["notices"] = [];
  notifier.on((chainId, latestId) => notices.push({ chainId, latestId }));
  const adminSecret = randomBytes(ADMIN_SECRET_BYTES).toString("hex");
  const marks = new Map<string, Mark>();
  const clock = { skewMs: 0 };
  const social: SocialRuntime["social"] = {
    indexer: mock,
    leaderboard: new LeaderboardService({ db, indexer: mock, log, chainIds }),
    holders: new HoldersService({
      db,
      indexer: mock,
      marks: async (chainId, marketId) => {
        const mark = marks.get(`${chainId}:${marketId}`);
        if (!mark) throw new Error("rpc down");
        return mark;
      },
      nowMs: () => Date.now() + clock.skewMs,
    }),
    notifier,
    chainIds,
    adminSecret,
    contact: { email: SUPPORT_EMAIL, url: null },
  };
  const ctx: SocialRuntime = { db, sessions, social };
  const app = createHttpServer({ service: "api", logger: log });
  registerProfileRoutes(app, ctx);
  registerFollowRoutes(app, ctx);
  registerPostRoutes(app, ctx);
  registerLeaderboardRoutes(app, ctx);
  registerHolderRoutes(app, ctx);
  registerModerationRoutes(app, ctx);
  await app.ready();
  const poller = new FeedPoller({ db, indexer: mock, notifier, log, chainIds });
  const fetchImpl = injectFetch(app);
  const addresses: string[] = [];
  const clientFor = (getToken?: () => string | null) =>
    createApiClient({ origin: ORIGIN, fetch: fetchImpl, ...(getToken ? { getToken } : {}) });
  const signedIn = (address: Address, chainId: ChainId): User => {
    let token: string | null = null;
    const ready = sessions.issue(address, chainId).then((s) => {
      token = s.token;
    });
    const api = clientFor(() => token);
    // Every call waits for the (async) session issue first.
    const call: ApiClient["call"] = async (route, input, init) => {
      await ready;
      return api.call(route, input, init);
    };
    return { address, lower: address.toLowerCase(), api: { call } };
  };
  return {
    db,
    app,
    anon: clientFor(),
    mock,
    social,
    poller,
    notices,
    marks,
    clock,
    async admin(route, input, secret = adminSecret) {
      const search = input.query ? `?${new URLSearchParams(input.query).toString()}` : "";
      const res = await app.inject({
        method: route.method,
        url: `${route.path}${search}`,
        headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
        ...(input.body === undefined ? {} : { payload: JSON.stringify(input.body) }),
      });
      return { status: res.statusCode, json: res.json() };
    },
    addresses,
    user(chainId = TESTNET_CHAIN_ID) {
      const address = getAddress(randomAddress()) as Address;
      addresses.push(address.toLowerCase());
      return signedIn(address, chainId);
    },
    on(user, chainId) {
      return signedIn(user.address, chainId);
    },
    async close() {
      await app.close();
      await db.end();
    },
  };
}

/** The error code of a rejected call, or "OK" when it resolved. */
export async function codeOf(promise: Promise<unknown>): Promise<ApiErrorCode | "OK"> {
  try {
    await promise;
    return "OK";
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
}

/** Removes only this run's rows (the database may be shared with other scratch runs). */
export async function cleanup(db: Db, addresses: string[]): Promise<void> {
  if (addresses.length === 0) return;
  const list = db(addresses);
  await db`DELETE FROM moderation_reviews WHERE target_id IN ${list}
              OR target_id IN (SELECT id::text FROM posts WHERE author IN ${list})`;
  await db`DELETE FROM reports WHERE reporter IN ${list} OR target_id IN ${list}
              OR target_id IN (SELECT id::text FROM posts WHERE author IN ${list})`;
  await db`DELETE FROM likes WHERE address IN ${list}`;
  await db`DELETE FROM posts WHERE author IN ${list}`;
  await db`DELETE FROM feed_events WHERE actor IN ${list}`;
  await db`DELETE FROM mutes WHERE muter IN ${list} OR muted IN ${list}`;
  await db`DELETE FROM follows WHERE follower IN ${list} OR followee IN ${list}`;
  await db`DELETE FROM blocks WHERE blocker IN ${list} OR blocked IN ${list}`;
  await db`DELETE FROM starter_claims WHERE user_address IN ${list}`;
  // Social actions now record notifications (G1); the notify check also registers device tokens.
  await db`DELETE FROM push_tickets WHERE event_key IN (SELECT event_key FROM push_sends WHERE user_address IN ${list})`;
  await db`DELETE FROM push_sends WHERE user_address IN ${list}`;
  await db`DELETE FROM push_tokens WHERE user_address IN ${list}`;
  await db`DELETE FROM handle_tombstones WHERE address IN ${list}`;
  await db`DELETE FROM profiles WHERE address IN ${list}`;
}

export class Checks {
  private readonly results: Array<{ name: string; ok: boolean }> = [];

  record(name: string, ok: boolean, detail?: unknown): void {
    this.results.push({ name, ok });
    console.log(
      `${ok ? "✓" : "✗"} ${name}${ok || detail === undefined ? "" : ` — got ${JSON.stringify(detail, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`}`,
    );
  }

  get failed(): number {
    return this.results.filter((r) => !r.ok).length;
  }

  get total(): number {
    return this.results.length;
  }
}

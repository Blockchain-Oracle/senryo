import { randomBytes } from "node:crypto";
import { type ApiClient, ApiError, type ApiErrorCode, createApiClient } from "@senryo/api-client";
import type { Address } from "@senryo/chain";
import { type ChainId, TESTNET_CHAIN_ID } from "@senryo/config";
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
import { registerProfileRoutes } from "../src/routes/profile.ts";

/**
 * In-process harness for the social check: the real profile/follow routes on a Fastify instance, a real Postgres
 * (`DATABASE_URL`, migrated here), and `@senryo/api-client` clients whose fetch is `app.inject` — the same encode /
 * decode path the apps use, with no port and no chain. Rate limits are not registered (they are per-IP config only).
 */

const ORIGIN = "http://social-check.local";
const SESSION_SECRET_BYTES = 32;
const ADDRESS_BYTES = 20;
const HANDLE_SUFFIX_BYTES = 4;
/** Enough connections for the concurrent-claim and cap races (each holds one inside its transaction). */
const CHECK_POOL_MAX = 16;

export interface Harness {
  db: Db;
  app: HttpServer;
  anon: ApiClient;
  /** A fresh account with a session on `chainId` (practice by default). */
  user(chainId?: ChainId): User;
  /** The same account with a session on another network. */
  on(user: User, chainId: ChainId): User;
  /** Every address the run created (for cleanup). */
  addresses: string[];
  close(): Promise<void>;
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
  const app = createHttpServer({ service: "api", logger: log });
  registerProfileRoutes(app, { db, sessions });
  registerFollowRoutes(app, { db, sessions });
  await app.ready();
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
    addresses,
    user(chainId = TESTNET_CHAIN_ID) {
      const address = randomAddress();
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
  await db`DELETE FROM follows WHERE follower IN ${db(addresses)} OR followee IN ${db(addresses)}`;
  await db`DELETE FROM blocks WHERE blocker IN ${db(addresses)} OR blocked IN ${db(addresses)}`;
  await db`DELETE FROM handle_tombstones WHERE address IN ${db(addresses)}`;
  await db`DELETE FROM profiles WHERE address IN ${db(addresses)}`;
}

export class Checks {
  private readonly results: Array<{ name: string; ok: boolean }> = [];

  record(name: string, ok: boolean, detail?: unknown): void {
    this.results.push({ name, ok });
    console.log(`${ok ? "✓" : "✗"} ${name}${ok || detail === undefined ? "" : ` — got ${JSON.stringify(detail)}`}`);
  }

  get failed(): number {
    return this.results.filter((r) => !r.ok).length;
  }

  get total(): number {
    return this.results.length;
  }
}

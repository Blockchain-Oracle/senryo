/**
 * In-process harness for the any-asset check (scripts/drive/src/anyasset-check.ts): the any-asset routes alone on a
 * Fastify instance — no database, no chain context (read clients are made on first use) — and an `@senryo/api-client`
 * whose fetch is `app.inject`, so every call takes the apps' encode / decode path. HyperSync spends at most one query
 * per scan here (its token's budget is shared with the indexer) unless the caller asks for more. Rate limits are not
 * registered. With `db` (a local Postgres, migrated here), the scan stores what it reads and wallet activity is served.
 */
import { type ApiClient, createApiClient } from "@senryo/api-client";
import type { SwapProvider } from "@senryo/config";
import { createHttpServer, createLogger, type Db, type HttpServer, migrate } from "@senryo/service-common";
import { type AnyAssetServices, createAnyAsset } from "../src/anyasset/runtime.ts";
import { registerAnyAssetRoutes } from "../src/routes/anyasset.ts";

const ORIGIN = "http://anyasset-check.local";

export interface AnyAssetHarness {
  api: ApiClient;
  services: AnyAssetServices;
  close(): Promise<void>;
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

export async function openAnyAssetHarness(
  secrets: {
    hypersyncToken?: string | undefined;
    alchemyKey?: string | undefined;
    auroraKey?: string | undefined;
  },
  /** Fork checks: quote only these aggregators (KyberSwap's AMM routes replay on a fork; Kuru's order book doesn't). */
  swapProviders?: readonly SwapProvider[],
  options: { db?: Db; pagesPerScan?: number } = {},
): Promise<AnyAssetHarness> {
  const log = createLogger("anyasset-check", process.env.LOG_LEVEL ?? "error");
  if (options.db) await migrate(options.db, log);
  const services = createAnyAsset(
    log,
    new Map(),
    { hypersyncToken: secrets.hypersyncToken, alchemyKey: secrets.alchemyKey, auroraKey: secrets.auroraKey },
    {
      hypersyncPagesPerScan: options.pagesPerScan ?? 1,
      ...(swapProviders ? { swapProviders } : {}),
      ...(options.db ? { db: options.db } : {}),
    },
  );
  const app = createHttpServer({ service: "anyasset-check", logger: log });
  registerAnyAssetRoutes(app, log, services);
  await app.ready();
  return { api: createApiClient({ origin: ORIGIN, fetch: injectFetch(app) }), services, close: () => app.close() };
}

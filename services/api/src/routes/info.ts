import { configRoute, geoRoute, statusRoute, timeRoute } from "@senryo/api-client";
import { networkOf } from "@senryo/config";
import { type HttpServer, MS_PER_SECOND, sendRoute } from "@senryo/service-common";
import type { ApiContext } from "../context.ts";
import { geoOf } from "../geo.ts";
import { priceStatus } from "../prices/health.ts";

/** A fixed public line; the full error (which may carry a keyed RPC URL) only goes to the log (S8.5b #7). */
function rpcDown(ctx: ApiContext, error: unknown): string {
  ctx.log.warn({ err: error instanceof Error ? error.message : String(error) }, "status: rpc down");
  return "rpc unavailable";
}

/** Unauthenticated reads that fan out to RPC are rate-limited per client IP (S8.5b #5). */
const READ_RATE = { rateLimit: { max: 120, timeWindow: "1 minute" } } as const;

/** Until S9 wires the Aurora client it reports "unknown" — never a fabricated "ok" — in the Wallet's words. */
const NOT_OPEN = { state: "unknown" as const, detail: "opens with Real" };

export function registerInfoRoutes(app: HttpServer, ctx: ApiContext): void {
  app.get(configRoute.path, async (_request, reply) =>
    sendRoute(reply, configRoute, {
      minAppVersion: ctx.env.MIN_APP_VERSION,
      features: ctx.env.FEATURES,
      networks: [...ctx.chains.values()].map((c) => ({
        chainId: c.chainId,
        modeLabel: networkOf(c.chainId).modeLabel,
        deployed: c.deployed,
      })),
      contact: { email: ctx.env.SUPPORT_EMAIL, url: ctx.env.SUPPORT_URL ?? null },
    }),
  );

  // Read as close to the send as possible: the client halves the round trip around it.
  app.get(timeRoute.path, { config: READ_RATE }, async (_request, reply) => {
    reply.header("cache-control", "no-store");
    return sendRoute(reply, timeRoute, { t: Date.now() });
  });

  app.get(geoRoute.path, async (request, reply) =>
    sendRoute(reply, geoRoute, geoOf(request, { db: ctx.geo, trustedHeader: ctx.env.TRUSTED_COUNTRY_HEADER })),
  );

  app.get(statusRoute.path, { config: READ_RATE }, async (_request, reply) => {
    const nowSec = Math.floor(Date.now() / MS_PER_SECOND);
    const chains = await Promise.all(
      [...ctx.chains.values()].map(async (c) => {
        try {
          const block = await c.read.getBlock({ blockTag: "finalized" });
          return {
            chainId: c.chainId,
            rpc: { state: "ok" as const, detail: null },
            headAgeSec: nowSec - Number(block.timestamp),
            indexerLagBlocks: null,
          };
        } catch (error) {
          return {
            chainId: c.chainId,
            rpc: { state: "down" as const, detail: rpcDown(ctx, error) },
            headAgeSec: null,
            indexerLagBlocks: null,
          };
        }
      }),
    );
    return sendRoute(reply, statusRoute, {
      at: new Date().toISOString(),
      chains,
      ...priceStatus(ctx.gateway.status(), ctx.bus.stats()),
      aurora: NOT_OPEN,
      process: ctx.guards.faults(),
    });
  });
}

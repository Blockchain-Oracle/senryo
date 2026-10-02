import { accountRoute, configRoute, geoRoute, marketsRoute, statusRoute } from "@senryo/api-client";
import { getAddress, isDeployed, readAccountSnapshot, readContract, readOracles, readPositions } from "@senryo/chain";
import { type ChainId, ENGINE_MARKETS, engineMarketsOn, networkOf } from "@senryo/config";
import { type HttpServer, MS_PER_SECOND, parseRoute, sendRoute } from "@senryo/service-common";
import { bucketsOf } from "../buckets.ts";
import { UPSTREAM_TIMEOUT_MS } from "../constants.ts";
import { type ApiContext, chainOf } from "../context.ts";
import { geoOf } from "../geo.ts";

const BPS = 10_000;

/** Market ids SenryoCore lists on `chainId` (FX joins 10143 only after AddMarkets executes, S8.23). */
const marketIdsOn = (chainId: ChainId) => engineMarketsOn(chainId).map((m) => m.id);

/** A fixed public line; the full error (which may carry a keyed RPC URL) only goes to the log (S8.5b #7). */
function rpcDown(ctx: ApiContext, error: unknown): string {
  ctx.log.warn({ err: error instanceof Error ? error.message : String(error) }, "status: rpc down");
  return "rpc unavailable";
}

/** Unauthenticated reads that fan out to RPC/indexer are rate-limited per client IP (S8.5b #5). */
const READ_RATE = { rateLimit: { max: 120, timeWindow: "1 minute" } } as const;

export function registerInfoRoutes(app: HttpServer, ctx: ApiContext): void {
  app.get(configRoute.path, async (_request, reply) =>
    sendRoute(reply, configRoute, {
      minAppVersion: ctx.env.MIN_APP_VERSION,
      features: ctx.env.FEATURES,
      networks: [...ctx.chains.values()].map((c) => ({
        chainId: c.chainId,
        modeLabel: networkOf(c.chainId).modeLabel,
        deployed: c.deployed,
        starter: c.deployed && isDeployed(c.chainId, "StarterDrip") && c.sponsor !== undefined,
        card: Boolean(ctx.env.CARD_URL),
      })),
      contact: ctx.social.contact,
    }),
  );

  app.get(geoRoute.path, async (request, reply) =>
    sendRoute(reply, geoRoute, geoOf(request, { db: ctx.geo, trustedHeader: ctx.env.TRUSTED_COUNTRY_HEADER })),
  );

  app.get(statusRoute.path, { config: READ_RATE }, async (_request, reply) => {
    const nowSec = Math.floor(Date.now() / MS_PER_SECOND);
    const chains = await Promise.all(
      [...ctx.chains.values()].map(async (c) => {
        try {
          const [block, oracles] = await Promise.all([
            c.read.getBlock({ blockTag: "finalized" }),
            c.deployed ? readOracles(c.read, c.chainId, marketIdsOn(c.chainId)) : Promise.resolve([]),
          ]);
          const progress = ctx.indexer.progressBlock(c.chainId);
          return {
            chainId: c.chainId,
            rpc: { state: "ok" as const, detail: null },
            headAgeSec: nowSec - Number(block.timestamp),
            oracles: oracles.map((o) => ({
              symbol: ENGINE_MARKETS.find((m) => m.id === o.marketId)?.symbol ?? String(o.marketId),
              status: o.status,
              ageSec: o.updatedAt === 0n ? null : nowSec - Number(o.updatedAt),
            })),
            indexerLagBlocks: progress === null ? null : Number(block.number - progress),
          };
        } catch (error) {
          return {
            chainId: c.chainId,
            rpc: { state: "down" as const, detail: rpcDown(ctx, error) },
            headAgeSec: null,
            oracles: [],
            indexerLagBlocks: null,
          };
        }
      }),
    );
    const card = ctx.env.CARD_URL
      ? await fetch(`${ctx.env.CARD_URL}/ready`, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) })
          .then((r) => ({ state: r.ok ? ("ok" as const) : ("degraded" as const), detail: null }))
          .catch(() => ({ state: "down" as const, detail: "unreachable" }))
      : { state: "unknown" as const, detail: "not configured" };
    const unknown = { state: "unknown" as const, detail: "S7/S9" };
    return sendRoute(reply, statusRoute, {
      at: new Date().toISOString(),
      chains,
      card,
      perpl: unknown,
      aurora: ctx.aurora ? await ctx.aurora.component() : unknown,
    });
  });

  app.get(marketsRoute.path, { config: READ_RATE }, async (request, reply) => {
    const { query } = parseRoute(marketsRoute, request);
    const chainId = query.chainId ?? ctx.env.CHAIN_ID;
    const chain = chainOf(ctx, chainId);
    const core = readContract(chainId, "SenryoCore", chain.read);
    const [views, params] = await Promise.all([
      readOracles(chain.read, chainId, marketIdsOn(chainId)),
      Promise.all(marketIdsOn(chainId).map((id) => core.read.marketParams([id]))),
    ]);
    const engine = engineMarketsOn(chainId).map((m, i) => {
      const view = views.find((v) => v.marketId === m.id);
      const p = params[i];
      return {
        id: m.id,
        symbol: m.symbol,
        name: m.name,
        venue: "SENRYO" as const,
        status: view?.status ?? "HALTED",
        price18: view?.price18 ?? 0n,
        latest18: view?.latest18 ?? 0n,
        updatedAt: Number(view?.updatedAt ?? 0n),
        spreadBps: view?.spreadBps ?? 0,
        imBps: p?.imBps ?? 0,
        mmBps: p?.mmBps ?? 0,
        feeBps: p?.feeBps ?? 0,
        maxLeverageX: p?.imBps ? Math.floor(BPS / p.imBps) : 0,
      };
    });
    return sendRoute(reply, marketsRoute, { chainId, engine, perpl: [] });
  });

  app.get(accountRoute.path, { config: READ_RATE }, async (request, reply) => {
    const { params, query } = parseRoute(accountRoute, request);
    const chainId = query.chainId ?? ctx.env.CHAIN_ID;
    const chain = chainOf(ctx, chainId);
    const address = getAddress(params.address);
    const [finalized, latest] = await Promise.all([
      readAccountSnapshot(chain.read, chainId, address, "finalized"),
      readAccountSnapshot(chain.read, chainId, address, "latest"),
    ]);
    const [positions, history] = await Promise.all([
      readPositions(chain.read, chainId, address, latest.positionBitmap, "latest"),
      ctx.indexer.history(chainId, address),
    ]);
    return sendRoute(reply, accountRoute, {
      chainId,
      address,
      finalized: bucketsOf(finalized),
      latest: bucketsOf(latest),
      positions: positions.map((p) => ({
        marketId: p.marketId,
        isLong: p.isLong,
        size18: p.size,
        entry18: p.entry,
        openedBlock: p.openedBlock,
      })),
      allowance: {
        dailyLimitUsd6: latest.allowanceDailyLimit,
        leftUsd6: latest.allowanceLeft,
        expiry: latest.allowanceExpiry,
      },
      history,
    });
  });
}

/**
 * Each component's health now (P6, D-324): prices (the gateway's feed states), settlement (calls past their window and
 * not settled), the relay (requests waiting and the oldest), the keeper (its jobs' last runs and errors, `keeper_state`),
 * the chain (the finalized head's age and how fast the RPC answered), the indexer (blocks behind the head,
 * `envio_chains`) and deposits (not open in Practice). Each reads ok, degraded, down or unknown with a short reason
 * and its numbers. The live board shows these; the recorder stores them once a minute for the history.
 */
import type { ChainId } from "@senryo/config";
import { MS_PER_SECOND } from "@senryo/service-common";
import type { ApiContext } from "../context.ts";
import { priceStatus } from "../prices/health.ts";
import { HEALTH_LIMITS as L } from "./constants.ts";

export type HealthState = "ok" | "degraded" | "down" | "unknown";
export const COMPONENTS = ["prices", "settlement", "relay", "keeper", "chain", "indexer", "deposits"] as const;
export type ComponentId = (typeof COMPONENTS)[number];

export interface ComponentHealth {
  id: ComponentId;
  state: HealthState;
  detail: string | null;
  metrics: Record<string, number | null>;
}

const grade = (v: number, limit: { degraded: number; down: number }): HealthState =>
  v >= limit.down ? "down" : v >= limit.degraded ? "degraded" : "ok";

const nowSec = () => Math.floor(Date.now() / MS_PER_SECOND);

async function settlement(ctx: ApiContext, chainId: ChainId): Promise<ComponentHealth> {
  const [row] = await ctx.db<{ overdue: number; oldest: number | null }[]>`
    SELECT count(*)::int AS overdue, min(window_expiry)::int8 AS oldest FROM market_tickets
    WHERE chain_id = ${chainId} AND state IN ('committed', 'open', 'closing')
      AND window_expiry < ${nowSec() - L.settleGraceSec}`;
  const overdue = row?.overdue ?? 0;
  return {
    id: "settlement",
    state: overdue === 0 ? "ok" : overdue >= L.overdueDown ? "down" : "degraded",
    detail: overdue === 0 ? "Every closed window settled" : `${overdue} calls past their window`,
    metrics: { overdue, oldestSec: row?.oldest ? nowSec() - Number(row.oldest) : null },
  };
}

async function relay(ctx: ApiContext, chainId: ChainId): Promise<ComponentHealth> {
  const [row] = await ctx.db<{ pending: number; oldest: number | null }[]>`
    SELECT count(*)::int AS pending, extract(epoch FROM now() - min(created_at))::int AS oldest FROM market_intents
    WHERE chain_id = ${chainId} AND state IN ('received', 'submitted')`;
  const oldest = row?.oldest ?? 0;
  return {
    id: "relay",
    state: (row?.pending ?? 0) === 0 ? "ok" : grade(oldest, L.relayOldestSec),
    detail: (row?.pending ?? 0) === 0 ? "Nothing waiting" : `${row?.pending} waiting · oldest ${oldest}s`,
    metrics: { pending: row?.pending ?? 0, oldestSec: row?.oldest ?? null },
  };
}

async function keeper(ctx: ApiContext): Promise<ComponentHealth> {
  const rows = await ctx.db<{ job: string; age: number; state: { lastError?: string | null; lastRunAt?: number } }[]>`
    SELECT job, extract(epoch FROM now() - last_tick_at)::int AS age, state FROM keeper_state`;
  if (rows.length === 0) return { id: "keeper", state: "unknown", detail: "Not reporting yet", metrics: {} };
  const newest = Math.min(...rows.map((r) => r.age));
  const failing = rows.filter((r) => r.state.lastError && r.age <= L.keeperErrorFreshSec).map((r) => r.job);
  const tick = grade(newest, L.keeperTickSec);
  const state: HealthState = tick !== "ok" ? tick : failing.length > 0 ? "degraded" : "ok";
  return {
    id: "keeper",
    state,
    detail: failing.length > 0 ? `${failing.join(", ")} failing` : `Last run ${newest}s ago`,
    metrics: { lastRunSec: newest, failing: failing.length, jobs: rows.length },
  };
}

async function chainAndIndexer(ctx: ApiContext, chainId: ChainId): Promise<ComponentHealth[]> {
  const c = ctx.chains.get(chainId);
  if (!c) {
    return [
      { id: "chain", state: "unknown", detail: "Not served here", metrics: {} },
      { id: "indexer", state: "unknown", detail: "Not served here", metrics: {} },
    ];
  }
  const started = Date.now();
  let head: { number: bigint; timestamp: bigint } | null = null;
  try {
    head = await c.read.getBlock({ blockTag: "finalized" });
  } catch {
    head = null;
  }
  const latency = Date.now() - started;
  const age = head ? nowSec() - Number(head.timestamp) : null;
  const chain: ComponentHealth = head
    ? {
        id: "chain",
        state: [grade(age ?? 0, L.headAgeSec), grade(latency, L.rpcLatencyMs)].includes("down")
          ? "down"
          : [grade(age ?? 0, L.headAgeSec), grade(latency, L.rpcLatencyMs)].includes("degraded")
            ? "degraded"
            : "ok",
        detail: `Block ${age}s old · RPC ${latency} ms`,
        metrics: { headAgeSec: age, rpcLatencyMs: latency, block: Number(head.number) },
      }
    : { id: "chain", state: "down", detail: "RPC unavailable", metrics: { rpcLatencyMs: latency } };
  let indexer: ComponentHealth;
  try {
    const schema = ctx.db(ctx.env.INDEXER_SCHEMA);
    const [row] = await ctx.db<{ source: number; progress: number }[]>`
      SELECT source_block::int8 AS source, progress_block::int8 AS progress FROM ${schema}.envio_chains
      WHERE id = ${chainId}`;
    const lag = row ? Math.max(0, Number(head?.number ?? BigInt(row.source)) - Number(row.progress)) : null;
    indexer =
      lag === null
        ? { id: "indexer", state: "unknown", detail: "Not indexing this network", metrics: {} }
        : {
            id: "indexer",
            state: grade(lag, L.indexerLagBlocks),
            detail: lag === 0 ? "Caught up" : `${lag} blocks behind`,
            metrics: { lagBlocks: lag },
          };
  } catch {
    indexer = { id: "indexer", state: "unknown", detail: "Progress unreadable", metrics: {} };
  }
  return [chain, indexer];
}

/** Every component's health on `chainId` now; a read that fails leaves its component unknown, never ok. */
export async function readHealth(ctx: ApiContext, chainId: ChainId): Promise<ComponentHealth[]> {
  const unknown = (id: ComponentId) => (): ComponentHealth => ({
    id,
    state: "unknown",
    detail: "Unreadable",
    metrics: {},
  });
  const p = priceStatus(ctx.gateway.status(), ctx.bus.stats());
  const live = p.priceSources.reduce((n, s) => n + (s.counts.live ?? 0), 0);
  const prices: ComponentHealth = {
    id: "prices",
    state: p.prices.state,
    detail: p.prices.detail,
    metrics: { live },
  };
  const [s, r, k, ci] = await Promise.all([
    settlement(ctx, chainId).catch(unknown("settlement")),
    relay(ctx, chainId).catch(unknown("relay")),
    keeper(ctx).catch(unknown("keeper")),
    chainAndIndexer(ctx, chainId),
  ]);
  const deposits: ComponentHealth = { id: "deposits", state: "unknown", detail: "Not open in Practice", metrics: {} };
  return [prices, s, r, k, ...ci, deposits];
}

"use client";

/**
 * The public traction reads (D-022 `/stats/`), per network, straight from the public Envio indexer — no API, no
 * account. Hasura exposes no `_aggregate` fields, so totals come from the ProtocolStats counters the handlers keep in
 * step with the User / Fill / CardHold rows, and the daily series pages ProtocolDailyStats by day (bounded). The pool's
 * value is the one chain read: the indexer keeps the pool's flows, not its value (schema `LpPoolDaily`).
 */
import type { ChainId } from "@senryo/config";
import {
  createIndexerClient,
  graphqlEndpoint,
  type ProtocolDay,
  ProtocolDaysDocument,
  SECONDS_PER_DAY,
  TractionDocument,
} from "@senryo/indexer-client";
import { useQuery } from "@tanstack/react-query";
import { QUERY_RETRIES } from "@/lib/constants/query";
import {
  STATS_DAYS_MAX_PAGES,
  STATS_DAYS_PAGE,
  STATS_DEPLOYMENT_STALE_MS,
  STATS_STALE_MS,
} from "@/lib/constants/stats";
import { ENV } from "@/lib/env";

const MS_PER_SECOND = 1000;
/** The first page asks for every day after this cursor (day indices start at 0). */
const BEFORE_FIRST_DAY = -1;

const indexer = createIndexerClient({ url: graphqlEndpoint(ENV.INDEXER_ORIGIN) });

/** Totals and how far the indexer has read this chain. */
export function useTraction(chainId: ChainId) {
  return useQuery({
    queryKey: ["stats", chainId, "traction"],
    queryFn: ({ signal }) => indexer.request(TractionDocument, { chainId }, signal),
    staleTime: STATS_STALE_MS,
    retry: QUERY_RETRIES,
  });
}

export interface DaysRead {
  rows: ProtocolDay[];
  /** False only if the page cap stopped the read before the last day (the chart then says so). */
  complete: boolean;
}

async function readAllDays(chainId: ChainId, signal: AbortSignal): Promise<DaysRead> {
  const rows: ProtocolDay[] = [];
  let afterDay = BEFORE_FIRST_DAY;
  for (let page = 0; page < STATS_DAYS_MAX_PAGES; page++) {
    const batch = await indexer.request(ProtocolDaysDocument, { chainId, afterDay, limit: STATS_DAYS_PAGE }, signal);
    rows.push(...batch);
    const last = batch.at(-1);
    if (!last || batch.length < STATS_DAYS_PAGE) return { rows, complete: true };
    afterDay = last.day;
  }
  return { rows, complete: false };
}

/** Every indexed day on this chain, in order (keyset pages of STATS_DAYS_PAGE). */
export function useProtocolDays(chainId: ChainId) {
  return useQuery({
    queryKey: ["stats", chainId, "days"],
    queryFn: ({ signal }) => readAllDays(chainId, signal),
    staleTime: STATS_STALE_MS,
    retry: QUERY_RETRIES,
  });
}

/**
 * Which of Senryo's own contracts exist on this chain (the address book the indexer config must match, invariant
 * `address-drift`). The chain package loads on demand, so the page's first paint doesn't carry viem.
 */
export function useDeployment(chainId: ChainId) {
  return useQuery({
    queryKey: ["stats", chainId, "deployment"],
    queryFn: async () => {
      const { isDeployed } = await import("@senryo/chain");
      return { core: isDeployed(chainId, "SenryoCore"), pool: isDeployed(chainId, "LpVault") };
    },
    staleTime: STATS_DEPLOYMENT_STALE_MS,
  });
}

/** The pool's value now: `LpVault.totalAssets()` (the Pool screen's figure), usd6. */
export function usePoolValue(chainId: ChainId, deployed: boolean) {
  return useQuery({
    queryKey: ["stats", chainId, "pool"],
    queryFn: async () => {
      const { createReadClient, readContract } = await import("@senryo/chain");
      return readContract(chainId, "LpVault", createReadClient(chainId)).read.totalAssets();
    },
    enabled: deployed,
    staleTime: STATS_STALE_MS,
    retry: QUERY_RETRIES,
  });
}

export interface DayPoint {
  day: number;
  accounts: number;
  trades: number;
}

/**
 * The since-launch series: every UTC day from the first indexed one to today. A day without a row is a true zero, not
 * a gap: the handlers create the day's row on the first new account or trade of that day (`updateProtocolDaily`).
 */
export function dailySeries(rows: readonly ProtocolDay[], nowMs: number): DayPoint[] {
  const first = rows[0];
  if (!first) return [];
  const today = todayIndex(nowMs);
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const last = Math.max(today, rows.at(-1)?.day ?? today);
  const points: DayPoint[] = [];
  for (let day = first.day; day <= last; day++) {
    const row = byDay.get(day);
    points.push({ day, accounts: row?.newUsers ?? 0, trades: row?.trades ?? 0 });
  }
  return points;
}

/** The UTC day index of now (the series' partial last day). */
export function todayIndex(nowMs: number): number {
  return Math.floor(nowMs / MS_PER_SECOND / SECONDS_PER_DAY);
}

/** "Sep 30" for a UTC day index. */
export function dayLabel(day: number): string {
  return new Date(day * SECONDS_PER_DAY * MS_PER_SECOND).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

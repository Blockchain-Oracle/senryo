/**
 * `GET /v1/status`: what the api reports about itself — each component's health on this network (P6: prices,
 * settlement, the relay, the keeper, the chain, the indexer, deposits), prices per source, each network's RPC, head
 * age and indexer lag, and the process — and `GET /v1/status/history`, the board's 24 h and 90 d bars.
 */
import {
  type StatusHistory,
  type StatusRange,
  type StatusResponse,
  statusHistoryRoute,
  statusRoute,
} from "@senryo/api-client";
import type { Reading } from "@senryo/core";
import { useQuery } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";
import { readingOf } from "./reading.ts";

/** A status screen that is open shows a state at most this old. */
export const STATUS_REFRESH_MS = 15_000;

/** The bars move a minute at a time; re-read them this often while the board is open. */
export const STATUS_HISTORY_REFRESH_MS = 60_000;

/** `enabled: false` stops the polling (a health chip on a screen that isn't in front). */
export function useStatus({ enabled = true }: { enabled?: boolean } = {}): Reading<StatusResponse> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: ["status", env.chainId] as const,
    queryFn: () => env.api.call(statusRoute, { query: { chainId: env.chainId } }),
    refetchInterval: STATUS_REFRESH_MS,
    staleTime: STATUS_REFRESH_MS,
    enabled,
  });
  return readingOf(query);
}

export function useStatusHistory(range: StatusRange): Reading<StatusHistory> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: ["status", env.chainId, "history", range] as const,
    queryFn: () => env.api.call(statusHistoryRoute, { query: { chainId: env.chainId, range } }),
    refetchInterval: STATUS_HISTORY_REFRESH_MS,
    staleTime: STATUS_HISTORY_REFRESH_MS,
    placeholderData: (previous) => previous,
  });
  return readingOf(query);
}

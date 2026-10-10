/**
 * `GET /v1/status`: what the api reports about itself — prices overall and per source (`FeedState` counts), each
 * network's RPC, head age and indexer lag, deposits, and the process. The phone's Status screen reads it (R2.10).
 */
import { type StatusResponse, statusRoute } from "@senryo/api-client";
import type { Reading } from "@senryo/core";
import { useQuery } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";
import { readingOf } from "./reading.ts";

/** A status screen that is open shows a state at most this old. */
export const STATUS_REFRESH_MS = 15_000;

export function useStatus(): Reading<StatusResponse> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: ["status"] as const,
    queryFn: () => env.api.call(statusRoute, {}),
    refetchInterval: STATUS_REFRESH_MS,
    staleTime: STATUS_REFRESH_MS,
  });
  return readingOf(query);
}

/**
 * Earn (S7.6, D-287): the pool and the account's place in it from `/v1/earn` (read on chain by the api). Rolls are
 * hourly, so a slow poll; the account's own requests and deliveries arrive on its stream and refresh it at once.
 */
import { earnRoute } from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { fromQuery } from "@senryo/core";
import { useQuery } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";

const EARN_POLL_MS = 30_000;

export const earnKeys = {
  all: ["earn"] as const,
  view: (chainId: ChainId, owner: string | undefined) => ["earn", chainId, owner ?? "guest"] as const,
};

export function useEarn(owner: `0x${string}` | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: earnKeys.view(env.chainId, owner),
    queryFn: ({ signal }) =>
      env.api.call(earnRoute, { query: { chainId: env.chainId, ...(owner ? { owner } : {}) } }, { signal }),
    refetchInterval: EARN_POLL_MS,
  });
  return fromQuery(query);
}

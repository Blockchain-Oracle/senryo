import { readPortfolio } from "@senryo/chain";
import type { Address } from "@senryo/core";
import { useQuery } from "@tanstack/react-query";
import { ACCOUNT_REFETCH_MS } from "./constants.ts";
import { useQueryEnv } from "./env.tsx";
import { keys } from "./keys.ts";
import { ownLpRequests } from "./lp-requests.ts";
import { readingOf } from "./reading.ts";
export function usePortfolio(address: Address | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: [...keys.account(env.chainId, address ?? "0x"), "portfolio"] as const,
    queryFn: () =>
      readPortfolio(env.read, env.chainId, address ?? "0x", (block) =>
        ownLpRequests(env.indexer, env.chainId, address ?? "0x", block),
      ),
    enabled: address !== undefined,
    refetchInterval: ACCOUNT_REFETCH_MS,
    staleTime: ACCOUNT_REFETCH_MS,
  });
  return readingOf(query, ACCOUNT_REFETCH_MS);
}

/**
 * Starter status (F05, S8.16e) as a shared query for both apps: whether this account already claimed on this chain
 * (read at `finalized` by the api), the drip's terms, and the last relay. Keyed under the account, so the invalidation
 * after a claim or a finalized account event refreshes it with the buckets. No interval: it changes only when the user
 * claims, and the claim flow invalidates it.
 */
import { type StarterStatus, starterStatusRoute } from "@senryo/api-client";
import type { Address } from "@senryo/core";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { STARTER_STALE_MS } from "./constants.ts";
import { type QueryEnv, useQueryEnv } from "./env.tsx";
import { keys } from "./keys.ts";

export const starterStatusOptions = (env: QueryEnv, user: Address) =>
  queryOptions({
    queryKey: keys.starter(env.chainId, user),
    queryFn: (): Promise<StarterStatus> => env.api.call(starterStatusRoute, { query: { chainId: env.chainId, user } }),
    staleTime: STARTER_STALE_MS,
  });

export type { StarterStatus };

/** The raw query (callers need `isPending`/`isError`/`refetch` to tell "checking" from "couldn't check"). */
export function useStarterStatus(address: Address | undefined) {
  const env = useQueryEnv();
  return useQuery({ ...starterStatusOptions(env, address ?? "0x"), enabled: address !== undefined });
}

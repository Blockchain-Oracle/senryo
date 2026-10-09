/**
 * Parlays (S8.5, D-293): the caller's parlays with their legs, refreshed on the user's own `parlay` events, and the
 * relay for a signed parlay (its status arrives as an intent, like a call's).
 */
import { type CallInput, parlaysRoute, submitParlayRoute } from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { type Address, fromQuery } from "@senryo/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";
import { ACCOUNT_FALLBACK_MS, marketKeys } from "./markets.ts";

export const parlayKeys = {
  of: (chainId: ChainId, owner: Address) => [...marketKeys.owner(chainId, owner), "parlays"] as const,
};

export function useParlays(owner: Address | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: parlayKeys.of(env.chainId, owner ?? "0x"),
    queryFn: ({ signal }) => {
      if (!owner) throw new Error("no account");
      return env.api.call(parlaysRoute, { query: { chainId: env.chainId, owner } }, { signal });
    },
    enabled: owner !== undefined,
    refetchInterval: ACCOUNT_FALLBACK_MS,
  });
  return fromQuery(query);
}

type SubmitParlayBody = CallInput<typeof submitParlayRoute>["body"];

/** Relay a signed parlay (idempotent by its EIP-712 digest). */
export function useSubmitParlay() {
  const env = useQueryEnv();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<SubmitParlayBody, "chainId">) =>
      env.api.call(submitParlayRoute, { body: { ...body, chainId: env.chainId } }),
    onSuccess: (status) => client.setQueryData(marketKeys.intent(status.digest), status),
  });
}

/**
 * Rides (D-299, R5): the ride markets and their terms on the active network, the caller's rides with their exits —
 * refreshed on the user's own `ride` events — and the relay for a signed ride (its status arrives as an intent, like a
 * call's).
 */
import { type CallInput, rideCatalogRoute, rideRoute, ridesRoute, submitRideRoute } from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { type Address, fromQuery } from "@senryo/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";
import { ACCOUNT_FALLBACK_MS, marketKeys } from "./markets.ts";

export const rideKeys = {
  catalog: (chainId: ChainId) => ["markets", chainId, "rides", "catalog"] as const,
  of: (chainId: ChainId, owner: Address) => [...marketKeys.owner(chainId, owner), "rides"] as const,
  one: (chainId: ChainId, rideId: bigint) => ["markets", chainId, "ride", String(rideId)] as const,
};

/** One ride by id (its receipt): re-read while it is live, still once it has ended. */
export function useRide(rideId: bigint | undefined, chainId?: ChainId) {
  const env = useQueryEnv();
  const chain = chainId ?? env.chainId;
  const query = useQuery({
    queryKey: rideKeys.one(chain, rideId ?? 0n),
    queryFn: ({ signal }) => {
      if (rideId === undefined) throw new Error("no ride");
      return env.api.call(rideRoute, { params: { rideId }, query: { chainId: chain } }, { signal });
    },
    enabled: rideId !== undefined,
    refetchInterval: (q) => (q.state.data && !RIDE_LIVE.has(q.state.data.ride.state) ? false : ACCOUNT_FALLBACK_MS),
  });
  return fromQuery(query);
}

const RIDE_LIVE = new Set(["committed", "open", "closing"]);

/** Which markets ride on this network, their leverage and fees, and the shared terms (`RIDE_TERMS`). */
export function useRideCatalog() {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: rideKeys.catalog(env.chainId),
    queryFn: ({ signal }) => env.api.call(rideCatalogRoute, { query: { chainId: env.chainId } }, { signal }),
    staleTime: Number.POSITIVE_INFINITY,
  });
  return fromQuery(query);
}

/** The caller's rides (open, pending and recent), each with its standing exit. */
export function useRides(owner: Address | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: rideKeys.of(env.chainId, owner ?? "0x"),
    queryFn: ({ signal }) => {
      if (!owner) throw new Error("no account");
      return env.api.call(ridesRoute, { query: { chainId: env.chainId, owner } }, { signal });
    },
    enabled: owner !== undefined,
    refetchInterval: ACCOUNT_FALLBACK_MS,
  });
  return fromQuery(query);
}

type SubmitRideBody = CallInput<typeof submitRideRoute>["body"];

/** Relay a signed ride open or close (idempotent by its EIP-712 digest). */
export function useSubmitRide() {
  const env = useQueryEnv();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<SubmitRideBody, "chainId">) =>
      env.api.call(submitRideRoute, { body: { ...body, chainId: env.chainId } }),
    onSuccess: (status) => client.setQueryData(marketKeys.intent(status.digest), status),
  });
}

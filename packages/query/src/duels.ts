/**
 * Duel (S8.6, D-294): the caller's place in the queue, their duels with the rating, one match, and the ladder — kept
 * true by the user's own `duelQueue` and `duel` events (see `useLiveSync`) — and the relays for an entry, leaving the
 * queue, and a swipe.
 */
import {
  type CallInput,
  cancelDuelRoute,
  type DuelQueueView,
  duelLadderRoute,
  duelPickRoute,
  duelQueueRoute,
  duelRoute,
  duelsRoute,
  enterDuelRoute,
} from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { type Address, fromQuery } from "@senryo/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";
import { ACCOUNT_FALLBACK_MS, marketKeys } from "./markets.ts";

/** A live match is re-read this often if its stream event was missed (a pick deadline is two minutes). */
export const DUEL_FALLBACK_MS = 10_000;

export const duelKeys = {
  all: ["duel"] as const,
  of: (chainId: ChainId, owner: Address) => [...marketKeys.owner(chainId, owner), "duels"] as const,
  queue: (chainId: ChainId, owner: Address) => [...marketKeys.owner(chainId, owner), "duel-queue"] as const,
  match: (chainId: ChainId, matchId: string) => ["duel", chainId, "match", matchId] as const,
  ladder: (chainId: ChainId) => ["duel", chainId, "ladder"] as const,
};

export function useDuelQueue(owner: Address | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: duelKeys.queue(env.chainId, owner ?? "0x"),
    queryFn: async ({ signal }) => {
      if (!owner) throw new Error("no account");
      return (await env.api.call(duelQueueRoute, { query: { chainId: env.chainId, owner } }, { signal })).entry;
    },
    enabled: owner !== undefined,
    refetchInterval: ACCOUNT_FALLBACK_MS,
  });
  return fromQuery(query);
}

export function useDuels(owner: Address | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: duelKeys.of(env.chainId, owner ?? "0x"),
    queryFn: ({ signal }) => {
      if (!owner) throw new Error("no account");
      return env.api.call(duelsRoute, { query: { chainId: env.chainId, owner } }, { signal });
    },
    enabled: owner !== undefined,
    refetchInterval: ACCOUNT_FALLBACK_MS,
  });
  return fromQuery(query);
}

export function useDuel(matchId: string | null | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: duelKeys.match(env.chainId, matchId ?? "none"),
    queryFn: ({ signal }) => {
      if (!matchId) throw new Error("no match");
      return env.api.call(
        duelRoute,
        { params: { matchId: matchId as `0x${string}` }, query: { chainId: env.chainId } },
        { signal },
      );
    },
    enabled: Boolean(matchId),
    refetchInterval: DUEL_FALLBACK_MS,
  });
  return fromQuery(query);
}

export function useDuelLadder() {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: duelKeys.ladder(env.chainId),
    queryFn: ({ signal }) => env.api.call(duelLadderRoute, { query: { chainId: env.chainId } }, { signal }),
    staleTime: DUEL_FALLBACK_MS,
  });
  return fromQuery(query);
}

type EnterBody = CallInput<typeof enterDuelRoute>["body"];

/** Join the queue with a signed entry (idempotent by its digest). */
export function useEnterDuel(owner: Address | undefined) {
  const env = useQueryEnv();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<EnterBody, "chainId">) =>
      env.api.call(enterDuelRoute, { body: { ...body, chainId: env.chainId } }),
    onSuccess: (entry: DuelQueueView) => {
      if (owner) client.setQueryData(duelKeys.queue(env.chainId, owner), entry);
    },
  });
}

export function useCancelDuel(owner: Address | undefined) {
  const env = useQueryEnv();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (digest: `0x${string}`) => {
      if (!owner) throw new Error("no account");
      return env.api.call(cancelDuelRoute, { body: { chainId: env.chainId, owner, digest } });
    },
    onSuccess: (entry: DuelQueueView) => {
      if (owner) client.setQueryData(duelKeys.queue(env.chainId, owner), entry);
    },
  });
}

type PickBody = CallInput<typeof duelPickRoute>["body"];

/** Relay a signed swipe; its progress reaches both players' streams as `duel` events. */
export function useDuelPick() {
  const env = useQueryEnv();
  return useMutation({
    mutationFn: (body: Omit<PickBody, "chainId">) =>
      env.api.call(duelPickRoute, { body: { ...body, chainId: env.chainId } }),
  });
}

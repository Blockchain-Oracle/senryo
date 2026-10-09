/**
 * Yes/no events (S8.7, D-296): the board, one question with its committee's statements, the caller's calls — kept
 * true by the public `event` notices on `markets` and the caller's own `eventCall` (see `useLiveSync`) — and the
 * relay for a signed call.
 */
import {
  type CallInput,
  eventBoardRoute,
  eventCallsRoute,
  eventDetailRoute,
  placeEventCallRoute,
} from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { type Address, fromQuery } from "@senryo/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";
import { ACCOUNT_FALLBACK_MS, marketKeys } from "./markets.ts";

export const eventKeys = {
  all: ["events"] as const,
  board: (chainId: ChainId) => ["events", chainId, "board"] as const,
  detail: (chainId: ChainId, eventId: string) => ["events", chainId, "detail", eventId.toLowerCase()] as const,
  calls: (chainId: ChainId, owner: Address) => [...marketKeys.owner(chainId, owner), "event-calls"] as const,
};

/** The board; `enabled` false where the book isn't on chain yet (nothing to read). */
export function useEventBoard(enabled = true) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: eventKeys.board(env.chainId),
    queryFn: ({ signal }) => env.api.call(eventBoardRoute, { query: { chainId: env.chainId } }, { signal }),
    enabled,
    refetchInterval: ACCOUNT_FALLBACK_MS,
  });
  return fromQuery(query);
}

export function useEventDetail(eventId: string | null | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: eventKeys.detail(env.chainId, eventId ?? "none"),
    queryFn: ({ signal }) => {
      if (!eventId) throw new Error("no question");
      return env.api.call(
        eventDetailRoute,
        { params: { eventId: eventId as `0x${string}` }, query: { chainId: env.chainId } },
        { signal },
      );
    },
    enabled: Boolean(eventId),
    refetchInterval: ACCOUNT_FALLBACK_MS,
  });
  return fromQuery(query);
}

export function useEventCalls(owner: Address | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: eventKeys.calls(env.chainId, owner ?? "0x"),
    queryFn: async ({ signal }) => {
      if (!owner) throw new Error("no account");
      return (await env.api.call(eventCallsRoute, { query: { chainId: env.chainId, owner } }, { signal })).calls;
    },
    enabled: owner !== undefined,
    refetchInterval: ACCOUNT_FALLBACK_MS,
  });
  return fromQuery(query);
}

type PlaceBody = CallInput<typeof placeEventCallRoute>["body"];

/** Relay a signed call; it answers once the call is on chain (its ticket and transaction). */
export function usePlaceEventCall(owner: Address | undefined) {
  const env = useQueryEnv();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<PlaceBody, "chainId">) =>
      env.api.call(placeEventCallRoute, { body: { ...body, chainId: env.chainId } }),
    onSuccess: (_placed, body) => {
      void client.invalidateQueries({ queryKey: eventKeys.board(env.chainId) });
      void client.invalidateQueries({ queryKey: eventKeys.detail(env.chainId, body.call.eventId) });
      if (!owner) return;
      void client.invalidateQueries({ queryKey: eventKeys.calls(env.chainId, owner) });
      void client.invalidateQueries({ queryKey: marketKeys.account(env.chainId, owner) });
    },
  });
}

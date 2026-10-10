/**
 * Games without a contract (S8.8, D-295): Lucky's seal and reveal and a player's draws; the arcade's seed, checked
 * score and board. Lucky's call itself goes through the ordinary relay (`useSubmitIntent`).
 */
import {
  type ArcadeBoardView,
  arcadeBoardRoute,
  arcadeScoreRoute,
  arcadeSeedRoute,
  type CallInput,
  luckyDrawsRoute,
  luckyPlacedRoute,
  luckyRevealRoute,
  luckySealRoute,
} from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { type Address, fromQuery } from "@senryo/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";
import { ACCOUNT_FALLBACK_MS, marketKeys } from "./markets.ts";

export type ArcadeGameKey = "line-rider" | "candle-hop";

export const gameKeys = {
  draws: (chainId: ChainId, owner: Address) => [...marketKeys.owner(chainId, owner), "lucky-draws"] as const,
  board: (game: ArcadeGameKey) => ["arcade", "board", game] as const,
};

export function useLuckyDraws(owner: Address | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: gameKeys.draws(env.chainId, owner ?? "0x"),
    queryFn: async ({ signal }) => {
      if (!owner) throw new Error("no account");
      return (await env.api.call(luckyDrawsRoute, { query: { chainId: env.chainId, owner } }, { signal })).draws;
    },
    enabled: owner !== undefined,
    refetchInterval: ACCOUNT_FALLBACK_MS,
  });
  return fromQuery(query);
}

/** Seal, reveal and link a Lucky draw (the seal and reveal need the api session). */
export function useLuckyDesk(owner: Address | undefined) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const refresh = () => {
    if (owner) void client.invalidateQueries({ queryKey: gameKeys.draws(env.chainId, owner) });
  };
  const seal = useMutation({ mutationFn: () => env.api.call(luckySealRoute, { body: {} }) });
  const reveal = useMutation({
    mutationFn: (body: CallInput<typeof luckyRevealRoute>["body"]) => env.api.call(luckyRevealRoute, { body }),
    onSuccess: refresh,
  });
  const placed = useMutation({
    mutationFn: (body: CallInput<typeof luckyPlacedRoute>["body"]) => env.api.call(luckyPlacedRoute, { body }),
    onSuccess: refresh,
  });
  return { seal, reveal, placed };
}

export function useArcadeBoard(game: ArcadeGameKey) {
  const env = useQueryEnv();
  const query = useQuery<ArcadeBoardView>({
    queryKey: gameKeys.board(game),
    queryFn: ({ signal }) => env.api.call(arcadeBoardRoute, { query: { game } }, { signal }),
    refetchInterval: ACCOUNT_FALLBACK_MS,
  });
  return fromQuery(query);
}

/** A seed for the next run, and a finished run's score (checked by replay before it ranks). */
export function useArcadeDesk(game: ArcadeGameKey) {
  const env = useQueryEnv();
  const client = useQueryClient();
  const seed = useMutation({ mutationFn: () => env.api.call(arcadeSeedRoute, { body: { game } }) });
  const score = useMutation({
    mutationFn: (body: Omit<CallInput<typeof arcadeScoreRoute>["body"], "game">) =>
      env.api.call(arcadeScoreRoute, { body: { ...body, game } }),
    onSuccess: () => void client.invalidateQueries({ queryKey: gameKeys.board(game) }),
  });
  return { seed, score };
}

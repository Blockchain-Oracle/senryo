/**
 * History from the indexer (S4, D-279): a caller's calls (paged back by ticket id), one call's timeline with its
 * receipts, a window's proof and crowd split, the caller's record and the leaderboard. Refreshed when the user's
 * stream says a ticket changed (`live-sync.ts`); public reads are cached briefly at the edge as well.
 */
import {
  callerStatsRoute,
  callsRoute,
  callTimelineRoute,
  type LEADERBOARD_PERIODS,
  leaderboardRoute,
  printRoute,
  windowProofRoute,
} from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { type Address, fromQuery } from "@senryo/core";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";

/** History changes only when a ticket does (pushed); this bounds a missed event. */
export const HISTORY_STALE_MS = 60_000;
/** A settled window's proof never changes; an open one fills in as prints and settlement land. */
export const OPEN_WINDOW_STALE_MS = 5_000;
export const LEADERBOARD_STALE_MS = 30_000;

export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];

export const historyKeys = {
  all: (chainId: ChainId) => ["history", chainId] as const,
  owner: (chainId: ChainId, owner: Address) => ["history", chainId, "owner", owner.toLowerCase()] as const,
  calls: (chainId: ChainId, owner: Address) => [...historyKeys.owner(chainId, owner), "calls"] as const,
  stats: (chainId: ChainId, owner: Address) => [...historyKeys.owner(chainId, owner), "stats"] as const,
  call: (chainId: ChainId, ticketId: bigint) => ["history", chainId, "call", ticketId.toString()] as const,
  window: (chainId: ChainId, windowId: string) => ["history", chainId, "window", windowId.toLowerCase()] as const,
  leaderboard: (chainId: ChainId, period: LeaderboardPeriod) => ["history", chainId, "leaderboard", period] as const,
  print: (symbol: string, t: number) => ["history", "print", symbol, t] as const,
};

/** A caller's calls, newest first, a page at a time. */
export function useCalls(owner: Address | undefined) {
  const env = useQueryEnv();
  return useInfiniteQuery({
    queryKey: historyKeys.calls(env.chainId, owner ?? "0x"),
    queryFn: ({ pageParam, signal }) => {
      if (!owner) throw new Error("no account");
      const before = pageParam ? BigInt(pageParam) : undefined;
      return env.api.call(callsRoute, { query: { chainId: env.chainId, owner, before } }, { signal });
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next,
    enabled: owner !== undefined,
    staleTime: HISTORY_STALE_MS,
  });
}

/** One call with everything that happened to it (commit, fill, cash-outs, settlement), each with its transaction. */
export function useCallTimeline(ticketId: bigint | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: historyKeys.call(env.chainId, ticketId ?? 0n),
    queryFn: ({ signal }) => {
      if (ticketId === undefined) throw new Error("no call");
      return env.api.call(callTimelineRoute, { params: { ticketId }, query: { chainId: env.chainId } }, { signal });
    },
    enabled: ticketId !== undefined,
    staleTime: HISTORY_STALE_MS,
  });
  return fromQuery(query);
}

/** A window's proof: its open and close prints with their transactions, state, calls and the crowd split. */
export function useWindowProof(windowId: `0x${string}` | undefined, options: { live?: boolean } = {}) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: historyKeys.window(env.chainId, windowId ?? "0x"),
    queryFn: ({ signal }) => {
      if (!windowId) throw new Error("no window");
      return env.api.call(windowProofRoute, { params: { windowId }, query: { chainId: env.chainId } }, { signal });
    },
    enabled: windowId !== undefined,
    staleTime: (q) => (q.state.data?.settled ? Number.POSITIVE_INFINITY : OPEN_WINDOW_STALE_MS),
    // The terminal follows the crowd while its window is open; elsewhere a proof is read once.
    refetchInterval: (q) => (options.live && !q.state.data?.settled ? OPEN_WINDOW_STALE_MS : false),
  });
  return fromQuery(query);
}

/**
 * The archived Pyth print of one instant (the services' `pyth_prints`, the same unique print settlement would post):
 * how a window nobody was left in still shows its close. Immutable once it exists.
 */
export function usePrint(symbol: string, t: number | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: historyKeys.print(symbol, t ?? 0),
    queryFn: ({ signal }) => {
      if (t === undefined) throw new Error("no instant");
      return env.api.call(printRoute, { query: { symbol, t } }, { signal });
    },
    enabled: t !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  return fromQuery(query);
}

/** The caller's record on this network: calls, staked, returned, realised result, wins, streaks. */
export function useCallerStats(owner: Address | undefined) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: historyKeys.stats(env.chainId, owner ?? "0x"),
    queryFn: ({ signal }) => {
      if (!owner) throw new Error("no account");
      return env.api.call(callerStatsRoute, { query: { chainId: env.chainId, owner } }, { signal });
    },
    enabled: owner !== undefined,
    staleTime: HISTORY_STALE_MS,
  });
  return fromQuery(query);
}

/** Practice and Real boards are separate (the active network); day, week or all time. */
export function useLeaderboard(period: LeaderboardPeriod) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: historyKeys.leaderboard(env.chainId, period),
    queryFn: ({ signal }) => env.api.call(leaderboardRoute, { query: { chainId: env.chainId, period } }, { signal }),
    staleTime: LEADERBOARD_STALE_MS,
  });
  return fromQuery(query);
}

/**
 * Whether a window is open on chain (R5.25): asked for a long lane's window on screen; a yes never changes, a no is
 * asked again while the window can still be opened (its print's admission), then left alone.
 */
import { windowStateRoute } from "@senryo/api-client";
import { fromQuery } from "@senryo/core";
import { useQuery } from "@tanstack/react-query";
import { useQueryEnv } from "./env.tsx";

const OPENING_POLL_MS = 5_000;

export function useWindowOpened(windowId: `0x${string}`, enabled: boolean, stillOpenable: boolean) {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: ["markets", env.chainId, "window", windowId.toLowerCase()],
    queryFn: ({ signal }) =>
      env.api.call(windowStateRoute, { params: { windowId }, query: { chainId: env.chainId } }, { signal }),
    enabled,
    staleTime: (q) => (q.state.data?.opened ? Number.POSITIVE_INFINITY : OPENING_POLL_MS),
    // An api without the route (or a failing read) leaves the lane as callable — it never blocks a call on a guess.
    retry: false,
    refetchInterval: (q) =>
      q.state.status === "error" || q.state.data?.opened || !stillOpenable ? false : OPENING_POLL_MS,
  });
  return fromQuery(query);
}

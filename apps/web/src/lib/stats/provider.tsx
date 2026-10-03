"use client";

/**
 * The public pages' query layer: one TanStack client and nothing else — no chain read client, engine socket or API
 * (the desk's `DeskDataProvider` mounts those). `/stats/` reads the public indexer through it and caches each network.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { QUERY_RETRIES } from "@/lib/constants/query";
import { STATS_STALE_MS } from "@/lib/constants/stats";

export function PublicDataProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: STATS_STALE_MS, retry: QUERY_RETRIES, refetchOnWindowFocus: false } },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

"use client";

/**
 * The query layer's clients for the desk (the phone's `MarketDataProvider`, S11b): one TanStack client, the viem read
 * client for the active network, our API client, the Envio indexer and the engine socket (`@senryo/query`). Mounted
 * by the desk layout only, so the landing page never loads chain reads. The socket opens on mount, never during the
 * static prerender.
 */
import { createReadClient } from "@senryo/chain";
import { createIndexerClient, graphqlEndpoint } from "@senryo/indexer-client";
import { QueryEnvProvider } from "@senryo/query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { api } from "@/lib/account/api";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { QUERY_RETRIES, QUERY_STALE_MS } from "@/lib/constants/query";
import { ENV } from "@/lib/env";

export function DeskDataProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: QUERY_STALE_MS, retry: QUERY_RETRIES } } }),
  );
  const [read] = useState(() => createReadClient(ACTIVE_NETWORK.chainId));
  const [indexer] = useState(() => createIndexerClient({ url: graphqlEndpoint(ENV.INDEXER_ORIGIN) }));
  return (
    <QueryClientProvider client={client}>
      <QueryEnvProvider
        chainId={ACTIVE_NETWORK.chainId}
        read={read}
        api={api()}
        indexer={indexer}
        apiOrigin={ENV.API_ORIGIN}
      >
        {children}
      </QueryEnvProvider>
    </QueryClientProvider>
  );
}

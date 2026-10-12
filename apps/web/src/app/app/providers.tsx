"use client";
/**
 * The app's clients, once (the phone's root layout): the query cache, the query layer's env (this deployment's network
 * and our API, D-280: no RPC from the app) and the one live stream.
 */
import { LiveProvider } from "@senryo/live/react";
import { QueryEnvProvider } from "@senryo/query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { api } from "@/lib/account/api";
import { QUERY_RETRIES, QUERY_STALE_MS } from "@/lib/constants/query";
import { appLive } from "@/lib/live";
import { useNetwork } from "@/lib/network";

/** The tree under the query env remounts on a network switch (D-320): every screen reads the new network. */
export function AppProviders({ children }: { children: ReactNode }) {
  const network = useNetwork();
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: QUERY_STALE_MS, retry: QUERY_RETRIES } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <QueryEnvProvider key={network.key} chainId={network.chainId} api={api()}>
        <LiveProvider live={appLive()}>{children}</LiveProvider>
      </QueryEnvProvider>
    </QueryClientProvider>
  );
}

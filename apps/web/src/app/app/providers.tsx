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
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { QUERY_RETRIES, QUERY_STALE_MS } from "@/lib/constants/query";
import { appLive } from "@/lib/live";

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: QUERY_STALE_MS, retry: QUERY_RETRIES } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <QueryEnvProvider chainId={ACTIVE_NETWORK.chainId} api={api()}>
        <LiveProvider live={appLive()}>{children}</LiveProvider>
      </QueryEnvProvider>
    </QueryClientProvider>
  );
}

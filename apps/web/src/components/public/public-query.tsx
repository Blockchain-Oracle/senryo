"use client";
/**
 * The query client for a public page (a shared call, the Proof pages): no account, the network from the link's
 * `chainId` (else the active one), suspense for `useSearchParams` in a static export.
 */
import { type ChainId, isChainId } from "@senryo/config";
import { QueryEnvProvider } from "@senryo/query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { type ReactNode, Suspense, useState } from "react";
import { api } from "@/lib/account/api";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { QUERY_RETRIES, QUERY_STALE_MS } from "@/lib/constants/query";

function WithChain({ children }: { children: (chainId: ChainId, params: URLSearchParams) => ReactNode }) {
  const params = useSearchParams();
  const asked = Number(params.get("chainId"));
  const chainId = isChainId(asked) ? asked : ACTIVE_NETWORK.chainId;
  return (
    <QueryEnvProvider chainId={chainId} api={api()}>
      {children(chainId, params)}
    </QueryEnvProvider>
  );
}

export function PublicQuery({
  loading,
  children,
}: {
  loading: string;
  children: (chainId: ChainId, params: URLSearchParams) => ReactNode;
}) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: QUERY_STALE_MS, retry: QUERY_RETRIES } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <Suspense fallback={<p className="text-body text-text-3">{loading}</p>}>
        <WithChain>{children}</WithChain>
      </Suspense>
    </QueryClientProvider>
  );
}

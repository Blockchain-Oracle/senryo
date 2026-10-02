"use client";

/**
 * Watch mode honours the link's network (flow book G2: `/watch/?address=…&chainId=…`): a profile shared from Mainnet
 * opens with Mainnet's reads even though the web runs Practice. The query layer gets a second environment for that
 * chain — its own read client and engine socket over the same API and indexer (both are keyed by chainId) — so every
 * figure below is that network's. Nothing under it signs.
 */
import { createReadClient } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { createIndexerClient, graphqlEndpoint } from "@senryo/indexer-client";
import { QueryEnvProvider } from "@senryo/query";
import { type ReactNode, useMemo } from "react";
import { api } from "@/lib/account/api";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { ENV } from "@/lib/env";

export function NetworkScope({ chainId, children }: { chainId: ChainId; children: ReactNode }) {
  const other = chainId !== ACTIVE_NETWORK.chainId;
  const read = useMemo(() => (other ? createReadClient(chainId) : undefined), [chainId, other]);
  const indexer = useMemo(() => createIndexerClient({ url: graphqlEndpoint(ENV.INDEXER_ORIGIN) }), []);
  if (!other || !read) return <>{children}</>;
  return (
    <QueryEnvProvider chainId={chainId} read={read} api={api()} indexer={indexer} apiOrigin={ENV.API_ORIGIN}>
      {children}
    </QueryEnvProvider>
  );
}

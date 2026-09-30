/**
 * The query layer's clients for the app (S8.8): the active network, the shared viem read client, our API client, the
 * Envio indexer and the engine socket (`@senryo/query`). Mounted once under the QueryClientProvider.
 */
import { createIndexerClient, graphqlEndpoint } from "@senryo/indexer-client";
import { QueryEnvProvider } from "@senryo/query";
import { type ReactNode, useState } from "react";
import { api } from "~/lib/account/api";
import { sharedRead } from "~/lib/account/sender";
import { ACTIVE_NETWORK } from "~/lib/constants/auth";
import { ENV } from "~/lib/env";

export function MarketDataProvider({ children }: { children: ReactNode }) {
  const [indexer] = useState(() => createIndexerClient({ url: graphqlEndpoint(ENV.INDEXER_ORIGIN) }));
  return (
    <QueryEnvProvider
      chainId={ACTIVE_NETWORK.chainId}
      read={sharedRead()}
      api={api()}
      indexer={indexer}
      apiOrigin={ENV.API_ORIGIN}
    >
      {children}
    </QueryEnvProvider>
  );
}

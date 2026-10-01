/**
 * The query layer's clients for the app (S8.8): the selected network (S8.22), the shared viem read client, our API client, the
 * Envio indexer and the engine socket (`@senryo/query`). Mounted once under the QueryClientProvider.
 */
import { createIndexerClient, graphqlEndpoint } from "@senryo/indexer-client";
import { QueryEnvProvider } from "@senryo/query";
import { type ReactNode, useState } from "react";
import { api } from "~/lib/account/api";
import { sharedRead } from "~/lib/account/sender";
import { ENV } from "~/lib/env";
import { useNetwork } from "~/lib/network";

export function MarketDataProvider({ children }: { children: ReactNode }) {
  const [indexer] = useState(() => createIndexerClient({ url: graphqlEndpoint(ENV.INDEXER_ORIGIN) }));
  // A network switch re-points every query (keys carry the chain), the socket and the price store (S8.22).
  const network = useNetwork();
  return (
    <QueryEnvProvider
      chainId={network.chainId}
      read={sharedRead(network.chainId)}
      api={api()}
      indexer={indexer}
      apiOrigin={ENV.API_ORIGIN}
    >
      {children}
    </QueryEnvProvider>
  );
}

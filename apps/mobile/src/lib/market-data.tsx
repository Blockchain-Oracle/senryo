/**
 * The query layer's clients for the app (S8.8): the selected network (S8.22), the shared viem read client, our API client, the
 * Envio indexer and the engine socket (`@senryo/query`). Mounted once under the QueryClientProvider.
 */
import { createIndexerClient, graphqlEndpoint } from "@senryo/indexer-client";
import { configureOperationScopeValidator, configureOperationStorage, QueryEnvProvider } from "@senryo/query";
import { type ReactNode, useState } from "react";
import { AppState } from "react-native";
import { api } from "~/lib/account/api";
import { useAccount } from "~/lib/account/provider";
import { sharedRead } from "~/lib/account/sender";
import { DEV_WORKSPACE } from "~/lib/dev/config";
import { ENV } from "~/lib/env";
import { activeNetwork, useNetwork } from "~/lib/network";
import { storage } from "~/lib/storage";

configureOperationStorage({
  get: (key) => storage.getString(key),
  set: (key, value) => storage.set(key, value),
  keys: () => storage.getAllKeys(),
});

export function MarketDataProvider({ children }: { children: ReactNode }) {
  const [indexer] = useState(() => createIndexerClient({ url: graphqlEndpoint(ENV.INDEXER_ORIGIN) }));
  // A network switch re-points every query (keys carry the chain), the socket and the price store (S8.22).
  const network = useNetwork();
  const account = useAccount();
  configureOperationScopeValidator((chainId, address) => {
    if (
      activeNetwork().chainId !== chainId ||
      account.hint?.address.toLowerCase() !== address.toLowerCase() ||
      AppState.currentState !== "active"
    )
      throw new Error("The account, network or app state changed. Review again.");
  });
  return (
    <QueryEnvProvider
      chainId={network.chainId}
      read={sharedRead(network.chainId)}
      api={api()}
      indexer={indexer}
      apiOrigin={ENV.API_ORIGIN}
      socketEnabled={!DEV_WORKSPACE}
    >
      {children}
    </QueryEnvProvider>
  );
}

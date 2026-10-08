/**
 * The app hands the query layer its clients once (`QueryEnvProvider`): the active network, our API client and — until
 * S3/S5 serve balances over the API stream — a viem read client for the wallet's own dollar balance. Hooks read them
 * from context, so screens never build clients themselves and a network switch is one provider value.
 *
 * D-272: the live price stream, the engine socket and the GraphQL indexer client are gone. One SSE per app arrives with
 * `packages/live` (S3/S5); positions and history come from the API (S4). The read client leaves with S5.
 */
import type { ApiClient } from "@senryo/api-client";
import type { ReadClient } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { createContext, type ReactNode, useContext, useMemo } from "react";

export interface QueryEnv {
  chainId: ChainId;
  read: ReadClient;
  api: ApiClient;
}

const Context = createContext<QueryEnv | undefined>(undefined);

export interface QueryEnvProviderProps {
  chainId: ChainId;
  read: ReadClient;
  api: ApiClient;
  children: ReactNode;
}

export function QueryEnvProvider({ chainId, read, api, children }: QueryEnvProviderProps) {
  const env = useMemo<QueryEnv>(() => ({ chainId, read, api }), [chainId, read, api]);
  return <Context.Provider value={env}>{children}</Context.Provider>;
}

export function useQueryEnv(): QueryEnv {
  const env = useContext(Context);
  if (!env) throw new Error("useQueryEnv outside QueryEnvProvider");
  return env;
}

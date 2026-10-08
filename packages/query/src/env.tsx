/**
 * The app hands the query layer its clients once (`QueryEnvProvider`): the active network and our API client. Hooks
 * read them from context, so screens never build clients themselves and a network switch is one provider value.
 * D-272/D-280: the apps make no RPC calls — balances, positions and history come from the api, live data from the one
 * `@senryo/live` stream.
 */
import type { ApiClient } from "@senryo/api-client";
import type { ChainId } from "@senryo/config";
import { createContext, type ReactNode, useContext, useMemo } from "react";

export interface QueryEnv {
  chainId: ChainId;
  api: ApiClient;
}

const Context = createContext<QueryEnv | undefined>(undefined);

export interface QueryEnvProviderProps {
  chainId: ChainId;
  api: ApiClient;
  children: ReactNode;
}

export function QueryEnvProvider({ chainId, api, children }: QueryEnvProviderProps) {
  const env = useMemo<QueryEnv>(() => ({ chainId, api }), [chainId, api]);
  return <Context.Provider value={env}>{children}</Context.Provider>;
}

export function useQueryEnv(): QueryEnv {
  const env = useContext(Context);
  if (!env) throw new Error("useQueryEnv outside QueryEnvProvider");
  return env;
}

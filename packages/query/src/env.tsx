/**
 * The app hands the query layer its clients once (`QueryEnvProvider`): the active network, a viem read client from
 * `@senryo/chain`, our API client, the Envio indexer client and the engine socket. Hooks read them from context, so
 * screens never build clients themselves and a network switch is one provider value.
 */
import type { ApiClient } from "@senryo/api-client";
import type { ReadClient } from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import type { Address } from "@senryo/core";
import type { CandleInterval, Candles, IndexerClient } from "@senryo/indexer-client";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useContext, useEffect, useMemo } from "react";
import { keys } from "./keys.ts";
import { PerplPriceStream } from "./perpl-stream.ts";
import { PriceStore } from "./price-store.ts";
import { EngineSocket } from "./socket.ts";

export interface MarketHistorySource {
  chainId: ChainId;
  label: string;
  load: (symbol: string, interval: CandleInterval, since: number, signal: AbortSignal) => Promise<Candles>;
}

export interface QueryEnv {
  chainId: ChainId;
  read: ReadClient;
  /** A Monad mainnet (143) client for mainnet-only data read in either mode (J11 spot tokens); see `mainnetReadOf`. */
  mainnetRead?: ReadClient | undefined;
  api: ApiClient;
  indexer: IndexerClient;
  marketHistory?: MarketHistorySource | undefined;
  prices: PriceStore;
  perplPrices: PerplPriceStream;
  socket: EngineSocket;
}

const Context = createContext<QueryEnv | undefined>(undefined);

export interface QueryEnvProviderProps {
  chainId: ChainId;
  read: ReadClient;
  /** The app's shared 143 client (`sharedRead(MAINNET_CHAIN_ID)`); without it the spot hooks make their own. */
  mainnetRead?: ReadClient | undefined;
  api: ApiClient;
  indexer: IndexerClient;
  marketHistory?: MarketHistorySource | undefined;
  /** API origin for the engine socket. */
  apiOrigin: string;
  /** Local fork workspaces use contract polling and must not subscribe a fixture account to production. */
  socketEnabled?: boolean;
  streamActive?: boolean;
  perplSnapshot?: (() => Promise<unknown>) | undefined;
  children: ReactNode;
}

export function QueryEnvProvider({
  chainId,
  read,
  mainnetRead,
  api,
  indexer,
  marketHistory,
  apiOrigin,
  socketEnabled = true,
  streamActive = true,
  perplSnapshot,
  children,
}: QueryEnvProviderProps) {
  const queryClient = useQueryClient();
  const env = useMemo<QueryEnv>(() => {
    const prices = new PriceStore();
    const socket = new EngineSocket({
      origin: apiOrigin,
      chainId,
      prices,
      onAccount: (address: Address) => void queryClient.invalidateQueries({ queryKey: keys.account(chainId, address) }),
    });
    return {
      chainId,
      read,
      mainnetRead,
      api,
      indexer,
      marketHistory,
      prices,
      socket,
      perplPrices: new PerplPriceStream(chainId, perplSnapshot),
    };
  }, [chainId, read, mainnetRead, api, indexer, marketHistory, apiOrigin, queryClient, perplSnapshot]);

  useEffect(() => {
    if (!socketEnabled) return;
    env.socket.start();
    return () => env.socket.stop();
  }, [env, socketEnabled]);

  useEffect(() => {
    env.perplPrices.setActive(streamActive);
    return () => env.perplPrices.setActive(false);
  }, [env, streamActive]);

  return <Context.Provider value={env}>{children}</Context.Provider>;
}

export function useQueryEnv(): QueryEnv {
  const env = useContext(Context);
  if (!env) throw new Error("useQueryEnv outside QueryEnvProvider");
  return env;
}

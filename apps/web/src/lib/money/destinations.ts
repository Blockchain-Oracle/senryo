"use client";

/**
 * Saved destinations (flow book B13; the phone's `destinations.ts`): a name, an address and the chain it receives on,
 * with the exchange's mark when the name says which (Coinbase, Binance, Kraken). Kept in this browser per network and
 * account until the server copy exists; a saved address is checked again on every use like a typed one.
 */
import { ids } from "@senryo/identity";
import { useCallback, useSyncExternalStore } from "react";
import { readJson, writeJson } from "@/lib/account/local";
import { MONEY_STORAGE } from "@/lib/constants/money";

export interface Destination {
  name: string;
  address: string;
  chainId: number;
}

type Book = Record<string, Destination[]>;

const EXCHANGES = ["coinbase", "binance", "kraken"] as const;
/** A destination's name is one short line. */
export const DESTINATION_NAME_MAX = 32;

/** The exchange mark a destination's name points at, or the chain's. */
export function destinationMark(d: Destination): string {
  const exchange = EXCHANGES.find((e) => d.name.toLowerCase().includes(e));
  return exchange ? ids.exchange(exchange) : ids.evmChain(d.chainId);
}

const listeners = new Set<() => void>();
let cache: string | undefined;
const readBook = (): Book =>
  readJson(MONEY_STORAGE.destinations, (v) => (v && typeof v === "object" ? (v as Book) : undefined)) ?? {};
const snapshot = () => {
  cache ??= JSON.stringify(readBook());
  return cache;
};

export function useDestinations(monadChainId: number, account: string | undefined) {
  const raw = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    snapshot,
    () => "{}",
  );
  const scope = `${monadChainId}:${account?.toLowerCase() ?? "guest"}`;
  const list = (JSON.parse(raw) as Book)[scope] ?? [];
  const same = (a: Destination, address: string, chainId: number) =>
    a.address.toLowerCase() === address.toLowerCase() && a.chainId === chainId;
  const write = useCallback(
    (next: Destination[]) => {
      const book = { ...readBook(), [scope]: next };
      writeJson(MONEY_STORAGE.destinations, book);
      cache = JSON.stringify(book);
      for (const l of listeners) l();
    },
    [scope],
  );
  return {
    list,
    find: (address: string, chainId: number) => list.find((d) => same(d, address, chainId)),
    save: (d: Destination) => write([d, ...list.filter((x) => !same(x, d.address, d.chainId))]),
    remove: (d: Destination) => write(list.filter((x) => !same(x, d.address, d.chainId))),
  };
}

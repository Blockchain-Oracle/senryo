/**
 * Saved destinations (B13): a name, an address and the chain it is on, with the exchange's mark when the name says
 * which (Coinbase, Binance, Kraken). Kept on this phone per network and account until the server copy (BD-5,
 * `GET/PUT /v1/destinations`) exists; a saved address is checked again on every use like a typed one.
 */
import { ids } from "@senryo/identity";
import { useMMKVString } from "react-native-mmkv";
import { STORAGE_KEYS, storage } from "~/lib/storage";

export interface Destination {
  name: string;
  address: string;
  /** The chain it receives on (the Monad network id for Monad). */
  chainId: number;
}

type Book = Record<string, Destination[]>;

const EXCHANGES = ["coinbase", "binance", "kraken"] as const;

/** The exchange mark a destination's name points at, or the chain's. */
export function destinationMark(d: Destination): string {
  const exchange = EXCHANGES.find((e) => d.name.toLowerCase().includes(e));
  return exchange ? ids.exchange(exchange) : ids.evmChain(d.chainId);
}

function parse(raw: string | undefined): Book {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" ? (value as Book) : {};
  } catch {
    return {};
  }
}

export function useDestinations(monadChainId: number, account: string | undefined) {
  const [raw, setRaw] = useMMKVString(STORAGE_KEYS.savedDestinations, storage);
  const scope = `${monadChainId}:${account?.toLowerCase() ?? "guest"}`;
  const book = parse(raw);
  const list = book[scope] ?? [];
  const write = (next: Destination[]) => setRaw(JSON.stringify({ ...book, [scope]: next }));
  const same = (a: Destination, address: string, chainId: number) =>
    a.address.toLowerCase() === address.toLowerCase() && a.chainId === chainId;
  return {
    list,
    find: (address: string, chainId: number) => list.find((d) => same(d, address, chainId)),
    save: (d: Destination) => write([d, ...list.filter((x) => !same(x, d.address, d.chainId))]),
    remove: (d: Destination) => write(list.filter((x) => !same(x, d.address, d.chainId))),
  };
}

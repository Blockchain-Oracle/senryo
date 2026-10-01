/**
 * What the Markets tab keeps on this phone (J3): starred markets and recent searches, per network, in one MMKV value
 * (`senryo.markets.v1`, JSON). Recent searches never leave the device; the starred markets also sync to the account
 * through the encrypted prefs (`WatchlistSync`, last writer wins), so they come back on a new device. A guest keeps
 * both here only. Reads are defensive: a value this build can't parse reads as empty, never as a crash.
 */
import { useMMKVString } from "react-native-mmkv";
import type { NetworkKey } from "~/lib/network";
import { STORAGE_KEYS, storage } from "~/lib/storage";

/** Something the user opened from Search: a market by symbol, or a trader by address (with the name shown then). */
export type RecentSearch =
  | { kind: "market"; symbol: string }
  | { kind: "trader"; address: string; handle: string | null; displayName: string | null };

interface NetworkSlice {
  watchlist: string[];
  recents: RecentSearch[];
}

export type MarketsDevice = Partial<Record<NetworkKey, NetworkSlice>>;

const EMPTY_SLICE: NetworkSlice = { watchlist: [], recents: [] };
const NETWORKS: readonly NetworkKey[] = ["testnet", "mainnet"];

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

function recentOf(value: unknown): RecentSearch | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const v = value as Record<string, unknown>;
  if (v.kind === "market" && typeof v.symbol === "string") return { kind: "market", symbol: v.symbol };
  if (v.kind === "trader" && typeof v.address === "string") {
    return { kind: "trader", address: v.address, handle: text(v.handle), displayName: text(v.displayName) };
  }
  return undefined;
}

function sliceOf(value: unknown): NetworkSlice {
  if (typeof value !== "object" || value === null) return EMPTY_SLICE;
  const v = value as Record<string, unknown>;
  return {
    watchlist: Array.isArray(v.watchlist) ? v.watchlist.filter((s): s is string => typeof s === "string") : [],
    recents: Array.isArray(v.recents) ? v.recents.flatMap((r) => recentOf(r) ?? []) : [],
  };
}

function parse(raw: string | undefined): MarketsDevice {
  if (!raw) return {};
  try {
    const value = JSON.parse(raw) as Record<string, unknown> | null;
    if (typeof value !== "object" || value === null) return {};
    return Object.fromEntries(NETWORKS.map((key) => [key, sliceOf(value[key])]));
  } catch {
    return {};
  }
}

/** One network's slice, re-rendering when it changes. */
export function useMarketsDevice(network: NetworkKey): NetworkSlice {
  const [raw] = useMMKVString(STORAGE_KEYS.markets, storage);
  return parse(raw)[network] ?? EMPTY_SLICE;
}

/** Applies a change to one network's slice. Reads the stored value first, so two writers never overwrite each other. */
export function updateMarketsDevice(network: NetworkKey, change: (slice: NetworkSlice) => NetworkSlice): void {
  const all = parse(storage.getString(STORAGE_KEYS.markets));
  storage.set(STORAGE_KEYS.markets, JSON.stringify({ ...all, [network]: change(all[network] ?? EMPTY_SLICE) }));
}

/** Both networks' starred markets and when they last changed here (0 = never), for the account sync. */
export function localWatchlist(): { at: number; lists: Record<NetworkKey, string[]> } {
  const all = parse(storage.getString(STORAGE_KEYS.markets));
  return {
    at: storage.getNumber(STORAGE_KEYS.watchlistAt) ?? 0,
    lists: Object.fromEntries(NETWORKS.map((key) => [key, all[key]?.watchlist ?? []])) as Record<NetworkKey, string[]>,
  };
}

/** Records a watchlist change made on this phone (the sync pushes it while the session is live). */
export function touchWatchlist(at: number = Date.now()): void {
  storage.set(STORAGE_KEYS.watchlistAt, at);
}

/** Adopts a newer synced watchlist (lists and its time); recents stay this phone's own. */
export function adoptWatchlist(synced: { at: number; lists: Partial<Record<NetworkKey, string[]>> }): void {
  const all = parse(storage.getString(STORAGE_KEYS.markets));
  const next = Object.fromEntries(
    NETWORKS.map((key) => [key, { ...(all[key] ?? EMPTY_SLICE), watchlist: synced.lists[key] ?? [] }]),
  );
  storage.set(STORAGE_KEYS.markets, JSON.stringify(next));
  touchWatchlist(synced.at);
}

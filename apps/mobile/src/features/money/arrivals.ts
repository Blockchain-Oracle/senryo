/**
 * "Arriving" (B5/B4/B16): money this phone started bringing in that hasn't landed yet — a Ramp purchase the user came
 * back from, a bridge into Monad. Each record keeps the wallet balance of the asset when it started; once the balance
 * is above it (or a day has passed) the record clears. Per network and account, on this phone.
 */
import { useMMKVString } from "react-native-mmkv";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import type { MoneyAsset } from "./assets";

const DAY_MS = 86_400_000;

export interface Arrival {
  id: string;
  kind: "ramp" | "bridge";
  chainId: number;
  account: string;
  /** Lower-case token address on Monad. */
  asset: string;
  symbol: string;
  /** Raw wallet balance when it started. */
  baseline: string;
  /** Expected raw amount, when known (a bridge quote). */
  amount?: string | undefined;
  /** "Ramp", "Base". */
  via: string;
  at: number;
}

function parse(raw: string | undefined): Arrival[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? (value as Arrival[]) : [];
  } catch {
    return [];
  }
}

export function recordArrival(arrival: Omit<Arrival, "id" | "at">): void {
  const list = parse(storage.getString(STORAGE_KEYS.arrivals));
  const at = Date.now();
  list.push({ ...arrival, id: `${arrival.kind}:${at}`, at });
  storage.set(STORAGE_KEYS.arrivals, JSON.stringify(list));
}

/** This account's open arrivals; any whose asset balance rose above its baseline (or that is a day old) is dropped. */
export function useArrivals(chainId: number, account: string | undefined, assets: readonly MoneyAsset[] | undefined) {
  const [raw, setRaw] = useMMKVString(STORAGE_KEYS.arrivals, storage);
  const all = parse(raw);
  const now = Date.now();
  const landed = (a: Arrival) => {
    if (now - a.at > DAY_MS) return true;
    const held = assets?.find((x) => x.key === a.asset);
    return held !== undefined && held.wallet > BigInt(a.baseline);
  };
  const mine = all.filter((a) => a.chainId === chainId && a.account === account?.toLowerCase());
  const open = mine.filter((a) => !landed(a));
  if (assets && open.length !== mine.length) {
    // Settle on read: landed records leave the store (their asset shows in Assets now).
    queueMicrotask(() => setRaw(JSON.stringify(all.filter((a) => !mine.includes(a) || open.includes(a)))));
  }
  return open;
}

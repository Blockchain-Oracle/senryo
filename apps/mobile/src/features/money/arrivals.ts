/**
 * "Arriving" (B5/B4/B16): money this phone started bringing in that hasn't landed yet — a Ramp purchase the user came
 * back from, a bridge into Monad. Each record keeps the wallet balance of the asset when it started; once the balance
 * is above it (or a day has passed) the record clears. Per network and account, on this phone. The record and its rule
 * live in `@senryo/query` (`arrivals.ts`), shared with the web; this module keeps them in MMKV.
 */
import { type Arrival, arrivalOf, openArrivals, parseArrivals } from "@senryo/query";
import { useMMKVString } from "react-native-mmkv";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import type { MoneyAsset } from "./assets";

export type { Arrival };

export function recordArrival(arrival: Omit<Arrival, "id" | "at">): void {
  const list = parseArrivals(storage.getString(STORAGE_KEYS.arrivals));
  list.push(arrivalOf(arrival, Date.now()));
  storage.set(STORAGE_KEYS.arrivals, JSON.stringify(list));
}

/** This account's open arrivals; any whose asset balance rose above its baseline (or that is a day old) is dropped. */
export function useArrivals(chainId: number, account: string | undefined, assets: readonly MoneyAsset[] | undefined) {
  const [raw, setRaw] = useMMKVString(STORAGE_KEYS.arrivals, storage);
  const { open, settled } = openArrivals(parseArrivals(raw), chainId, account, assets, Date.now());
  // Settle on read: landed records leave the store (their asset shows in Assets now).
  if (settled) queueMicrotask(() => setRaw(JSON.stringify(settled)));
  return open;
}

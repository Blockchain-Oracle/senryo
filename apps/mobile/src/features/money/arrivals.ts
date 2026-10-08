/**
 * "Arriving" (B5/B4/B16): money this phone started bringing in that hasn't landed yet — a Ramp purchase the user came
 * back from, a bridge into Monad. Each record keeps the wallet balance of the asset when it started; provider results
 * settle delivery; overdue operations remain unresolved. Per network and account, on this phone. The record and its rule
 * live in `@senryo/query` (`arrivals.ts`), shared with the web; this module keeps them in MMKV.
 */
import { type Arrival, arrivalOf, openArrivals, parseArrivals } from "@senryo/query";
import { useMMKVString } from "react-native-mmkv";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import type { MoneyAsset } from "./assets";

export type { Arrival };

export function recordArrival(arrival: Omit<Arrival, "id" | "at">): void {
  const list = parseArrivals(storage.getString(STORAGE_KEYS.arrivals));
  const next = arrivalOf(arrival, Date.now());
  const previous = list.findIndex((a) => a.id === next.id);
  if (previous >= 0) list[previous] = { ...list[previous], ...next };
  else list.push(next);
  storage.set(STORAGE_KEYS.arrivals, JSON.stringify(list));
}

/** This account's open provider operations. Balance changes cannot settle them. */
export function useArrivals(chainId: number, account: string | undefined, assets: readonly MoneyAsset[] | undefined) {
  const [raw, setRaw] = useMMKVString(STORAGE_KEYS.arrivals, storage);
  const { open, settled } = openArrivals(parseArrivals(raw), chainId, account, assets, Date.now());
  // Settle on read: landed records leave the store (their asset shows in Assets now).
  if (settled)
    queueMicrotask(() => {
      const current = openArrivals(
        parseArrivals(storage.getString(STORAGE_KEYS.arrivals)),
        chainId,
        account,
        assets,
        Date.now(),
      );
      if (current.settled) setRaw(JSON.stringify(current.settled));
    });
  return open;
}

/** Provider evidence updates a persisted operation; absence/fetch errors never erase it. */
export function updateArrival(
  providerOperationId: string,
  chainId: number,
  account: string,
  patch: Pick<Arrival, "status" | "providerStatus" | "deliveryTransaction">,
) {
  const list = parseArrivals(storage.getString(STORAGE_KEYS.arrivals));
  let changed = false;
  const next = list.map((a) => {
    if (a.providerOperationId !== providerOperationId || a.chainId !== chainId || a.account !== account.toLowerCase())
      return a;
    if (Object.entries(patch).every(([key, value]) => a[key as keyof Arrival] === value)) return a;
    changed = true;
    return { ...a, ...patch };
  });
  if (changed) storage.set(STORAGE_KEYS.arrivals, JSON.stringify(next));
}

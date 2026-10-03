"use client";

/**
 * "Arriving" (flow book B4, B16; the phone's `arrivals.ts`): money this browser started bringing in that hasn't
 * landed yet — a bridge into Monad through a deposit address. Each record keeps the asset's wallet balance when it
 * started; once the balance is above it (or a day has passed) the record clears. Per network and account. The record
 * and its rule are `@senryo/query`'s (`arrivals.ts`), shared with the phone.
 */
import { type Arrival, arrivalOf, openArrivals, parseArrivals } from "@senryo/query";
import { useEffect } from "react";
import { readLocalString, useLocalString, writeLocalString } from "@/lib/account/local-string";
import { MONEY_STORAGE } from "@/lib/constants/money";
import type { MoneyAsset } from "./assets";

export type { Arrival };

export function recordArrival(arrival: Omit<Arrival, "id" | "at">): void {
  const list = parseArrivals(readLocalString(MONEY_STORAGE.arrivals));
  writeLocalString(MONEY_STORAGE.arrivals, JSON.stringify([...list, arrivalOf(arrival, Date.now())]));
}

/** This account's open arrivals; any whose asset balance rose above its baseline (or that is a day old) is dropped. */
export function useArrivals(
  chainId: number,
  account: string | undefined,
  assets: readonly MoneyAsset[] | undefined,
): Arrival[] {
  const raw = useLocalString(MONEY_STORAGE.arrivals);
  const { open, settled } = openArrivals(parseArrivals(raw), chainId, account, assets, Date.now());
  const next = settled ? JSON.stringify(settled) : undefined;
  // Settle after render: landed records leave the store (their asset shows in Assets now).
  useEffect(() => {
    if (next !== undefined) writeLocalString(MONEY_STORAGE.arrivals, next);
  }, [next]);
  return open;
}

"use client";

/**
 * Which version of the terms each account acknowledged in this browser (flow book A11; the phone's `acknowledged.ts`).
 * Before an account's first money action — trade, add money, send, withdraw — the terms must be agreed; the screens
 * read `useTermsAccepted` and send the person to setup's terms step when they aren't.
 */
import type { Address } from "@senryo/account";
import { LEGAL_VERSION } from "@senryo/config";
import { useSyncExternalStore } from "react";
import { readJson, writeJson } from "./local";

const KEY = "senryo.terms-accepted.v1";
type Stored = Record<string, string>;

const listeners = new Set<() => void>();
const read = (): Stored => readJson(KEY, (v) => (v && typeof v === "object" ? (v as Stored) : undefined)) ?? {};

export function hasAcknowledgedTerms(address: Address | undefined): boolean {
  return address !== undefined && read()[address.toLowerCase()] === LEGAL_VERSION;
}

export function acknowledgeTerms(address: Address): void {
  writeJson(KEY, { ...read(), [address.toLowerCase()]: LEGAL_VERSION });
  for (const l of listeners) l();
}

/** True once this account agreed to the current terms here; false before (and during the static prerender). */
export function useTermsAccepted(address: Address | undefined): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => hasAcknowledgedTerms(address),
    () => false,
  );
}

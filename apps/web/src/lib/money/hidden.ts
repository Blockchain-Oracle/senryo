"use client";

/**
 * Hidden tokens (B14), as on the phone: the token addresses an account chose to hide on a network, kept in this browser
 * per account and network. A hidden token leaves Other tokens and sits under "Hidden (n)", where it can be shown again.
 */
import { useCallback, useSyncExternalStore } from "react";
import { readJson, writeJson } from "@/lib/account/local";
import { MONEY_STORAGE } from "@/lib/constants/money";

type HiddenBook = Record<string, string[]>;

const listeners = new Set<() => void>();
let cache: string | undefined;

function readBook(): HiddenBook {
  return (
    readJson(MONEY_STORAGE.hiddenTokens, (v) => (v && typeof v === "object" ? (v as HiddenBook) : undefined)) ?? {}
  );
}

function snapshot(): string {
  cache ??= JSON.stringify(readBook());
  return cache;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHiddenTokens(chainId: number, account: string | undefined) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "{}");
  const scope = `${chainId}:${account?.toLowerCase() ?? "guest"}`;
  const book = JSON.parse(raw) as HiddenBook;
  const list = new Set(book[scope] ?? []);
  const write = useCallback(
    (next: Set<string>) => {
      const updated = { ...readBook(), [scope]: [...next] };
      writeJson(MONEY_STORAGE.hiddenTokens, updated);
      cache = JSON.stringify(updated);
      for (const l of listeners) l();
    },
    [scope],
  );
  return {
    has: (address: string) => list.has(address.toLowerCase()),
    hide: (address: string) => write(new Set([...list, address.toLowerCase()])),
    show: (address: string) => write(new Set([...list].filter((a) => a !== address.toLowerCase()))),
  };
}

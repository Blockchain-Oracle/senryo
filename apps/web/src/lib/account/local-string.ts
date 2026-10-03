"use client";

/**
 * A raw localStorage string per key that React re-reads when this tab writes it (and when another tab does, through
 * the `storage` event) — the web's twin of the phone's `useMMKVString` for non-secret conveniences. Missing or
 * unreadable storage reads as undefined (privacy modes, stateless test).
 */
import { useSyncExternalStore } from "react";
import { kvStore } from "./local";

const listeners = new Map<string, Set<() => void>>();

function notify(key: string): void {
  for (const listener of listeners.get(key) ?? []) listener();
}

function subscribe(key: string, listener: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === key) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function readLocalString(key: string): string | undefined {
  return kvStore.getItem(key) ?? undefined;
}

export function writeLocalString(key: string, value: string): void {
  kvStore.setItem(key, value);
  notify(key);
}

export function useLocalString(key: string): string | undefined {
  return useSyncExternalStore(
    (listener) => subscribe(key, listener),
    () => readLocalString(key),
    () => undefined,
  );
}

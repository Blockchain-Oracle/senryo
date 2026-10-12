/**
 * A value that changes per tick without rendering React (D-272): the quote pass writes it, `LiveText` (and anything
 * else that subscribes) paints it straight into the DOM.
 */
import { useSyncExternalStore } from "react";

export interface LiveValue<T> {
  get(): T;
  set(next: T): void;
  subscribe(listener: (value: T) => void): () => void;
}

export function liveValue<T>(initial: T): LiveValue<T> {
  let value = initial;
  const listeners = new Set<(value: T) => void>();
  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const l of listeners) l(value);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * A live value as React state, for the few places that must render on it (the CLOSE button's rolling amount, TRAIL's
 * state): they re-render on each change, at most once per tick.
 */
export function useLiveValue<T>(value: LiveValue<T>): T {
  return useSyncExternalStore(value.subscribe, value.get, value.get);
}

/**
 * A value that changes per tick without rendering React (D-272): the quote pass writes it, `LiveText` (and anything
 * else that subscribes) paints it straight into the DOM.
 */
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

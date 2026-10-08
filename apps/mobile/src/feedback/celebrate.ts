/**
 * The win burst's trigger: whoever learns of a win (a call paid, a cash-out in profit) calls `celebrate()`, and the
 * one confetti host over the app plays it — wherever the user is.
 */
const listeners = new Set<() => void>();

export function celebrate(): void {
  for (const listener of listeners) listener();
}

export function onCelebrate(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

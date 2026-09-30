/**
 * One ordered queue per address (spec client.md): sign → send → nonce bump happens one at a time for a key, so two
 * writes never race for a nonce. `packages/chain` runs each send through `enqueue(address, …)`; a failure never
 * blocks the tasks behind it.
 */
import type { Address } from "viem";

const tails = new Map<string, Promise<unknown>>();

export function enqueue<T>(address: Address, task: () => Promise<T>): Promise<T> {
  const key = address.toLowerCase();
  const previous = tails.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);
  const tail = run.then(
    () => undefined,
    () => undefined,
  );
  tails.set(key, tail);
  void tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
}

/** Tasks still queued or running for `address` (the UI disables a second submit while > 0). */
export function isBusy(address: Address): boolean {
  return tails.has(address.toLowerCase());
}

/** The shape of `@senryo/chain`'s `NonceSource` (structural — this package never imports chain). */
export interface NonceSourceLike {
  withNext<T>(address: Address, fn: (nonce: number) => Promise<T>): Promise<T>;
  resync(address: Address): void;
}

/**
 * The `@senryo/chain` seam (S3 Handoff): wrap its `LocalNonceSource` so every assign → sign for an address runs through
 * this package's one ordered queue — the same queue any other per-address signing work uses. A policy refusal inside
 * `fn` rejects before the inner source counts the nonce, so a step-up retry reuses it.
 */
export function queuedNonces(inner: NonceSourceLike): NonceSourceLike {
  return {
    withNext: (address, fn) => enqueue(address, () => inner.withNext(address, fn)),
    resync: (address) => inner.resync(address),
  };
}

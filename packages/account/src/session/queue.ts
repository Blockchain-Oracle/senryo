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

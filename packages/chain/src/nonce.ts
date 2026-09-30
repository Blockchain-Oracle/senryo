import type { Address } from "viem";
import type { ReadClient } from "./clients.ts";

/**
 * Local nonces per sender. Monad has no public mempool (`eth_getTransactionCount` reflects the proposed state), so a
 * sender that fires several txs quickly must count locally. Assignment is serialised per address (one promise chain),
 * which also orders signing; broadcasts may overlap. After a definitive rejection the caller `resync`s.
 */
export interface NonceSource {
  /** Runs `fn` with the next nonce, holding the per-address lock only while `fn` runs (assign + sign). */
  withNext<T>(address: Address, fn: (nonce: number) => Promise<T>): Promise<T>;
  /** Forget the local counter (next use re-reads the chain). */
  resync(address: Address): void;
}

export class LocalNonceSource implements NonceSource {
  private readonly next = new Map<string, number>();
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(private readonly read: ReadClient) {}

  async withNext<T>(address: Address, fn: (nonce: number) => Promise<T>): Promise<T> {
    const key = address.toLowerCase();
    const previous = this.locks.get(key) ?? Promise.resolve();
    const run = previous
      .catch(() => undefined)
      .then(async () => {
        let nonce = this.next.get(key);
        if (nonce === undefined) nonce = await this.read.getTransactionCount({ address, blockTag: "latest" });
        const result = await fn(nonce);
        this.next.set(key, nonce + 1);
        return result;
      });
    this.locks.set(key, run);
    try {
      return await run;
    } finally {
      if (this.locks.get(key) === run) this.locks.delete(key);
    }
  }

  resync(address: Address): void {
    this.next.delete(address.toLowerCase());
  }

  /** Seed from durable storage (services persist `operator_nonces`). */
  seed(address: Address, nonce: number): void {
    this.next.set(address.toLowerCase(), nonce);
  }
}

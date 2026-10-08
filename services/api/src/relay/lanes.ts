import {
  createSender,
  FeeCache,
  type HeadTracker,
  LocalNonceSource,
  type ReadClient,
  type Sender,
  type Signer,
} from "@senryo/chain";
import type { ChainId } from "@senryo/config";
import { type Db, pgJournal } from "@senryo/service-common";

/**
 * The relay's sponsor lanes (D-266, D-272): one journaled sender per sponsor key, each running its work strictly in
 * order so nonces never race. A caller's calls always use the same lane (by address), so their order is kept.
 */
export class Lane {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(readonly sender: Sender) {}

  run<T>(work: (sender: Sender) => Promise<T>): Promise<T> {
    const next = this.tail.then(() => work(this.sender));
    this.tail = next.catch(() => undefined);
    return next;
  }
}

export function openLanes(chainId: ChainId, read: ReadClient, heads: HeadTracker, db: Db, signers: Signer[]): Lane[] {
  const fees = new FeeCache(read);
  fees.start();
  return signers.map(
    (account) =>
      new Lane(
        createSender({
          chainId,
          account,
          read,
          heads,
          fees,
          nonces: new LocalNonceSource(read),
          journal: pgJournal(db, `relay:${chainId}:${account.address.toLowerCase()}`),
        }),
      ),
  );
}

const ADDRESS_TAIL_HEX = 8;

/** The lane for an address (stable, spread evenly). */
export function laneIndex(address: string, lanes: number): number {
  return Number.parseInt(address.slice(-ADDRESS_TAIL_HEX), 16) % lanes;
}

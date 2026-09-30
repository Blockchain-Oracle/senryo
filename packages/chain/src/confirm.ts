import type { TxStage } from "@senryo/core";
import type { Hex, TransactionReceipt } from "viem";
import type { ReadClient } from "./clients.ts";
import { FINALIZE_TIMEOUT_MS, POLL_INTERVAL_MS } from "./constants.ts";
import type { CommitLevel, HeadTracker } from "./heads.ts";

/**
 * Economic confirmation reads the "finalized" commit state (invariant `finalized-for-money`): `latest` on Monad is a
 * speculative proposal and can be abandoned. A receipt counts once its block is at or below the finalized head AND
 * its block hash is the canonical block at that height; otherwise the receipt is re-fetched (it may have landed in
 * a different block) or the tx is `abandoned` — never resent automatically.
 */

export interface ConfirmOptions {
  read: ReadClient;
  heads?: HeadTracker | undefined;
  timeoutMs?: number | undefined;
}

export type Confirmation =
  | { stage: Extract<TxStage, "voted" | "finalized" | "reverted">; receipt: TransactionReceipt }
  | { stage: "abandoned"; receipt: undefined };

const FINALIZED_TAG = "finalized";
const SAFE_TAG = "safe";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function headAt(read: ReadClient, level: Exclude<CommitLevel, "proposed">): Promise<bigint> {
  const block = await read.getBlock({ blockTag: level === "finalized" ? FINALIZED_TAG : SAFE_TAG });
  return block.number;
}

/** Waits until the `level` head reaches `blockNumber`; false on timeout. */
async function reach(
  opts: ConfirmOptions,
  level: Exclude<CommitLevel, "proposed">,
  blockNumber: bigint,
  deadline: number,
): Promise<boolean> {
  if (opts.heads) {
    const timeout = sleep(Math.max(deadline - Date.now(), 0)).then(() => false);
    return Promise.race([opts.heads.waitFor(level, blockNumber).then(() => true), timeout]);
  }
  while (Date.now() < deadline) {
    const head = await headAt(opts.read, level).catch(() => -1n);
    if (head >= blockNumber) return true;
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

async function canonicalHash(opts: ConfirmOptions, blockNumber: bigint): Promise<Hex | undefined> {
  const known = opts.heads?.finalizedHash(blockNumber);
  if (known) return known;
  const block = await opts.read.getBlock({ blockNumber }).catch(() => undefined);
  return block?.hash ?? undefined;
}

/**
 * Wait for `receipt` to reach `level` ("finalized" for anything that moves money; "voted" for optimistic UI).
 * Returns the (possibly re-fetched) receipt with its final stage.
 */
export async function waitForCommit(
  opts: ConfirmOptions,
  receipt: TransactionReceipt,
  level: Exclude<CommitLevel, "proposed"> = FINALIZED_TAG,
): Promise<Confirmation> {
  const deadline = Date.now() + (opts.timeoutMs ?? FINALIZE_TIMEOUT_MS);
  let current: TransactionReceipt | null = receipt;
  while (current && Date.now() < deadline) {
    if (!(await reach(opts, level, current.blockNumber, deadline))) break;
    const hash = level === FINALIZED_TAG ? await canonicalHash(opts, current.blockNumber) : current.blockHash;
    if (hash === current.blockHash) {
      if (current.status === "reverted") return { stage: "reverted", receipt: current };
      return { stage: level, receipt: current };
    }
    // The proposal carrying the receipt was superseded: look the tx up again.
    current = await opts.read.getTransactionReceipt({ hash: current.transactionHash }).catch(() => null);
  }
  if (current === null) return { stage: "abandoned", receipt: undefined };
  throw new FinalityTimeoutError(receipt.transactionHash, level);
}

/** Shorthand used by every money path: wait for "finalized". */
export function confirmFinalized(opts: ConfirmOptions, receipt: TransactionReceipt): Promise<Confirmation> {
  return waitForCommit(opts, receipt, FINALIZED_TAG);
}

/** The commit feed stalled past the timeout: the outcome is unknown (reconcile later; never resend). */
export class FinalityTimeoutError extends Error {
  constructor(
    readonly hash: Hex,
    readonly level: string,
  ) {
    super(`tx ${hash} did not reach ${level} in time`);
    this.name = "FinalityTimeoutError";
  }
}

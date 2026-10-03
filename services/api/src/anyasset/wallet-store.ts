/**
 * `wallet_transfers` / `wallet_scans` (migration 0013) behind the HyperSync scan (D8): a page's movements are stored
 * with the cursors after it in one transaction, so a cursor never runs ahead of the rows it covers, and a movement seen
 * twice (from both sides, or by a re-read after a crash) is stored once. Reads give one address's movements a
 * transaction at a time, newest first, keyset-paged by (block, transaction index).
 */
import { type ChainId, NATIVE_TOKEN } from "@senryo/config";
import type { Db } from "@senryo/service-common";
import { WALLET_INSERT_CHUNK } from "./constants.ts";
import type { Cursors, MovementStore } from "./hypersync.ts";
import type { Movement } from "./hypersync-pages.ts";

/** A transaction's place in the chain: the wallet page cursor (exclusive). */
export interface TxPosition {
  blockNumber: bigint;
  txIndex: number;
}

export interface StoredMovement {
  txHash: string;
  logIndex: number;
  traceAddress: string;
  blockNumber: bigint;
  txIndex: number;
  timestamp: number;
  token: string;
  from: string;
  to: string;
  txFrom: string | null;
  value: bigint;
}

interface Row {
  tx_hash: string;
  log_index: number;
  trace_address: string;
  block_number: bigint;
  tx_index: number;
  block_timestamp: bigint;
  token: string;
  from_address: string;
  to_address: string;
  tx_from: string | null;
  value: string;
}

export class WalletTransferStore implements MovementStore {
  constructor(private readonly db: Db) {}

  async load(chainId: ChainId, address: string): Promise<(Cursors & { tokens: string[] }) | undefined> {
    const owner = address.toLowerCase();
    const [scan] = await this.db<{ next_block: bigint; trace_next_block: bigint }[]>`
      SELECT next_block, trace_next_block FROM wallet_scans WHERE chain_id = ${chainId} AND address = ${owner}`;
    if (!scan) return undefined;
    const tokens = await this.db<{ token: string }[]>`
      SELECT token FROM wallet_transfers WHERE chain_id = ${chainId} AND from_address = ${owner} AND token <> ${NATIVE_TOKEN}
      UNION
      SELECT token FROM wallet_transfers WHERE chain_id = ${chainId} AND to_address = ${owner} AND token <> ${NATIVE_TOKEN}`;
    return {
      nextBlock: Number(scan.next_block),
      traceNextBlock: Number(scan.trace_next_block),
      tokens: tokens.map((t) => t.token),
    };
  }

  async save(chainId: ChainId, address: string, movements: readonly Movement[], cursors: Cursors): Promise<void> {
    const rows = movements.map((m) => ({
      chain_id: chainId,
      tx_hash: m.txHash,
      log_index: m.logIndex,
      trace_address: m.traceAddress,
      block_number: m.blockNumber,
      tx_index: m.txIndex,
      block_timestamp: m.timestamp,
      token: m.token,
      from_address: m.from,
      to_address: m.to,
      tx_from: m.txFrom,
      value: m.value.toString(),
    }));
    await this.db.begin(async (tx) => {
      for (let i = 0; i < rows.length; i += WALLET_INSERT_CHUNK) {
        await tx`INSERT INTO wallet_transfers ${tx(rows.slice(i, i + WALLET_INSERT_CHUNK))} ON CONFLICT DO NOTHING`;
      }
      await tx`
        INSERT INTO wallet_scans (chain_id, address, next_block, trace_next_block)
        VALUES (${chainId}, ${address.toLowerCase()}, ${cursors.nextBlock}, ${cursors.traceNextBlock})
        ON CONFLICT (chain_id, address) DO UPDATE SET
          next_block = GREATEST(wallet_scans.next_block, EXCLUDED.next_block),
          trace_next_block = GREATEST(wallet_scans.trace_next_block, EXCLUDED.trace_next_block),
          updated_at = now()`;
    });
  }

  /**
   * Every stored movement of `address` in its `limit` newest transactions before `before`, newest first, and whether
   * the page is full (older transactions may follow). Each side is read through its own index, newest first.
   */
  async page(
    chainId: ChainId,
    address: string,
    before: TxPosition | undefined,
    limit: number,
  ): Promise<{ movements: StoredMovement[]; full: boolean; last: TxPosition | undefined }> {
    const owner = address.toLowerCase();
    const older = (sql: Db) =>
      before
        ? sql`AND (block_number, tx_index) < (${before.blockNumber.toString()}::bigint, ${before.txIndex})`
        : sql``;
    const txs = await this.db<{ tx_hash: string; block_number: bigint; tx_index: number }[]>`
      SELECT tx_hash, block_number, tx_index FROM (
        (SELECT tx_hash, block_number, tx_index FROM wallet_transfers
          WHERE chain_id = ${chainId} AND from_address = ${owner} ${older(this.db)}
          GROUP BY block_number, tx_index, tx_hash ORDER BY block_number DESC, tx_index DESC LIMIT ${limit})
        UNION
        (SELECT tx_hash, block_number, tx_index FROM wallet_transfers
          WHERE chain_id = ${chainId} AND to_address = ${owner} ${older(this.db)}
          GROUP BY block_number, tx_index, tx_hash ORDER BY block_number DESC, tx_index DESC LIMIT ${limit})
      ) AS sides
      ORDER BY block_number DESC, tx_index DESC LIMIT ${limit}`;
    const tail = txs.at(-1);
    if (txs.length === 0) return { movements: [], full: false, last: undefined };
    const rows = await this.db<Row[]>`
      SELECT tx_hash, log_index, trace_address, block_number, tx_index, block_timestamp, token, from_address,
             to_address, tx_from, value::text AS value
        FROM wallet_transfers
       WHERE chain_id = ${chainId} AND tx_hash IN ${this.db(txs.map((t) => t.tx_hash))}
         AND (from_address = ${owner} OR to_address = ${owner})
       ORDER BY block_number DESC, tx_index DESC, log_index, trace_address`;
    return {
      movements: rows.map(movementOf),
      full: txs.length === limit,
      last: tail ? { blockNumber: tail.block_number, txIndex: tail.tx_index } : undefined,
    };
  }
}

function movementOf(row: Row): StoredMovement {
  return {
    txHash: row.tx_hash,
    logIndex: row.log_index,
    traceAddress: row.trace_address,
    blockNumber: row.block_number,
    txIndex: row.tx_index,
    timestamp: Number(row.block_timestamp),
    token: row.token,
    from: row.from_address,
    to: row.to_address,
    txFrom: row.tx_from,
    value: BigInt(row.value),
  };
}

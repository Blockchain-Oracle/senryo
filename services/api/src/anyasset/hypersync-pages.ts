/**
 * The two HyperSync queries behind an address's scan (B1 holdings discovery, D8 wallet activity) and their parsing into
 * movements (JSON API, docs.envio.dev/docs/HyperSync/hypersync-query, read through Context7 on 3 Oct):
 *  - transfers (every network): ERC-20 `Transfer` logs with the address in topic1 or topic2, WMON wraps and unwraps,
 *    and the address's own transactions (from or to it) for their MON value. Default join: each log brings its
 *    transaction (who sent it) and every row its block (when);
 *  - internal MON (networks with a traces host): calls into the address that carry value. Join-all brings each
 *    transaction's status and its whole call tree, so a payout inside a reverted call — or a failed transaction — is
 *    never read as money received. `trace_address` arrives as hex: a u64 count, then the path, little-endian.
 * Only blocks below `archive_height − HYPERSYNC_FINALITY_BLOCKS` are kept; the cursor stops there and the next scan
 * reads the rest, so a reorg never leaves a stored movement behind.
 */
import { ERC20_TRANSFER_TOPIC, NATIVE_TOKEN, WMON_DEPOSIT_TOPIC, WMON_WITHDRAWAL_TOPIC } from "@senryo/config";
import { z } from "zod";
import { HYPERSYNC_FINALITY_BLOCKS } from "./constants.ts";
import { UpstreamError } from "./upstream.ts";

/** One movement of value in or out of the scanned address. Addresses and the hash are lower-case. */
export interface Movement {
  txHash: string;
  /** The log's index; native MON has no log (`NATIVE_LOG_INDEX`). */
  logIndex: number;
  /** Native MON: the call's path ("" = the transaction's own value, "0.9.0.3" = an internal call); logs: "". */
  traceAddress: string;
  blockNumber: number;
  txIndex: number;
  /** Unix seconds of the block. */
  timestamp: number;
  /** Token address; `NATIVE_TOKEN` for MON. */
  token: string;
  from: string;
  to: string;
  /** The transaction's sender, when HyperSync returned it. */
  txFrom: string | null;
  /** Raw base units, > 0. */
  value: bigint;
}

export interface MovementPage {
  movements: Movement[];
  /** ERC-20 contracts seen in this page's logs (holdings discovery), zero-value transfers included. */
  tokens: string[];
  /** First block the next query starts from (never past the finality margin). */
  nextBlock: number;
  /** The query reached the newest final block. */
  done: boolean;
}

export const NATIVE_LOG_INDEX = -1;

const TOPIC_PAD = 24;
const ADDRESS_HEX = 40;
const WORD_HEX = 64;
const U64_HEX = 16;
const BYTE_HEX = 2;
const TX_SUCCESS = 1;
const topicOf = (address: string) => `0x${"0".repeat(TOPIC_PAD)}${address.toLowerCase().slice(2)}`;
const addressOfTopic = (topic: string) => `0x${topic.slice(-ADDRESS_HEX)}`.toLowerCase();
const isAddress = (text: string | null | undefined): text is string =>
  typeof text === "string" && /^0x[0-9a-fA-F]{40}$/.test(text);
const isWord = (text: string | null | undefined): text is string =>
  typeof text === "string" && text.length === WORD_HEX + 2 && /^0x[0-9a-fA-F]+$/.test(text);

const count = z.number().int().nonnegative();
const text = z.string().nullish();
const batchSchema = z.object({
  blocks: z.array(z.object({ number: count, timestamp: z.union([z.string(), z.number()]) })).nullish(),
  logs: z
    .array(
      z.object({
        block_number: count,
        log_index: count,
        transaction_index: count,
        transaction_hash: z.string(),
        address: text,
        topic0: text,
        topic1: text,
        topic2: text,
        topic3: text,
        data: text,
      }),
    )
    .nullish(),
  transactions: z
    .array(
      z.object({
        block_number: count.nullish(),
        transaction_index: count.nullish(),
        hash: z.string(),
        from: text,
        to: text,
        value: text,
        status: z.number().nullish(),
      }),
    )
    .nullish(),
  traces: z
    .array(
      z.object({
        block_number: count,
        transaction_position: count.nullish(),
        transaction_hash: text,
        trace_address: z.union([z.string(), z.array(count)]).nullish(),
        from: text,
        to: text,
        value: text,
        call_type: text,
        error: text,
      }),
    )
    .nullish(),
});
const responseSchema = z.object({
  data: z.union([z.array(batchSchema), batchSchema]),
  next_block: count,
  archive_height: count.nullish(),
});
type Batch = z.output<typeof batchSchema>;

const LOG_FIELDS = [
  "block_number",
  "log_index",
  "transaction_index",
  "transaction_hash",
  "address",
  "topic0",
  "topic1",
  "topic2",
  "topic3",
  "data",
];
const TRACE_FIELDS = [
  "block_number",
  "transaction_position",
  "transaction_hash",
  "trace_address",
  "from",
  "to",
  "value",
  "call_type",
  "error",
];

/** Logs + transactions of `address` from `fromBlock` (every network). */
export function transferQuery(address: string, fromBlock: number, wmon: string) {
  const topic = topicOf(address);
  return {
    from_block: fromBlock,
    logs: [
      { topics: [[ERC20_TRANSFER_TOPIC], [], [topic]] },
      { topics: [[ERC20_TRANSFER_TOPIC], [topic]] },
      { address: [wmon.toLowerCase()], topics: [[WMON_DEPOSIT_TOPIC, WMON_WITHDRAWAL_TOPIC], [topic]] },
    ],
    transactions: [{ from: [address.toLowerCase()] }, { to: [address.toLowerCase()] }],
    field_selection: {
      block: ["number", "timestamp"],
      log: LOG_FIELDS,
      transaction: ["block_number", "transaction_index", "hash", "from", "to", "value", "status"],
    },
  };
}

/** Calls into `address` from `fromBlock`, with their transactions and call trees (traces hosts only). */
export function internalCallQuery(address: string, fromBlock: number) {
  return {
    from_block: fromBlock,
    join_mode: "JoinAll",
    traces: [{ to: [address.toLowerCase()] }],
    field_selection: {
      block: ["number", "timestamp"],
      transaction: ["hash", "from", "status"],
      trace: TRACE_FIELDS,
    },
  };
}

function open(json: unknown, fromBlock: number) {
  const parsed = responseSchema.parse(json);
  const batches: Batch[] = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
  const head = parsed.archive_height ?? parsed.next_block;
  const finalHead = Math.max(0, head - HYPERSYNC_FINALITY_BLOCKS);
  const nextBlock = Math.max(fromBlock, Math.min(parsed.next_block, finalHead));
  const times = new Map<number, number>();
  for (const block of batches.flatMap((b) => b.blocks ?? [])) {
    times.set(block.number, typeof block.timestamp === "number" ? block.timestamp : Number(BigInt(block.timestamp)));
  }
  const timeOf = (blockNumber: number): number => {
    const time = times.get(blockNumber);
    if (time === undefined) throw new UpstreamError("hypersync", null, `block ${blockNumber} came without its time`);
    return time;
  };
  return { batches, nextBlock, done: nextBlock >= finalHead, timeOf };
}

const hexAmount = (hex: string | null | undefined): bigint => (hex && /^0x[0-9a-fA-F]+$/.test(hex) ? BigInt(hex) : 0n);

/** A log as (token, from, to, value): an ERC-20 transfer, or a WMON wrap / unwrap. ERC-721 (4 topics) is not money. */
function logTransfer(log: NonNullable<Batch["logs"]>[number], wmon: string) {
  if (!isAddress(log.address) || !log.topic1 || !isWord(log.data)) return undefined;
  const token = log.address.toLowerCase();
  const topic0 = log.topic0?.toLowerCase();
  const value = BigInt(log.data);
  if (topic0 === ERC20_TRANSFER_TOPIC && log.topic2 && !log.topic3)
    return { token, from: addressOfTopic(log.topic1), to: addressOfTopic(log.topic2), value };
  if (token !== wmon) return undefined;
  if (topic0 === WMON_DEPOSIT_TOPIC) return { token, from: NATIVE_TOKEN, to: addressOfTopic(log.topic1), value };
  if (topic0 === WMON_WITHDRAWAL_TOPIC) return { token, from: addressOfTopic(log.topic1), to: NATIVE_TOKEN, value };
  return undefined;
}

export function parseTransferPage(json: unknown, address: string, fromBlock: number, wmon: string): MovementPage {
  const owner = address.toLowerCase();
  const { batches, nextBlock, done, timeOf } = open(json, fromBlock);
  const transactions = batches.flatMap((b) => b.transactions ?? []);
  const senders = new Map(transactions.map((t) => [t.hash.toLowerCase(), t.from?.toLowerCase() ?? null]));
  const movements: Movement[] = [];
  const tokens = new Set<string>();
  for (const log of batches.flatMap((b) => b.logs ?? [])) {
    if (log.block_number >= nextBlock) continue;
    const transfer = logTransfer(log, wmon.toLowerCase());
    if (!transfer) continue;
    tokens.add(transfer.token);
    if (transfer.value === 0n || (transfer.from !== owner && transfer.to !== owner)) continue;
    const txHash = log.transaction_hash.toLowerCase();
    movements.push({
      ...transfer,
      txHash,
      logIndex: log.log_index,
      traceAddress: "",
      blockNumber: log.block_number,
      txIndex: log.transaction_index,
      timestamp: timeOf(log.block_number),
      txFrom: senders.get(txHash) ?? null,
    });
  }
  for (const tx of transactions) {
    const value = hexAmount(tx.value);
    const from = tx.from?.toLowerCase();
    const to = tx.to?.toLowerCase();
    if (tx.status !== TX_SUCCESS || value === 0n || !from || !to) continue;
    if ((from !== owner && to !== owner) || tx.block_number == null || tx.transaction_index == null) continue;
    if (tx.block_number >= nextBlock) continue;
    movements.push({
      txHash: tx.hash.toLowerCase(),
      logIndex: NATIVE_LOG_INDEX,
      traceAddress: "",
      blockNumber: tx.block_number,
      txIndex: tx.transaction_index,
      timestamp: timeOf(tx.block_number),
      token: NATIVE_TOKEN,
      from,
      to,
      txFrom: from,
      value,
    });
  }
  return { movements, tokens: [...tokens], nextBlock, done };
}

/** `[0, 9, 0, 3]` from HyperSync's hex encoding (u64 count, then the path, each little-endian), or as given. */
export function tracePath(raw: string | readonly number[] | null | undefined): number[] | undefined {
  if (Array.isArray(raw)) return [...raw];
  if (typeof raw !== "string" || !new RegExp(`^0x([0-9a-fA-F]{${U64_HEX}})+$`).test(raw)) return undefined;
  const words = raw.slice(2).match(new RegExp(`.{${U64_HEX}}`, "g")) ?? [];
  const littleEndian = (word: string) =>
    Number(BigInt(`0x${(word.match(new RegExp(`.{${BYTE_HEX}}`, "g")) ?? []).reverse().join("")}`));
  const [length, ...path] = words.map(littleEndian);
  return length === path.length ? path : undefined;
}

export function parseInternalPage(json: unknown, address: string, fromBlock: number): MovementPage {
  const owner = address.toLowerCase();
  const { batches, nextBlock, done, timeOf } = open(json, fromBlock);
  const txs = new Map(batches.flatMap((b) => b.transactions ?? []).map((t) => [t.hash.toLowerCase(), t]));
  const traces = batches.flatMap((b) => b.traces ?? []);
  const reverted = new Set<string>();
  for (const trace of traces) {
    const path = tracePath(trace.trace_address);
    if (trace.error && trace.transaction_hash && path)
      reverted.add(`${trace.transaction_hash.toLowerCase()}|${path.join(".")}`);
  }
  const movements: Movement[] = [];
  for (const trace of traces) {
    const txHash = trace.transaction_hash?.toLowerCase();
    const path = tracePath(trace.trace_address);
    const value = hexAmount(trace.value);
    const tx = txHash ? txs.get(txHash) : undefined;
    if (!txHash || !path || !tx || tx.status !== TX_SUCCESS || trace.transaction_position == null) continue;
    if (trace.to?.toLowerCase() !== owner || !isAddress(trace.from) || value === 0n || trace.call_type !== "call")
      continue;
    if (trace.block_number >= nextBlock) continue;
    // A call is undone when it, or any call above it, reverted (a caught revert leaves the transaction successful).
    const undone = path.some((_, i) => reverted.has(`${txHash}|${path.slice(0, i + 1).join(".")}`));
    if (undone || reverted.has(`${txHash}|`)) continue;
    movements.push({
      txHash,
      logIndex: NATIVE_LOG_INDEX,
      traceAddress: path.join("."),
      blockNumber: trace.block_number,
      txIndex: trace.transaction_position,
      timestamp: timeOf(trace.block_number),
      token: NATIVE_TOKEN,
      from: trace.from.toLowerCase(),
      to: owner,
      txFrom: tx.from?.toLowerCase() ?? null,
      value,
    });
  }
  return { movements, tokens: [], nextBlock, done };
}

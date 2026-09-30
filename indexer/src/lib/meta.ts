/** Per-event metadata, ids and small pure helpers shared by every handler. */
import type { EvmOnEventContext } from "envio";
import { SECONDS_PER_DAY } from "./constants.ts";

export type Ctx = EvmOnEventContext;

/** Every handler selects these fields (block number is always present). */
export const EVENT_FIELDS = { block: ["timestamp"], transaction: ["hash"] } as const;

export interface Meta {
  /** `<block>_<logIndex>` — unique per chain (rows are per chain, disable_default_cross_chain). */
  id: string;
  chainId: number;
  block: number;
  logIndex: number;
  timestamp: number;
  day: number;
  txHash: string;
}

interface EventShape {
  chainId: number;
  logIndex: number;
  block: { number: number; timestamp: number };
  transaction: { hash: string };
}

export function metaOf(event: EventShape): Meta {
  const { number: block, timestamp } = event.block;
  return {
    id: `${block}_${event.logIndex}`,
    chainId: event.chainId,
    block,
    logIndex: event.logIndex,
    timestamp,
    day: dayOf(timestamp),
    txHash: event.transaction.hash,
  };
}

export function dayOf(timestamp: number): number {
  return Math.floor(timestamp / SECONDS_PER_DAY);
}

/** Solidity enum → schema enum. An unknown index means the ABI drifted: stop loudly instead of mislabelling money. */
export function enumAt<T extends string>(values: readonly T[], index: bigint, what: string): T {
  const value = values[Number(index)];
  if (value === undefined) throw new Error(`unknown ${what} enum index ${index}`);
  return value;
}

/** uint8/uint64 event params that are ids or timestamps (never money) as JS numbers. */
export function small(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`value ${value} exceeds a safe integer`);
  return Number(value);
}

export function maxBig(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

export function minBig(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

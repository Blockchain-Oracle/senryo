import type { ChainId } from "@senryo/config";
import { aggregatorV3InterfaceAbi, senryoCoreAbi, sessionOracleAbi } from "@senryo/contracts/abis";
import type { Address, Hex } from "viem";
import type { ReadClient } from "./clients.ts";
import { addressOf } from "./contracts.ts";
import { MARKET_STATUS, type MarketStatusName, type ReadTag } from "./reads.ts";

/** Reads the keeper needs (batched through Multicall3 at one block tag). */

/**
 * `isLiquidatable(user)` for many accounts at once (view risk uses `peek`, so a fresh round counts immediately).
 * A row whose read failed maps to `undefined` — never `false`: an RPC hiccup must not look like a healthy account.
 */
export async function readLiquidatable(
  read: ReadClient,
  chainId: ChainId,
  users: readonly Address[],
  blockTag: ReadTag = "latest",
): Promise<Map<Address, boolean | undefined>> {
  if (users.length === 0) return new Map();
  const address = addressOf(chainId, "SenryoCore");
  const rows = await read.multicall({
    contracts: users.map((u) => ({ address, abi: senryoCoreAbi, functionName: "isLiquidatable", args: [u] }) as const),
    allowFailure: true,
    blockTag,
  });
  return new Map(users.map((u, i) => [u, rows[i]?.status === "success" ? rows[i]?.result === true : undefined]));
}

export interface OracleState {
  marketId: number;
  lastPrice18: bigint;
  lastUpdatedAt: bigint;
  lastRoundId: bigint;
  circuit: boolean;
  lastStatus: MarketStatusName;
}

/** Persisted `SessionOracle.states(marketId)` — compared with `peek` to decide whether an `observe` poke changes state. */
export async function readOracleStates(
  read: ReadClient,
  chainId: ChainId,
  marketIds: readonly number[],
): Promise<OracleState[]> {
  const address = addressOf(chainId, "SessionOracle");
  const rows = await read.multicall({
    contracts: marketIds.map((id) => ({ address, abi: sessionOracleAbi, functionName: "states", args: [id] }) as const),
    allowFailure: false,
    blockTag: "latest",
  });
  return rows.map(([lastPrice18, lastUpdatedAt, , lastRoundId, circuit, , lastStatus], i) => ({
    marketId: marketIds[i] ?? 0,
    lastPrice18,
    lastUpdatedAt: BigInt(lastUpdatedAt),
    lastRoundId: BigInt(lastRoundId),
    circuit,
    lastStatus: MARKET_STATUS[lastStatus] ?? "HALTED",
  }));
}

/**
 * Whether each market has open interest (`SenryoCore.marketState` longSize + shortSize > 0) — the keeper's observe
 * budget pokes price drift only where positions are open (S8.23).
 */
export async function readOpenInterest(
  read: ReadClient,
  chainId: ChainId,
  marketIds: readonly number[],
): Promise<Map<number, boolean>> {
  const address = addressOf(chainId, "SenryoCore");
  const rows = await read.multicall({
    contracts: marketIds.map(
      (id) => ({ address, abi: senryoCoreAbi, functionName: "marketState", args: [id] }) as const,
    ),
    allowFailure: false,
    blockTag: "latest",
  });
  return new Map(marketIds.map((id, i) => [id, (rows[i]?.longSize ?? 0n) + (rows[i]?.shortSize ?? 0n) > 0n]));
}

export interface FeedRound {
  roundId: bigint;
  answer: bigint;
  updatedAt: bigint;
}

/** `latestRoundData()` of any AggregatorV3 (mainnet Chainlink or a testnet MirrorAggregator). */
export async function readFeedRound(read: ReadClient, feed: Address): Promise<FeedRound> {
  const [roundId, answer, , updatedAt] = await read.readContract({
    address: feed,
    abi: aggregatorV3InterfaceAbi,
    functionName: "latestRoundData",
  });
  return { roundId: BigInt(roundId), answer, updatedAt };
}

export const HOLD_STATE = ["NONE", "OPEN", "CAPTURED", "RELEASED"] as const;

export interface HoldView {
  holdId: Hex;
  user: Address;
  expiry: bigint;
  fromEnvelope: boolean;
  state: (typeof HOLD_STATE)[number];
  amount: bigint;
}

export async function readHolds(read: ReadClient, chainId: ChainId, holdIds: readonly Hex[]): Promise<HoldView[]> {
  if (holdIds.length === 0) return [];
  const address = addressOf(chainId, "SenryoCore");
  const rows = await read.multicall({
    contracts: holdIds.map((id) => ({ address, abi: senryoCoreAbi, functionName: "hold", args: [id] }) as const),
    allowFailure: false,
    blockTag: "latest",
  });
  return rows.map((h, i) => ({
    holdId: holdIds[i] ?? "0x",
    user: h.user,
    expiry: BigInt(h.expiry),
    fromEnvelope: h.fromEnvelope,
    state: HOLD_STATE[h.state] ?? "NONE",
    amount: h.amount,
  }));
}

/** Native balances (wallet floors, gas top-ups). */
export async function readBalances(read: ReadClient, addresses: readonly Address[]): Promise<Map<Address, bigint>> {
  const balances = await Promise.all(addresses.map((a) => read.getBalance({ address: a })));
  return new Map(addresses.map((a, i) => [a, balances[i] ?? 0n]));
}

/** `Account.positionBitmap` for many accounts in one multicall (failed rows omitted). */
export async function readPositionBitmaps(
  read: ReadClient,
  chainId: ChainId,
  users: readonly Address[],
  blockTag: ReadTag = "latest",
): Promise<Map<Address, number>> {
  if (users.length === 0) return new Map();
  const address = addressOf(chainId, "SenryoCore");
  const rows = await read.multicall({
    contracts: users.map((u) => ({ address, abi: senryoCoreAbi, functionName: "account", args: [u] }) as const),
    allowFailure: true,
    blockTag,
  });
  const out = new Map<Address, number>();
  users.forEach((u, i) => {
    const row = rows[i];
    if (row?.status === "success") out.set(u, row.result.positionBitmap);
  });
  return out;
}

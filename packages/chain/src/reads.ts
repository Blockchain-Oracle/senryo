import type { ChainId } from "@senryo/config";
import { senryoCoreAbi, sessionOracleAbi } from "@senryo/contracts/abis";
import type { Address } from "viem";
import type { ReadClient } from "./clients.ts";
import { addressOf } from "./contracts.ts";

/**
 * Consistent multi-reads: one Multicall3 `eth_call` at one block tag, so every field comes from the same state
 * (two separate "finalized" calls could straddle a new finalized block). Money decisions use "finalized".
 */

export type ReadTag = "latest" | "safe" | "finalized";

export interface AccountSnapshot {
  equityInit: bigint;
  equityLiq: bigint;
  im: bigint;
  mm: bigint;
  freeToTrade: bigint;
  /** Already capped by the live spend allowance onchain. */
  freeToSpend: bigint;
  allOpen: boolean;
  anyUnsafe: boolean;
  usdc: bigint;
  ausd: bigint;
  holds: bigint;
  cardDebt: bigint;
  envelope: bigint;
  /** Account nonce (bumped by every mutation) — orders snapshots against landed holds. */
  nonce: bigint;
  positionBitmap: number;
  allowanceDailyLimit: bigint;
  allowanceExpiry: bigint;
  allowanceLeft: bigint;
}

export async function readAccountSnapshot(
  read: ReadClient,
  chainId: ChainId,
  user: Address,
  blockTag: ReadTag = "finalized",
): Promise<AccountSnapshot> {
  const core = { address: addressOf(chainId, "SenryoCore"), abi: senryoCoreAbi } as const;
  const [risk, account, allowance] = await read.multicall({
    contracts: [
      { ...core, functionName: "accountRisk", args: [user] },
      { ...core, functionName: "account", args: [user] },
      { ...core, functionName: "allowance", args: [user] },
    ],
    allowFailure: false,
    blockTag,
  });
  const [al, left] = allowance;
  return {
    equityInit: risk.equityInit,
    equityLiq: risk.equityLiq,
    im: risk.im,
    mm: risk.mm,
    freeToTrade: risk.freeToTrade,
    freeToSpend: risk.freeToSpend,
    allOpen: risk.allOpen,
    anyUnsafe: risk.anyUnsafe,
    usdc: account.usdc,
    ausd: account.ausd,
    holds: account.holds,
    cardDebt: account.cardDebt,
    envelope: account.envelope,
    nonce: BigInt(account.nonce),
    positionBitmap: account.positionBitmap,
    allowanceDailyLimit: al.dailyLimit,
    allowanceExpiry: BigInt(al.expiry),
    allowanceLeft: left,
  };
}

export interface PositionView {
  marketId: number;
  size: bigint;
  entry: bigint;
  isLong: boolean;
  openedBlock: bigint;
  /** Market funding / borrow index at the last settle (for the owed breakdown, F11). */
  fundingSnap: bigint;
  borrowSnap: bigint;
}

/** Open positions for the markets set in `positionBitmap` (one multicall). */
export async function readPositions(
  read: ReadClient,
  chainId: ChainId,
  user: Address,
  positionBitmap: number,
  blockTag: ReadTag = "latest",
): Promise<PositionView[]> {
  const ids: number[] = [];
  for (let id = 0, bits = positionBitmap; bits !== 0; id += 1, bits >>>= 1) {
    if ((bits & 1) === 1) ids.push(id);
  }
  if (ids.length === 0) return [];
  const address = addressOf(chainId, "SenryoCore");
  const rows = await read.multicall({
    contracts: ids.map((id) => ({ address, abi: senryoCoreAbi, functionName: "position", args: [user, id] }) as const),
    allowFailure: false,
    blockTag,
  });
  return rows.map((p, i) => ({
    marketId: ids[i] ?? 0,
    size: p.size,
    entry: p.entry,
    isLong: p.isLong,
    openedBlock: BigInt(p.openedBlock),
    fundingSnap: BigInt(p.fundingSnap),
    borrowSnap: BigInt(p.borrowSnap),
  }));
}

export const MARKET_STATUS = ["OPEN", "REOPENING", "CLOSED", "STALE", "CIRCUIT", "HALTED"] as const;
export type MarketStatusName = (typeof MARKET_STATUS)[number];

export interface OracleView {
  marketId: number;
  price18: bigint;
  latest18: bigint;
  updatedAt: bigint;
  status: MarketStatusName;
  spreadBps: number;
}

/** `SessionOracle.peek` for each market id (view; `observe` is the state-changing twin keepers poke). */
export async function readOracles(
  read: ReadClient,
  chainId: ChainId,
  marketIds: readonly number[],
  blockTag: ReadTag = "latest",
): Promise<OracleView[]> {
  const address = addressOf(chainId, "SessionOracle");
  const rows = await read.multicall({
    contracts: marketIds.map((id) => ({ address, abi: sessionOracleAbi, functionName: "peek", args: [id] }) as const),
    allowFailure: false,
    blockTag,
  });
  return rows.map((v, i) => ({
    marketId: marketIds[i] ?? 0,
    price18: v.price18,
    latest18: v.latest18,
    updatedAt: BigInt(v.updatedAt),
    status: MARKET_STATUS[v.status] ?? "HALTED",
    spreadBps: v.spreadBps,
  }));
}

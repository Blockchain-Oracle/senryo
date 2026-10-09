/**
 * Parlays (S8.5, D-293) for the apps, the relay and the keeper: the EIP-712 `ParlayIntent` exactly as `ParlayBook`
 * hashes it (domain "Senryo Markets" v1 on the reserve, the legs as two arrays), the calldata to commit, fill, expire
 * and settle, the first-call batch that opens every leg's window with its line, the keeper's batch that resolves the
 * leg windows and settles, and the reserve's parlay events as changes for the services' book.
 */

import type { ChainId } from "@senryo/config";
import { bandReserveAbi, windowsAbi } from "@senryo/contracts/abis";
import { type Address, decodeEventLog, encodeFunctionData, type Hex, hashTypedData, type Log } from "viem";
import { addressOf } from "./contracts.ts";
import { NO_PERMIT, type PermitArgs } from "./market-calls.ts";
import { marketsDomain } from "./market-typed-data.ts";
import { aggregate, type Call } from "./markets.ts";

export const PARLAY_TYPES = {
  ParlayIntent: [
    { name: "owner", type: "address" },
    { name: "windowIds", type: "bytes32[]" },
    { name: "bands", type: "uint8[]" },
    { name: "stake", type: "uint64" },
    { name: "minPayout", type: "uint64" },
    { name: "recipient", type: "address" },
    { name: "configVersion", type: "uint32" },
    { name: "deadline", type: "uint64" },
    { name: "nonce", type: "uint256" },
    { name: "epoch", type: "uint32" },
  ],
} as const;

export interface MarketParlayIntent {
  owner: Address;
  windowIds: Hex[];
  bands: number[];
  stake: bigint;
  minPayout: bigint;
  recipient: Address;
  configVersion: number;
  deadline: bigint;
  nonce: bigint;
  epoch: number;
}

export const parlayRequest = (chainId: ChainId, message: MarketParlayIntent) =>
  ({ domain: marketsDomain(chainId), types: PARLAY_TYPES, primaryType: "ParlayIntent", message }) as const;

/** The digest the owner or session delegate signs; also the relay's idempotency key. */
export const parlayDigest = (chainId: ChainId, intent: MarketParlayIntent): Hex =>
  hashTypedData(parlayRequest(chainId, intent));

export function commitParlayCallData(intent: MarketParlayIntent, signature: Hex, permit: PermitArgs | null): Hex {
  return encodeFunctionData({
    abi: bandReserveAbi,
    functionName: "commitParlay",
    args: [intent, signature, permit ?? NO_PERMIT],
  });
}

/** The fill: one proof per leg, in leg order (the print of the parlay's instant on that leg's feed). */
export function finalizeParlayCallData(parlayId: bigint, proofs: readonly Hex[]): Hex {
  return encodeFunctionData({ abi: bandReserveAbi, functionName: "finalizeParlay", args: [parlayId, [...proofs]] });
}

export function expireParlayCallData(parlayId: bigint): Hex {
  return encodeFunctionData({ abi: bandReserveAbi, functionName: "expireParlay", args: [parlayId] });
}

export function settleParlayCallData(parlayId: bigint): Hex {
  return encodeFunctionData({ abi: bandReserveAbi, functionName: "settleParlay", args: [parlayId] });
}

/** A leg window the batch opens with its line (`openWindow` + the open print), or resolves (the close print). */
export interface LegWindow {
  seriesId: Hex;
  windowId: Hex;
  start: number;
  expiry: number;
  verifier: Address;
  feedId: Hex;
  /** The open print's proof (opening) or the close print's (resolving); null to void a window whose print never came. */
  proof: Hex | null;
}

/**
 * Each window opened and its open print recorded, both allowed to fail (someone may have done it): what a parlay's
 * commit or a duel's reveal needs first.
 */
export function openWindowCalls(chainId: ChainId, legs: readonly LegWindow[]): Call[] {
  const windows = addressOf(chainId, "Windows");
  return legs.flatMap((l) => [
    {
      target: windows,
      allowFailure: true,
      callData: encodeFunctionData({ abi: windowsAbi, functionName: "openWindow", args: [l.seriesId, l.start] }),
    },
    {
      target: windows,
      allowFailure: true,
      callData: encodeFunctionData({
        abi: windowsAbi,
        functionName: "ensurePrint",
        args: [l.verifier, l.feedId, l.start, l.proof ?? "0x"],
      }),
    },
  ]);
}

/**
 * A parlay's first call, in one transaction: each leg window opened with its line, then the commit (must succeed;
 * `commitMayFail` for a simulation that reads it).
 */
export function openLegsAndCommitParlayData(
  chainId: ChainId,
  legs: readonly LegWindow[],
  commitData: Hex,
  commitMayFail = false,
): Hex {
  const calls = openWindowCalls(chainId, legs);
  calls.push({ target: addressOf(chainId, "BandReserve"), allowFailure: commitMayFail, callData: commitData });
  return aggregate(calls);
}

/**
 * The keeper's settlement of parlays: each ended leg window's close print and verdict (or its void once the print
 * can't come), each allowed to fail (done already), then `settleParlay` for each parlay (must succeed).
 */
export function resolveLegsAndSettleData(
  chainId: ChainId,
  legs: readonly LegWindow[],
  parlayIds: readonly bigint[],
): Hex {
  const windows = addressOf(chainId, "Windows");
  const reserve = addressOf(chainId, "BandReserve");
  const calls: Call[] = legs.flatMap((l): Call[] =>
    l.proof
      ? [
          {
            target: windows,
            allowFailure: true,
            callData: encodeFunctionData({
              abi: windowsAbi,
              functionName: "ensurePrint",
              args: [l.verifier, l.feedId, l.expiry, l.proof],
            }),
          },
          {
            target: windows,
            allowFailure: true,
            callData: encodeFunctionData({ abi: windowsAbi, functionName: "resolve", args: [l.windowId] }),
          },
        ]
      : [
          {
            target: windows,
            allowFailure: true,
            callData: encodeFunctionData({ abi: windowsAbi, functionName: "voidExpired", args: [l.windowId] }),
          },
        ],
  );
  for (const id of parlayIds) {
    calls.push({ target: reserve, allowFailure: false, callData: settleParlayCallData(id) });
  }
  return aggregate(calls);
}

export type ParlayChange =
  | { kind: "parlayCommitted"; parlayId: bigint; owner: Address; stake: bigint; target: number }
  | { kind: "parlayFilled"; parlayId: bigint; payout: bigint; chanceE6: number }
  | { kind: "parlayRefused"; parlayId: bigint; reason: number; refunded: bigint }
  | { kind: "parlayLegDecided"; parlayId: bigint; leg: number; outcome: number }
  | { kind: "parlaySettled"; parlayId: bigint; to: Address; outcome: number; amount: bigint };

/** The reserve's parlay events in a receipt, in order (other logs ignored). */
export function parlayChanges(logs: readonly Log[], reserve: Address): ParlayChange[] {
  const out: ParlayChange[] = [];
  for (const log of logs) {
    if (log.address.toLowerCase() !== reserve.toLowerCase()) continue;
    let e: ReturnType<typeof decodeEventLog<typeof bandReserveAbi>>;
    try {
      e = decodeEventLog({ abi: bandReserveAbi, data: log.data, topics: log.topics });
    } catch {
      continue;
    }
    const a = e.args as Record<string, unknown>;
    const parlayId = a.parlayId as bigint;
    switch (e.eventName) {
      case "ParlayCommitted":
        out.push({
          kind: "parlayCommitted",
          parlayId,
          owner: a.owner as Address,
          stake: a.stake as bigint,
          target: Number(a.target),
        });
        break;
      case "ParlayFilled":
        out.push({
          kind: "parlayFilled",
          parlayId,
          payout: a.payout as bigint,
          chanceE6: Number(a.chanceE6),
        });
        break;
      case "ParlayRefused":
        out.push({ kind: "parlayRefused", parlayId, reason: Number(a.reason), refunded: a.refunded as bigint });
        break;
      case "ParlayLegDecided":
        out.push({ kind: "parlayLegDecided", parlayId, leg: Number(a.leg), outcome: Number(a.outcome) });
        break;
      case "ParlaySettled":
        out.push({
          kind: "parlaySettled",
          parlayId,
          to: a.to as Address,
          outcome: Number(a.outcome),
          amount: a.amount as bigint,
        });
        break;
      default:
        break;
    }
  }
  return out;
}

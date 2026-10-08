/**
 * The markets' ids and batches, exactly as the contracts hash and expect them (contracts/src/markets, S2): series
 * `keccak256(abi.encode(bytes32 market, uint32 cadence))`, window `keccak256(abi.encode(seriesId, uint40 start))`, print
 * key `keccak256(abi.encode(verifier, feedId, uint40 t))`. Windows are lazy on chain (D-278): the first call in a window
 * opens it, records its open print and commits in one Multicall3 transaction; settlement records the close print,
 * resolves, settles and pays the first batch in another. Every step is permissionless, so the batch needs no contract.
 */
import { type CadenceSec, type ChainId, LOCKOUT_SEC, MARKETS, type MarketSpec } from "@senryo/config";
import { bandReserveAbi, windowsAbi } from "@senryo/contracts/abis";
import {
  type Address,
  decodeFunctionResult,
  encodeAbiParameters,
  encodeFunctionData,
  type Hex,
  keccak256,
  parseAbiParameters,
  stringToHex,
} from "viem";
import { addressOf } from "./contracts.ts";

/** Multicall3 at its canonical address (code checked on Monad 143 and 10143, 8 Oct 2026). */
export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

const multicall3Abi = [
  {
    type: "function",
    name: "aggregate3",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
      },
    ],
  },
] as const;

/** The series market key: the symbol's ASCII bytes, left-aligned in a bytes32 (Solidity `bytes32("BTC")`). */
export function marketKey(symbol: string): Hex {
  return stringToHex(symbol, { size: 32 });
}

export function seriesIdOf(symbol: string, cadenceSec: number): Hex {
  return keccak256(encodeAbiParameters(parseAbiParameters("bytes32, uint32"), [marketKey(symbol), cadenceSec]));
}

export function windowIdOf(seriesId: Hex, start: number): Hex {
  return keccak256(encodeAbiParameters(parseAbiParameters("bytes32, uint40"), [seriesId, start]));
}

export function printKeyOf(verifier: Address, feedId: Hex, t: number): Hex {
  return keccak256(encodeAbiParameters(parseAbiParameters("address, bytes32, uint40"), [verifier, feedId, t]));
}

/** The window of `cadence` containing `nowSec`, and whether calls are still open in it (before the lockout). */
export function windowAt(nowSec: number, cadenceSec: CadenceSec) {
  const start = nowSec - (nowSec % cadenceSec);
  const expiry = start + cadenceSec;
  return { start, expiry, trading: nowSec + LOCKOUT_SEC < expiry };
}

/** The catalogue market behind a series id on a chain (undefined for a series we don't list). */
export function seriesOf(chainId: ChainId, seriesId: Hex): { market: MarketSpec; cadenceSec: CadenceSec } | undefined {
  for (const market of MARKETS) {
    if (!market.chains.includes(chainId)) continue;
    for (const cadenceSec of market.cadences) {
      if (seriesIdOf(market.symbol, cadenceSec) === seriesId) return { market, cadenceSec };
    }
  }
  return undefined;
}

/** A print proof as the verifier takes it: `abi.encode(bytes[] updateData)`. */
export function printProof(updates: readonly Hex[]): Hex {
  return encodeAbiParameters(parseAbiParameters("bytes[]"), [updates]);
}

interface Call {
  target: Address;
  allowFailure: boolean;
  callData: Hex;
}

function aggregate(calls: Call[]): Hex {
  return encodeFunctionData({ abi: multicall3Abi, functionName: "aggregate3", args: [calls] });
}

/**
 * The first call in a window, in one transaction: open the window and record its open print (both allowed to fail —
 * someone may have done it already), then the commit itself (must succeed).
 */
export function openAndCommitData(
  chainId: ChainId,
  args: { seriesId: Hex; start: number; verifier: Address; feedId: Hex; openProof: Hex; commitData: Hex },
  /** Simulation only: let the commit fail so its own revert can be read from the result (a strict batch hides it). */
  commitMayFail = false,
): Hex {
  const windows = addressOf(chainId, "Windows");
  return aggregate([
    {
      target: windows,
      allowFailure: true,
      callData: encodeFunctionData({ abi: windowsAbi, functionName: "openWindow", args: [args.seriesId, args.start] }),
    },
    {
      target: windows,
      allowFailure: true,
      callData: encodeFunctionData({
        abi: windowsAbi,
        functionName: "ensurePrint",
        args: [args.verifier, args.feedId, args.start, args.openProof],
      }),
    },
    { target: addressOf(chainId, "BandReserve"), allowFailure: commitMayFail, callData: args.commitData },
  ]);
}

/** The per-call results of an `aggregate3` simulation (`eth_call`). */
export function aggregateResults(data: Hex): readonly { success: boolean; returnData: Hex }[] {
  return decodeFunctionResult({ abi: multicall3Abi, functionName: "aggregate3", data });
}

/**
 * Settlement of a window with calls, in one transaction: record the close print, resolve, settle every band, then pay
 * the first batch. Each step may already be done; only the payout batch must succeed.
 */
export function settleAndClaimData(
  chainId: ChainId,
  args: { windowId: Hex; expiry: number; verifier: Address; feedId: Hex; closeProof: Hex; ticketIds: bigint[] },
): Hex {
  const windows = addressOf(chainId, "Windows");
  const reserve = addressOf(chainId, "BandReserve");
  const calls: Call[] = [
    {
      target: windows,
      allowFailure: true,
      callData: encodeFunctionData({
        abi: windowsAbi,
        functionName: "ensurePrint",
        args: [args.verifier, args.feedId, args.expiry, args.closeProof],
      }),
    },
    {
      target: windows,
      allowFailure: true,
      callData: encodeFunctionData({ abi: windowsAbi, functionName: "resolve", args: [args.windowId] }),
    },
    {
      target: reserve,
      allowFailure: true,
      callData: encodeFunctionData({ abi: bandReserveAbi, functionName: "settleWindow", args: [args.windowId] }),
    },
  ];
  if (args.ticketIds.length > 0) {
    calls.push({
      target: reserve,
      allowFailure: false,
      callData: encodeFunctionData({ abi: bandReserveAbi, functionName: "claimFor", args: [args.ticketIds] }),
    });
  }
  return aggregate(calls);
}

/** A window with no print ever recorded voids after admission; anyone may do it, then settle and refund. */
export function voidAndClaimData(chainId: ChainId, args: { windowId: Hex; ticketIds: bigint[] }): Hex {
  const windows = addressOf(chainId, "Windows");
  const reserve = addressOf(chainId, "BandReserve");
  const calls: Call[] = [
    {
      target: windows,
      allowFailure: true,
      callData: encodeFunctionData({ abi: windowsAbi, functionName: "voidExpired", args: [args.windowId] }),
    },
    {
      target: reserve,
      allowFailure: true,
      callData: encodeFunctionData({ abi: bandReserveAbi, functionName: "settleWindow", args: [args.windowId] }),
    },
  ];
  if (args.ticketIds.length > 0) {
    calls.push({
      target: reserve,
      allowFailure: false,
      callData: encodeFunctionData({ abi: bandReserveAbi, functionName: "claimFor", args: [args.ticketIds] }),
    });
  }
  return aggregate(calls);
}

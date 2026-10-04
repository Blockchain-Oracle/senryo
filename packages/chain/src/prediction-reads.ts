/** Original, minimal read interface derived from Castora's public function signatures. No provider implementation. */
import { PREDICTION_VENUES } from "@senryo/config";
import type { ReadClient } from "./clients.ts";

const uint = <const N extends string>(name: N) => ({ name, type: "uint256" }) as const;
const address = <const N extends string>(name: N) => ({ name, type: "address" }) as const;
const seeds = [
  address("predictionToken"),
  address("stakeToken"),
  uint("stakeAmount"),
  uint("snapshotTime"),
  uint("windowCloseTime"),
  { name: "feesPercent", type: "uint16" },
  { name: "multiplier", type: "uint16" },
  { name: "isUnlisted", type: "bool" },
] as const;
const pool = [
  uint("poolId"),
  { name: "seeds", type: "tuple", components: seeds },
  { name: "seedsHash", type: "bytes32" },
  uint("creationTime"),
  uint("noOfPredictions"),
  uint("snapshotPrice"),
  uint("completionTime"),
  uint("winAmount"),
  uint("noOfWinners"),
  uint("noOfClaimedWinnings"),
] as const;
const gettersAbi = [
  {
    name: "allStats",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "stats",
        type: "tuple",
        components: [
          uint("noOfUsers"),
          uint("noOfPools"),
          uint("noOfPredictions"),
          uint("noOfWinnings"),
          uint("noOfClaimableWinnings"),
          uint("noOfClaimedWinnings"),
          uint("noOfPredictionTokens"),
          uint("noOfStakeTokens"),
        ],
      },
    ],
  },
  {
    name: "pools",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "ids", type: "uint256[]" }],
    outputs: [{ name: "items", type: "tuple[]", components: pool }],
  },
  {
    name: "pool",
    type: "function",
    stateMutability: "view",
    inputs: [uint("id")],
    outputs: [{ name: "item", type: "tuple", components: pool }],
  },
] as const;
const coreAbi = [
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
] as const;

const SCAN_MAX = 500;
const BATCH = 50;
const getter = PREDICTION_VENUES.castora.getters;
export async function readCastoraPool(read: ReadClient, id: bigint) {
  const block = await read.getBlock({ blockTag: "finalized" });
  const common = { blockNumber: block.number };
  const [item, paused] = await Promise.all([
    read.readContract({ address: getter, abi: gettersAbi, functionName: "pool", args: [id], ...common }),
    read.readContract({ address: PREDICTION_VENUES.castora.core, abi: coreAbi, functionName: "paused", ...common }),
  ]);
  return { item, paused, blockNumber: block.number, observedAt: Number(block.timestamp) };
}
export type CastoraPool = Awaited<ReturnType<typeof readCastoraPool>>["item"];
export async function readCastoraPools(read: ReadClient) {
  const block = await read.getBlock({ blockTag: "finalized" });
  const common = { blockNumber: block.number };
  const [stats, paused] = await Promise.all([
    read.readContract({ address: getter, abi: gettersAbi, functionName: "allStats", ...common }),
    read.readContract({ address: PREDICTION_VENUES.castora.core, abi: coreAbi, functionName: "paused", ...common }),
  ]);
  const count = Number(stats.noOfPools > BigInt(SCAN_MAX) ? BigInt(SCAN_MAX) : stats.noOfPools);
  const items: CastoraPool[] = [];
  for (let offset = 0; offset < count; offset += BATCH) {
    const ids = Array.from({ length: Math.min(BATCH, count - offset) }, (_, i) => stats.noOfPools - BigInt(offset + i));
    items.push(
      ...(await read.readContract({ address: getter, abi: gettersAbi, functionName: "pools", args: [ids], ...common })),
    );
  }
  return {
    items,
    paused,
    blockNumber: block.number,
    observedAt: Number(block.timestamp),
    limited: stats.noOfPools > BigInt(SCAN_MAX),
    totalPools: stats.noOfPools,
  };
}

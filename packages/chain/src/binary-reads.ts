import {
  assertBinaryActivation,
  BINARY_POLICY,
  BINARY_POLICY_TEXT,
  type BinaryEnvironment,
  type BinaryManifest,
} from "@senryo/config";
import { pythBoundaryOracleAbi, senryoBinaryV1Abi } from "@senryo/contracts";
import { type Address, encodeAbiParameters, type Hex, keccak256, stringToHex } from "viem";
import type { ReadClient } from "./clients.ts";
export const BINARY_POLICY_HASH = keccak256(stringToHex(BINARY_POLICY_TEXT));
export function binaryBytes32(x: string): asserts x is Hex {
  if (!/^0x[0-9a-fA-F]{64}$/.test(x) || /^0x0{64}$/.test(x)) throw new Error("binary: invalid bytes32");
}
export function binaryAddress(x: string): asserts x is Address {
  if (!/^0x[0-9a-fA-F]{40}$/.test(x) || /^0x0{40}$/.test(x)) throw new Error("binary: invalid address");
}
export function binaryConfigHash(m: BinaryManifest): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        ...Array.from({ length: 5 }, () => ({ type: "address" }) as const),
      ],
      [
        BINARY_POLICY_HASH,
        BINARY_POLICY.btcFeed,
        BINARY_POLICY.ethFeed,
        m.oracle,
        m.receiver,
        m.roundCreator,
        m.guardian,
        m.liquidityBeneficiary,
      ],
    ),
  );
}
export function assertBinaryManifest(m: BinaryManifest, e: BinaryEnvironment): void {
  assertBinaryActivation(m, e);
  for (const a of [m.contract, m.oracle, m.receiver, m.roundCreator, m.guardian, m.liquidityBeneficiary])
    binaryAddress(a);
  for (const h of [m.configHash, m.marketCodeHash, m.oracleCodeHash, m.receiverCodeHash, m.anchorHash])
    binaryBytes32(h);
  if (
    m.anchorBlock < 0n ||
    m.receiver !== BINARY_POLICY.receiver ||
    binaryConfigHash(m).toLowerCase() !== m.configHash.toLowerCase()
  )
    throw new Error("binary: invalid deployment configuration");
}
/** Check endpoint identity and exact deployed dependencies at one pinned block, including fixture fork identity. */
export async function verifyBinarySource(read: ReadClient, m: BinaryManifest, e: BinaryEnvironment) {
  assertBinaryManifest(m, e);
  const [chainId, anchor, block] = await Promise.all([
    read.getChainId(),
    read.getBlock({ blockNumber: m.anchorBlock }),
    read.getBlock(),
  ]);
  if (chainId !== m.chainId || anchor.hash?.toLowerCase() !== m.anchorHash.toLowerCase())
    throw new Error("binary: endpoint environment mismatch");
  const blockNumber = block.number;
  const codes = await Promise.all(
    [m.contract, m.oracle, m.receiver].map((address) => read.getCode({ address, blockNumber })),
  );
  const expected = [m.marketCodeHash, m.oracleCodeHash, m.receiverCodeHash];
  if (codes.some((code, i) => !code || keccak256(code).toLowerCase() !== expected[i]?.toLowerCase()))
    throw new Error("binary: bytecode mismatch");
  const config = await read.readContract({
    address: m.contract,
    abi: senryoBinaryV1Abi,
    functionName: "configHash",
    blockNumber,
  });
  if (config.toLowerCase() !== m.configHash.toLowerCase()) throw new Error("binary: onchain config mismatch");
  return { blockNumber, blockHash: block.hash, timestamp: block.timestamp };
}
export async function readBinaryRound(
  read: ReadClient,
  m: BinaryManifest,
  e: BinaryEnvironment,
  roundId: Hex,
  owner: Address,
) {
  m = Object.freeze({ ...m });
  e = Object.freeze({ ...e });
  binaryBytes32(roundId);
  binaryAddress(owner);
  const source = await verifyBinarySource(read, m, e);
  const c = { address: m.contract, abi: senryoBinaryV1Abi, blockNumber: source.blockNumber } as const;
  const [round, position, creditWei, riskPaused, walletMonWei] = await Promise.all([
    read.readContract({ ...c, functionName: "round", args: [roundId] }),
    read.readContract({ ...c, functionName: "position", args: [roundId, owner] }),
    read.readContract({ ...c, functionName: "creditOf", args: [owner] }),
    read.readContract({ ...c, functionName: "riskPaused" }),
    read.getBalance({ address: owner, blockNumber: source.blockNumber }),
  ]);
  if (round.state === 0) throw new Error("binary: missing round");
  return {
    manifest: m,
    environment: e,
    roundId,
    owner,
    ...source,
    round,
    position,
    creditWei,
    riskPaused,
    walletMonWei,
  };
}
export type BinarySnapshot = Awaited<ReturnType<typeof readBinaryRound>>;
export async function readBinaryQuote(
  read: ReadClient,
  s: BinarySnapshot,
  isUp: boolean,
  action: "buy" | "sell",
  amount: bigint,
) {
  if (amount <= 0n) throw new Error("binary: nonpositive input");
  if (action === "sell" && amount > (isUp ? s.position.up : s.position.down))
    throw new Error("binary: insufficient shares");
  const quote = await read.readContract({
    address: s.manifest.contract,
    abi: senryoBinaryV1Abi,
    functionName: action === "buy" ? "quoteBuy" : "quoteSell",
    args: [s.roundId, isUp, amount],
    blockNumber: s.blockNumber,
  });
  return { ...s, isUp, action, quote };
}
export type BinaryQuoted = Awaited<ReturnType<typeof readBinaryQuote>>;
export async function readBinaryProofFee(
  read: ReadClient,
  m: BinaryManifest,
  e: BinaryEnvironment,
  proof: readonly Hex[],
) {
  const source = await verifyBinarySource(read, m, e);
  if (!proof.length || proof.some((p) => !/^0x(?:[0-9a-fA-F]{2})+$/.test(p)))
    throw new Error("binary: invalid proof bytes");
  return read.readContract({
    address: m.oracle,
    abi: pythBoundaryOracleAbi,
    functionName: "fee",
    args: [proof],
    blockNumber: source.blockNumber,
  });
}
export async function binaryOperationUsed(
  read: ReadClient,
  m: BinaryManifest,
  e: BinaryEnvironment,
  owner: Address,
  operationId: Hex,
) {
  binaryAddress(owner);
  binaryBytes32(operationId);
  const source = await verifyBinarySource(read, m, e);
  return read.readContract({
    address: m.contract,
    abi: senryoBinaryV1Abi,
    functionName: "usedOperation",
    args: [owner, operationId],
    blockNumber: source.blockNumber,
  });
}
/** Credits are deliberately excluded: only withdrawn MON can fund another buy. */
export function binaryMaxBuy(
  walletWei: bigint,
  pendingWei: bigint,
  worstCaseGasWei: bigint,
  supplyRoomWei: bigint,
): bigint {
  if ([walletWei, pendingWei, worstCaseGasWei, supplyRoomWei].some((v) => v < 0n))
    throw new Error("binary: negative budget");
  const available = walletWei - BINARY_POLICY.walletReserveWei - pendingWei - worstCaseGasWei;
  return [available, BINARY_POLICY.buyMaxWei, supplyRoomWei].reduce((a, b) => (a < b ? a : b)) > 0n
    ? [available, BINARY_POLICY.buyMaxWei, supplyRoomWei].reduce((a, b) => (a < b ? a : b))
    : 0n;
}

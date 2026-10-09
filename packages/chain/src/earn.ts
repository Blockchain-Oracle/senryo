/**
 * Earn (D-287) for the apps, the relay and the keeper: the EIP-712 `EarnRequest` exactly as `PoolShares` hashes it
 * (domain "Senryo Earn" v1 on the share contract), and the calldata for a relayed request, the hourly roll and a claim.
 */
import type { ChainId } from "@senryo/config";
import { poolSharesAbi } from "@senryo/contracts/abis";
import { type Address, encodeFunctionData, type Hex } from "viem";
import { addressOf, isDeployed } from "./contracts.ts";
import { NO_PERMIT, type PermitArgs } from "./market-calls.ts";

export const EARN_DOMAIN_NAME = "Senryo Earn";
export const EARN_DOMAIN_VERSION = "1";

/** `PoolShares` request kinds. */
export const EARN_KIND = { supply: 1, withdraw: 2, cancelSupply: 3, cancelWithdraw: 4 } as const;
export type EarnKind = (typeof EARN_KIND)[keyof typeof EARN_KIND];

export const EARN_REQUEST_TYPES = {
  EarnRequest: [
    { name: "kind", type: "uint8" },
    { name: "owner", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "deadline", type: "uint64" },
    { name: "nonce", type: "uint256" },
  ],
} as const;

export interface EarnRequest {
  kind: EarnKind;
  owner: Address;
  amount: bigint;
  deadline: bigint;
  nonce: bigint;
}

/** Earn exists on this network once `PoolShares` is in the address book. */
export const earnDeployed = (chainId: ChainId): boolean => isDeployed(chainId, "PoolShares");

export function earnRequestTypedData(chainId: ChainId, r: EarnRequest) {
  return {
    domain: {
      name: EARN_DOMAIN_NAME,
      version: EARN_DOMAIN_VERSION,
      chainId,
      verifyingContract: addressOf(chainId, "PoolShares"),
    },
    types: EARN_REQUEST_TYPES,
    primaryType: "EarnRequest" as const,
    message: r,
  };
}

export function earnRequestCallData(r: EarnRequest, signature: Hex, permit: PermitArgs | null): Hex {
  return encodeFunctionData({
    abi: poolSharesAbi,
    functionName: "requestFor",
    args: [r, signature, permit ?? NO_PERMIT],
  });
}

export function rollCallData(hour: number): Hex {
  return encodeFunctionData({ abi: poolSharesAbi, functionName: "roll", args: [hour] });
}

export function claimEarnCallData(owner: Address): Hex {
  return encodeFunctionData({ abi: poolSharesAbi, functionName: "claim", args: [owner] });
}

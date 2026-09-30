import type { ChainId } from "@senryo/config";
import { CLAIM_TYPES, EIP712_DOMAINS, SPEND_ALLOWANCE_TYPES, TOPUP_TYPES, VOUCHER_TYPES } from "@senryo/core";
import { type Address, type Hex, keccak256, stringToBytes, stringToHex, verifyTypedData } from "viem";
import { addressOf } from "./contracts.ts";

/**
 * Off-chain verification of user signatures before a relay spends sponsor gas on them (the contract re-verifies).
 * Pure (no RPC): Mera accounts are EOAs, so plain ECDSA recovery is exact.
 */

export function starterDripDomain(chainId: ChainId) {
  return { ...EIP712_DOMAINS.starterDrip, chainId, verifyingContract: addressOf(chainId, "StarterDrip") } as const;
}

export function coreDomain(chainId: ChainId) {
  return { ...EIP712_DOMAINS.core, chainId, verifyingContract: addressOf(chainId, "SenryoCore") } as const;
}

/**
 * A malformed signature (bad length or v) makes viem THROW instead of returning false; a relay must answer 400
 * SIGNATURE_INVALID, not 500 (found smoking the top-up route, S8.16c). Every verifier here goes through this.
 */
async function verifiedOrFalse(params: Parameters<typeof verifyTypedData>[0]): Promise<boolean> {
  try {
    return await verifyTypedData(params);
  } catch {
    return false;
  }
}

/** `codeHash = keccak256(bytes(code))` exactly as `StarterDrip.redeemVoucher` hashes its `bytes code`. */
export function voucherCodeHash(code: string): Hex {
  return keccak256(stringToBytes(code));
}

export function voucherCodeBytes(code: string): Hex {
  return stringToHex(code);
}

export function verifyClaimSignature(params: {
  chainId: ChainId;
  user: Address;
  deadline: bigint;
  signature: Hex;
}): Promise<boolean> {
  return verifiedOrFalse({
    address: params.user,
    domain: starterDripDomain(params.chainId),
    types: CLAIM_TYPES,
    primaryType: "Claim",
    message: { user: params.user, deadline: params.deadline },
    signature: params.signature,
  });
}

/** The off-chain gas top-up authorisation (S8.16c): same StarterDrip domain, a type the contract never accepts. */
export function verifyTopUpSignature(params: {
  chainId: ChainId;
  user: Address;
  needWei: bigint;
  deadline: bigint;
  signature: Hex;
}): Promise<boolean> {
  return verifiedOrFalse({
    address: params.user,
    domain: starterDripDomain(params.chainId),
    types: TOPUP_TYPES,
    primaryType: "TopUp",
    message: { user: params.user, needWei: params.needWei, deadline: params.deadline },
    signature: params.signature,
  });
}

export function verifyVoucherSignature(params: {
  chainId: ChainId;
  user: Address;
  code: string;
  deadline: bigint;
  signature: Hex;
}): Promise<boolean> {
  return verifiedOrFalse({
    address: params.user,
    domain: starterDripDomain(params.chainId),
    types: VOUCHER_TYPES,
    primaryType: "Voucher",
    message: { user: params.user, codeHash: voucherCodeHash(params.code), deadline: params.deadline },
    signature: params.signature,
  });
}

export function verifySpendAllowanceSignature(params: {
  chainId: ChainId;
  user: Address;
  dailyLimit: bigint;
  expiry: bigint;
  nonce: bigint;
  signature: Hex;
}): Promise<boolean> {
  return verifiedOrFalse({
    address: params.user,
    domain: coreDomain(params.chainId),
    types: SPEND_ALLOWANCE_TYPES,
    primaryType: "SpendAllowance",
    message: { user: params.user, dailyLimit: params.dailyLimit, expiry: params.expiry, nonce: params.nonce },
    signature: params.signature,
  });
}

/**
 * EIP-712 types exactly as the contracts declare them (read from source, not invented):
 *  - contracts/src/periphery/StarterDrip.sol — `EIP712("SenryoStarterDrip", "1")`,
 *    `Claim(address user,uint64 deadline)`, `Voucher(address user,bytes32 codeHash,uint64 deadline)`
 *  - contracts/src/core/CoreStorage.sol + TriggerOrders.sol — `EIP712("SenryoCore", "1")`, `TriggerOrder(...)`
 * `checks/starter.check.ts` re-derives the type strings from the .sol files and compares digests.
 */
import type { ChainId } from "@senryo/config";
import type { Address, Hex, TypedDataDefinition } from "viem";
import { keccak256, toHex } from "viem";
import { STARTER_DEADLINE_SECONDS } from "../constants.ts";
import { scopeTargets } from "../policy/targets.ts";

export const STARTER_DOMAIN = { name: "SenryoStarterDrip", version: "1" } as const;
export const TRIGGER_DOMAIN = { name: "SenryoCore", version: "1" } as const;

export const CLAIM_TYPES = {
  Claim: [
    { name: "user", type: "address" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

export const VOUCHER_TYPES = {
  Voucher: [
    { name: "user", type: "address" },
    { name: "codeHash", type: "bytes32" },
    { name: "deadline", type: "uint64" },
  ],
} as const;

/** What the relay needs to call `StarterDrip.claimFor(user, deadline, signature)`. */
export interface SignedClaim {
  chainId: ChainId;
  user: Address;
  deadline: bigint;
  signature: Hex;
}

/** What the relay needs to call `StarterDrip.redeemVoucher(user, bytes(code), deadline, signature)`. */
export interface SignedVoucher extends SignedClaim {
  /** Canonical voucher text (D-143); the relay sends its UTF-8 bytes, the contract hashes them. */
  code: string;
}

/** Canonical voucher text (D-143; S3 relay schema `/^[A-Z0-9-]{6,32}$/`). */
export const VOUCHER_CODE = /^[A-Z0-9-]{6,32}$/;

/** Trim + upper-case; `undefined` when the result is not a valid code (the field shows "Check the code"). */
export function canonicalVoucherCode(input: string): string | undefined {
  const code = input.trim().toUpperCase();
  return VOUCHER_CODE.test(code) ? code : undefined;
}

function starterDomain(chainId: ChainId) {
  const verifyingContract = scopeTargets(chainId).starterDrip;
  if (!verifyingContract) throw new Error(`StarterDrip is not deployed on chain ${chainId}`);
  return { ...STARTER_DOMAIN, chainId, verifyingContract };
}

/** Deadline in unix seconds (the contract compares against `block.timestamp`). */
export function starterDeadline(nowMs: number): bigint {
  const MS_PER_SECOND = 1000n;
  return BigInt(nowMs) / MS_PER_SECOND + STARTER_DEADLINE_SECONDS;
}

export function claimTypedData(chainId: ChainId, user: Address, deadline: bigint) {
  return {
    domain: starterDomain(chainId),
    types: CLAIM_TYPES,
    primaryType: "Claim",
    message: { user, deadline },
  } as const satisfies TypedDataDefinition;
}

/** The bytes the contract hashes: UTF-8 of the canonical text, so "gold-12" and "GOLD-12" are one voucher. */
export function voucherCodeBytes(code: string): Hex {
  return toHex(code.trim().toUpperCase());
}

export function voucherTypedData(chainId: ChainId, user: Address, code: Hex, deadline: bigint) {
  return {
    domain: starterDomain(chainId),
    types: VOUCHER_TYPES,
    primaryType: "Voucher",
    message: { user, codeHash: keccak256(code), deadline },
  } as const satisfies TypedDataDefinition;
}

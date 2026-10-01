/**
 * Starter funds (D-030, F05): the user signs StarterDrip's EIP-712 `Claim` / `Voucher` with the *scoped* signer — in
 * scope, so no prompt inside a live session (one unlock prompt when locked) — and the sponsor relays `claimFor` /
 * `redeemVoucher` (S3 `POST /v1/starter/claim`). The user never needs gas.
 */
import type { ChainId } from "@senryo/config";
import type { LocalAccount } from "viem";
import {
  canonicalVoucherCode,
  claimTypedData,
  type SignedClaim,
  type SignedTopUp,
  type SignedVoucher,
  starterDeadline,
  topUpTypedData,
  voucherCodeBytes,
  voucherTypedData,
} from "./typed-data.ts";

export async function signStarterClaim(signer: LocalAccount, chainId: ChainId, nowMs: number): Promise<SignedClaim> {
  if (!signer.signTypedData) throw new Error("Signer cannot sign typed data");
  const deadline = starterDeadline(nowMs);
  const signature = await signer.signTypedData(claimTypedData(chainId, signer.address, deadline));
  return { chainId, user: signer.address, deadline, signature };
}

export async function signVoucher(
  signer: LocalAccount,
  chainId: ChainId,
  code: string,
  nowMs: number,
): Promise<SignedVoucher> {
  if (!signer.signTypedData) throw new Error("Signer cannot sign typed data");
  const canonical = canonicalVoucherCode(code);
  if (canonical === undefined) throw new RangeError("Voucher codes are 6–32 letters, digits or dashes");
  const deadline = starterDeadline(nowMs);
  const bytes = voucherCodeBytes(canonical);
  const signature = await signer.signTypedData(voucherTypedData(chainId, signer.address, bytes, deadline));
  return { chainId, user: signer.address, deadline, signature, code: canonical };
}

/** Gas top-up authorisation (S8.16c): in scope for the session like Claim, so no prompt while unlocked. */
export async function signStarterTopUp(
  signer: LocalAccount,
  chainId: ChainId,
  needWei: bigint,
  nowMs: number,
): Promise<SignedTopUp> {
  if (!signer.signTypedData) throw new Error("Signer cannot sign typed data");
  const deadline = starterDeadline(nowMs);
  const signature = await signer.signTypedData(topUpTypedData(chainId, signer.address, needWei, deadline));
  return { chainId, user: signer.address, needWei, deadline, signature };
}

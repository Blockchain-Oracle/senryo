/**
 * Starter funds (D-030, F05): the user signs StarterDrip's EIP-712 `Claim` / `Voucher` with the *scoped* signer — in
 * scope, so no prompt inside a live session (one unlock prompt when locked) — and the sponsor relays `claimFor` /
 * `redeemVoucher` (S3 `POST /v1/starter/claim`). The user never needs gas.
 */
import type { ChainId } from "@senryo/config";
import type { LocalAccount } from "viem";
import {
  claimTypedData,
  type SignedClaim,
  type SignedVoucher,
  starterDeadline,
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
  const deadline = starterDeadline(nowMs);
  const bytes = voucherCodeBytes(code);
  const signature = await signer.signTypedData(voucherTypedData(chainId, signer.address, bytes, deadline));
  return { chainId, user: signer.address, deadline, signature, code: bytes };
}

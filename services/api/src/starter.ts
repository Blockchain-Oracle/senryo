import { randomUUID } from "node:crypto";
import type { ApiErrorCode, RelayResponse } from "@senryo/api-client";
import {
  type Address,
  confirmFinalized,
  contractCall,
  describeError,
  GasAboveCapError,
  type Hex,
  readContract,
  SimulationRevertedError,
  sendTx,
  voucherCodeBytes,
  voucherCodeHash,
} from "@senryo/chain";
import { TESTNET_CHAIN_ID } from "@senryo/config";
import { HTTP_STATUS, HttpError } from "@senryo/service-common";
import type { ApiContext, ChainContext } from "./context.ts";

/** Revert → client error (flows.md F05 failure copy keys off these codes). */
const REVERT_CODES: Record<string, [number, ApiErrorCode]> = {
  AlreadyClaimed: [HTTP_STATUS.conflict, "ALREADY_CLAIMED"],
  DeadlinePassed: [HTTP_STATUS.badRequest, "SIGNATURE_EXPIRED"],
  InvalidSignature: [HTTP_STATUS.badRequest, "SIGNATURE_INVALID"],
  BudgetExceeded: [HTTP_STATUS.unavailable, "BUDGET_EXHAUSTED"],
  NativeTransferFailed: [HTTP_STATUS.unavailable, "BUDGET_EXHAUSTED"],
  UnknownVoucher: [HTTP_STATUS.notFound, "VOUCHER_INVALID"],
  VoucherCapReached: [HTTP_STATUS.gone, "VOUCHER_CAP_REACHED"],
  AccessManagedUnauthorized: [HTTP_STATUS.unavailable, "RELAYER_BUSY"],
};

export interface StarterConfig {
  dripWei: bigint;
  dailyBudgetWei: bigint;
  practiceAmount: bigint;
  voucherAmount: bigint;
  maxVouchers: bigint;
}

export async function starterConfig(chain: ChainContext): Promise<StarterConfig> {
  const drip = readContract(chain.chainId, "StarterDrip", chain.read);
  const [dripWei, dailyBudgetWei, , , practiceAmount, , voucherAmount, maxVouchers] = await drip.read.config();
  return { dripWei, dailyBudgetWei, practiceAmount, voucherAmount, maxVouchers };
}

interface RelayInput {
  kind: "claim" | "voucher";
  user: Address;
  deadline: bigint;
  signature: Hex;
  code?: string | undefined;
  ipPrefix: string;
  deviceHash: string | undefined;
}

/**
 * Relay a user-signed claim/voucher with the sponsor key: simulate (estimate) → send → answer at `proposed`; the
 * row follows to `finalized` in the background (poll `/v1/starter/relays/:id`). Nothing is sent if simulation reverts.
 */
export async function relay(ctx: ApiContext, chain: ChainContext, input: RelayInput): Promise<RelayResponse> {
  if (!chain.sponsor) throw new HttpError(HTTP_STATUS.unavailable, "RELAYER_BUSY", "no sponsor key configured");
  const practice = chain.chainId === TESTNET_CHAIN_ID;
  const request =
    input.kind === "claim"
      ? contractCall(
          chain.chainId,
          "StarterDrip",
          "claimFor",
          [input.user, input.deadline, input.signature],
          practice ? "claimForPractice" : "claimFor",
        )
      : contractCall(
          chain.chainId,
          "StarterDrip",
          "redeemVoucher",
          [input.user, voucherCodeBytes(input.code ?? ""), input.deadline, input.signature],
          "redeemVoucher",
        );
  const config = await starterConfig(chain);
  const relayId = randomUUID();
  const createdAt = new Date();
  let sent: Awaited<ReturnType<typeof sendTx>>;
  try {
    sent = await sendTx(chain.sponsor, request);
  } catch (error) {
    if (error instanceof SimulationRevertedError) {
      const [status, code] = REVERT_CODES[error.revert?.name ?? ""] ?? [HTTP_STATUS.badGateway, "RELAY_REVERTED"];
      throw new HttpError(status, code, error.revert?.message ?? "relay would revert");
    }
    ctx.log.warn({ err: describeError(error), user: input.user, kind: input.kind }, "relay not sent");
    if (error instanceof GasAboveCapError) throw new HttpError(HTTP_STATUS.badGateway, "RELAY_REVERTED", error.message);
    throw new HttpError(HTTP_STATUS.unavailable, "RELAYER_BUSY", "relay broadcast failed; nothing to retry yet");
  }
  const nativeWei = input.kind === "claim" ? config.dripWei : 0n;
  const creditUsd6 = input.kind === "claim" ? (practice ? config.practiceAmount : 0n) : config.voucherAmount;
  await ctx.db`
    INSERT INTO starter_claims (id, kind, chain_id, user_address, code_hash, tx_hash, stage, block_number, native_wei,
                                credit_usd6, ip_prefix, device_hash, created_at)
    VALUES (${relayId}, ${input.kind}, ${chain.chainId}, ${input.user.toLowerCase()}, ${input.code ? voucherCodeHash(input.code) : null}, ${sent.hash},
            ${sent.stage}, ${sent.receipt.blockNumber}, ${nativeWei.toString()}, ${creditUsd6}, ${input.ipPrefix},
            ${input.deviceHash ?? null}, ${createdAt})`;
  void confirmFinalized({ read: chain.read, heads: chain.heads }, sent.receipt)
    .then((final) => ctx.db`UPDATE starter_claims SET stage = ${final.stage}, updated_at = now() WHERE id = ${relayId}`)
    .catch((error) => ctx.log.warn({ relayId, err: String(error) }, "relay finality unknown"));
  return {
    relayId,
    kind: input.kind,
    chainId: chain.chainId,
    user: input.user,
    txHash: sent.hash,
    stage: sent.stage,
    blockNumber: sent.receipt.blockNumber,
    nativeWei,
    creditUsd6,
    createdAt: createdAt.toISOString(),
  };
}

interface ClaimRow {
  id: string;
  kind: "claim" | "voucher";
  chain_id: number;
  user_address: string;
  tx_hash: string;
  stage: string;
  block_number: bigint | null;
  native_wei: string;
  credit_usd6: bigint;
  created_at: Date;
}

export function relayFromRow(row: ClaimRow): RelayResponse {
  return {
    relayId: row.id,
    kind: row.kind,
    chainId: row.chain_id as RelayResponse["chainId"],
    user: row.user_address as Address,
    txHash: row.tx_hash as Hex,
    stage: row.stage as RelayResponse["stage"],
    blockNumber: row.block_number,
    nativeWei: BigInt(row.native_wei),
    creditUsd6: row.credit_usd6,
    createdAt: row.created_at.toISOString(),
  };
}

export type { ClaimRow };

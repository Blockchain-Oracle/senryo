/**
 * The Kinpaku spend allowance onchain (CardModule): the daily limit the card operator may draw within, until an
 * expiry, from Free to spend only. Setting it needs the user's EIP-712 `SpendAllowance` signature (a card setting:
 * always behind a fresh passkey check) and may be sent by anyone; revoking it is the card freeze (D-039) — a
 * direct call that only ever lowers what can be spent, so it is in session scope.
 */
import { addressOf, CONTRACT_ABIS, contractCall, coreDomain, type ReadClient, type TxRequest } from "@senryo/chain";
import { type ChainId, positionGasLimit } from "@senryo/config";
import { type Address, SPEND_ALLOWANCE_TYPES } from "@senryo/core";

/** What the allowance is right now, from the account snapshot's three fields. */
export type AllowanceState =
  | { kind: "off" }
  | { kind: "expired"; dailyLimitUsd6: bigint }
  | { kind: "live"; dailyLimitUsd6: bigint; leftUsd6: bigint; expiresAtSec: bigint };

export function allowanceState(dailyLimit: bigint, expiry: bigint, left: bigint, nowSec: bigint): AllowanceState {
  if (dailyLimit === 0n) return { kind: "off" };
  if (expiry <= nowSec) return { kind: "expired", dailyLimitUsd6: dailyLimit };
  return { kind: "live", dailyLimitUsd6: dailyLimit, leftUsd6: left, expiresAtSec: expiry };
}

/** The core's per-user allowance nonce, which the next signature must carry. */
export async function readAllowanceNonce(read: ReadClient, chainId: ChainId, user: Address): Promise<bigint> {
  const nonce = await read.readContract({
    address: addressOf(chainId, "SenryoCore"),
    abi: CONTRACT_ABIS.SenryoCore,
    functionName: "allowanceNonce",
    args: [user],
  });
  return BigInt(nonce as bigint | number);
}

export function spendAllowanceTypedData(
  chainId: ChainId,
  user: Address,
  dailyLimitUsd6: bigint,
  expirySec: bigint,
  nonce: bigint,
) {
  return {
    domain: coreDomain(chainId),
    types: SPEND_ALLOWANCE_TYPES,
    primaryType: "SpendAllowance" as const,
    message: { user, dailyLimit: dailyLimitUsd6, expiry: expirySec, nonce },
  };
}

export function setSpendAllowanceRequest(
  chainId: ChainId,
  user: Address,
  dailyLimitUsd6: bigint,
  expirySec: bigint,
  signature: `0x${string}`,
  positions: number,
): TxRequest {
  return contractCall(
    chainId,
    "SenryoCore",
    "setSpendAllowance",
    [user, dailyLimitUsd6, expirySec, signature],
    "setSpendAllowance",
    { gasCap: positionGasLimit("setSpendAllowance", positions), meta: { kind: "setSpendAllowance" } },
  );
}

/**
 * Repay card debt from the trading-account balance (E4, CardModule.repayCardDebt; the contract caps it at the debt).
 * Session scope ("card-safe"): it only ever lowers a liability. The card service's `/v1/card/repay-quote` returns the
 * same call; build it here and compare before signing.
 */
export function repayCardDebtRequest(chainId: ChainId, amountUsd6: bigint, positions: number): TxRequest {
  return contractCall(chainId, "SenryoCore", "repayCardDebt", [amountUsd6], "repayCardDebt", {
    gasCap: positionGasLimit("repayCardDebt", positions),
    meta: { kind: "repayCardDebt" },
  });
}

/** The freeze: the daily limit and expiry go to zero; the card can't spend until a new limit is signed. */
export function revokeSpendAllowanceRequest(chainId: ChainId, positions: number): TxRequest {
  return contractCall(chainId, "SenryoCore", "revokeSpendAllowance", [], "revokeSpendAllowance", {
    gasCap: positionGasLimit("revokeSpendAllowance", positions),
    meta: { kind: "revokeSpendAllowance" },
  });
}

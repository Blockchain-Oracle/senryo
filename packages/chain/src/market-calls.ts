/**
 * Calldata for every market call and the decoding of their receipts — in one place, so services never import viem
 * (invariant `viem-import-boundary`): commit, finalize, expire, claimFor, session grant / revoke, the Practice mint, and
 * the reserve's events as ticket changes (the services' ticket book follows exactly what the chain emitted).
 */
import { bandReserveAbi, testUSDAbi } from "@senryo/contracts/abis";
import {
  type Address,
  decodeErrorResult,
  decodeEventLog,
  encodeFunctionData,
  type Hex,
  type Log,
  zeroHash,
} from "viem";
import { ALL_ERRORS_ABI } from "./contracts.ts";
import type { MarketIntent, MarketSessionGrant } from "./market-typed-data.ts";

export interface PermitArgs {
  value: bigint;
  deadline: bigint;
  v: number;
  r: Hex;
  s: Hex;
}

export const NO_PERMIT: PermitArgs = { value: 0n, deadline: 0n, v: 0, r: zeroHash, s: zeroHash };

export function commitCallData(intent: MarketIntent, signature: Hex, permit: PermitArgs | null): Hex {
  return encodeFunctionData({
    abi: bandReserveAbi,
    functionName: "commit",
    args: [intent, signature, permit ?? NO_PERMIT],
  });
}

export function finalizeCallData(target: number, ids: readonly bigint[], proof: Hex): Hex {
  return encodeFunctionData({ abi: bandReserveAbi, functionName: "finalize", args: [target, [...ids], proof] });
}

export function expireCallData(ids: readonly bigint[]): Hex {
  return encodeFunctionData({ abi: bandReserveAbi, functionName: "expire", args: [[...ids]] });
}

export function claimForCallData(ids: readonly bigint[]): Hex {
  return encodeFunctionData({ abi: bandReserveAbi, functionName: "claimFor", args: [[...ids]] });
}

export function grantSessionCallData(grant: MarketSessionGrant, signature: Hex, permit: PermitArgs | null): Hex {
  return encodeFunctionData({
    abi: bandReserveAbi,
    functionName: "grantSession",
    args: [{ ...grant, expiry: Number(grant.expiry) }, signature, permit ?? NO_PERMIT],
  });
}

export function revokeCallData(owner: Address, nonce: bigint, deadline: bigint, signature: Hex): Hex {
  return encodeFunctionData({
    abi: bandReserveAbi,
    functionName: "revokeBySig",
    args: [owner, nonce, deadline, signature],
  });
}

export function mintDollarsCallData(to: Address, amount: bigint): Hex {
  return encodeFunctionData({ abi: testUSDAbi, functionName: "mint", args: [to, amount] });
}

/** A revert's name and arguments from raw return data (one of our contracts', or "reverted"). */
export function revertReason(returnData: Hex): string {
  try {
    const e = decodeErrorResult({ abi: ALL_ERRORS_ABI, data: returnData });
    return `${e.errorName}(${(e.args ?? []).map(String).join(", ")})`;
  } catch {
    return "reverted";
  }
}

export type TicketChange =
  | { kind: "committed"; ticketId: bigint; owner: Address; windowId: Hex; band: number; stake: bigint; target: number }
  | { kind: "filled"; ticketId: bigint; payout: bigint; stake: bigint; entryE8: bigint }
  | { kind: "refused"; ticketId: bigint; reason: number; refunded: bigint }
  | { kind: "closing"; ticketId: bigint; shares: bigint; target: number }
  | { kind: "closed"; ticketId: bigint; shares: bigint; proceeds: bigint; basisOut: bigint }
  | { kind: "closeRefused"; ticketId: bigint; reason: number }
  | { kind: "claimed"; ticketId: bigint; outcome: number; amount: bigint };

/** The reserve's events in a receipt, in order, as ticket changes (other contracts' logs are ignored). */
export function ticketChanges(logs: readonly Log[], reserve: Address): TicketChange[] {
  const out: TicketChange[] = [];
  for (const log of logs) {
    if (log.address.toLowerCase() !== reserve.toLowerCase()) continue;
    let e: ReturnType<typeof decodeEventLog<typeof bandReserveAbi>>;
    try {
      e = decodeEventLog({ abi: bandReserveAbi, data: log.data, topics: log.topics });
    } catch {
      continue;
    }
    const a = e.args as Record<string, unknown>;
    const ticketId = a.ticketId as bigint;
    switch (e.eventName) {
      case "Committed":
        out.push({
          kind: "committed",
          ticketId,
          owner: a.owner as Address,
          windowId: a.windowId as Hex,
          band: Number(a.band),
          stake: a.stake as bigint,
          target: Number(a.target),
        });
        break;
      case "Filled":
        out.push({
          kind: "filled",
          ticketId,
          payout: a.payout as bigint,
          stake: a.stake as bigint,
          entryE8: a.entryE8 as bigint,
        });
        break;
      case "Refused":
        out.push({ kind: "refused", ticketId, reason: Number(a.reason), refunded: a.refunded as bigint });
        break;
      case "CloseCommitted":
        out.push({ kind: "closing", ticketId, shares: a.shares as bigint, target: Number(a.target) });
        break;
      case "Closed":
        out.push({
          kind: "closed",
          ticketId,
          shares: a.shares as bigint,
          proceeds: a.proceeds as bigint,
          basisOut: a.basisOut as bigint,
        });
        break;
      case "CloseRefused":
        out.push({ kind: "closeRefused", ticketId, reason: Number(a.reason) });
        break;
      case "Claimed":
        out.push({ kind: "claimed", ticketId, outcome: Number(a.outcome), amount: a.amount as bigint });
        break;
      default:
        break;
    }
  }
  return out;
}

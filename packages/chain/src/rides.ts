/**
 * Rides (D-299, D-301, R3): calldata for every ride action and the reserve's ride events as changes, in one place, so
 * the services never import viem (invariant `viem-import-boundary`) and their ride book follows exactly what the
 * chain emitted. A ride's exit events arrive here (`book` 2); a call's are `ticketChanges`'.
 */
import { bandReserveAbi, windowsAbi } from "@senryo/contracts/abis";
import { type Address, decodeEventLog, encodeFunctionData, type Hex, type Log } from "viem";
import { NO_PERMIT, type PermitArgs } from "./market-calls.ts";
import { EXIT_BOOK } from "./market-typed-data.ts";
import type { RideIntent } from "./ride-typed-data.ts";

/** A ride's sides (contracts `SIDE_LONG`, `SIDE_SHORT`). */
export const RIDE_SIDE = { long: 0, short: 1 } as const;

/** A ride's states on chain (contracts `RIDE_*`); `RideExited.how` is the state it leaves the ride in. */
export const RIDE_STATE = {
  committed: 1,
  open: 2,
  closed: 3,
  knockedOut: 4,
  capped: 5,
  ended: 6,
  refunded: 7,
} as const;

export function commitRideCallData(intent: RideIntent, signature: Hex, permit: PermitArgs | null): Hex {
  return encodeFunctionData({
    abi: bandReserveAbi,
    functionName: "commitRide",
    args: [intent, signature, permit ?? NO_PERMIT],
  });
}

/** Fills every pending open or close in `ids` (one market) at `target`'s print — no σ: a ride enters at the print. */
export function finalizeRidesCallData(target: number, ids: readonly bigint[], proof: Hex): Hex {
  return encodeFunctionData({ abi: bandReserveAbi, functionName: "finalizeRides", args: [target, [...ids], proof] });
}

export function expireRidesCallData(ids: readonly bigint[]): Hex {
  return encodeFunctionData({ abi: bandReserveAbi, functionName: "expireRides", args: [[...ids]] });
}

/** Settles every ride in `ids` (one market) whose knock-out or cap the print of `t` crossed. */
export function settleBoundsCallData(t: number, ids: readonly bigint[], proof: Hex): Hex {
  return encodeFunctionData({ abi: bandReserveAbi, functionName: "settleBounds", args: [t, [...ids], proof] });
}

/** Settles every ride in `ids` (one market) whose life ends at `end`, at that print. */
export function settleEndsCallData(end: number, ids: readonly bigint[], proof: Hex): Hex {
  return encodeFunctionData({ abi: bandReserveAbi, functionName: "settleEnds", args: [end, [...ids], proof] });
}

/** Tightens a side's frontier to its open rides' bounds: `ids` is every open ride of the side, ascending. */
export function refreshFrontierCallData(marketId: number, side: number, ids: readonly bigint[]): Hex {
  return encodeFunctionData({
    abi: bandReserveAbi,
    functionName: "refreshFrontier",
    args: [marketId, side, [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))],
  });
}

export function fireRideExitCallData(rideId: bigint): Hex {
  return encodeFunctionData({ abi: bandReserveAbi, functionName: "fireRideExit", args: [rideId] });
}

export function fireRideTrailCallData(rideId: bigint): Hex {
  return encodeFunctionData({ abi: bandReserveAbi, functionName: "fireRideTrail", args: [rideId] });
}

/** Records `(verifier, feedId, t)`'s print unless it already is (`Windows.ensurePrint`). */
export function ensurePrintCallData(verifier: Address, feedId: Hex, t: number, proof: Hex): Hex {
  return encodeFunctionData({ abi: windowsAbi, functionName: "ensurePrint", args: [verifier, feedId, t, proof] });
}

export type RideChange =
  | {
      kind: "rideCommitted";
      rideId: bigint;
      owner: Address;
      marketId: number;
      isLong: boolean;
      margin: bigint;
      leverageBps: number;
      openFee: bigint;
      limitE8: bigint;
      target: number;
    }
  | {
      kind: "rideFilled";
      rideId: bigint;
      entryE8: bigint;
      size: bigint;
      reserve: bigint;
      openFee: bigint;
      koE8: bigint;
      capE8: bigint;
    }
  | { kind: "rideRefused"; rideId: bigint; reason: number; refunded: bigint }
  | { kind: "rideClosing"; rideId: bigint; size: bigint; limitE8: bigint; target: number }
  | { kind: "rideCloseRefused"; rideId: bigint; reason: number }
  | {
      kind: "rideExited";
      rideId: bigint;
      /** The state the exit leaves the ride in: `RIDE_STATE.open` for a part, else how it ended. */
      how: number;
      size: bigint;
      exitE8: bigint;
      pnl: bigint;
      fees: bigint;
      paid: bigint;
      keeperFee: bigint;
    }
  | { kind: "rideExitSet"; rideId: bigint; takeProfit: bigint; stopLoss: bigint; floor: bigint; trail: bigint }
  | { kind: "rideExitFired"; rideId: bigint; exitKind: number; target: number };

/** The reserve's ride events in a receipt, in order (other contracts' and the calls' logs are ignored). */
export function rideChanges(logs: readonly Log[], reserve: Address): RideChange[] {
  const out: RideChange[] = [];
  for (const log of logs) {
    if (log.address.toLowerCase() !== reserve.toLowerCase()) continue;
    let e: ReturnType<typeof decodeEventLog<typeof bandReserveAbi>>;
    try {
      e = decodeEventLog({ abi: bandReserveAbi, data: log.data, topics: log.topics });
    } catch {
      continue;
    }
    switch (e.eventName) {
      case "RideCommitted": {
        const a = e.args;
        out.push({
          kind: "rideCommitted",
          rideId: a.rideId,
          owner: a.owner,
          marketId: a.marketId,
          isLong: a.isLong,
          margin: a.margin,
          leverageBps: a.leverageBps,
          openFee: a.openFee,
          limitE8: a.worstPriceE8,
          target: a.target,
        });
        break;
      }
      case "RideFilled": {
        const a = e.args;
        out.push({
          kind: "rideFilled",
          rideId: a.rideId,
          entryE8: a.entryE8,
          size: a.size,
          reserve: a.reserve,
          openFee: a.openFee,
          koE8: a.koE8,
          capE8: a.capE8,
        });
        break;
      }
      case "RideRefused":
        out.push({ kind: "rideRefused", rideId: e.args.rideId, reason: e.args.reason, refunded: e.args.refunded });
        break;
      case "RideCloseCommitted": {
        const a = e.args;
        out.push({ kind: "rideClosing", rideId: a.rideId, size: a.size, limitE8: a.worstPriceE8, target: a.target });
        break;
      }
      case "RideCloseRefused":
        out.push({ kind: "rideCloseRefused", rideId: e.args.rideId, reason: e.args.reason });
        break;
      case "RideExited": {
        const a = e.args;
        out.push({
          kind: "rideExited",
          rideId: a.rideId,
          how: a.how,
          size: a.size,
          exitE8: a.exitE8,
          pnl: a.pnl,
          fees: a.fees,
          paid: a.paid,
          keeperFee: a.keeperFee,
        });
        break;
      }
      case "ExitSet": {
        const a = e.args;
        if (a.book !== EXIT_BOOK.ride) break;
        out.push({
          kind: "rideExitSet",
          rideId: a.id,
          takeProfit: a.takeProfit,
          stopLoss: a.stopLoss,
          floor: a.floor,
          trail: a.trail,
        });
        break;
      }
      case "ExitFired":
        if (e.args.book !== EXIT_BOOK.ride) break;
        out.push({ kind: "rideExitFired", rideId: e.args.id, exitKind: e.args.kind, target: e.args.target });
        break;
      default:
        break;
    }
  }
  return out;
}

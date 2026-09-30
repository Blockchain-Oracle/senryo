import { BaseError, decodeErrorResult, type Hex } from "viem";
import { ALL_ERRORS_ABI } from "./contracts.ts";

/** A revert decoded against every Senryo ABI (e.g. `{ name: "InsufficientFreeCollateral", args: [-5n] }`). */
export interface DecodedRevert {
  name: string;
  args: readonly unknown[];
  /** One-line technical text (logs, "Technical details"); never a secret. */
  message: string;
}

const HEX_DATA = /^0x[0-9a-fA-F]{8,}$/;

function revertData(error: unknown): Hex | undefined {
  if (!(error instanceof BaseError)) return undefined;
  let found: Hex | undefined;
  error.walk((cause) => {
    const data = (cause as { data?: unknown }).data;
    const hex = typeof data === "string" ? data : (data as { data?: unknown } | undefined)?.data;
    if (typeof hex === "string" && HEX_DATA.test(hex)) {
      found = hex as Hex;
      return true;
    }
    return false;
  });
  return found;
}

/** Decode a revert from a failed call/estimate/send; undefined when the error is not a contract revert. */
export function decodeRevert(error: unknown): DecodedRevert | undefined {
  const data = revertData(error);
  if (!data) return undefined;
  try {
    const decoded = decodeErrorResult({ abi: ALL_ERRORS_ABI, data });
    const args = decoded.args ?? [];
    return { name: decoded.errorName, args, message: `${decoded.errorName}(${args.map(String).join(", ")})` };
  } catch {
    return { name: "UnknownRevert", args: [data], message: `revert ${data.slice(0, 10)}` };
  }
}

/** Short, log-safe description of any error. */
export function describeError(error: unknown): string {
  const revert = decodeRevert(error);
  if (revert) return revert.message;
  if (error instanceof BaseError) return error.shortMessage;
  return error instanceof Error ? error.message : String(error);
}

/** The estimate alone exceeds the action's budget: refuse (Monad would charge the whole limit). */
export class GasAboveCapError extends Error {
  constructor(
    readonly action: string,
    readonly estimate: bigint,
    readonly cap: bigint,
  ) {
    super(`${action}: estimate ${estimate} above gas budget ${cap}`);
    this.name = "GasAboveCapError";
  }
}

/** The simulation (eth_estimateGas) reverted; nothing was sent. */
export class SimulationRevertedError extends Error {
  constructor(
    readonly action: string,
    readonly revert: DecodedRevert | undefined,
    cause: unknown,
  ) {
    super(`${action} would revert: ${revert?.message ?? describeError(cause)}`, { cause });
    this.name = "SimulationRevertedError";
  }
}

/** No RPC accepted the signed tx and no receipt appeared. Outcome unknown → journal + reconcile, never re-sign. */
export class BroadcastError extends Error {
  constructor(
    readonly hash: Hex,
    cause: unknown,
  ) {
    super(`broadcast of ${hash} failed: ${describeError(cause)}`, { cause });
    this.name = "BroadcastError";
  }
}

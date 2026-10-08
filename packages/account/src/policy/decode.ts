/**
 * Calldata → `Action`, decoded against the real ABIs (`decodeFunctionData`). Amounts, destinations and spenders come
 * from the calldata itself; nothing the caller claims is trusted.
 */
import { type Address, decodeFunctionData, erc20Abi, type Hex, isHex, size, slice } from "viem";
import { includesAddress, type ScopeTargets } from "./targets.ts";
import type { Action } from "./types.ts";

const SELECTOR_BYTES = 4;

export interface CallInput {
  to: Address | undefined;
  data: Hex | undefined;
  value: bigint;
  hasAuthorizationList: boolean;
}

function selectorOf(data: Hex | undefined): string {
  return data && isHex(data) && size(data) >= SELECTOR_BYTES ? slice(data, 0, SELECTOR_BYTES) : "0x";
}

const unknown = (call: CallInput): Action => ({ kind: "unknown", to: call.to, selector: selectorOf(call.data) });

function decodeDollar(call: CallInput, data: Hex, t: ScopeTargets): Action {
  try {
    const fn = decodeFunctionData({ abi: erc20Abi, data });
    const token = call.to as Address;
    if (fn.functionName === "transfer") {
      const [to, amount] = fn.args;
      return { kind: "transfer", token, to, amountUsd6: amount };
    }
    if (fn.functionName === "approve") {
      const [spender, amount] = fn.args;
      return {
        kind: "approve",
        token,
        spender,
        amountUsd6: amount,
        spenderKnown: includesAddress(t.spenders, spender),
      };
    }
  } catch {
    /* not an ERC-20 call */
  }
  return unknown(call);
}

/** Decode one call; anything we don't recognise is `unknown` (never signed in session). */
export function decodeCall(call: CallInput, _self: Address, t: ScopeTargets): Action {
  if (call.hasAuthorizationList) return { kind: "delegation" };
  if (call.to === undefined) return unknown(call);
  if (call.value > 0n && (call.data === undefined || call.data === "0x")) {
    return { kind: "native-send", to: call.to, valueWei: call.value };
  }
  if (call.data && isHex(call.data) && includesAddress(t.dollars, call.to)) return decodeDollar(call, call.data, t);
  return unknown(call);
}

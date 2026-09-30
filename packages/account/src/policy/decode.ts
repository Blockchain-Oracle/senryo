/**
 * Calldata → `Action`, decoded against the real ABIs in `@senryo/contracts` (`decodeFunctionData`). Notional,
 * amounts, destinations and receivers come from the calldata itself; nothing the caller claims is trusted.
 */
import { lpVaultAbi, mockAUSDAbi, senryoCoreAbi } from "@senryo/contracts";
import { type Abi, type Address, decodeFunctionData, type Hex, isHex, size, slice } from "viem";
import { includesAddress, type ScopeTargets, sameAddress } from "./targets.ts";
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

function decode(abi: Abi, data: Hex): { functionName: string; args: readonly unknown[] } | undefined {
  try {
    const out = decodeFunctionData({ abi, data });
    return { functionName: out.functionName, args: out.args ?? [] };
  } catch {
    return undefined;
  }
}

const unknown = (call: CallInput): Action => ({ kind: "unknown", to: call.to, selector: selectorOf(call.data) });

function decodeCore(call: CallInput, data: Hex, self: Address, t: ScopeTargets): Action {
  const fn = decode(senryoCoreAbi, data);
  if (!fn) return unknown(call);
  const a = fn.args;
  switch (fn.functionName) {
    case "increase":
      return { kind: "open", marketId: Number(a[0]), isLong: a[1] === true, notionalUsd6: a[2] as bigint };
    case "decrease":
    case "close":
      return { kind: "reduce", fn: fn.functionName, marketId: Number(a[0]) };
    case "cancelTrigger":
      return { kind: "reduce", fn: "cancelTrigger" };
    case "placeTrigger": {
      const order = a[0] as { user: Address; marketId: number };
      // A trigger only ever reduces the signer's own position (TriggerOrders.sol); someone else's order is out.
      return sameAddress(order.user, self)
        ? { kind: "reduce", fn: "placeTrigger", marketId: Number(order.marketId) }
        : unknown(call);
    }
    case "deposit":
      return includesAddress(t.stables, a[0] as Address)
        ? { kind: "deposit", token: a[0] as Address, amountUsd6: a[1] as bigint }
        : unknown(call);
    case "depositFor":
      // Crediting someone else is a gift, i.e. a send.
      return sameAddress(a[2] as Address, self)
        ? { kind: "deposit", token: a[0] as Address, amountUsd6: a[1] as bigint }
        : { kind: "transfer", token: a[0] as Address, to: a[2] as Address, amountUsd6: a[1] as bigint };
    case "withdraw": {
      const to = a[2] as Address;
      return {
        kind: "withdraw",
        token: a[0] as Address,
        amountUsd6: a[1] as bigint,
        to,
        toSelf: sameAddress(to, self),
      };
    }
    case "swapCollateral":
      return { kind: "swap", tokenIn: a[0] as Address, amountUsd6: a[1] as bigint };
    case "repayCardDebt":
    case "revokeSpendAllowance":
      return { kind: "card-safe", fn: fn.functionName };
    case "setCardEnvelope":
    case "setSpendAllowance":
      return { kind: "card-setting", fn: fn.functionName };
    default:
      return unknown(call);
  }
}

function decodeVault(call: CallInput, data: Hex, self: Address): Action {
  const fn = decode(lpVaultAbi, data);
  if (!fn) return unknown(call);
  const a = fn.args;
  switch (fn.functionName) {
    case "deposit":
      return { kind: "lp-deposit", amountUsd6: a[0] as bigint, receiverSelf: sameAddress(a[1] as Address, self) };
    case "requestRedeem":
      return { kind: "lp-redeem", fn: "requestRedeem", receiverSelf: sameAddress(a[1] as Address, self) };
    case "claimRedeem":
      return { kind: "lp-redeem", fn: "claimRedeem", receiverSelf: true };
    default:
      return unknown(call);
  }
}

function decodeToken(call: CallInput, data: Hex, token: Address, t: ScopeTargets): Action {
  const fn = decode(mockAUSDAbi, data);
  if (!fn) return unknown(call);
  const a = fn.args;
  switch (fn.functionName) {
    case "approve": {
      const spender = a[0] as Address;
      return {
        kind: "approve",
        token,
        spender,
        amountUsd6: a[1] as bigint,
        spenderKnown: includesAddress(t.spenders, spender),
      };
    }
    case "transfer":
      return { kind: "transfer", token, to: a[0] as Address, amountUsd6: a[1] as bigint };
    case "faucet":
      return includesAddress(t.faucets, token) ? { kind: "faucet", token } : unknown(call);
    default:
      return unknown(call);
  }
}

/** Decodes one transaction into the action it performs for `self` on this network. */
export function decodeCall(call: CallInput, self: Address, targets: ScopeTargets): Action {
  if (call.hasAuthorizationList) return { kind: "delegation" };
  if (call.value > 0n) {
    return call.to ? { kind: "native-send", to: call.to, valueWei: call.value } : unknown(call);
  }
  if (!call.to || !call.data || selectorOf(call.data) === "0x") return unknown(call);
  if (sameAddress(call.to, targets.core)) return decodeCore(call, call.data, self, targets);
  if (sameAddress(call.to, targets.lpVault)) return decodeVault(call, call.data, self);
  if (includesAddress(targets.stables, call.to)) return decodeToken(call, call.data, call.to, targets);
  return unknown(call);
}

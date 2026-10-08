/**
 * Calldata → `Action`, decoded against the real ABIs in `@senryo/contracts` (`decodeFunctionData`). Notional,
 * amounts, destinations and receivers come from the calldata itself; nothing the caller claims is trusted.
 */
import { PERPL_COLLATERAL_DECIMALS, PERPL_ORDER_TYPE } from "@senryo/config";
import {
  lpVaultAbi,
  mockAUSDAbi,
  perplExchangeAbi,
  practiceSwapAbi,
  senryoBinaryV1Abi,
  senryoCoreAbi,
} from "@senryo/contracts";
import { oneUnit } from "@senryo/core";
import { type Abi, type Address, decodeFunctionData, encodeFunctionData, type Hex, isHex, size, slice } from "viem";
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

/**
 * Perpl's Exchange (D1). The account is `msg.sender`, so nothing here can act for someone else; amounts and the
 * order's size, limit price and leverage are read from calldata. Only the four position order types are in scope —
 * cancel / change / increase-collateral and every other selector stay unknown (this app never signs them in session).
 */
function decodePerpl(call: CallInput, data: Hex, t: ScopeTargets): Action {
  const fn = decode(perplExchangeAbi, data);
  if (!fn) return unknown(call);
  const a = fn.args;
  switch (fn.functionName) {
    case "createAccount":
    case "depositCollateral":
      return { kind: "perpl-deposit", fn: fn.functionName, amountUsd6: a[0] as bigint };
    case "withdrawCollateral":
      return { kind: "perpl-withdraw", amountUsd6: a[0] as bigint };
    case "execOrder": {
      const order = a[0] as {
        perpId: bigint;
        orderType: number;
        pricePNS: bigint;
        lotLNS: bigint;
        leverageHdths: bigint;
      };
      const marketId = Number(order.perpId);
      if (order.orderType === PERPL_ORDER_TYPE.closeLong || order.orderType === PERPL_ORDER_TYPE.closeShort)
        return { kind: "perpl-reduce", marketId };
      const isOpen = order.orderType === PERPL_ORDER_TYPE.openLong || order.orderType === PERPL_ORDER_TYPE.openShort;
      const scale = t.perplScales[marketId];
      // An open on a market whose decimals aren't known can't be valued from calldata: never in session.
      if (!isOpen || !scale) return unknown(call);
      const exp = scale.priceDecimals + scale.lotDecimals - PERPL_COLLATERAL_DECIMALS;
      const product = order.pricePNS * order.lotLNS;
      const notionalUsd6 = exp >= 0 ? product / oneUnit(exp) : product * oneUnit(-exp);
      return {
        kind: "perpl-open",
        marketId,
        isLong: order.orderType === PERPL_ORDER_TYPE.openLong,
        notionalUsd6,
        leverageHdths: order.leverageHdths,
      };
    }
    default:
      return unknown(call);
  }
}

/**
 * The practice par swap (D-252): a swap of the signer's own stable, paid back to the signer — the same action (and so
 * the same confirmation level) as any other swap. Paying the output to someone else is a send.
 */
function decodePracticeSwap(call: CallInput, data: Hex, self: Address, t: ScopeTargets): Action {
  const fn = decode(practiceSwapAbi, data);
  if (fn?.functionName !== "swap") return unknown(call);
  const [tokenIn, amountIn, , to] = fn.args as readonly [Address, bigint, bigint, Address];
  if (!includesAddress(t.stables, tokenIn)) return unknown(call);
  return sameAddress(to, self)
    ? { kind: "swap", tokenIn, amountUsd6: amountIn }
    : { kind: "transfer", token: tokenIn, to, amountUsd6: amountIn };
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
  if (targets.binary && sameAddress(call.to, targets.binary.contract)) {
    // All mutations, including credits/reductions/permissionless settlement, require a fresh ceremony.
    // A malformed or admin selector on the binary target must never fall through to native-send.
    if (!call.data || call.value < 0n) return unknown(call);
    const fn = decode(senryoBinaryV1Abi, call.data);
    const allowed = ["buy", "sell", "claim", "withdraw", "recordOpening", "resolve", "voidExpired", "claimLiquidity"];
    if (!fn || !allowed.includes(fn.functionName)) return unknown(call);
    const item = senryoBinaryV1Abi.find((i) => i.type === "function" && i.name === fn.functionName);
    if (item?.type !== "function" || (item.stateMutability !== "payable" && call.value !== 0n)) return unknown(call);
    // Reject trailing bytes/noncanonical encodings as well as invalid ABI data.
    const canonical = encodeFunctionData({ abi: [item], functionName: fn.functionName, args: fn.args } as never);
    if (canonical.toLowerCase() !== call.data.toLowerCase()) return unknown(call);
    const opIndex = ({ buy: 4, sell: 5, claim: 1, withdraw: 1 } as Record<string, number>)[fn.functionName];
    if (opIndex !== undefined && /^0x0{64}$/.test(String(fn.args[opIndex]))) return unknown(call);
    return { kind: "binary-mutation", fn: fn.functionName, valueWei: call.value };
  }
  if (call.value > 0n) {
    return call.to ? { kind: "native-send", to: call.to, valueWei: call.value } : unknown(call);
  }
  if (!call.to || !call.data || selectorOf(call.data) === "0x") return unknown(call);
  if (sameAddress(call.to, targets.core)) return decodeCore(call, call.data, self, targets);
  if (sameAddress(call.to, targets.lpVault)) return decodeVault(call, call.data, self);
  if (sameAddress(call.to, targets.perplExchange)) return decodePerpl(call, call.data, targets);
  if (sameAddress(call.to, targets.practiceSwap)) return decodePracticeSwap(call, call.data, self, targets);
  // Perpl's AUSD is decoded like our stables (approve / transfer only — `faucet` stays limited to the mocks).
  if (includesAddress(targets.stables, call.to) || sameAddress(call.to, targets.perplCollateral))
    return decodeToken(call, call.data, call.to, targets);
  return unknown(call);
}

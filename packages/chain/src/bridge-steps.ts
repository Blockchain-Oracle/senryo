/**
 * Bridge sends on Monad (D2, plan §0.8 B9): a `/v1/bridge/quote` returns its Monad-side steps as data — an exact
 * approval and the provider call — and this file turns them into `TxRequest`s for the account's sender. Every `to`
 * and every approval spender must be a pinned bridge contract (`BRIDGE_CONTRACTS`); a step for another chain is
 * refused (those are signed by the sender's wallet on that chain). The CCTP burn calldata is encoded here too, since
 * services never import viem.
 *
 * Monad reserve rule: a step that sends MON value keeps `reserveWei` on the account (see aggregator-swap.ts). In a
 * composed operation, steps sending MON value go before any other MON-spending step (routes.md §7).
 */
import {
  CCTP_FAST_FINALITY,
  CCTP_FORWARD_HOOK_DATA,
  type ChainId,
  type GasAction,
  isPinnedBridgeTarget,
} from "@senryo/config";
import { type Address, encodeFunctionData, erc20Abi, type Hex, pad } from "viem";
import {
  AGGREGATOR_MON_RESERVE_WEI,
  MonReserveError,
  spendableNative,
  UnpinnedTargetError,
} from "./aggregator-swap.ts";
import { externalCall } from "./calls.ts";
import type { ReadClient } from "./clients.ts";
import type { TxRequest } from "./send.ts";
import { readAllowances } from "./token-reads.ts";

export const BRIDGE_GAS_ACTIONS = ["relayDeposit", "cctpBurn", "acrossDeposit", "lifiBridge"] as const;
export type BridgeGasAction = (typeof BRIDGE_GAS_ACTIONS)[number] & GasAction;

export type BridgeStep =
  | { kind: "approve"; chainId: number; token: Address; spender: Address; amount: bigint }
  | { kind: "call"; chainId: number; to: Address; data: Hex; value: bigint; action: BridgeGasAction };

function assertMonadStep(chainId: ChainId, step: BridgeStep): void {
  if (step.chainId !== chainId) {
    throw new Error(`bridge step is signed on chain ${step.chainId}, not Monad ${chainId}`);
  }
  const target = step.kind === "approve" ? step.spender : step.to;
  if (!isPinnedBridgeTarget(chainId, target)) throw new UnpinnedTargetError(target, `bridge ${step.kind}`);
  if (step.kind === "call" && !BRIDGE_GAS_ACTIONS.includes(step.action)) {
    throw new Error(`bridge call has no bridge gas budget (${step.action})`);
  }
}

/** MON value the steps send in total (the provider fee LI.FI charges in MON, a native-MON deposit). */
export function bridgeNativeValue(steps: readonly BridgeStep[]): bigint {
  return steps.reduce((sum, s) => sum + (s.kind === "call" ? s.value : 0n), 0n);
}

/**
 * The ordered sends for a quote's Monad steps. Approvals are exact and skipped when `allowances` (same order as the
 * approve steps) already cover them; calls carry their bridge budget.
 */
export function buildBridgeSends(
  chainId: ChainId,
  steps: readonly BridgeStep[],
  allowances: readonly bigint[] = [],
  meta: Record<string, string> = {},
): TxRequest[] {
  let approveIndex = 0;
  const requests: TxRequest[] = [];
  for (const step of steps) {
    assertMonadStep(chainId, step);
    if (step.kind === "approve") {
      const onFile = allowances[approveIndex];
      approveIndex += 1;
      if (onFile !== undefined && onFile >= step.amount) continue;
      requests.push(
        externalCall(step.token, erc20Abi, "approve", [step.spender, step.amount], "approve", {
          meta: { kind: "bridge", ...meta, step: "approve" },
        }),
      );
    } else {
      requests.push({
        to: step.to,
        data: step.data,
        value: step.value,
        action: step.action,
        meta: { kind: "bridge", ...meta, step: step.action },
      });
    }
  }
  return requests;
}

export interface PrepareBridgeOptions {
  reserveWei?: bigint | undefined;
  /** The sends' gas cost (Σ limit × max fee) the MON balance must also cover. */
  gasCostWei?: bigint | undefined;
  meta?: Record<string, string> | undefined;
}

/** Reads allowances (and the MON balance when a step sends value) and builds the sends as the chain stands now. */
export async function prepareBridgeSends(
  read: ReadClient,
  chainId: ChainId,
  owner: Address,
  steps: readonly BridgeStep[],
  options: PrepareBridgeOptions = {},
): Promise<TxRequest[]> {
  for (const step of steps) assertMonadStep(chainId, step);
  const value = bridgeNativeValue(steps);
  if (value > 0n) {
    const reserveWei = options.reserveWei ?? AGGREGATOR_MON_RESERVE_WEI;
    const balance = await read.getBalance({ address: owner, blockTag: "latest" });
    const max = spendableNative(balance, options.gasCostWei ?? 0n, reserveWei);
    if (value > max) throw new MonReserveError(max, reserveWei);
  }
  const approvals = steps.flatMap((s) => (s.kind === "approve" ? [{ token: s.token, spender: s.spender }] : []));
  const allowances = await readAllowances(read, owner, approvals);
  return buildBridgeSends(chainId, steps, allowances, options.meta);
}

// ---------------------------------------------------------------- CCTP v2

const depositForBurnWithHookAbi = [
  {
    type: "function",
    name: "depositForBurnWithHook",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export interface CctpBurnParams {
  amount: bigint;
  destinationDomain: number;
  /** The EVM address that receives the mint on the destination. */
  recipient: Address;
  burnToken: Address;
  /** Protocol fee + Circle's forwarding fee ceiling; the recipient gets at least `amount − maxFee`. */
  maxFee: bigint;
  minFinalityThreshold?: number | undefined;
}

/**
 * `TokenMessengerV2.depositForBurnWithHook` with Circle's Forwarding Service hook: Circle mints on the destination,
 * so the recipient needs no gas there. `destinationCaller` is zero (any caller), as Circle's forwarding guide uses.
 */
export function encodeCctpBurn(params: CctpBurnParams): Hex {
  return encodeFunctionData({
    abi: depositForBurnWithHookAbi,
    functionName: "depositForBurnWithHook",
    args: [
      params.amount,
      params.destinationDomain,
      pad(params.recipient, { size: 32 }),
      params.burnToken,
      pad("0x", { size: 32 }),
      params.maxFee,
      params.minFinalityThreshold ?? CCTP_FAST_FINALITY,
      CCTP_FORWARD_HOOK_DATA,
    ],
  });
}

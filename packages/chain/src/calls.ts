import type { ChainId, GasAction } from "@senryo/config";
import {
  type Abi,
  type Address,
  type ContractFunctionArgs,
  type ContractFunctionName,
  type EncodeFunctionDataParameters,
  encodeFunctionData,
  parseEventLogs,
  type TransactionReceipt,
} from "viem";
import { addressOf, CONTRACT_ABIS, type ContractName } from "./contracts.ts";
import type { TxRequest } from "./send.ts";

type AbiOf<N extends ContractName> = (typeof CONTRACT_ABIS)[N];
type Mutability = "nonpayable" | "payable";

export type WriteFunction<N extends ContractName> = ContractFunctionName<AbiOf<N>, Mutability>;
export type WriteArgs<N extends ContractName, F extends WriteFunction<N>> = ContractFunctionArgs<
  AbiOf<N>,
  Mutability,
  F
>;

/**
 * Typed tx request for one of our deployed contracts: `contractCall(10143, "SenryoCore", "placeHold", [...], "placeHold")`.
 * The gas budget key is explicit so every call site states which budget it spends.
 */
export function contractCall<N extends ContractName, F extends WriteFunction<N>>(
  chainId: ChainId,
  name: N,
  functionName: F,
  args: WriteArgs<N, F>,
  action: GasAction,
  extra?: Pick<TxRequest, "gasCap" | "fixedGas" | "meta" | "value">,
): TxRequest {
  const data = encodeFunctionData({
    abi: CONTRACT_ABIS[name],
    functionName,
    args,
  } as unknown as EncodeFunctionDataParameters);
  return { to: addressOf(chainId, name), data, action, ...extra };
}

/** Tx request for an external contract with a caller-supplied ABI (Uniswap, tokens) — same explicit-gas rules. */
export function externalCall<const TAbi extends Abi, F extends ContractFunctionName<TAbi, Mutability>>(
  to: Address,
  abi: TAbi,
  functionName: F,
  args: ContractFunctionArgs<TAbi, Mutability, F>,
  action: GasAction,
  extra?: Pick<TxRequest, "gasCap" | "fixedGas" | "meta" | "value">,
): TxRequest {
  const data = encodeFunctionData({ abi, functionName, args } as unknown as EncodeFunctionDataParameters);
  return { to, data, action, ...extra };
}

/** Decoded events of `name`'s ABI in a receipt (e.g. `HoldPlaced` → holdId, nonce). */
export function receiptEvents<N extends ContractName>(receipt: TransactionReceipt, name: N) {
  return parseEventLogs({ abi: CONTRACT_ABIS[name], logs: receipt.logs });
}

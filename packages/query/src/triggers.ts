/**
 * TP/SL (F14, TriggerOrders.sol): the user signs an EIP-712 `TriggerOrder` in session (our own domain — in scope) and
 * places it with `placeTrigger` (a reduce: always in scope); any keeper executes it when the accepted oracle price
 * crosses. A trigger only ever reduces the matching position. Active orders come from the indexer.
 */
import { contractCall, coreDomain, type Sender, type TxRequest } from "@senryo/chain";
import { type ChainId, positionGasLimit } from "@senryo/config";
import { type Address, type Reading, RISK, TRIGGER_ORDER_TYPES } from "@senryo/core";
import {
  type Liquidations,
  LiquidationsDocument,
  liquidationsVars,
  type TriggerHistory,
  TriggerHistoryDocument,
  type Triggers,
  TriggersDocument,
  triggersVars,
} from "@senryo/indexer-client";
import { useQuery } from "@tanstack/react-query";
import { ACCOUNT_REFETCH_MS } from "./constants.ts";
import { useQueryEnv } from "./env.tsx";
import { keys } from "./keys.ts";
import { readingOf } from "./reading.ts";

/** Take-profit fills close to the trigger; a stop-loss must fill even through a fast move, so its bound is wider. */
export const TP_SLIPPAGE_BPS = 100n;
export const SL_SLIPPAGE_BPS = 300n;
/** Triggers expire after 30 days unless cancelled or executed (the contract checks expiry at execution). */
export const TRIGGER_TTL_SEC = 2_592_000n;
const MS_PER_SECOND = 1000;
const SALT_BYTES = 8;
const BITS_PER_BYTE = 8n;

export interface TriggerOrder {
  user: Address;
  marketId: number;
  isLong: boolean;
  takeProfit: boolean;
  triggerPrice18: bigint;
  sizeDelta: bigint;
  acceptablePrice18: bigint;
  expiry: bigint;
  salt: bigint;
}

function randomSalt(): bigint {
  const bytes = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(bytes);
  return bytes.reduce((acc, b) => (acc << BITS_PER_BYTE) | BigInt(b), 0n);
}

/** A TP/SL on the held position: closing a long sells (bound below the trigger), closing a short buys (bound above). */
export function triggerOrder(params: {
  user: Address;
  marketId: number;
  isLong: boolean;
  takeProfit: boolean;
  triggerPrice18: bigint;
  sizeDelta: bigint;
}): TriggerOrder {
  const slip = params.takeProfit ? TP_SLIPPAGE_BPS : SL_SLIPPAGE_BPS;
  const acceptable = params.isLong
    ? (params.triggerPrice18 * (RISK.BPS - slip)) / RISK.BPS
    : (params.triggerPrice18 * (RISK.BPS + slip)) / RISK.BPS;
  return {
    ...params,
    acceptablePrice18: acceptable,
    expiry: BigInt(Math.floor(Date.now() / MS_PER_SECOND)) + TRIGGER_TTL_SEC,
    salt: randomSalt(),
  };
}

/** Sign with the sender's (scoped) account and build `placeTrigger(order, signature)`. */
export async function placeTriggerRequest(sender: Sender, order: TriggerOrder): Promise<TxRequest> {
  const signature = await sender.account.signTypedData({
    domain: coreDomain(sender.chainId),
    types: TRIGGER_ORDER_TYPES,
    primaryType: "TriggerOrder",
    message: order,
  });
  return contractCall(sender.chainId, "SenryoCore", "placeTrigger", [order, signature], "placeTrigger", {
    meta: {
      kind: "placeTrigger",
      marketId: String(order.marketId),
      leg: order.takeProfit ? "tp" : "sl",
      price: order.triggerPrice18.toString(),
    },
  });
}

export function cancelTriggerRequest(chainId: ChainId, orderId: `0x${string}`): TxRequest {
  return contractCall(chainId, "SenryoCore", "cancelTrigger", [orderId], "placeTrigger", {
    gasCap: positionGasLimit("placeTrigger", 1),
    meta: { kind: "cancelTrigger", orderId },
  });
}

/** The user's active triggers (indexer); `["account", chain, addr, "triggers"]` refetches on finalized changes. */
export function useTriggers(address: Address | undefined): Reading<Triggers> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: [...keys.account(env.chainId, address ?? "0x"), "triggers"] as const,
    queryFn: ({ signal }) => env.indexer.request(TriggersDocument, triggersVars(env.chainId, address ?? "0x"), signal),
    enabled: address !== undefined,
    refetchInterval: ACCOUNT_REFETCH_MS,
    staleTime: ACCOUNT_REFETCH_MS,
  });
  return readingOf(query, ACCOUNT_REFETCH_MS);
}

/** Every TP/SL the user placed on this network, any status (Orders → History, flow book C8). */
export function useTriggerHistory(address: Address | undefined): Reading<TriggerHistory> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: [...keys.account(env.chainId, address ?? "0x"), "trigger-history"] as const,
    queryFn: ({ signal }) =>
      env.indexer.request(TriggerHistoryDocument, triggersVars(env.chainId, address ?? "0x"), signal),
    enabled: address !== undefined,
    refetchInterval: ACCOUNT_REFETCH_MS,
    staleTime: ACCOUNT_REFETCH_MS,
  });
  return readingOf(query, ACCOUNT_REFETCH_MS);
}

/** Our-engine liquidations of the user within the last `windowSec` (F12 post-mortem); stable window key. */
export function useRecentLiquidations(address: Address | undefined, windowSec: number): Reading<Liquidations> {
  const env = useQueryEnv();
  const query = useQuery({
    queryKey: [...keys.account(env.chainId, address ?? "0x"), "liquidations", windowSec] as const,
    queryFn: ({ signal }) => {
      const since = Math.floor(Date.now() / MS_PER_SECOND) - windowSec;
      return env.indexer.request(LiquidationsDocument, liquidationsVars(env.chainId, address ?? "0x", since), signal);
    },
    enabled: address !== undefined,
    refetchInterval: ACCOUNT_REFETCH_MS,
    staleTime: ACCOUNT_REFETCH_MS,
  });
  return readingOf(query, ACCOUNT_REFETCH_MS);
}

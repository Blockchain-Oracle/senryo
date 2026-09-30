/**
 * The gas a user send will actually need (S8.16b, D-171): Monad consensus checks the sender's balance against the gas
 * LIMIT × the max fee it signs, so the ticket budgets exactly what `@senryo/chain` will sign — the `planGas` limit
 * (estimate × headroom, capped by the action budget; the cap when the simulation can't run) × the `FeeCache` max fee.
 * Estimated once per (action, market, side, position count), never per keystroke (D-162): gas barely depends on size.
 */
import {
  type Address,
  FEE_REFRESH_MS,
  FeeCache,
  gasWithHeadroom,
  type ReadClient,
  type TxRequest,
} from "@senryo/chain";
import { GAS_LIMITS, USER_MAX_FEE_BASE_MULTIPLIER_BPS } from "@senryo/config";
import { useQuery } from "@tanstack/react-query";
import { GAS_BUDGET_STALE_MS } from "./constants.ts";
import { useQueryEnv } from "./env.tsx";

export interface GasBudget {
  /** Gas limit the send will use (the estimate with headroom, or the action cap). */
  limit: bigint;
  maxFeePerGas: bigint;
  /** Native balance the sender must hold for Monad's consensus check: limit × max fee. */
  needWei: bigint;
  /** The limit came from a real simulation (vs the cap fallback). */
  estimated: boolean;
}

const feeCaches = new WeakMap<ReadClient, FeeCache>();

/**
 * The user-send fee quote (USER_MAX_FEE_BASE_MULTIPLIER_BPS, D-171), one per read client. The app's sender MUST use
 * this same cache so the budget and the signed max fee can never disagree.
 */
export function userFeeCache(read: ReadClient): FeeCache {
  let cache = feeCaches.get(read);
  if (!cache) {
    cache = new FeeCache(read, FEE_REFRESH_MS, USER_MAX_FEE_BASE_MULTIPLIER_BPS);
    feeCaches.set(read, cache);
  }
  return cache;
}

/** `budgetKey` names what the limit depends on (market, side, position count) — not the amount. */
export function useGasBudget(
  address: Address | undefined,
  request: TxRequest | undefined,
  budgetKey: readonly (string | number | boolean)[],
) {
  const env = useQueryEnv();
  return useQuery({
    queryKey: ["chain", env.chainId, "gasBudget", address?.toLowerCase() ?? "", ...budgetKey] as const,
    enabled: address !== undefined && request !== undefined,
    staleTime: GAS_BUDGET_STALE_MS,
    queryFn: () => gasBudgetFor(env.read, address as Address, request as TxRequest),
  });
}

/** Imperative form for one-off sends (close, TP/SL, LP): the same limit × max fee the sender will sign. */
export async function gasBudgetFor(read: ReadClient, address: Address, req: TxRequest): Promise<GasBudget> {
  const cap = req.gasCap ?? GAS_LIMITS[req.action];
  let limit = req.fixedGas ?? cap;
  let estimated = false;
  if (req.fixedGas === undefined) {
    try {
      const estimate = await read.estimateGas({ account: address, to: req.to, data: req.data, value: req.value ?? 0n });
      limit = gasWithHeadroom(estimate, cap, req.action);
      estimated = true;
    } catch {
      // Simulation couldn't run (e.g. a node that enforces the balance check): budget the cap instead.
    }
  }
  const fees = await userFeeCache(read).get();
  return { limit, maxFeePerGas: fees.maxFeePerGas, needWei: limit * fees.maxFeePerGas, estimated };
}

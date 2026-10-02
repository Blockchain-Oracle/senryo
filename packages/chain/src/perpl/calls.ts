/**
 * Perpl sends from the user's own wallet (D1): each builder returns a plain `TxRequest` for the account's sender —
 * explicit gas under a named `GAS_LIMITS` budget, the estimate doubling as the simulation (a revert sends nothing).
 * Approvals are exact (never unlimited), so nothing stays spendable by the Exchange after the deposit.
 */
import {
  type ChainId,
  PERPL_COLLATERAL,
  PERPL_EXCHANGE,
  PERPL_MAX_NEG_PNL_COLLAT_BPS,
  PERPL_ORDER_MAX_MATCHES,
  PERPL_ORDER_TTL_BLOCKS,
  type PerplOrderType,
} from "@senryo/config";
import { perplExchangeAbi } from "@senryo/contracts/external";
import { erc20Abi } from "viem";
import { externalCall } from "../calls.ts";
import type { TxRequest } from "../send.ts";
import { type PerplIntent, PerplOrderError, type PerplSide, perplOrderType } from "./math.ts";

const KIND = "perpl";

/** Funding steps: who they are for in the operations journal (`meta.step`). */
export type PerplFundingStep = "perplApprove" | "perplCreateAccount" | "perplDeposit" | "perplWithdraw";

const meta = (step: string, extra: Record<string, string> = {}) => ({ kind: KIND, step, ...extra });

/** `AUSD.approve(Exchange, amountCNS)` — exact amount, for the deposit that follows. */
export function perplApproveRequest(chainId: ChainId, amountCNS: bigint): TxRequest {
  return externalCall(
    PERPL_COLLATERAL[chainId],
    erc20Abi,
    "approve",
    [PERPL_EXCHANGE[chainId], amountCNS],
    "perplApprove",
    {
      meta: meta("perplApprove", { collateral: amountCNS.toString() }),
    },
  );
}

/** First deposit: `createAccount(amountCNS)` (≥ the live minimum; reverts `AccountExists` when there is one). */
export function perplCreateAccountRequest(chainId: ChainId, amountCNS: bigint): TxRequest {
  return externalCall(PERPL_EXCHANGE[chainId], perplExchangeAbi, "createAccount", [amountCNS], "perplCreateAccount", {
    meta: meta("perplCreateAccount", { collateral: amountCNS.toString() }),
  });
}

/** Top-up of an existing account: `depositCollateral(amountCNS)`. */
export function perplDepositRequest(chainId: ChainId, amountCNS: bigint): TxRequest {
  return externalCall(PERPL_EXCHANGE[chainId], perplExchangeAbi, "depositCollateral", [amountCNS], "perplDeposit", {
    meta: meta("perplDeposit", { collateral: amountCNS.toString() }),
  });
}

/** `withdrawCollateral(amountCNS)` — always pays `msg.sender`, the wallet that owns the account. */
export function perplWithdrawRequest(chainId: ChainId, amountCNS: bigint): TxRequest {
  return externalCall(PERPL_EXCHANGE[chainId], perplExchangeAbi, "withdrawCollateral", [amountCNS], "perplWithdraw", {
    meta: meta("perplWithdraw", { collateral: amountCNS.toString() }),
  });
}

export interface PerplOrderParams {
  marketId: number;
  intent: PerplIntent;
  side: PerplSide;
  lots: bigint;
  /** The IOC's bound (`perplLimitPrice`) — the worst price the order may fill at, as reviewed. */
  limitPricePNS: bigint;
  /** Hundredths (500 = 5x); a close sends the position's own. Never 0 (the market maximum). */
  leverageHdths: bigint;
  /** The head block when built: the order is void after head + `PERPL_ORDER_TTL_BLOCKS`. Omitted → no deadline (0). */
  headBlock?: bigint | undefined;
  /** Client tag (`orderDescId`); unused onchain for direct orders. Default: ms since the epoch. */
  orderDescId?: bigint | undefined;
  maxMatches?: bigint | undefined;
}

/** The `OrderDesc` an IOC order sends (exported for simulation and the check script). */
export function perplOrderDesc(params: PerplOrderParams) {
  if (params.lots <= 0n) throw new PerplOrderError("size", "the order is below one size unit of this market");
  if (params.leverageHdths <= 0n) throw new PerplOrderError("leverage", "leverage must be set explicitly");
  const orderType: PerplOrderType = perplOrderType(params.intent, params.side);
  return {
    orderDescId: params.orderDescId ?? BigInt(Date.now()),
    perpId: BigInt(params.marketId),
    orderType,
    orderId: 0n,
    pricePNS: params.limitPricePNS,
    lotLNS: params.lots,
    expiryBlock: 0n,
    postOnly: false,
    fillOrKill: false,
    immediateOrCancel: true,
    maxMatches: params.maxMatches ?? PERPL_ORDER_MAX_MATCHES,
    leverageHdths: params.leverageHdths,
    lastExecutionBlock: params.headBlock === undefined ? 0n : params.headBlock + PERPL_ORDER_TTL_BLOCKS,
    amountCNS: 0n,
    maxNegPnlCollatBPS: PERPL_MAX_NEG_PNL_COLLAT_BPS,
  } as const;
}

/**
 * IOC `execOrder`: fills what it can at or better than `limitPricePNS` and cancels the rest. The receipt alone never
 * says it filled — `decodePerplOrder` reads the fill from the events.
 */
export function perplOrderRequest(chainId: ChainId, params: PerplOrderParams): TxRequest {
  const desc = perplOrderDesc(params);
  return externalCall(PERPL_EXCHANGE[chainId], perplExchangeAbi, "execOrder", [desc], "perplOrder", {
    meta: meta("perplOrder", {
      marketId: String(params.marketId),
      intent: params.intent,
      side: params.side,
      lots: params.lots.toString(),
      limitPricePNS: params.limitPricePNS.toString(),
      leverageHdths: params.leverageHdths.toString(),
      lastExecutionBlock: desc.lastExecutionBlock.toString(),
    }),
  });
}

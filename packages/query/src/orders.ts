/**
 * Order requests for the ticket and position actions — `SenryoCore.increase/decrease/close` with the acceptable price
 * bounded by `TRADE_SLIPPAGE_BPS` around the previewed execution price, a short deadline, and an explicit gas budget
 * (chain sizes the limit from the simulation). The contract re-checks price, caps and margin.
 */
import { contractCall, type TxRequest } from "@senryo/chain";
import { type ChainId, positionGasLimit } from "@senryo/config";
import { RISK } from "@senryo/core";

/** Price protection between preview and inclusion (~1 s on Monad); the fill is still the oracle price ± spread. */
export const TRADE_SLIPPAGE_BPS = 50n;
export const TRADE_DEADLINE_SEC = 120n;
const MS_PER_SECOND = 1000;

const deadline = () => BigInt(Math.floor(Date.now() / MS_PER_SECOND)) + TRADE_DEADLINE_SEC;
/** Longs buy at most this high; shorts sell at least this low. */
const acceptableFor = (buying: boolean, exec18: bigint) =>
  buying
    ? (exec18 * (RISK.BPS + TRADE_SLIPPAGE_BPS)) / RISK.BPS
    : (exec18 * (RISK.BPS - TRADE_SLIPPAGE_BPS)) / RISK.BPS;

/** `positions` = open positions after the action (count the traded market) — the gas cap scales with it (D-185). */
export function increaseRequest(
  chainId: ChainId,
  marketId: number,
  isLong: boolean,
  notionalUsd6: bigint,
  exec18: bigint,
  positions: number,
): TxRequest {
  const acceptable = acceptableFor(isLong, exec18);
  return contractCall(
    chainId,
    "SenryoCore",
    "increase",
    [marketId, isLong, notionalUsd6, acceptable, deadline()],
    "increase",
    {
      gasCap: positionGasLimit("increase", positions),
      meta: { kind: "increase", marketId: String(marketId) },
    },
  );
}

/** Reducing a long sells (bound below); reducing a short buys (bound above). */
export function decreaseRequest(
  chainId: ChainId,
  marketId: number,
  isLong: boolean,
  sizeDelta: bigint,
  exec18: bigint,
  positions: number,
): TxRequest {
  const acceptable = acceptableFor(!isLong, exec18);
  return contractCall(chainId, "SenryoCore", "decrease", [marketId, sizeDelta, acceptable, deadline()], "decrease", {
    gasCap: positionGasLimit("decrease", positions),
    meta: { kind: "decrease", marketId: String(marketId) },
  });
}

export function closeRequest(
  chainId: ChainId,
  marketId: number,
  isLong: boolean,
  exec18: bigint,
  positions: number,
): TxRequest {
  const acceptable = acceptableFor(!isLong, exec18);
  return contractCall(chainId, "SenryoCore", "close", [marketId, acceptable, deadline()], "close", {
    gasCap: positionGasLimit("close", positions),
    meta: { kind: "close", marketId: String(marketId) },
  });
}

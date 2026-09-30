/**
 * F11 position management: the held position in one market, its health (PnL at the conservative exit, liquidation
 * price + distance, margin use), funding and borrow owed since the last settle (F11 breakdown), and a reduce — a
 * share of the size (25/50/75/100 %) previewed by `previewDecrease` (max-profit cap, `MIN_HOLD_BLOCKS` for a
 * profitable reduce) and sent as `decrease`/`close` through the scoped signer (reduce is always in scope).
 */
import { positionCount } from "@senryo/config";
import { borrowOwed, fundingOwed, notional, previewDecrease, previewPosition, RISK } from "@senryo/core";
import {
  closeRequest,
  decreaseRequest,
  riskViewOf,
  useAccountRisk,
  useMarket,
  usePositions,
  useQueryEnv,
  useSendTrace,
} from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAccount } from "~/lib/account/provider";
import { userSender } from "~/lib/account/sender";
import { REDUCE_ALL_BPS } from "./constants";

const HEAD_REFETCH_MS = 2_000;

export function usePosition(marketId: number) {
  const env = useQueryEnv();
  const account = useAccount();
  const address = account.hint?.address;
  const market = useMarket(marketId);
  const risk = useAccountRisk(address, "latest");
  const positions = usePositions(address);
  const head = useQuery({
    queryKey: ["chain", env.chainId, "head"],
    queryFn: () => env.read.getBlockNumber(),
    refetchInterval: HEAD_REFETCH_MS,
  });
  const [shareBps, setShareBps] = useState<bigint>(REDUCE_ALL_BPS);
  const trace = useSendTrace();

  const m = market.status === "fresh" || market.status === "stale" ? market.value : undefined;
  const snapshot = risk.status === "fresh" || risk.status === "stale" ? risk.value : undefined;
  const list = positions.status === "fresh" || positions.status === "stale" ? positions.value : undefined;
  const position = list?.find((p) => p.marketId === marketId);
  const loading = !m || !snapshot || !list;

  const health = m && snapshot && position ? previewPosition(m.risk, m.pv, riskViewOf(snapshot), position) : undefined;
  const entryNotional = position ? notional(position.size, position.entry) : 0n;
  const funding =
    m && position ? fundingOwed(position.isLong, entryNotional, m.fundingIndex, position.fundingSnap) : 0n;
  const borrow = m && position ? borrowOwed(entryNotional, m.borrowIndex, position.borrowSnap) : 0n;
  const closingAll = shareBps >= REDUCE_ALL_BPS;
  const sizeDelta = position ? (closingAll ? position.size : (position.size * shareBps) / RISK.BPS) : 0n;
  const reduce =
    m && position && head.data !== undefined && sizeDelta > 0n
      ? previewDecrease(m.risk, m.pv, position, sizeDelta, head.data)
      : undefined;

  const submit = async () => {
    const client = account.client;
    if (!client || !address || !m || !position || !reduce || !snapshot) return undefined;
    const sender = userSender(client, address, account.settings.faceId);
    const positionsNow = positionCount(snapshot.positionBitmap);
    const request = closingAll
      ? closeRequest(env.chainId, marketId, position.isLong, reduce.execPrice18, positionsNow)
      : decreaseRequest(env.chainId, marketId, position.isLong, sizeDelta, reduce.execPrice18, positionsNow);
    return trace.run(sender, request);
  };

  return {
    loading,
    market: m,
    position,
    snapshot,
    health,
    fundingUsd6: funding,
    borrowUsd6: borrow,
    currentNotionalUsd6: position && m ? notional(position.size, m.pv.price18) : 0n,
    shareBps,
    setShareBps,
    closingAll,
    reduce,
    headBlock: head.data,
    trace,
    submit,
    ready: account.client !== undefined,
  };
}

"use client";

/**
 * F11 position management (ported from the phone's `usePosition`): the held position in one market, its health (PnL at the conservative exit, liquidation
 * price + distance, margin use), funding and borrow owed since the last settle (F11 breakdown), and a reduce — a
 * share of the size (25/50/75/100 %) previewed by `previewDecrease` (max-profit cap, `MIN_HOLD_BLOCKS` for a
 * profitable reduce) and sent as `decrease`/`close` through the scoped signer (reduce is always in scope). Closing
 * the whole position also cancels that market's leftover TP/SL as later steps of the same operation (flow book C6
 * rule b, Part 1 defect 2): `cancelTrigger` is reduce-class, so it signs in session without another prompt.
 */
import { pinRead, readMarketRisk, readPositions } from "@senryo/chain";
import { positionCount } from "@senryo/config";
import { borrowOwed, fundingOwed, notional, previewDecrease, previewPosition, RISK } from "@senryo/core";
import {
  cancelTriggerRequest,
  closeRequest,
  decreaseRequest,
  readOperation,
  riskViewOf,
  TRADE_SLIPPAGE_BPS,
  useAccountRisk,
  useMarket,
  usePositions,
  useQueryEnv,
  useSendTrace,
  useTriggers,
} from "@senryo/query";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useAccount } from "@/lib/account/provider";
import { userSender } from "@/lib/account/sender";
import { HEAD_REFETCH_MS, REDUCE_ALL_BPS } from "@/lib/constants/ticket";
import { useReviewGuard } from "@/lib/review-guard";
import { useEnsureGas } from "@/lib/trade/use-gas-top-up";

/** What a reduce was quoted at when the hold completed: the close summary shows this, labelled as quoted. */
export interface ReduceQuote {
  isLong: boolean;
  closingAll: boolean;
  shareBps: bigint;
  execPrice18: bigint;
  realizedPnlUsd6: bigint;
  feeUsd6: bigint;
  netUsd6: bigint;
}

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
  const trace = useSendTrace(`position:${env.chainId}:${address ?? "guest"}:${marketId}`);
  const gas = useEnsureGas();
  const [quoted, setQuoted] = useState<ReduceQuote | undefined>();
  // The leftover levels a full close cancels: every placed TP/SL on this market, orphans of earlier positions included.
  const cleanup = useSendTrace(`position:${env.chainId}:${address ?? "guest"}:${marketId}:cleanup`);
  const triggers = useTriggers(address);
  const leftovers =
    triggers.status === "fresh" || triggers.status === "stale"
      ? triggers.value.filter((t) => t.market_id === `ours-${marketId}`)
      : [];

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

  const guard = useReviewGuard([env.chainId, address, marketId, shareBps, position?.size].join(":"));
  const submit = async () => {
    const client = account.client;
    if (!client || !address || !m || !position || !reduce || !snapshot) return undefined;
    const sender = userSender(client, address, account.settings.faceId);
    const positionsNow = positionCount(snapshot.positionBitmap);
    const request = closingAll
      ? closeRequest(env.chainId, marketId, position.isLong, reduce.execPrice18, positionsNow)
      : decreaseRequest(env.chainId, marketId, position.isLong, sizeDelta, reduce.execPrice18, positionsNow);
    setQuoted({
      isLong: position.isLong,
      closingAll,
      shareBps,
      execPrice18: reduce.execPrice18,
      realizedPnlUsd6: reduce.realizedPnlUsd6,
      feeUsd6: reduce.feeUsd6,
      netUsd6: reduce.netUsd6,
    });
    // Closing the whole position cancels its leftover levels in the same operation, after the close finalizes.
    const cancels = closingAll ? leftovers.map((t) => t.id as `0x${string}`) : [];
    // Closing needs gas too: top up first when short, and show why if that's impossible (S8.16c).
    const closed = await trace.run(sender, request, {
      preflight: gas.preflight(request),
      // The cancel request's gas class is "placeTrigger" (`cancelTriggerRequest`), so that is the step it records.
      plannedActions: [request.action, ...cancels.map(() => "placeTrigger")],
      reviewedIntent: {
        isLong: String(position.isLong),
        closingAll: String(closingAll),
        shareBps: shareBps.toString(),
        execPrice18: reduce.execPrice18.toString(),
        realizedPnlUsd6: reduce.realizedPnlUsd6.toString(),
        feeUsd6: reduce.feeUsd6.toString(),
        netUsd6: reduce.netUsd6.toString(),
        sizeDelta: sizeDelta.toString(),
        marketId: String(marketId),
        ...(cancels.length > 0 ? { cancels: cancels.join(",") } : {}),
      },
      revalidate: async () => {
        guard();
        const block = await env.read.getBlock({ blockTag: "latest" });
        const read = pinRead(env.read, block.number);
        const [fresh, held] = await Promise.all([
          readMarketRisk(read, env.chainId, marketId),
          readPositions(read, env.chainId, address, snapshot.positionBitmap),
        ]);
        const current = held.find((p) => p.marketId === marketId);
        if (
          !current ||
          current.isLong !== position.isLong ||
          current.size !== position.size ||
          fresh.pv.status !== m.pv.status
        )
          throw new Error("The position or market changed. Review again.");
        const quote = previewDecrease(fresh.risk, fresh.pv, current, sizeDelta, block.number);
        const moved =
          quote.execPrice18 > reduce.execPrice18
            ? quote.execPrice18 - reduce.execPrice18
            : reduce.execPrice18 - quote.execPrice18;
        if (moved * RISK.BPS > reduce.execPrice18 * TRADE_SLIPPAGE_BPS || quote.holdReadyBlock !== undefined)
          throw new Error("The close quote changed. Review again.");
        guard();
      },
    });
    if (closed?.final?.stage === "finalized" && cancels.length > 0) await cancelLeftovers(cancels, closed.operationId);
    return closed;
  };

  /** One cancel per leftover level, in session, recorded on the close's own operation; a failure is counted, not retried. */
  const cancelLeftovers = async (ids: readonly `0x${string}`[], operationId: string | undefined) => {
    const client = account.client;
    if (!client || !address) return;
    const sender = userSender(client, address, account.settings.faceId);
    for (const id of ids) {
      const request = cancelTriggerRequest(env.chainId, id);
      await cleanup.run(sender, request, { preflight: gas.preflight(request), operationId });
    }
  };
  // The cleanup's progress is read from the close's own operation, so it survives a remount.
  const operation = trace.record ? readOperation(trace.record.id) : undefined;
  const cancelSteps = (operation?.steps ?? []).filter((step) => step.request?.kind === "cancelTrigger");
  const planned = trace.record?.reviewedIntent.cancels;

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
    quoted: quoted ?? restoredReduce(trace.record?.reviewedIntent),
    /** Leftover TP/SL on this market, cancelled by a full close. */
    leftovers,
    cleanup: {
      running: cleanup.running,
      cancels: planned ? planned.split(",").length : 0,
      failed: cancelSteps.filter((step) => ["reverted", "abandoned", "not-sent"].includes(step.outcome)).length,
      reset: cleanup.reset,
    },
    submit,
    ready: account.client !== undefined,
  };
}

function restoredReduce(intent: Record<string, string> | undefined): ReduceQuote | undefined {
  if (!intent?.shareBps) return undefined;
  try {
    return {
      isLong: intent.isLong === "true",
      closingAll: intent.closingAll === "true",
      shareBps: BigInt(intent.shareBps),
      execPrice18: BigInt(intent.execPrice18 ?? ""),
      realizedPnlUsd6: BigInt(intent.realizedPnlUsd6 ?? ""),
      feeUsd6: BigInt(intent.feeUsd6 ?? ""),
      netUsd6: BigInt(intent.netUsd6 ?? ""),
    };
  } catch {
    return undefined;
  }
}

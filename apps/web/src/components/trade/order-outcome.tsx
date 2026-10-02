"use client";

/**
 * The order's outcome (plan §0.9 Order status; Part A rule 8): `OperationStatus` in the order's words — "Opening short"
 * while it runs, then "Short XAU opened" with Size · Entry · Liq. taken from the reviewed intent (and the fill event
 * once read), View position, and under Details the margin, leverage, fee and the transaction. A failure hands back to
 * the ticket and never resends; an unknown result offers no new action.
 */
import { DECIMALS } from "@senryo/core";
import type { OperationRecord, TraceEvent } from "@senryo/query";
import Link from "next/link";
import { DetailRow } from "@/components/kit/list-row";
import { OperationStatus } from "@/components/kit/operation-status";
import { ORDER_WORDS } from "@/components/kit/trace-words";
import { Button } from "@/components/ui/button";
import { positionHref } from "@/lib/constants/routes";
import { money, price18, priceDecimalsOf } from "@/lib/format";
import { useSettledOutcome } from "@/lib/trade/send-outcome";

export interface SubmittedOrder {
  marketId: number;
  symbol: string;
  side: "long" | "short";
  leverage: number;
  marginUsd6: bigint;
  notionalUsd6: bigint;
  execPrice18: bigint;
  feeUsd6: bigint;
  liqPrice18: bigint | null;
}

/** The order exactly as it was reviewed, from the operation journal (never the ticket's current state). */
export function restoredOrder(record: OperationRecord | undefined): SubmittedOrder | undefined {
  const i = record?.reviewedIntent;
  if (!i?.symbol || (i.side !== "long" && i.side !== "short")) return undefined;
  try {
    return {
      marketId: Number(i.marketId),
      symbol: i.symbol,
      side: i.side,
      leverage: Number(i.leverage),
      marginUsd6: BigInt(i.marginUsd6 ?? ""),
      notionalUsd6: BigInt(i.notionalUsd6 ?? ""),
      execPrice18: BigInt(i.execPrice18 ?? ""),
      feeUsd6: BigInt(i.feeUsd6 ?? ""),
      liqPrice18: i.liqPrice18 ? BigInt(i.liqPrice18) : null,
    };
  } catch {
    return undefined;
  }
}

export function OrderOutcome({
  events,
  record,
  running,
  onDone,
  onLeave,
}: {
  events: readonly TraceEvent[];
  record: OperationRecord | undefined;
  running: boolean;
  onDone: () => void;
  onLeave: () => void;
}) {
  const outcome = useSettledOutcome(events);
  const order = restoredOrder(record);
  const sideWord = order ? (order.side === "long" ? "Long" : "Short") : undefined;
  const fill = order
    ? record?.steps
        .flatMap((s) => s.facts ?? [])
        .find((f) => f.event === "PositionUpdated" && f.values.marketId === String(order.marketId))?.values
    : undefined;
  const decimals = order ? priceDecimalsOf(order.marketId) : DECIMALS.cents;
  const entry = order ? (fill?.execPrice ? BigInt(fill.execPrice) : order.execPrice18) : undefined;
  const words = order
    ? { ...ORDER_WORDS, pending: `Opening ${order.side}`, success: `${sideWord} ${order.symbol} opened` }
    : ORDER_WORDS;
  return (
    <OperationStatus
      events={events}
      record={record}
      running={running}
      outcome={outcome}
      words={words}
      onDone={onDone}
      onLeave={onLeave}
      facts={
        order ? (
          <>
            <DetailRow label="Size" value={money(order.notionalUsd6)} />
            <DetailRow label={fill ? "Entry" : "Entry (quoted)"} value={entry ? `$${price18(entry, decimals)}` : "—"} />
            <DetailRow
              label="Liq."
              value={order.liqPrice18 === null ? "None" : `$${price18(order.liqPrice18, decimals)}`}
              tone="down"
            />
          </>
        ) : null
      }
      details={
        order ? (
          <>
            <DetailRow label="Margin" value={money(order.marginUsd6)} />
            <DetailRow label="Leverage" value={`${order.leverage}×`} />
            <DetailRow
              label={fill?.fee ? "Fee" : "Fee (estimated)"}
              value={money(fill?.fee ? BigInt(fill.fee) : order.feeUsd6)}
            />
          </>
        ) : null
      }
      next={
        order ? (
          <Button asChild variant="secondary" size="xl">
            <Link href={positionHref(order.symbol)}>View position</Link>
          </Button>
        ) : null
      }
    />
  );
}

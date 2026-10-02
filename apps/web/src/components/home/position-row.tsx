"use client";

import type { AccountSnapshot, PositionView } from "@senryo/chain";
import { ENGINE_MARKETS } from "@senryo/config";
import { notional, previewPosition } from "@senryo/core";
import { ids } from "@senryo/identity";
import { riskViewOf, useMarket, useQueryEnv } from "@senryo/query";
import { EntityMark } from "@/components/identity/entity-mark";
import { ListRow } from "@/components/kit/list-row";
import { known } from "@/components/ui/reading";
import { Skeleton } from "@/components/ui/skeleton";
import { MARK_ROW } from "@/lib/constants/brand";
import { positionHref } from "@/lib/constants/routes";
import { arrow, money, price18, priceDecimalsOf, signedMoney, wholePct } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "liq 12% away" · "liq now" · "no liquidation" (the phone's words). */
export function liquidationLabel(awayBps: bigint | null): string {
  if (awayBps === null) return "no liquidation";
  return awayBps <= 0n ? "liq now" : `liq ${wholePct(awayBps)} away`;
}

/** A position's side as a small washed badge: the word carries the meaning, the colour repeats it. */
export function SideBadge({ isLong }: { isLong: boolean }) {
  return (
    <span
      className={cn(
        "ml-2 rounded-xs px-1.5 py-0.5 align-middle text-label",
        isLong ? "bg-up-surface text-up" : "bg-down-surface text-down",
      )}
    >
      {isLong ? "Long" : "Short"}
    </span>
  );
}

/**
 * One open position (the phone's `PositionRow`, Fomo F09/F12): the market's mark, symbol + side badge, exposure · entry,
 * and the unrealised P&L at the conservative exit (signed, ▲▼) over the distance to liquidation. Opens the position.
 * `readOnly` (watch mode) links to the market instead.
 */
export function PositionRow({
  position,
  account,
  href,
}: {
  position: PositionView;
  account: AccountSnapshot | undefined;
  href?: string;
}) {
  const env = useQueryEnv();
  const market = useMarket(position.marketId);
  const symbol = ENGINE_MARKETS.find((m) => m.id === position.marketId)?.symbol ?? `#${position.marketId}`;
  const m = known(market);
  const health = m && account ? previewPosition(m.risk, m.pv, riskViewOf(account), position) : undefined;
  const exposure = m ? notional(position.size, m.pv.price18) : undefined;
  const entry = price18(position.entry, priceDecimalsOf(position.marketId));
  const away = health?.liqDistanceBps ?? null;
  return (
    <ListRow
      href={href ?? positionHref(symbol)}
      leading={<EntityMark id={ids.engineMarket(env.chainId, position.marketId)} size={MARK_ROW} decorative />}
      title={
        <>
          {symbol}
          <SideBadge isLong={position.isLong} />
        </>
      }
      subtitle={exposure === undefined ? `Entry ${entry}` : `${money(exposure, 0)} · entry ${entry}`}
      value={
        health ? (
          <span className={health.upnlUsd6 < 0n ? "text-down" : "text-up"}>
            {arrow(health.upnlUsd6)} {signedMoney(health.upnlUsd6)}
          </span>
        ) : market.status === "failed" ? (
          <span className="text-text-3">Price unavailable</span>
        ) : (
          <Skeleton className="ml-auto h-4 w-20" />
        )
      }
      detail={health ? liquidationLabel(away) : undefined}
      detailClassName={away !== null && away <= 0n ? "text-down" : "text-text-3"}
    />
  );
}

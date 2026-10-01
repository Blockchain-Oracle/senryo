"use client";

import type { AccountSnapshot, PositionView } from "@senryo/chain";
import { ENGINE_MARKETS } from "@senryo/config";
import { type Address, notional, previewPosition } from "@senryo/core";
import { keys, riskViewOf, useAccountRisk, useMarket, usePositions, useQueryEnv } from "@senryo/query";
import Link from "next/link";
import { Num } from "@/components/shell/primitives";
import { known, ReadingView, useRetry } from "@/components/ui/reading";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/lib/constants/routes";
import { arrow, compactMoney, price18, priceDecimalsOf, signedMoney, wholePct } from "@/lib/format";
import { cn } from "@/lib/utils";

const GRID = "grid grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_6rem] items-center gap-x-1";

/** "liq 12% away" · "liq now" · "no liquidation" — the phone's words for the distance to liquidation. */
function liquidationLabel(awayBps: bigint | null): string {
  if (awayBps === null) return "no liquidation";
  return awayBps <= 0n ? "liq now" : `liq ${wholePct(awayBps)} away`;
}

/**
 * One open position, priced from its market's live oracle view through the core preview with the account's other
 * positions held fixed (the phone's `PositionRow`). Cross-margin: a position keeps no leverage of its own, so the row
 * shows exposure, never a multiple. Opens the market.
 */
function PositionRow({ position, account }: { position: PositionView; account: AccountSnapshot | undefined }) {
  const market = useMarket(position.marketId);
  const meta = ENGINE_MARKETS.find((m) => m.id === position.marketId);
  const symbol = meta?.symbol ?? `#${position.marketId}`;
  const m = known(market);
  const health = m && account ? previewPosition(m.risk, m.pv, riskViewOf(account), position) : undefined;
  const exposure = m ? notional(position.size, m.pv.price18) : undefined;
  const decimals = priceDecimalsOf(position.marketId);
  const side = position.isLong ? "LONG" : "SHORT";
  const away = health?.liqDistanceBps ?? null;
  const label = `${meta?.name ?? symbol} ${side.toLowerCase()}, entry ${price18(position.entry, decimals)}${
    health
      ? `, ${health.upnlUsd6 < 0n ? "loss" : "profit"} ${signedMoney(health.upnlUsd6)}, ${liquidationLabel(away)}`
      : ""
  }`;
  return (
    <Link
      href={ROUTES.trade(symbol)}
      aria-label={label}
      className={cn(
        GRID,
        "border-border border-b px-3 py-2.5 transition-colors duration-(--motion-fast) ease-desk last:border-0 hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate font-mono font-semibold text-num-sm">{symbol}-PERP</span>
        <span className={cn("font-mono text-micro", position.isLong ? "text-up" : "text-down")}>
          {side} <span className="text-muted-foreground">· entry {price18(position.entry, decimals)}</span>
        </span>
      </span>
      {exposure !== undefined ? (
        <Num className="text-right text-caption">{compactMoney(exposure)}</Num>
      ) : (
        <Skeleton className="ml-auto h-3.5 w-12" />
      )}
      {health ? (
        <Num className="text-right text-caption text-muted-foreground">
          {health.liqPrice18 === null ? "—" : price18(health.liqPrice18, decimals)}
        </Num>
      ) : (
        <Skeleton className="ml-auto h-3.5 w-14" />
      )}
      {health ? (
        <span className="text-right">
          <Num className={cn("block text-caption", health.upnlUsd6 < 0n ? "text-down" : "text-up")}>
            {arrow(health.upnlUsd6)} {signedMoney(health.upnlUsd6)}
          </Num>
          <span
            className={cn("font-mono text-micro", away !== null && away <= 0n ? "text-down" : "text-muted-foreground")}
          >
            {liquidationLabel(away)}
          </span>
        </span>
      ) : market.status === "failed" ? (
        <span className="text-right text-micro text-warn">Price unavailable</span>
      ) : (
        <Skeleton className="ml-auto h-3.5 w-16" />
      )}
    </Link>
  );
}

/** D2 positions table: the account's open positions on this network, at `latest`. Rows open the market. */
export function PositionsTable({ address, className }: { address: Address; className?: string }) {
  const env = useQueryEnv();
  const positions = usePositions(address);
  const account = known(useAccountRisk(address, "latest"));
  const retry = useRetry(keys.account(env.chainId, address));
  return (
    <ReadingView
      reading={positions}
      loadingLabel="Reading positions"
      retry={retry}
      className={cn("p-3", className)}
      skeleton={<Skeleton className="h-10 w-full" />}
    >
      {(rows) =>
        rows.length === 0 ? (
          <p className={cn("border border-border p-4 text-caption text-muted-foreground", className)}>
            No open positions on this network. Open one from{" "}
            <Link href={ROUTES.markets} className="text-foreground underline underline-offset-4">
              Markets
            </Link>
            .
          </p>
        ) : (
          <div className={cn("border border-border", className)}>
            <div className={cn(GRID, "border-border border-b px-3 py-1.5 font-mono text-micro text-muted-foreground")}>
              <span>MKT</span>
              <span className="text-right">SIZE</span>
              <span className="text-right">LIQ</span>
              <span className="text-right">PNL</span>
            </div>
            {rows.map((p) => (
              <PositionRow key={p.marketId} position={p} account={account} />
            ))}
          </div>
        )
      }
    </ReadingView>
  );
}

/** "Positions · 3" once the count is known. */
export function usePositionCount(address: Address | undefined): number | undefined {
  return known(usePositions(address))?.length;
}

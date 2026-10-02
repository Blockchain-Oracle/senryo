"use client";

import type { EngineMarket } from "@senryo/config";
import { nextTransition, notional, type Reading, utcSlotLabel } from "@senryo/core";
import { ids } from "@senryo/identity";
import { useCalendar } from "@senryo/query";
import type { ReactNode } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { LeverageBadge, marketTitles } from "@/components/screens/markets/market-row";
import { known } from "@/components/ui/reading";
import { Skeleton } from "@/components/ui/skeleton";
import { ACTIVE_NETWORK } from "@/lib/constants/auth";
import { arrow, compactMoney, price18, priceDecimalsOf, signedPct } from "@/lib/format";
import type { MarketLine } from "@/lib/markets/line";
import { ageLabel, STATUS_LABEL, statusTone, useNowSec } from "@/lib/markets/session";
import { cn } from "@/lib/utils";

const MARK_PX = 40;

/** "Open · closes Fri 21:00 UTC" — the onchain status decides; the calendar only words when it changes next. */
function useSession(line: MarketLine, now: bigint): string {
  const calendar = useCalendar(line.market.calendarId);
  const week = known(calendar);
  const turn =
    week && now > 0n && line.status === "OPEN"
      ? nextTransition(week, now, false)
      : week && now > 0n && line.status === "CLOSED"
        ? nextTransition(week, now, true)
        : undefined;
  if (turn === undefined) return STATUS_LABEL[line.status];
  return `${STATUS_LABEL[line.status]} · ${line.status === "OPEN" ? "closes" : "opens"} ${utcSlotLabel(turn)}`;
}

function Fact({ term, children, className }: { term: string; children: ReactNode; className?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-3">{term}</dt>
      <dd className={cn("text-right text-foreground tabular-nums", className)}>{children}</dd>
    </div>
  );
}

function Facts({ line }: { line: MarketLine }) {
  const now = useNowSec();
  const session = useSession(line, now);
  const { book } = line.market;
  const openInterest = compactMoney(notional(book.longSize + book.shortSize, line.price18));
  return (
    <dl className="grid shrink-0 gap-x-6 text-meta sm:grid-cols-2">
      <Fact term="Session" className={statusTone(line.status)}>
        {session}
      </Fact>
      <Fact term="Oracle">Updated {ageLabel(line.updatedAt, now)}</Fact>
      <Fact term="Open interest">{openInterest}</Fact>
    </dl>
  );
}

/**
 * The trade header (F32/F35, the phone's `PriceBlock`): the market's mark and name with its max-leverage badge, the
 * oracle price as the page's dominant figure with the 24 h change under it, and the facts from the same read — session
 * (with the calendar's next change), oracle age, open interest from the engine's book, max leverage and fee.
 */
export function MarketHeader({ meta, reading }: { meta: EngineMarket; reading: Reading<MarketLine> }) {
  const { title, detail } = marketTitles(meta);
  const line = known(reading);
  const change = line?.change24hBps;
  return (
    <div className="grid gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <EntityMark id={ids.engineMarket(ACTIVE_NETWORK.chainId, meta.id)} size={MARK_PX} decorative />
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-sheet-title">
            {title}
            {line ? <LeverageBadge x={line.maxLeverageX} /> : null}
            <span className="font-normal text-meta text-text-3">
              {detail} · Senryo · {ACTIVE_NETWORK.modeLabel}
            </span>
          </h1>
          {line ? (
            <p className="font-display text-display-price tnum">
              ${price18(line.price18, priceDecimalsOf(meta.id))}{" "}
              <span
                className={cn(
                  "text-caption",
                  change === undefined ? "text-muted-foreground" : change >= 0n ? "text-up" : "text-down",
                )}
              >
                {change === undefined ? "24h —" : `${arrow(change)} ${signedPct(change)} 24h`}
              </span>
            </p>
          ) : reading.status === "failed" ? (
            <p className="text-caption text-warn">Price unavailable</p>
          ) : (
            <Skeleton className="mt-1 h-7 w-48" />
          )}
        </div>
      </div>
      {line ? <Facts line={line} /> : null}
    </div>
  );
}

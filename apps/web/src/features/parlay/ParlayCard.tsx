"use client";
/**
 * A market on Parlay's board (P3, D-326; the phone's `ParlayCard`): the real mark, symbol and name, the live price with
 * its 24 h line and change, and two sides — "↑ Up · 1.89×", "↓ Down · 1.94×" — priced for the selected lane
 * (`useLegPrices` → `indicativeOdds`: indicative; the slip's price is the chain's). Click a side to pick it, again to
 * drop it, the other side to switch. The mark is where a new leg's flight starts.
 */
import { indicativeOdds, PARLAY_SIDES, unitOf } from "@senryo/calls";
import { useDayLine, useLegPrices } from "@senryo/calls/react";
import type { CadenceSec } from "@senryo/config";
import { formatPrice, priceFromE8 } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { useLivePrice } from "@senryo/live/react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useRef } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { ChangeChip } from "@/components/ui/change-chip";
import { Sparkline } from "@/components/ui/sparkline";
import { cn } from "@/lib/utils";

const MARK = 32;
const ODDS_DECIMALS = 2;

export function ParlayCard({
  symbol,
  name,
  cadenceSec,
  minHalfSpreadE6,
  pickedBand,
  onPick,
}: {
  symbol: string;
  name: string;
  cadenceSec: CadenceSec;
  minHalfSpreadE6: number;
  pickedBand: number | undefined;
  onPick: (band: number, mark: HTMLElement | null) => void;
}) {
  const mark = useRef<HTMLSpanElement>(null);
  const priceE8 = useLivePrice(symbol);
  const day = useDayLine(symbol);
  const leg = useLegPrices([{ symbol, cadenceSec }]).legs[0];
  const price = formatPrice(priceE8 === undefined ? undefined : priceFromE8(priceE8), undefined, unitOf(symbol));
  return (
    <article aria-label={name} className="@container flex flex-col gap-3 rounded-2xl bg-secondary p-4">
      <div className="flex items-center gap-3">
        <span ref={mark} className="shrink-0">
          <EntityMark id={marketId(symbol)} size={MARK} decorative />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold text-row-title">{symbol}</span>
          <span className="truncate text-meta text-text-3">{name}</span>
        </span>
        {day ? <Sparkline symbol={symbol} day={day} className="shrink-0 @max-xs:hidden" /> : null}
        <span className="flex flex-col items-end gap-1">
          <span className="tnum font-semibold text-row-price">{price}</span>
          {day ? <ChangeChip symbol={symbol} day={day} suffix={false} /> : null}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {PARLAY_SIDES.map((side) => {
          // Between rounds the closing window's odds mean nothing for the next: no odds, the side picks a draft.
          const between = leg !== undefined && !leg.window.trading;
          const odds =
            leg && !between ? indicativeOdds(leg.sides[side.band] ?? null, minHalfSpreadE6, cadenceSec) : null;
          const on = pickedBand === side.band;
          const up = side.band === 0;
          const Arrow = up ? ArrowUp : ArrowDown;
          return (
            <button
              key={side.band}
              type="button"
              aria-pressed={on}
              disabled={odds === null && !on && !between}
              aria-label={`${on ? "Remove" : "Add"} ${symbol} ${side.label}${between ? ", for the next round" : odds === null ? ", not priced" : `, pays about ${odds.toFixed(ODDS_DECIMALS)} times`}`}
              onClick={() => onPick(side.band, mark.current)}
              className={cn(
                "press-lift flex h-11 items-center justify-center gap-1.5 rounded-full font-semibold text-button-compact transition-colors duration-(--motion-fast)",
                "focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40",
                on
                  ? up
                    ? "bg-up text-up-foreground"
                    : "bg-down text-down-foreground"
                  : "bg-(--shell-plate) hover:bg-accent",
              )}
            >
              <Arrow aria-hidden strokeWidth={2.5} className={cn("size-4", !on && (up ? "text-up" : "text-down"))} />
              <span className="tnum">
                {between ? side.label : `${side.label} · ${odds === null ? "—" : `${odds.toFixed(ODDS_DECIMALS)}×`}`}
              </span>
            </button>
          );
        })}
      </div>
    </article>
  );
}

"use client";
/**
 * The ride's risk, drawn (Q1, Codex direction 16 §1; `@senryo/calls` `rideLadder`; the phone's `RiskLadder`): two
 * rails on one rising price axis — UP on the left, DOWN on the right — each from its knock-out (a dashed crossbar) to
 * its cap (a solid one), the live price dashed across both and written once above, between the side names. Distances are true: more leverage visibly brings the
 * knock-out in. Clicking a level shows how far it is; its price shows otherwise. Each level is written once.
 */
import { type LadderLevel, ladderPriceText, type RideLadder, unitOf } from "@senryo/calls";
import { priceText } from "@senryo/core";
import { useState } from "react";
import { fire } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const PERCENT = 100;
const RAIL_AT = { up: 44, down: 56 } as const;
const PERCENT_PER_BPS = 100;
const ONE_DECIMAL = 1;

const top = (at: number) => `${(1 - at) * PERCENT}%`;
const moveText = (bps: number) => `${bps < 0 ? "−" : "+"}${Math.abs(bps / PERCENT_PER_BPS).toFixed(ONE_DECIMAL)}%`;

export function RiskLadder({ ladder, symbol, markE8 }: { ladder: RideLadder; symbol: string; markE8: bigint }) {
  const [open, setOpen] = useState<string | null>(null);
  const unit = unitOf(symbol);
  const label = (l: LadderLevel) => {
    const key = `${l.side}-${l.kind}`;
    const name = l.kind === "ko" ? "KO" : "Cap";
    const left = l.side === "up";
    return (
      <button
        key={key}
        type="button"
        aria-label={`${left ? "Up" : "Down"} ${l.kind === "ko" ? "knocks out" : "caps"} at ${priceText(l.priceE8, unit)}, ${moveText(l.moveBps)}`}
        onClick={() => {
          fire("tick", { cue: "tap" });
          setOpen((o) => (o === key ? null : key));
        }}
        className={cn(
          "tnum -translate-y-1/2 absolute whitespace-nowrap rounded px-1 text-meta focus-visible:outline-2 focus-visible:outline-ring",
          l.kind === "ko" ? "text-foreground" : "text-text-3",
        )}
        style={{
          top: top(l.at),
          ...(left
            ? { right: `calc(${PERCENT - RAIL_AT.up}% + 1.25rem)` }
            : { left: `calc(${RAIL_AT.down}% + 1.25rem)` }),
        }}
      >
        {name} {open === key ? moveText(l.moveBps) : ladderPriceText(l.priceE8, unit)}
      </button>
    );
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between text-meta">
        <span className="font-semibold text-up">UP ↑</span>
        <span className="tnum text-text-3">{priceText(markE8, unit)}</span>
        <span className="font-semibold text-down">DOWN ↓</span>
      </div>
      <div className="relative h-48">
        {(["up", "down"] as const).map((side) => {
          const [lo, hi] = ladder.bands[side];
          return (
            <div
              key={side}
              aria-hidden
              className={cn("-translate-x-1/2 absolute w-2.5 rounded-full", side === "up" ? "bg-up/30" : "bg-down/30")}
              style={{ left: `${RAIL_AT[side]}%`, top: top(hi), height: `${Math.max(0, hi - lo) * PERCENT}%` }}
            />
          );
        })}
        {ladder.levels.map((l) => (
          <div
            key={`tick-${l.side}-${l.kind}`}
            aria-hidden
            className={cn(
              "-translate-x-1/2 absolute h-0 w-7 border-foreground",
              l.kind === "ko" ? "border-t-2 border-dashed" : "border-t-3",
            )}
            style={{ left: `${RAIL_AT[l.side]}%`, top: top(l.at) }}
          />
        ))}
        <div
          aria-hidden
          className="absolute inset-x-0 h-0 border-text-3 border-t border-dashed"
          style={{ top: top(ladder.markAt) }}
        />
        {ladder.levels.map(label)}
      </div>
    </div>
  );
}

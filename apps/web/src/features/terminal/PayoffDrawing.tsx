"use client";
/**
 * What a call pays, drawn (Q1, Codex direction 16 §2; `@senryo/calls` `callPayoff`; the phone's `PayoffDrawing`): the
 * line across a rising price axis, each side's winning zone tinted where its edges sit, and in each zone a pay bar on
 * one shared scale — a bigger stake grows them; the dashed tick is the stake, so the bar past it is the profit.
 * Clicking a zone shows where it wins in place of its name. With balances hidden the bars keep only their odds.
 */
import { type CallPayoff, dollars, type PayoffZone, unitOf } from "@senryo/calls";
import { priceText } from "@senryo/core";
import { useState } from "react";
import { fire } from "@/lib/feedback";
import { masked } from "@/lib/shell/privacy";
import { cn } from "@/lib/utils";

const PERCENT = 100;
const GUTTER = "5.5rem";
const INSIDE = 0.72;
const MIN_BAR = 0.02;

const pct = (v: number) => `${v * PERCENT}%`;
/** A point along the bar track: the gutter plus a share of what's left. */
const along = (share: number) => `calc(${GUTTER} + (100% - ${GUTTER}) * ${share})`;

export function PayoffDrawing({
  payoff,
  lineE8,
  symbol,
  hidden,
}: {
  payoff: CallPayoff;
  lineE8: bigint | undefined;
  symbol: string;
  hidden: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const most = payoff.zones.reduce((m, z) => (z.payout !== null && z.payout > m ? z.payout : m), 0n);
  const share = (z: PayoffZone) =>
    Math.max(MIN_BAR, hidden ? (z.payout !== null && most > 0n ? Number(z.payout) / Number(most) : 0) : z.bar);
  return (
    <div className="relative h-54">
      {payoff.zones.map((z) => {
        const pays = z.payout === null ? "—" : masked(dollars(z.payout), hidden);
        const inside = share(z) > INSIDE;
        return (
          <button
            key={z.slot}
            type="button"
            aria-label={`${z.band.label} pays ${pays} if ${z.band.where}`}
            onClick={() => {
              fire("tick", { cue: "tap" });
              setOpen((o) => (o === z.slot ? null : z.slot));
            }}
            className={cn(
              "absolute inset-x-0 text-left focus-visible:outline-2 focus-visible:outline-ring",
              z.band.tone === "up" ? "bg-up/12" : z.band.tone === "down" ? "bg-down/12" : "bg-primary/10",
            )}
            style={{ top: pct(1 - z.to), height: pct(z.to - z.from) }}
          >
            <span
              className={cn(
                "-translate-y-1/2 absolute top-1/2 left-0 line-clamp-2 pr-2 font-semibold text-row",
                z.band.tone === "up" ? "text-up" : z.band.tone === "down" ? "text-down" : "text-foreground",
              )}
              style={{ width: GUTTER }}
            >
              {open === z.slot ? z.band.where : z.band.label}
            </span>
            <span
              aria-hidden
              className={cn(
                "-translate-y-1/2 absolute top-1/2 h-7 rounded-full transition-[width] duration-(--motion-base)",
                z.band.tone === "up" ? "bg-up" : z.band.tone === "down" ? "bg-down" : "bg-primary",
                z.payout === null && "opacity-30",
              )}
              style={{ left: GUTTER, width: `calc((100% - ${GUTTER}) * ${share(z)})` }}
            />
            <span
              className={cn(
                "tnum -translate-y-1/2 absolute top-1/2 font-semibold text-row",
                inside ? "text-background" : "text-foreground",
              )}
              style={
                inside
                  ? { right: `calc(100% - ${along(share(z))} + 0.5rem)` }
                  : { left: `calc(${along(share(z))} + 0.5rem)` }
              }
            >
              {pays}
            </span>
          </button>
        );
      })}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 h-0 border-foreground border-t border-dashed"
        style={{ top: pct(1 - payoff.lineAt) }}
      />
      {hidden ? null : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-0 border-text-3 border-l border-dashed"
          style={{ left: along(payoff.stakeBar) }}
        />
      )}
      {lineE8 !== undefined ? (
        <span
          className="tnum -translate-y-1/2 pointer-events-none absolute right-0 bg-background px-1 text-meta"
          style={{ top: pct(1 - payoff.lineAt) }}
        >
          {priceText(lineE8, unitOf(symbol))}
        </span>
      ) : null}
    </div>
  );
}

"use client";
/**
 * The parlay slip (S8.5; Owarine's slip: "Odds multiply / All-or-nothing / Pre-funded payout"): each leg with its
 * window's countdown and both sides' odds (21st Odds Display #36173, the picked side pressed, an arrow when it moved
 * since the pick), the stake, what it pays and how likely, and Place. Two to four legs; a leg closing, a side out of
 * the priced range or too little money says so in words.
 */
import {
  chanceText,
  multiplierText,
  PARLAY_SIDES,
  PARLAY_STAKES_USD,
  type ParlayPick,
  pickLine,
  sideOdds,
} from "@senryo/calls";
import type { ParlayQuoteView } from "@senryo/calls/react";
import { PARLAY } from "@senryo/config";
import { clockText, usd } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { X } from "lucide-react";
import { useRef } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { OddsDisplay } from "@/components/ui/odds-display";
import { fire } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const MARK = 32;
const USD = 1_000_000n;

export function ParlaySlip(p: {
  quote: ParlayQuoteView;
  halfSpreadE6: number;
  stake: bigint;
  onStake: (stake: bigint) => void;
  onPick: (pick: ParlayPick) => void;
  onRemove: (symbol: string) => void;
  onPlace: () => void;
  pending: string | null;
  balance: bigint | undefined;
}) {
  // Each side's odds when the leg was picked: the arrow says how it moved since.
  const firstOdds = useRef(new Map<string, number | null>());
  const legs = p.quote.legs;
  const q = p.quote.quote;
  const short = p.balance !== undefined && p.balance < p.stake;
  const why =
    legs.length < PARLAY.minLegs
      ? `Pick ${PARLAY.minLegs} to ${PARLAY.maxLegs} calls`
      : !p.quote.trading
        ? "A leg's window is closing — pick its next one"
        : q?.refusal
          ? "Not priced right now: a leg is out of range"
          : short
            ? "Not enough dollars for this stake"
            : null;
  return (
    <section aria-label="Parlay slip" className="flex flex-col gap-3">
      <h2 className="font-semibold text-section-title">Your parlay</h2>
      {legs.length === 0 ? (
        <p className="text-body text-text-2">Pick calls on the left. All must come true; the odds multiply.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {legs.map((l) => (
            <li key={l.pick.symbol} className="flex items-center gap-3 py-2">
              <EntityMark id={marketId(l.pick.symbol)} size={MARK} decorative />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold text-row-title">{pickLine(l.pick)}</span>
                <span className="tnum text-meta text-text-3">Closes in {clockText(l.window.closesIn)}</span>
              </span>
              {PARLAY_SIDES.map((side, i) => {
                const odds = sideOdds(l.sides[i] ?? null, p.halfSpreadE6);
                const key = `${l.pick.symbol}:${l.pick.cadenceSec}:${side.band}`;
                if (!firstOdds.current.has(key) && odds !== null) firstOdds.current.set(key, odds);
                return (
                  <OddsDisplay
                    key={side.band}
                    label={side.label}
                    odds={odds}
                    previousOdds={firstOdds.current.get(key)}
                    selected={l.pick.band === side.band}
                    onSelect={() => l.pick.band !== side.band && p.onPick({ ...l.pick, band: side.band })}
                    aria-label={`${l.pick.symbol} ${side.label}`}
                  />
                );
              })}
              <button
                type="button"
                aria-label={`Remove ${l.pick.symbol}`}
                onClick={() => p.onRemove(l.pick.symbol)}
                className="flex size-9 items-center justify-center rounded-full text-text-3 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <fieldset className="m-0 flex min-w-0 gap-2 border-0 p-0">
        <legend className="sr-only">Stake</legend>
        {PARLAY_STAKES_USD.map((d) => {
          const value = BigInt(d) * USD;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={p.stake === value}
              onClick={() => {
                fire("tick", { cue: "tap" });
                p.onStake(value);
              }}
              className={cn(
                "h-10 flex-1 rounded-full font-semibold text-button-compact focus-visible:outline-2 focus-visible:outline-ring",
                p.stake === value ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent",
              )}
            >
              ${d}
            </button>
          );
        })}
      </fieldset>
      <div className="flex items-baseline justify-between gap-3">
        <span className="tnum font-semibold text-section-title">{q && !q.refusal ? `Pays ${usd(q.payout)}` : "—"}</span>
        <span className="tnum text-meta text-text-2">
          {q && !q.refusal ? `${multiplierText(p.stake, q.payout)} · ${chanceText(q.chanceE6)}` : ""}
        </span>
      </div>
      <p className="min-h-5 text-meta text-text-3" role="status" aria-live="polite">
        {p.pending ?? why ?? "All must come true. One wrong call and the stake is the pool's."}
      </p>
      <button
        type="button"
        disabled={why !== null || p.pending !== null}
        onClick={p.onPlace}
        className="h-14 rounded-full bg-primary font-semibold text-button text-primary-foreground transition-opacity focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
      >
        Place parlay · {usd(p.stake)}
      </button>
    </section>
  );
}

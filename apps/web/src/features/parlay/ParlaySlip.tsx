"use client";
/**
 * The slip (P3, D-326; the phone's slip sheet — Owarine's "Pays 4.12×" hero, Mitoshi's hold-to-place): each leg with its
 * clock and both sides' indicative odds (switch a side in place, ✕ to drop it), what the whole parlay pays — the
 * chain's own quote, never the legs' odds multiplied — and how likely, the stake (presets or any amount), the least it
 * fills for, and a hold to place it; the button names whatever blocks it. A guest picks and prices freely; placing is
 * the passkey step with the slip kept. The sticky rail on wide screens; the drawer's body on narrow ones.
 */
import {
  chanceText,
  indicativeOdds,
  legClock,
  PARLAY_SIDES,
  PARLAY_STAKES_USD,
  type ParlayPick,
  payoutMultiple,
  placeWords,
  TOLERANCE_BPS,
  unpricedLine,
} from "@senryo/calls";
import type { ParlayQuoteView } from "@senryo/calls/react";
import type { CadenceSec } from "@senryo/config";
import { formatUnits, lane, parseUnits, usd, withTolerance } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { X } from "lucide-react";
import { useState } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { HoldButton } from "@/components/ui/hold-button";
import { fire } from "@/lib/feedback";
import { cn } from "@/lib/utils";

const MARK = 32;
const USD = 1_000_000n;
const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const ODDS_DECIMALS = 2;
const PRESETS = PARLAY_STAKES_USD.map((d) => BigInt(d) * USD);

export interface ParlaySlipProps {
  quote: ParlayQuoteView;
  minHalfSpreadE6: number;
  stake: bigint;
  onStake: (stake: bigint) => void;
  onPick: (pick: ParlayPick) => void;
  onRemove: (symbol: string) => void;
  onPlace: () => void;
  pending: string | null;
  balance: bigint | undefined;
  signedIn: boolean;
  limits: { min: bigint; max: bigint };
}

export function ParlaySlip(p: ParlaySlipProps) {
  const { legs, quote: q, now, trading } = p.quote;
  // Between rounds the legs' closing windows price nothing for the next: the price waits for it.
  const priced = trading && q !== null && !q.refusal;
  const multiple = priced ? payoutMultiple(p.stake, q.payout) : null;
  const first = legs[0];
  const place = placeWords({
    legs: legs.length,
    trading,
    nextOpensInSec: first ? Math.max(0, first.window.expiry - now) : 0,
    priced,
    refused: q?.refusal !== undefined && q.refusal !== null,
    short: p.signedIn && p.balance !== undefined && p.balance < p.stake,
    stake: p.stake,
  });
  return (
    <section aria-label="Parlay slip" className="flex flex-col gap-4">
      <h2 className="font-semibold text-section-title">Your parlay</h2>
      {legs.length === 0 ? (
        <p className="text-body text-text-2">Pick a side on a market to add your first leg.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {legs.map((l) => (
            <li key={l.pick.symbol} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2">
              <EntityMark id={marketId(l.pick.symbol)} size={MARK} decorative />
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold text-row-title">
                  {l.pick.symbol} · {lane(l.pick.cadenceSec)}
                </span>
                <span className="tnum truncate text-meta text-text-3">{legClock(l.window, now)}</span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${l.pick.symbol}`}
                onClick={() => {
                  fire("tick", { cue: "tap" });
                  p.onRemove(l.pick.symbol);
                }}
                className="grid size-9 place-items-center rounded-full text-text-3 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X aria-hidden className="size-4" />
              </button>
              <div className="col-span-3 grid grid-cols-2 gap-2">
                {PARLAY_SIDES.map((side) => {
                  const odds = l.window.trading
                    ? indicativeOdds(l.sides[side.band] ?? null, p.minHalfSpreadE6, l.pick.cadenceSec as CadenceSec)
                    : null;
                  const on = l.pick.band === side.band;
                  return (
                    <button
                      key={side.band}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        if (on) return;
                        fire("tick", { cue: "tap" });
                        p.onPick({ ...l.pick, band: side.band });
                      }}
                      className={cn(
                        "tnum h-9 rounded-full px-3 font-semibold text-button-compact focus-visible:outline-2 focus-visible:outline-ring",
                        on
                          ? side.band === 0
                            ? "bg-up text-up-foreground"
                            : "bg-down text-down-foreground"
                          : "bg-secondary hover:bg-accent",
                      )}
                    >
                      {odds === null ? side.label : `${side.label} ${odds.toFixed(ODDS_DECIMALS)}×`}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col items-center gap-1 py-2" role="status" aria-live="polite">
        <span className={cn("tnum font-display text-num-xl", priced ? "text-foreground" : "text-text-3")}>
          {multiple ? `Pays ${multiple}` : "—"}
        </span>
        <span className="tnum text-center text-meta text-text-2">
          {priced
            ? `${usd(q.payout)} if all ${legs.length} land · ${chanceText(q.chanceE6)} chance`
            : unpricedLine(legs.length, trading)}
        </span>
      </div>
      <StakePicker stake={p.stake} onStake={p.onStake} limits={p.limits} />
      <p className="text-center text-meta text-text-3">
        {p.pending ??
          (priced
            ? `Fills only if it still pays ${usd(withTolerance(q.payout, TOLERANCE_BPS))} or more. One miss and the stake is the pool's.`
            : "One miss and the stake is the pool's.")}
      </p>
      <HoldButton
        label={place.label}
        holdingLabel="Keep holding to place…"
        ready={place.ready}
        busy={p.pending !== null}
        onConfirm={p.onPlace}
      />
    </section>
  );
}

/** The presets, or any amount typed (the web has the keyboard; the phone's keypad is for touch). */
function StakePicker({
  stake,
  onStake,
  limits,
}: {
  stake: bigint;
  onStake: (stake: bigint) => void;
  limits: { min: bigint; max: bigint };
}) {
  const preset = PRESETS.includes(stake);
  const [text, setText] = useState(preset ? "" : formatUnits(stake, DOLLAR_DECIMALS, CENTS));
  const parsed = parseUnits(text === "" ? "0" : text, DOLLAR_DECIMALS);
  const typed = parsed.ok ? parsed.value : 0n;
  const problem =
    text === ""
      ? null
      : typed < limits.min
        ? `At least ${usd(limits.min)}`
        : typed > limits.max
          ? `At most ${usd(limits.max)} a parlay`
          : null;
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="sr-only">Stake</legend>
      <div className="flex gap-2">
        {PRESETS.map((v) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={stake === v}
            onClick={() => {
              fire("tick", { cue: "tap" });
              setText("");
              onStake(v);
            }}
            className={cn(
              "tnum h-10 flex-1 rounded-full font-semibold text-button-compact focus-visible:outline-2 focus-visible:outline-ring",
              stake === v ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-accent",
            )}
          >
            {usd(v)}
          </button>
        ))}
      </div>
      <label
        className={cn("flex h-11 items-center gap-2 rounded-full px-4", preset ? "bg-secondary" : "bg-selected-row")}
      >
        <span className="whitespace-nowrap text-meta text-text-3">Other amount $</span>
        <input
          inputMode="decimal"
          value={text}
          placeholder="0.00"
          aria-invalid={problem !== null}
          onChange={(e) => {
            const next = e.target.value.replace(/[^0-9.]/g, "");
            setText(next);
            const v = parseUnits(next === "" ? "0" : next, DOLLAR_DECIMALS);
            if (v.ok && v.value >= limits.min && v.value <= limits.max) onStake(v.value);
          }}
          className="tnum h-full w-full min-w-0 bg-transparent font-semibold text-body outline-none placeholder:text-text-3"
        />
      </label>
      {problem ? <span className="text-meta text-down">{problem}</span> : null}
    </fieldset>
  );
}

"use client";
/**
 * A call's settings (Q1, Codex direction 16 §2; the phone's `CallSettingsBody`): the call type, the stake as the hero
 * (the amount field opens on a click), what it pays drawn under it, the one rule worth a sentence, then the trail and
 * the fees each one line that opens. The old summary rows (stake again, pays if right, fees per side, settles at,
 * after this) are gone.
 */
import { CALL_MODES, type CallMode, callPayoff, dollars, type Offer, type Quotes, TRAIL_CENTS } from "@senryo/calls";
import { useState } from "react";
import { DisclosureRow } from "@/components/ui/disclosure-row";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { fire } from "@/lib/feedback";
import { masked, usePrivacy } from "@/lib/shell/privacy";
import { AmountField } from "./AmountField";
import { STAKE_PRESETS_USD } from "./constants";
import { PayoffDrawing } from "./PayoffDrawing";

const USD = 1_000_000n;

export interface CallSettingsProps {
  symbol: string;
  mode: CallMode;
  offer: Offer;
  quotes: Quotes;
  lineE8: bigint | undefined;
  stake: bigint;
  min: bigint;
  max: bigint;
  trailCents: number;
  available: bigint | undefined;
  onMode: (m: CallMode) => void;
  onStake: (v: bigint) => void;
  onTrail: (cents: number) => void;
}

export function CallSettings(p: CallSettingsProps) {
  const hidden = usePrivacy();
  const [editing, setEditing] = useState(false);
  const money = (v: bigint) => masked(dollars(v), hidden);
  const top = BigInt(STAKE_PRESETS_USD.at(-1) ?? 1) * USD;
  const payoff = callPayoff(p.offer, p.quotes, p.stake, top < p.max ? top : p.max);
  const fees = payoff.zones.flatMap((z) => (z.fee === null ? [] : [z.fee]));
  const low = fees.reduce((m, f) => (f < m ? f : m), fees[0] ?? 0n);
  const high = fees.reduce((m, f) => (f > m ? f : m), 0n);
  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        options={CALL_MODES}
        label="Call type"
        value={p.mode}
        onValueChange={(v) => {
          fire("tick", { cue: "toggle" });
          p.onMode(v as CallMode);
        }}
        fill
      />
      <button
        type="button"
        aria-expanded={editing}
        aria-label={`Stake ${money(p.stake)}. Edit`}
        onClick={() => {
          fire("tick", { cue: "tap" });
          setEditing((e) => !e);
        }}
        className="tnum self-start rounded-md font-semibold text-display-balance leading-none focus-visible:outline-2 focus-visible:outline-ring"
      >
        {money(p.stake)}
      </button>
      {editing ? (
        <AmountField
          label="Stake"
          hideLabel
          value={p.stake}
          presetsUsd={STAKE_PRESETS_USD}
          min={p.min}
          max={p.max}
          available={p.available}
          onChange={p.onStake}
        />
      ) : null}
      <PayoffDrawing payoff={payoff} lineE8={p.lineE8} symbol={p.symbol} hidden={hidden} />
      {p.mode === "updown" ? <p className="text-meta text-text-3">On the line refunds.</p> : null}
      <DisclosureRow title="Trail" value={`${p.trailCents}¢`}>
        <div className="flex flex-wrap gap-2">
          {TRAIL_CENTS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={c === p.trailCents}
              onClick={() => {
                fire("tick", { cue: "tap" });
                p.onTrail(c);
              }}
              className="terminal-preset px-3"
            >
              {c}¢
            </button>
          ))}
        </div>
      </DisclosureRow>
      {fees.length > 0 ? (
        <DisclosureRow title="Fees" value={low === high ? money(low) : `${money(low)}–${money(high)}`}>
          {payoff.zones.map((z) =>
            z.fee === null ? null : (
              <p key={z.slot} className="flex items-center gap-3 text-body">
                <span className="flex-1 text-text-3">In {z.band.label}'s price</span>
                <span className="tnum font-semibold">{money(z.fee)}</span>
              </p>
            ),
          )}
        </DisclosureRow>
      ) : null}
    </div>
  );
}

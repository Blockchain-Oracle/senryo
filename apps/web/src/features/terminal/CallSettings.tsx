"use client";
/**
 * A call's settings (Q1, Codex direction 16 §2; the phone's `CallSettingsBody`): the call type, the stake as the hero
 * (the amount field opens on a click), what it pays drawn under it, the one rule worth a sentence, then the trail and
 * the fees each one line that opens. The old summary rows (stake again, pays if right, fees per side, settles at,
 * after this) are gone.
 */
import {
  CALL_MODES,
  type CallMode,
  callPayoff,
  dollars,
  feeDollars,
  type Offer,
  type Quotes,
  TRAIL_CENTS,
} from "@senryo/calls";
import { useState } from "react";
import { DisclosureRow } from "@/components/ui/disclosure-row";
import { FactList } from "@/components/ui/fact-list";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { fire } from "@/lib/feedback";
import { masked, usePrivacy } from "@/lib/shell/privacy";
import { AmountField } from "./AmountField";
import { STAKE_PRESETS_USD } from "./constants";
import { MarksRuler } from "./MarksRuler";
import { PayoffDrawing } from "./PayoffDrawing";

const USD = 1_000_000n;

export interface CallSettingsProps {
  symbol: string;
  mode: CallMode;
  offer: Offer;
  quotes: Quotes;
  lineE8: bigint | undefined;
  /** The window the call goes into: the drawing's ring drains to its settlement. */
  window: { start: number; expiry: number };
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
  const fine = (v: bigint) => masked(feeDollars(v), hidden);
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
      <div className="flex flex-col">
        <span className="text-meta text-text-3">Stake</span>
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
      </div>
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
      <PayoffDrawing payoff={payoff} lineE8={p.lineE8} symbol={p.symbol} window={p.window} hidden={hidden} />
      {p.mode === "updown" ? <p className="text-meta text-text-3">On the line refunds.</p> : null}
      <DisclosureRow title="Trail" value={`${p.trailCents}¢`}>
        <MarksRuler
          marks={TRAIL_CENTS}
          value={p.trailCents}
          onChange={p.onTrail}
          format={(c) => `${c}¢`}
          label="Trail, bid cents"
        />
      </DisclosureRow>
      {fees.length > 0 ? (
        <DisclosureRow title="Fees" value={low === high ? fine(low) : `${fine(low)}–${fine(high)}`}>
          <FactList
            facts={payoff.zones.flatMap((z) =>
              z.fee === null ? [] : [{ label: `In ${z.band.label}'s price`, value: feeDollars(z.fee), money: true }],
            )}
          />
        </DisclosureRow>
      ) : null}
    </div>
  );
}

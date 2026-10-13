"use client";
/**
 * A ride's settings (Q1, D-344, Codex direction 16 §1; the phone's `RideSettingsBody`): the margin on one line (the
 * amount field opens on a click); Leverage — off, so the ride is 1×, until switched on, when one big multiple and a
 * marked slider over the market's marks appear; the risk drawn as a ladder; the trail and the fees each one line that
 * opens. Nothing repeated, nothing explained in a sentence.
 */
import {
  dollars,
  feeDollars,
  LEVERAGE_OFF_X,
  leverageMarks,
  leverageOn,
  RIDE_MARGIN_USD,
  RIDE_TRAIL_STEPS_BPS,
  type RideTermsLike,
  rideLadder,
  rideQuote,
  trailText,
} from "@senryo/calls";
import { SquarePen } from "lucide-react";
import { useState } from "react";
import { DisclosureRow } from "@/components/ui/disclosure-row";
import { FactList } from "@/components/ui/fact-list";
import { SwitchRow } from "@/components/ui/switch-row";
import { fire } from "@/lib/feedback";
import { masked, usePrivacy } from "@/lib/shell/privacy";
import { AmountField } from "./AmountField";
import { MarksRuler } from "./MarksRuler";
import { RiskLadder } from "./RiskLadder";

const LEVERAGE_ONE = 10_000;
const BPS_PER_PERCENT = 100;

export interface RideSettingsProps {
  symbol: string;
  markE8: bigint | null;
  margin: bigint;
  leverageBps: number;
  maxLeverageBps: number;
  /** The multiple leverage returns to when it's switched back on. */
  leverageOnX: number;
  trailBps: number;
  terms: RideTermsLike & { minMargin: bigint; maxMargin: bigint; earlyFeeBps: number; earlyWindowSec: number };
  available: bigint | undefined;
  onMargin: (v: bigint) => void;
  onLeverage: (x: number) => void;
  onTrail: (bps: number) => void;
}

export function RideSettings(p: RideSettingsProps) {
  const hidden = usePrivacy();
  const [editing, setEditing] = useState(false);
  const money = (v: bigint) => masked(dollars(v), hidden);
  const fine = (v: bigint) => masked(feeDollars(v), hidden);
  const on = leverageOn(p.leverageBps);
  const x = p.leverageBps / LEVERAGE_ONE;
  const marks = leverageMarks(p.maxLeverageBps);
  const up = p.markE8 ? rideQuote(true, p.margin, p.leverageBps, p.markE8, p.terms) : null;
  const down = p.markE8 ? rideQuote(false, p.margin, p.leverageBps, p.markE8, p.terms) : null;
  const ladder = up && down && p.markE8 ? rideLadder(up, down, p.markE8) : null;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={editing}
        onClick={() => {
          fire("tick", { cue: "tap" });
          setEditing((e) => !e);
        }}
        className="flex min-h-14 w-full items-center gap-3 rounded-md px-1 text-left focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="flex-1 font-medium text-row">Margin</span>
        <span className="tnum font-semibold text-title">{money(p.margin)}</span>
        <SquarePen aria-hidden className="size-4 text-text-3" />
      </button>
      {editing ? (
        <AmountField
          label="Margin"
          hideLabel
          value={p.margin}
          presetsUsd={RIDE_MARGIN_USD}
          min={p.terms.minMargin}
          max={p.terms.maxMargin}
          available={p.available}
          onChange={p.onMargin}
        />
      ) : null}
      <SwitchRow
        label="Leverage"
        on={on}
        onChange={(next) =>
          p.onLeverage(next ? Math.min(p.leverageOnX, marks.at(-1) ?? p.leverageOnX) : LEVERAGE_OFF_X)
        }
      />
      {on ? (
        <div className="flex flex-col gap-1">
          <p className="tnum font-semibold text-display-balance leading-none">{x}×</p>
          <MarksRuler marks={marks} value={x} onChange={p.onLeverage} format={(v) => `${v}×`} label="Leverage" />
        </div>
      ) : null}
      {ladder && p.markE8 ? <RiskLadder ladder={ladder} symbol={p.symbol} markE8={p.markE8} /> : null}
      <DisclosureRow title="Trail" value={trailText(p.trailBps)}>
        <MarksRuler
          marks={RIDE_TRAIL_STEPS_BPS}
          value={p.trailBps}
          onChange={p.onTrail}
          format={trailText}
          label="Trail, behind the best price"
        />
      </DisclosureRow>
      {up ? (
        <DisclosureRow title="Open fee" value={fine(up.fee)}>
          <FactList
            facts={[
              { label: "Close fee at today's price", value: feeDollars(up.closeFee), money: true },
              ...(p.terms.earlyFeeBps > 0
                ? [
                    {
                      label: `In profit within ${p.terms.earlyWindowSec} s`,
                      value: `up to ${p.terms.earlyFeeBps / BPS_PER_PERCENT}%`,
                    },
                  ]
                : []),
            ]}
          />
        </DisclosureRow>
      ) : null}
    </div>
  );
}

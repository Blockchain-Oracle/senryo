"use client";
/**
 * A call's settings (Codex direction 11 §2, R5.4/R5.7): the call type (Up/Down · Range · Moonshot/Crash — out of the
 * panel and into here), how each side wins in one sentence, the stake (presets, typed, a share of what's available),
 * the trail TRAIL arms at (cents behind the best bid per share), and the summary: stake, what each side pays if right,
 * the fees inside the price, when it settles, and the wallet after it.
 */
import { CALL_MODES, type CallMode, dollars, type Offer, type Quotes, TRAIL_CENTS } from "@senryo/calls";
import { P_ONE, priceText } from "@senryo/core";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { fire } from "@/lib/feedback";
import { masked, usePrivacy } from "@/lib/shell/privacy";
import { AmountField } from "./AmountField";
import { STAKE_PRESETS_USD } from "./constants";
import { SummaryRow } from "./OrderSummary";

const MS = 1_000;

export interface CallSettingsProps {
  mode: CallMode;
  offer: Offer;
  quotes: Quotes;
  lineE8: bigint | undefined;
  expiry: number;
  stake: bigint;
  min: bigint;
  max: bigint;
  trailCents: number;
  available: bigint | undefined;
  onMode: (m: CallMode) => void;
  onStake: (v: bigint) => void;
  onTrail: (cents: number) => void;
}

/** "Up wins above $82,289 at 20:00; Down wins below. Exactly on the line refunds." */
function winWords(p: CallSettingsProps): string {
  const at = new Date(p.expiry * MS).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const [a, b] = p.offer;
  if (p.mode === "updown" && p.lineE8 !== undefined)
    return `Up wins above ${priceText(p.lineE8)} at ${at}; Down wins below. Exactly on the line refunds.`;
  const sides = [a, b].filter((x) => x !== undefined).map((x) => `${x.label} wins ${x.where}`);
  return `${sides.join("; ")} at ${at}.`;
}

export function CallSettings(p: CallSettingsProps) {
  const hidden = usePrivacy();
  const money = (v: bigint) => masked(dollars(v), hidden);
  const sides = [
    [p.offer[0], p.quotes.first],
    [p.offer[1], p.quotes.second],
  ] as const;
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="font-semibold text-meta text-text-3 uppercase tracking-wide">Call type</h3>
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
        <p className="text-body text-text-2">{winWords(p)}</p>
      </section>
      <AmountField
        label="Stake"
        value={p.stake}
        presetsUsd={STAKE_PRESETS_USD}
        min={p.min}
        max={p.max}
        available={p.available}
        onChange={p.onStake}
      />
      <section className="flex flex-col gap-3">
        <h3 className="font-semibold text-meta text-text-3 uppercase tracking-wide">Trailing stop</h3>
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
        <p className="text-meta text-text-3">Behind the best bid per share, once you're past break-even.</p>
      </section>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-body">
        <SummaryRow k="Stake" v={money(p.stake)} />
        {sides.map(([side, q]) =>
          side && q && !q.refusal ? (
            <SummaryRow key={side.label} k={`${side.label} pays if right`} v={money(q.payout)} />
          ) : null,
        )}
        {sides.map(([side, q]) =>
          side && q && !q.refusal ? (
            <SummaryRow
              key={`${side.label}-fee`}
              k={`Fees in ${side.label}'s price`}
              v={money(p.stake - (q.payout * q.probE6) / P_ONE)}
            />
          ) : null,
        )}
        <SummaryRow
          k="Settles at"
          v={new Date(p.expiry * MS).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        />
        {p.available !== undefined ? <SummaryRow k="After this" v={money(p.available - p.stake)} /> : null}
      </dl>
    </div>
  );
}

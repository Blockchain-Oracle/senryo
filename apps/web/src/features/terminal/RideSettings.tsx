"use client";
/**
 * A ride's settings (Tradash's settings sheet, Codex direction 11 §2, R5.4/R5.7): the margin (presets up to the terms'
 * cap, typed, or a share of what's available), the leverage chips to the market's cap with the risk on each side in
 * words — "UP · Knocked out at $80,431 (−2.2%)" — the trail TRAIL arms at, and the summary: trade size, margin at
 * risk, fees, the most it can win and where that caps, its 4-hour life, and the wallet after it.
 */
import {
  capWords,
  dollars,
  knockOutWords,
  leverageChips,
  RIDE_MARGIN_USD,
  RIDE_TRAIL_STEPS_BPS,
  type RideTermsLike,
  rideQuote,
  trailText,
  unitOf,
} from "@senryo/calls";
import { priceText } from "@senryo/core";
import { fire } from "@/lib/feedback";
import { masked, usePrivacy } from "@/lib/shell/privacy";
import { AmountField } from "./AmountField";
import { SummaryRow } from "./OrderSummary";

const LEVERAGE_ONE = 10_000;
const SECONDS_PER_HOUR = 3_600;

export interface RideSettingsProps {
  symbol: string;
  markE8: bigint | null;
  margin: bigint;
  leverageBps: number;
  maxLeverageBps: number;
  trailBps: number;
  terms: RideTermsLike & {
    minMargin: bigint;
    maxMargin: bigint;
    maxLifeSec: number;
    earlyFeeBps: number;
    earlyWindowSec: number;
  };
  available: bigint | undefined;
  onMargin: (v: bigint) => void;
  onLeverage: (x: number) => void;
  onTrail: (bps: number) => void;
}

export function RideSettings(p: RideSettingsProps) {
  const hidden = usePrivacy();
  const unit = unitOf(p.symbol);
  const up = p.markE8 ? rideQuote(true, p.margin, p.leverageBps, p.markE8, p.terms) : null;
  const down = p.markE8 ? rideQuote(false, p.margin, p.leverageBps, p.markE8, p.terms) : null;
  const money = (v: bigint) => masked(dollars(v), hidden);
  return (
    <div className="flex flex-col gap-6">
      <AmountField
        label="Margin"
        value={p.margin}
        presetsUsd={RIDE_MARGIN_USD}
        min={p.terms.minMargin}
        max={p.terms.maxMargin}
        available={p.available}
        onChange={p.onMargin}
      />
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h3 className="font-semibold text-meta text-text-3 uppercase tracking-wide">Leverage</h3>
          <span className="text-meta text-text-3">Up to {p.maxLeverageBps / LEVERAGE_ONE}×</span>
        </div>
        <p className="tnum font-semibold text-display-balance leading-none">{p.leverageBps / LEVERAGE_ONE}×</p>
        <div className="flex flex-wrap gap-2">
          {leverageChips(p.maxLeverageBps).map((x) => (
            <button
              key={x}
              type="button"
              aria-pressed={x * LEVERAGE_ONE === p.leverageBps}
              onClick={() => {
                fire("tick", { cue: "tap" });
                p.onLeverage(x);
              }}
              className="terminal-preset min-w-14 px-3"
            >
              {x}×
            </button>
          ))}
        </div>
        {up && down ? (
          <ul className="flex flex-col gap-1 text-body">
            <li>
              <span className="font-semibold text-up">UP</span> · {knockOutWords(up, unit)}
            </li>
            <li>
              <span className="font-semibold text-down">DOWN</span> · {knockOutWords(down, unit)}
            </li>
            <li className="text-meta text-text-3">Knocked out when 90% of the margin is lost.</li>
          </ul>
        ) : (
          <p className="text-meta text-text-3">Waiting for a live price…</p>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="font-semibold text-meta text-text-3 uppercase tracking-wide">Trailing stop</h3>
        <div className="flex flex-wrap gap-2">
          {RIDE_TRAIL_STEPS_BPS.map((bps) => (
            <button
              key={bps}
              type="button"
              aria-pressed={bps === p.trailBps}
              onClick={() => {
                fire("tick", { cue: "tap" });
                p.onTrail(bps);
              }}
              className="terminal-preset px-3"
            >
              {trailText(bps)}
            </button>
          ))}
        </div>
        <p className="text-meta text-text-3">TRAIL arms this far behind the best price once you're past break-even.</p>
      </section>
      {up ? (
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 text-body">
          <SummaryRow k="Trade size" v={money(up.notional)} />
          <SummaryRow k="Margin at risk" v={money(p.margin)} />
          <SummaryRow k="Opening fee" v={money(up.fee)} />
          <SummaryRow k="Estimated closing fee" v={`about ${money(up.fee)}`} />
          <SummaryRow k="Early-close fee" v={`on a profit, ${p.terms.earlyWindowSec} s at most`} />
          <SummaryRow k="Max profit" v={money(up.reserve)} />
          {down ? <SummaryRow k="Up · Down" v={`${capWords(up, unit)} · ${priceText(down.capE8, unit)}`} /> : null}
          <SummaryRow k="Closes after" v={`${p.terms.maxLifeSec / SECONDS_PER_HOUR} h at most`} />
          {p.available !== undefined ? <SummaryRow k="After this" v={money(p.available - up.cost)} /> : null}
        </dl>
      ) : null}
    </div>
  );
}

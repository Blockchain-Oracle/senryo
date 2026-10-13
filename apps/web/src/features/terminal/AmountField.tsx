"use client";
/**
 * An amount in the order sheet (Tradash's SIZE block, Codex direction 11 §2, R5.7): "Available $Y", the presets and
 * Max as chips, the amount typed in dollars (checked against the terms and the wallet as it's typed), and a slider
 * of the share of what's available with marks at ¼, ½ and ¾. Exact amounts always; presets are conveniences.
 */
import { SIZE_STOPS } from "@senryo/calls";
import { formatUnits, parseUnits } from "@senryo/core";
import { useEffect, useState } from "react";
import { MarksSlider } from "@/components/ui/marks-slider";
import { fire } from "@/lib/feedback";
import { masked, usePrivacy } from "@/lib/shell/privacy";
import { cn } from "@/lib/utils";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const USD = 1_000_000n;
const PERCENT = 100;
const usd = (v: bigint) => `$${formatUnits(v, DOLLAR_DECIMALS, CENTS)}`;

export interface AmountFieldProps {
  label: string;
  /** The row that opened it already names the amount: the heading is read, not shown. */
  hideLabel?: boolean;
  value: bigint;
  presetsUsd: readonly number[];
  min: bigint;
  max: bigint;
  /** What the wallet holds (undefined for a guest: no Max, no slider). */
  available: bigint | undefined;
  onChange: (v: bigint) => void;
}

export function AmountField({ label, hideLabel, value, presetsUsd, min, max, available, onChange }: AmountFieldProps) {
  const hidden = usePrivacy();
  const [text, setText] = useState(formatUnits(value, DOLLAR_DECIMALS, CENTS));
  useEffect(() => setText(formatUnits(value, DOLLAR_DECIMALS, CENTS)), [value]);
  const cap = available !== undefined && available < max ? available : max;
  const parsed = parseUnits(text === "" ? "0" : text, DOLLAR_DECIMALS);
  const typed = parsed.ok ? parsed.value : 0n;
  const problem = !parsed.ok
    ? "Enter an amount in dollars"
    : typed < min
      ? `At least ${usd(min)}`
      : typed > cap
        ? available !== undefined && available < max
          ? `You have ${usd(available)}`
          : `At most ${usd(max)}`
        : null;
  const share = available && available > 0n ? Number((value * BigInt(PERCENT)) / available) : 0;
  const pick = (v: bigint) => {
    fire("tick", { cue: "tap" });
    onChange(v);
  };
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h3 className={cn("font-semibold text-meta text-text-3 uppercase tracking-wide", hideLabel && "sr-only")}>
          {label}
        </h3>
        {available !== undefined ? (
          <span className="text-meta text-text-3">Available {masked(usd(available), hidden)}</span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {presetsUsd.map((d) => {
          const v = BigInt(d) * USD;
          if (v > max) return null;
          return (
            <button
              key={d}
              type="button"
              aria-pressed={v === value}
              onClick={() => pick(v)}
              className="terminal-preset min-w-14 px-3"
            >
              ${d}
            </button>
          );
        })}
        {available !== undefined && cap >= min ? (
          <button type="button" aria-pressed={value === cap} onClick={() => pick(cap)} className="terminal-preset px-3">
            Max
          </button>
        ) : null}
      </div>
      <label className="flex flex-col gap-1">
        <span className="sr-only">{label} in dollars</span>
        <span className="flex items-center gap-1 rounded-xl bg-secondary px-3 py-2 font-semibold text-title">
          $
          <input
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => {
              if (!problem && typed > 0n) onChange(typed);
              else setText(formatUnits(value, DOLLAR_DECIMALS, CENTS));
            }}
            className={cn("tnum min-w-0 flex-1 bg-transparent outline-none")}
            aria-invalid={problem !== null}
          />
        </span>
        <span className={cn("min-h-4 text-meta", problem ? "text-down" : "text-text-3")}>
          {problem ?? (available ? `${share}% of available` : "")}
        </span>
      </label>
      {available && available >= min ? (
        <MarksSlider
          value={Number((value * BigInt(PERCENT)) / available)}
          min={0}
          max={PERCENT}
          step={1}
          stops={SIZE_STOPS}
          label={`${label} as a share of what's available`}
          valueText={`${share}% of available`}
          onValueChange={(pct) => {
            const next = (available * BigInt(pct)) / BigInt(PERCENT);
            onChange(next < min ? min : next > cap ? cap : next);
          }}
        />
      ) : null}
    </section>
  );
}

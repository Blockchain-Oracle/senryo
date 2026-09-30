"use client";

// 21st: designali-in/gauge-1 (#3719) — https://21st.dev/@designali-in/components/gauge-1
// Re-tokenized for D2 Desk and split on install (arc · value · index). Named colours map to tokens (danger → --down,
// warning → --warn, success → --up, info → --chart-5); no glow, no gradient, no multi-ring (unused by D2, and D2 has no
// glow). `half` is now a true semicircle; value counts with a 200 ms tween.

import type { SVGProps } from "react";
import { cn } from "@/lib/utils";
import { Arc, CENTER, type GaugeType, geometry, markerAt, splitArcs } from "./arc";
import { GaugeValue, useGaugeValue } from "./value";

type Named = "danger" | "warning" | "success" | "info";
/** a colour, a named tone, or `{ percentFrom: colour }` bands (e.g. `{ 0: "var(--up)", 60: "var(--gold)" }`) */
export type GaugeColor = Named | string | Readonly<Record<number, string>>;

export interface GaugeProps extends Omit<SVGProps<SVGSVGElement>, "className"> {
  value: number;
  /** rendered width in px (or any CSS length) */
  size?: number | string;
  gapPercent?: number;
  strokeWidth?: number;
  showValue?: boolean;
  showPercentage?: boolean;
  primary?: GaugeColor;
  secondary?: GaugeColor;
  thresholds?: ReadonlyArray<{ value: number; color: string; label?: string }>;
  gaugeType?: GaugeType;
  className?:
    | string
    | { svgClassName?: string; primaryClassName?: string; textClassName?: string; labelClassName?: string };
  label?: string;
  unit?: string;
  min?: number;
  max?: number;
  tickMarks?: boolean;
}

const NAMED: Record<Named, string> = {
  danger: "var(--down)",
  warning: "var(--warn)",
  success: "var(--up)",
  info: "var(--chart-5)",
};
const PERCENT = 100;
const HALF = 2;
const QUARTER = 25;
const HALF_MARK = 50;
const THREE_QUARTER = 75;
const TICKS = 8;
const TICK_LEN = 6;
const MARKER_GAP = 5;
const MARKER_R = 2;
const DECIMALS_FRACTION = 1;

function resolve(color: GaugeColor | undefined, pct: number, fallback: string): string {
  if (color === undefined) {
    if (fallback) return fallback;
    if (pct <= QUARTER) return NAMED.danger;
    if (pct <= HALF_MARK) return NAMED.warning;
    return pct <= THREE_QUARTER ? NAMED.info : NAMED.success;
  }
  if (typeof color === "string") return NAMED[color as Named] ?? color;
  const keys = Object.keys(color)
    .map(Number)
    .sort((a, b) => a - b);
  let picked = keys[0];
  for (const k of keys) if (pct >= k) picked = k;
  const c = picked === undefined ? undefined : color[picked];
  return c === undefined ? fallback : (NAMED[c as Named] ?? c);
}

export function Gauge({
  value,
  size = 150,
  gapPercent = 5,
  strokeWidth = 10,
  showValue = true,
  showPercentage = false,
  primary,
  secondary,
  thresholds,
  gaugeType = "full",
  className,
  label,
  unit = "%",
  min = 0,
  max = 100,
  tickMarks = false,
  ...props
}: GaugeProps) {
  const animated = useGaugeValue(value);
  const geo = geometry(gaugeType);
  const r = CENTER - strokeWidth / HALF;
  const pct = Math.max(0, Math.min(PERCENT, ((animated - min) / (max - min || 1)) * PERCENT));
  const arcs = splitArcs(geo, r, pct, gapPercent, gaugeType === "full");
  const decimals = value % 1 !== 0 ? DECIMALS_FRACTION : 0;
  const text = showValue
    ? `${animated.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${showPercentage ? unit : ""}`
    : null;
  const cls: Exclude<GaugeProps["className"], string | undefined> =
    typeof className === "object" ? className : className === undefined ? {} : { svgClassName: className };
  const width = typeof size === "number" ? size : undefined;

  return (
    <div className="relative inline-block">
      {/* biome-ignore lint/a11y/useSemanticElements: an SVG meter; <meter> cannot draw the arc */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={geo.viewBox}
        width={size}
        height={width === undefined ? undefined : width * geo.ratio}
        fill="none"
        role="meter"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label ?? "Gauge"}
        className={cn("select-none", cls.svgClassName)}
        {...props}
      >
        {tickMarks &&
          Array.from({ length: TICKS + 1 }, (_, i) => {
            const outer = markerAt(geo, r - strokeWidth / HALF, (i / TICKS) * PERCENT);
            const inner = markerAt(geo, r - strokeWidth / HALF - TICK_LEN, (i / TICKS) * PERCENT);
            return (
              <line
                key={i}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.3"
              />
            );
          })}
        <Arc d={arcs.secondary} stroke={resolve(secondary, PERCENT - pct, "var(--muted)")} width={strokeWidth} />
        <g className={typeof className === "object" ? className.primaryClassName : undefined}>
          <Arc d={arcs.primary} stroke={resolve(primary, pct, "")} width={strokeWidth} />
        </g>
        {thresholds?.map((t) => {
          const p = markerAt(geo, r + strokeWidth / HALF + MARKER_GAP, ((t.value - min) / (max - min || 1)) * PERCENT);
          return <circle key={`${t.value}-${t.color}`} cx={p.x} cy={p.y} r={MARKER_R} fill={t.color} />;
        })}
        <GaugeValue
          text={text}
          label={label}
          valueY={geo.valueY}
          labelY={geo.labelY}
          valueClassName={cls.textClassName}
          labelClassName={cls.labelClassName}
        />
      </svg>
    </div>
  );
}

export default Gauge;

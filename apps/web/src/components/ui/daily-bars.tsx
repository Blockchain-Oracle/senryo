"use client";

// 21st: eugeneshilow/stacked-activity (#29474) — https://21st.dev/@eugeneshilow/components/stacked-activity
// Ported: daily columns grown from one baseline, the hovered day's track band, per-day hit zones wider than the
// columns, the hatched partial last day (data honesty: today isn't over), clean {1, 2, 2.5, 5}×10^k scale steps and the
// grow-in stagger. Changed: one series per chart (two measures of different scale are two charts, never one stack or a
// second axis), the live legend lifted to the caller so two charts share one hovered day, every label in HTML so text
// never scales with the SVG, Living Lacquer tokens instead of the vizcn palette, motion/react with the lacquer ease
// (reduced motion draws the columns in place), hairlines that stay 1 device pixel at any width.

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { DESK_SLOW_S, deskTransition } from "@/lib/constants/charts";
import { DAILY_BARS, DECIMAL_BASE, NICE_STEP_BASES, NICE_STEP_MAX_EXP, NICE_STEP_MIN_EXP } from "@/lib/constants/stats";

const { width: W, height: H } = DAILY_BARS;
const MS_PER_S = 1000;
const HALF = 2;
/** Hatch stripe pitch and stroke (user units) and the partial day's fade. */
const HATCH_PITCH = 6;
const HATCH_STROKE = 2;
const PARTIAL_OPACITY = 0.6;

/** The scale's top: the smallest clean step ≥ the peak with headroom (counts, so never below 1). */
export function niceTop(peak: number): number {
  const target = Math.max(1, peak * DAILY_BARS.headroom);
  for (let exp = NICE_STEP_MIN_EXP; exp <= NICE_STEP_MAX_EXP; exp++) {
    for (const base of NICE_STEP_BASES) {
      const step = base * DECIMAL_BASE ** exp;
      if (step >= target && Number.isInteger(step)) return step;
    }
  }
  return Math.ceil(target);
}

/** A column with a rounded data end and a square foot on the baseline. */
function column(x: number, height: number, width: number): string {
  const r = Math.min(DAILY_BARS.radius, width / HALF, height);
  const y = H - height;
  return `M${x},${H}V${y + r}Q${x},${y} ${x + r},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${H}Z`;
}

export interface DailyBarsProps {
  /** Names the series for assistive tech (the visible title is the caller's). */
  label: string;
  /** One count per day, oldest first. */
  values: readonly number[];
  /** The hovered day, shared across charts; undefined when the pointer is away. */
  focus: number | undefined;
  onFocus: (index: number | undefined) => void;
  /** The last day is still running: hatch and fade it. */
  partialLast?: boolean;
  /** The series colour as a CSS value (a token: `var(--practice)`). */
  color: string;
}

export function DailyBars({ label, values, focus, onFocus, partialLast = false, color }: DailyBarsProps) {
  const reduced = useReducedMotion();
  const hatch = useId();
  const n = values.length;
  if (n === 0) return null;
  const peak = Math.max(...values);
  const top = niceTop(peak);
  const slot = W / n;
  const barW = Math.min(slot * DAILY_BARS.barShare, DAILY_BARS.maxBar);
  const left = (i: number) => slot * i + (slot - barW) / HALF;
  const tall = (v: number) => (v / top) * H;
  const lastValue = values[n - 1] ?? 0;
  const grow = (i: number) =>
    ({
      style: { transformBox: "fill-box", originY: 1 },
      initial: reduced ? false : { scaleY: 0 },
      animate: { scaleY: 1 },
      transition: deskTransition(DESK_SLOW_S, Math.min(i * DAILY_BARS.staggerMs, DAILY_BARS.staggerMaxMs) / MS_PER_S),
    }) as const;

  return (
    <div className="relative pt-2">
      {/* The top gridline's value: the scale for every column below it (the hovered value is the caller's legend). */}
      <span
        aria-hidden
        className="-translate-y-1/2 absolute top-2 left-0 bg-background pr-1.5 text-micro text-text-3 tnum"
      >
        {top}
      </span>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-pan-y overflow-visible"
        role="img"
        aria-label={`${label} per day: ${n} days, peak ${peak}`}
        onPointerLeave={() => onFocus(undefined)}
      >
        <defs>
          <pattern
            id={hatch}
            width={HATCH_PITCH}
            height={HATCH_PITCH}
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <line x1={0} y1={0} x2={0} y2={HATCH_PITCH} stroke="var(--background)" strokeWidth={HATCH_STROKE} />
          </pattern>
        </defs>
        <line x1={0} y1={0} x2={W} y2={0} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
        <line x1={0} y1={H} x2={W} y2={H} stroke="var(--border)" vectorEffect="non-scaling-stroke" />
        {focus !== undefined ? (
          <rect x={slot * focus} y={0} width={slot} height={H} fill="var(--row-pressed)" rx={DAILY_BARS.radius} />
        ) : null}
        {values.map((v, i) =>
          v > 0 ? (
            <motion.path
              key={i}
              d={column(left(i), tall(v), barW)}
              fill={color}
              opacity={partialLast && i === n - 1 ? PARTIAL_OPACITY : 1}
              {...grow(i)}
            />
          ) : null,
        )}
        {partialLast && lastValue > 0 ? (
          <motion.path
            d={column(left(n - 1), tall(lastValue), barW)}
            fill={`url(#${hatch})`}
            pointerEvents="none"
            {...grow(n - 1)}
          />
        ) : null}
        {values.map((_, i) => (
          <rect
            key={`hit-${i}`}
            x={slot * i}
            y={0}
            width={slot}
            height={H}
            fill="transparent"
            onPointerEnter={() => onFocus(i)}
            onPointerDown={() => onFocus(i)}
          />
        ))}
      </svg>
    </div>
  );
}

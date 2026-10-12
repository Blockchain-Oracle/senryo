"use client";
// From 21st.dev 30538 ssychui/balance-chart, by way of Mitoshi's table-cell sparkline (`../crypto-world-fair/web/src/
// components/ui/sparkline.tsx`), made passive for every price row (D-319, F7). Kept: the plain-SVG line over a fill
// fading to nothing, its colour read against a dashed baseline, `vector-effect: non-scaling-stroke` so the 1.6 px stroke
// survives the stretch. Changed: no scrubber, labels or crosshair (a row is a link; the terminal is where you read a
// price); the geometry is `@senryo/calls` `sparkGeometry` (gaps stay gaps; the live price closes it), shared with the
// phone's Skia path; the colours are the direction inks (D-316).
import { type DayLine, sparkGeometry } from "@senryo/calls";
import { useSampledPrice } from "@senryo/live/react";
import { useId } from "react";
import { cn } from "@/lib/utils";

const W = 96;
const H = 32;
const PAD = 3;
/** The live tail redraws once a second: a row's graph covers a day, not a tick. */
const TAIL_MS = 1_000;
const TONE_VAR = { up: "var(--up)", down: "var(--down)", flat: "var(--text-3)" } as const;

export function Sparkline({ symbol, day, className }: { symbol: string; day: DayLine; className?: string }) {
  const gid = useId().replace(/:/g, "");
  const nowE8 = useSampledPrice(symbol, TAIL_MS);
  const g = sparkGeometry(day, nowE8, W, H, PAD);
  if (!g) return <span aria-hidden className={cn("block h-6 w-16 sm:h-8 sm:w-24", className)} />;
  const hue = TONE_VAR[g.tone];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      className={cn("block h-6 w-16 overflow-visible sm:h-8 sm:w-24", className)}
    >
      <defs>
        <linearGradient id={`${gid}-f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hue} stopOpacity="0.08" />
          <stop offset="100%" stopColor={hue} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={g.area} fill={`url(#${gid}-f)`} />
      <line
        x1={0}
        x2={W}
        y1={g.baseY}
        y2={g.baseY}
        stroke="var(--text-3)"
        strokeOpacity={0.5}
        strokeDasharray="2 3"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={g.d}
        fill="none"
        stroke={hue}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

"use client";

// 21st: theshanelevine/loading-state (#23591) — https://21st.dev/@theshanelevine/components/loading-state
// Pixel-grid loader + shimmering label + live elapsed timer in mono tabular figures (the D2 terminal loader).
// Keyframes ship with the component (hoisted/deduped by React 19 via `href` + `precedence`).
import { useEffect, useState } from "react";
import { ORBIT_ORDER } from "@/lib/constants/loading-state";
import { cn } from "@/lib/utils";

const GRID = 3;
const CELLS = GRID * GRID;
const CHEVRON_STEP_MS = 90;
const ORBIT_STEP_MS = 110;
const TICK_MS = 100;
const TICKS_PER_S = 10;
const S_PER_MIN = 60;
const DIM_IDLE = 0.07;
const DIM_ACTIVE = 0.15;

const chevron = Array.from({ length: CELLS }, (_, i) => {
  const row = Math.floor(i / GRID);
  const col = i % GRID;
  return (col + Math.abs(row - 1)) * CHEVRON_STEP_MS;
});

const orbit = Array.from({ length: CELLS }, (_, i) => {
  const k = ORBIT_ORDER.indexOf(i as (typeof ORBIT_ORDER)[number]);
  return k === -1 ? null : k * ORBIT_STEP_MS;
});

export type LoadingVariant = "Drive" | "Dots" | "Orbit";

const PATTERNS: Record<LoadingVariant, { delays: (number | null)[]; dur: number; round: boolean }> = {
  Drive: { delays: chevron, dur: 650, round: false },
  Dots: { delays: chevron, dur: 650, round: true },
  Orbit: { delays: orbit, dur: 950, round: false },
};

const KEYFRAMES = `
@keyframes senryo-pixel-on { 0%, 100% { opacity: 0.12; } 50% { opacity: 1; } }
@keyframes senryo-shimmer-text { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
`;

function useElapsed() {
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTicks((d) => d + 1), TICK_MS);
    return () => clearInterval(t);
  }, []);
  const total = ticks / TICKS_PER_S;
  if (total < S_PER_MIN) return `${total.toFixed(1)}s`;
  return `${Math.floor(total / S_PER_MIN)}m ${(total % S_PER_MIN).toFixed(1)}s`;
}

export default function LoadingState({
  label,
  variant = "Drive",
  className,
}: {
  label: string;
  variant?: LoadingVariant;
  className?: string;
}) {
  const elapsed = useElapsed();
  const { delays, dur, round } = PATTERNS[variant];

  return (
    <div role="status" aria-live="polite" className={cn("flex w-fit items-center gap-2.5", className)}>
      <style href="senryo-loading-state" precedence="default">
        {KEYFRAMES}
      </style>
      <span aria-hidden className="grid grid-cols-3 gap-[0.09375rem]">
        {delays.map((d, i) => (
          <span
            key={i}
            className={cn("size-1 bg-foreground", round ? "rounded-full" : "rounded-[0.0625rem]")}
            style={{
              opacity: d === null ? DIM_IDLE : DIM_ACTIVE,
              animation: d === null ? "none" : `senryo-pixel-on ${dur}ms ease-in-out ${d}ms infinite`,
            }}
          />
        ))}
      </span>
      <span
        className="bg-clip-text font-medium text-num-sm text-transparent"
        style={{
          backgroundImage:
            "linear-gradient(90deg, var(--muted-foreground) 35%, var(--foreground) 50%, var(--muted-foreground) 65%)",
          backgroundSize: "200% 100%",
          animation: "senryo-shimmer-text 1.4s linear infinite",
        }}
      >
        {label}
      </span>
      <span className="font-mono text-caption text-muted-foreground tabular-nums">{elapsed}</span>
    </div>
  );
}

export { LoadingState };

"use client";

// 21st: ssychui/balance-chart (#30538) — https://21st.dev/@ssychui/components/balance-chart
// Re-tokenized for D2 Desk: data-driven frames (no seeded demo inside), bare by default (no card chrome),
// line hue from --chart-up/--chart-down, scrub dot/crosshair in HTML, pill glides on ease-desk (nothing bounces).
// S11b: `pills={false}` hands the timeframe row to the caller (`FramePills`), which loads one window at a time.

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type EquityFrame = {
  /** pill label and key, e.g. "24H" */
  id: string;
  /** equity samples, oldest → newest */
  values: readonly number[];
  /** x-axis labels, evenly spread */
  ticks: readonly string[];
  /** readout caption for sample `index` (hover card) */
  stamp?: (index: number) => string;
};

export interface BalanceChartProps {
  frames: readonly EquityFrame[];
  initialFrame?: string;
  formatValue?: (n: number, fractionDigits: number) => string;
  /** "bare" (D2 default) sits on the page; "card" draws the 21st surface + hairline */
  variant?: "bare" | "card";
  /** false: no timeframe row (the caller draws `FramePills` and switches `frames` itself) */
  pills?: boolean;
  className?: string;
}

/** The timeframe pills — the glide thumb under the chart. */
export function FramePills({
  ids,
  value,
  onChange,
}: {
  ids: readonly string[];
  value: string;
  onChange: (id: string) => void;
}) {
  const index = Math.max(0, ids.indexOf(value));
  return (
    <fieldset className="relative mx-auto mt-3 flex w-full max-w-90 min-w-0 gap-1 border-0 p-0">
      <legend className="sr-only">Timeframe</legend>
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 rounded-full bg-foreground/7 transition-transform duration-(--motion-slow) ease-desk motion-reduce:transition-none"
        style={{
          width: `calc((100% - ${ids.length - 1} * 0.25rem) / ${ids.length})`,
          transform: `translateX(calc(${index} * (100% + 0.25rem)))`,
        }}
      />
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-pressed={value === id}
          className={cn(
            "relative z-1 h-7 flex-1 rounded-full text-caption font-medium tabular-nums transition-colors duration-(--motion-base) ease-desk motion-reduce:transition-none",
            value === id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {id}
        </button>
      ))}
    </fieldset>
  );
}

const UP = "var(--chart-up)";
const DOWN = "var(--chart-down)";
const W = 640;
const H = 240;
const STROKE = 2.1;
const PAD_BOTTOM = 14;
const PAD_TOTAL = 44;
const SMOOTH_PASSES = 2;
const SMOOTH_RADIUS = 3;
const CATMULL = 6;
const DP = 2;
const PERCENT = 100;
const EDGE_PCT = 12;
const HALF = 0.5;
const SHIFT_STEP = 10;
const DECIMALS_PATH = 2;

const usd = (n: number, dp = DP) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

type Pt = { x: number; y: number };

/** Catmull-Rom through the samples as cubic Béziers, so a dense line reads as one smooth stroke. */
function smoothPath(pts: readonly Pt[]): string {
  const first = pts[0];
  if (!first || pts.length < DP) return "";
  const f = (n: number) => n.toFixed(DECIMALS_PATH);
  let d = `M${f(first.x)},${f(first.y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i] ?? first;
    const p0 = pts[i - 1] ?? p1;
    const p2 = pts[i + 1] ?? p1;
    const p3 = pts[i + DP] ?? p2;
    d += ` C${f(p1.x + (p2.x - p0.x) / CATMULL)},${f(p1.y + (p2.y - p0.y) / CATMULL)} ${f(p2.x - (p3.x - p1.x) / CATMULL)},${f(p2.y - (p3.y - p1.y) / CATMULL)} ${f(p2.x)},${f(p2.y)}`;
  }
  return d;
}

/** Two passes of a 7-sample mean — only used when points sit closer than two stroke widths. */
function smoothValues(vals: readonly number[]): number[] {
  let drawn = [...vals];
  for (let pass = 0; pass < SMOOTH_PASSES; pass++) {
    const src = drawn;
    drawn = src.map((_, i) => {
      const lo = Math.max(0, i - SMOOTH_RADIUS);
      const hi = Math.min(src.length - 1, i + SMOOTH_RADIUS);
      let sum = 0;
      for (let j = lo; j <= hi; j++) sum += src[j] ?? 0;
      return sum / (hi - lo + 1);
    });
  }
  return drawn;
}

/** An extreme near either edge aligns to that edge instead of centring half off the plot. */
function edge(x: number) {
  const pct = (x / W) * PERCENT;
  if (pct <= EDGE_PCT) return { left: 0 };
  if (pct >= PERCENT - EDGE_PCT) return { right: 0 };
  return { left: `${pct}%`, transform: "translateX(-50%)" };
}

export default function BalanceChart({
  frames,
  initialFrame,
  formatValue = usd,
  variant = "bare",
  pills = true,
  className,
}: BalanceChartProps) {
  const [tf, setTf] = useState(initialFrame ?? frames[0]?.id ?? "");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const frame = frames.find((f) => f.id === tf) ?? frames[0];
  const values = frame?.values ?? [];
  const n = values.length;

  const [plotW, setPlotW] = useState(W);
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setPlotW(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const smooth = plotW / Math.max(1, n - 1) < DP * STROKE;

  const chart = useMemo(() => {
    const drawn = smooth ? smoothValues(values) : [...values];
    const lo = Math.min(...drawn);
    const hi = Math.max(...drawn);
    const nx = (i: number) => (i / Math.max(1, n - 1)) * W;
    const ny = (v: number) => H - PAD_BOTTOM - ((v - lo) / (hi - lo || 1)) * (H - PAD_TOTAL);
    const xy = drawn.map((v, i) => ({ x: nx(i), y: ny(v) }));
    const path = smooth
      ? smoothPath(xy)
      : xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    const rawLo = Math.min(...values);
    const rawHi = Math.max(...values);
    return {
      pts: values.map((val, i) => ({ x: xy[i]?.x ?? 0, y: xy[i]?.y ?? 0, val })),
      path,
      area: `${path} L${W},${H} L0,${H} Z`,
      min: rawLo,
      max: rawHi,
      iMin: values.indexOf(rawLo),
      iMax: values.indexOf(rawHi),
      up: (values[n - 1] ?? 0) >= (values[0] ?? 0),
    };
  }, [values, n, smooth]);

  const last = chart.pts[n - 1];
  const maxPt = chart.pts[chart.iMax];
  const minPt = chart.pts[chart.iMin];
  if (!frame || !last || !maxPt || !minPt) return null;

  const hue = chart.up ? UP : DOWN;
  const hovered = hover != null ? chart.pts[hover] : undefined;
  const cardRight = hovered ? hovered.x / W < HALF : false;
  const clampIdx = (i: number) => Math.max(0, Math.min(n - 1, i));

  const scrubTo = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover(clampIdx(Math.round(((clientX - rect.left) / rect.width) * (n - 1))));
  };

  return (
    <div className={cn("w-full", variant === "card" && "rounded-lg border border-border bg-card p-3", className)}>
      <div
        className="rounded-md pb-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabIndex={0}
        role="slider"
        aria-label="Balance chart. Use the left and right arrow keys to read values."
        aria-valuemin={0}
        aria-valuemax={n - 1}
        aria-valuenow={hover ?? n - 1}
        aria-valuetext={formatValue((hovered ?? last).val, DP)}
        onFocus={() => setHover((h) => h ?? n - 1)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          const step = e.shiftKey ? SHIFT_STEP : 1;
          const at = hover ?? n - 1;
          const keys: Record<string, number> = { ArrowLeft: at - step, ArrowRight: at + step, Home: 0, End: n - 1 };
          if (e.key === "Escape") setHover(null);
          const next = keys[e.key];
          if (next === undefined) return;
          e.preventDefault();
          setHover(clampIdx(next));
        }}
      >
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="h-60 w-full cursor-crosshair touch-pan-y"
            preserveAspectRatio="none"
            role="img"
            aria-label={`Balance over ${frame.id}, ${formatValue(last.val, 0)} now`}
            onPointerDown={(e) => scrubTo(e.clientX)}
            onPointerMove={(e) => scrubTo(e.clientX)}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") setHover(null);
            }}
          >
            <defs>
              <linearGradient id="bcp-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={hue} stopOpacity="0.16" />
                <stop offset="100%" stopColor={hue} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={chart.area} fill="url(#bcp-fill)" />
            <path
              d={chart.path}
              fill="none"
              stroke={hue}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {hovered && (
            <>
              <i
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-0 border-l border-dashed border-chart-1/50"
                style={{ left: `${(hovered.x / W) * PERCENT}%` }}
              />
              <i
                aria-hidden
                className="pointer-events-none absolute block size-1.75 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[0.09375rem] ring-card"
                style={{
                  left: `${(hovered.x / W) * PERCENT}%`,
                  top: `${(hovered.y / H) * PERCENT}%`,
                  background: hue,
                }}
              />
            </>
          )}
          <span
            className="pointer-events-none absolute -mt-4.5 text-label font-medium text-muted-foreground tabular-nums"
            style={{ ...edge(maxPt.x), top: `${(maxPt.y / H) * PERCENT}%` }}
          >
            {formatValue(chart.max, 0)}
          </span>
          <span
            className="pointer-events-none absolute mt-2 text-label font-medium text-muted-foreground tabular-nums"
            style={{ ...edge(minPt.x), top: `${(minPt.y / H) * PERCENT}%` }}
          >
            {formatValue(chart.min, 0)}
          </span>
          {hovered && hover != null && (
            <div
              className="pointer-events-none absolute z-10 rounded-lg border border-border bg-card px-2.5 py-1.5"
              role="status"
              style={{
                left: `${(hovered.x / W) * PERCENT}%`,
                top: `clamp(0.125rem, calc(${(hovered.y / H) * PERCENT}% - 1.375rem), calc(100% - 3.25rem))`,
                transform: cardRight ? "translateX(0.875rem)" : "translateX(calc(-100% - 0.875rem))",
              }}
            >
              <div className="font-mono text-num-sm font-bold text-foreground tabular-nums">
                {formatValue(hovered.val, DP)}
              </div>
              {frame.stamp && <div className="text-micro text-muted-foreground">{frame.stamp(hover)}</div>}
            </div>
          )}
        </div>
      </div>
      <div className="mt-1 flex justify-between px-1 text-label text-muted-foreground tabular-nums">
        {frame.ticks.map((t, i) => (
          <span key={i}>{t}</span>
        ))}
      </div>
      {pills && (
        <FramePills
          ids={frames.map((f) => f.id)}
          value={frame.id}
          onChange={(id) => {
            setTf(id);
            setHover(null);
          }}
        />
      )}
    </div>
  );
}

export { BalanceChart };

"use client";

// 21st: ssychui/candle-chart (#22250) — https://21st.dev/@ssychui/components/candle-chart
// Re-tokenized for D2 Desk and split on install (scale · layers · volume · crosshair). Data-driven: pass `candles`
// (history oldest → newest). Defaults are the D2 ticket look: fill mode, no header chrome, banded price axis.
// Dropped from the source: the card-width drag handle (the desk pane owns width) and the seeded demo series.

import { motion, useReducedMotion } from "motion/react";
import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { deskTransition } from "@/lib/constants/charts";
import { cn } from "@/lib/utils";
import { Crosshair, CrosshairTip } from "./crosshair";
import { GridLayer, LastCloseGuide, type SeriesKind, SeriesLayer } from "./layers";
import {
  AXIS_W,
  type Candle,
  type CandleTimeframe,
  clamp,
  DATE_LABELS,
  DOWN,
  DRAG_Y_GAIN,
  fmtAxis,
  fmtDay,
  fmtUsd,
  GAP,
  HALF,
  MIN_FILL_H,
  MIN_FILL_W,
  MIN_VISIBLE,
  makeScale,
  PERCENT,
  TF_COUNT,
  TIMEFRAMES,
  UP,
  VB_H,
  VB_W,
  VOL_H,
  WHEEL_X,
  WHEEL_Y,
  Y_SCALE_MAX,
  Y_SCALE_MIN,
} from "./scale";
import { VolumeDivider, VolumeLayer } from "./volume";

export type { Candle } from "./scale";

export type CandleChartProps = {
  candles: readonly Candle[];
  symbol: string;
  /** market label after the symbol in the header; null hides it */
  exchange?: string | null;
  kind?: SeriesKind;
  priceFmt?: (n: number) => string;
  axisFmt?: (n: number) => string;
  /** header row with price + timeframe switch (off on the D2 ticket, which draws its own price chrome) */
  chrome?: boolean;
  /** true: the viewBox is measured from the pane in 1:1 px so type never scales */
  fill?: boolean;
  /** band the axis around the visible candles (true) or run it from 0 to `ceil` */
  banded?: boolean;
  ceil?: number;
  initialTimeframe?: CandleTimeframe;
  className?: string;
  /** plot height in fill mode */
  plotClassName?: string;
};

const FIXED_PCT = 2;

export default function CandleChart({
  candles,
  symbol,
  exchange = null,
  kind = "candles",
  priceFmt = fmtUsd,
  axisFmt = fmtAxis,
  chrome = false,
  fill = true,
  banded = true,
  ceil = 0,
  initialTimeframe = "6M",
  className,
  plotClassName = "h-72",
}: CandleChartProps) {
  const reduced = useReducedMotion();
  const [timeframe, setTimeframe] = useState<CandleTimeframe>(initialTimeframe);
  const [visible, setVisible] = useState(TF_COUNT[initialTimeframe]);
  const [hover, setHover] = useState<number | null>(null);
  const [zone, setZone] = useState<"price" | "volume">("price");
  const [volH, setVolH] = useState(VOL_H);
  const [yScale, setYScale] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const axisZoneRef = useRef<HTMLDivElement>(null);
  const dateAxisRef = useRef<HTMLDivElement>(null);
  const volDrag = useRef(false);
  const yDrag = useRef<{ startY: number; startS: number } | null>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = plotRef.current;
    if (!fill || !el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setBox({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);

  const total = candles.length;
  useEffect(() => {
    const axis = axisZoneRef.current;
    const dates = dateAxisRef.current;
    const onAxisWheel = (e: WheelEvent) => {
      e.preventDefault();
      setYScale((s) => clamp(s * Math.exp(e.deltaY * WHEEL_Y), Y_SCALE_MIN, Y_SCALE_MAX));
    };
    const onDateWheel = (e: WheelEvent) => {
      e.preventDefault();
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      setHover(null);
      setVisible((v) => Math.round(clamp(v + d * WHEEL_X, MIN_VISIBLE, Math.max(MIN_VISIBLE, total))));
    };
    axis?.addEventListener("wheel", onAxisWheel, { passive: false });
    dates?.addEventListener("wheel", onDateWheel, { passive: false });
    return () => {
      axis?.removeEventListener("wheel", onAxisWheel);
      dates?.removeEventListener("wheel", onDateWheel);
    };
  }, [total]);

  const view = useMemo(() => candles.slice(total - Math.min(visible, total)), [candles, total, visible]);
  const maxVolume = useMemo(() => Math.max(...view.map((k) => k.v)), [view]);
  const vn = view.length;
  const vbox = {
    vw: fill && box ? Math.max(MIN_FILL_W, box.w) : VB_W,
    vh: fill && box ? Math.max(MIN_FILL_H, box.h) : VB_H,
  };
  const scale = makeScale(view, vbox, volH, yScale, banded, ceil);
  const dateLabels = useMemo(
    () => Array.from({ length: DATE_LABELS }, (_, i) => view[Math.min(vn - 1, Math.floor((i * vn) / DATE_LABELS))]),
    [view, vn],
  );

  const first = view[0];
  const last = view[vn - 1];
  const active = view[Math.min(hover ?? vn - 1, vn - 1)];
  if (!first || !last || !active) return null;
  const up = active.c >= active.o;
  const totalPct = ((last.c - first.o) / (first.o || 1)) * PERCENT;
  const totalUp = totalPct >= 0;

  const onMove = (e: PointerEvent) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r) return;
    const px = ((e.clientX - r.left) / r.width) * scale.vw;
    const py = ((e.clientY - r.top) / r.height) * scale.vh;
    setHover(clamp(Math.floor(px / scale.slot), 0, vn - 1));
    setZone(py > scale.plotH + GAP / HALF ? "volume" : "price");
  };

  return (
    <div className={cn(fill ? "flex w-full flex-col" : "w-full", className)}>
      {chrome && (
        <div className="flex shrink-0 items-end justify-between px-3 pt-3">
          <div>
            <div className="flex items-center gap-2 font-mono text-micro uppercase tracking-label text-muted-foreground">
              <span>{symbol}</span>
              {exchange && <span className="opacity-60">· {exchange}</span>}
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-mono text-num-ticker text-foreground tabular-nums">{priceFmt(last.c)}</span>
              <span className="font-mono text-caption tabular-nums" style={{ color: totalUp ? UP : DOWN }}>
                {totalUp ? "+" : "−"}
                {Math.abs(totalPct).toFixed(FIXED_PCT)}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-0.5 rounded-full border border-border p-0.5">
            {TIMEFRAMES.map((tf) => {
              const on = tf === timeframe;
              return (
                <button
                  key={tf}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setTimeframe(tf);
                    setVisible(TF_COUNT[tf]);
                    setHover(null);
                  }}
                  className={cn(
                    "relative rounded-full px-2.5 py-1 font-mono text-micro transition-colors duration-(--motion-base) ease-desk",
                    on ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {on && (
                    <motion.span
                      layoutId={`cc-tf-${symbol}`}
                      className="absolute inset-0 rounded-full bg-foreground/8"
                      transition={reduced ? { duration: 0 } : deskTransition()}
                    />
                  )}
                  <span className="relative">{tf}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div ref={plotRef} className={cn("relative", chrome && "mt-3", fill && plotClassName)}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${scale.vw} ${scale.vh}`}
          className={cn("touch-none", fill ? "h-full w-full" : "w-full")}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          role="img"
          aria-label={`${symbol} candlestick chart, last ${priceFmt(last.c)}`}
        >
          <GridLayer scale={scale} axisFmt={axisFmt} />
          <LastCloseGuide scale={scale} close={last.c} />
          <SeriesLayer view={view} scale={scale} kind={kind} hover={hover} up={totalUp} />
          <VolumeLayer view={view} scale={scale} volH={volH} maxVolume={maxVolume} hover={hover} />
          {hover !== null && <Crosshair scale={scale} index={hover} active={active} up={up} axisFmt={axisFmt} />}
        </svg>

        <div
          ref={axisZoneRef}
          aria-hidden
          className="absolute inset-y-0 right-0 z-5 cursor-ns-resize touch-none select-none"
          style={{ width: `${(AXIS_W / scale.vw) * PERCENT}%` }}
          onPointerDown={(e) => {
            yDrag.current = { startY: e.clientY, startS: yScale };
            e.currentTarget.setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = yDrag.current;
            if (!d) return;
            const h = svgRef.current?.getBoundingClientRect().height || scale.vh;
            setYScale(clamp(d.startS * Math.exp(((e.clientY - d.startY) / h) * DRAG_Y_GAIN), Y_SCALE_MIN, Y_SCALE_MAX));
          }}
          onPointerUp={() => {
            yDrag.current = null;
          }}
          onPointerCancel={() => {
            yDrag.current = null;
          }}
        />

        <VolumeDivider scale={scale} volH={volH} setVolH={setVolH} svgRef={svgRef} dragging={volDrag} />

        {hover !== null && (
          <CrosshairTip
            scale={scale}
            index={hover}
            active={active}
            zone={zone}
            flip={hover > vn / HALF}
            priceFmt={priceFmt}
          />
        )}
      </div>

      <div
        ref={dateAxisRef}
        className="mt-2 flex shrink-0 cursor-ew-resize touch-none select-none justify-between border-t border-border pt-2"
        style={{ paddingRight: `${(AXIS_W / scale.vw) * PERCENT}%` }}
      >
        {dateLabels.map((k, i) =>
          k ? (
            <span key={i} className="font-mono text-micro text-muted-foreground tabular-nums">
              {fmtDay(k.t)}
            </span>
          ) : null,
        )}
      </div>
    </div>
  );
}

export { CandleChart };

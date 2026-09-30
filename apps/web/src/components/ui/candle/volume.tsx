"use client";

// 21st: ssychui/candle-chart (#22250) — volume strip + the draggable price/volume divider.

import type { RefObject } from "react";
import {
  type Candle,
  clamp,
  DIM_VOL,
  DOWN,
  GAP,
  HALF,
  MAX_VOL,
  MIN_VOL,
  PERCENT,
  type Scale,
  UP,
  VOL_KEY_STEP,
  VOL_OPACITY,
} from "./scale";

export function VolumeLayer({
  view,
  scale,
  volH,
  maxVolume,
  hover,
}: {
  view: readonly Candle[];
  scale: Scale;
  volH: number;
  maxVolume: number;
  hover: number | null;
}) {
  return (
    <g transform={`translate(0 ${scale.plotH + GAP})`}>
      {view.map((k, i) => {
        const h = (k.v / (maxVolume || 1)) * volH;
        return (
          <rect
            key={k.t}
            x={scale.xMid(i) - scale.bodyW / HALF}
            y={volH - h}
            width={scale.bodyW}
            height={h}
            fill={k.c >= k.o ? UP : DOWN}
            fillOpacity={hover !== null && hover !== i ? DIM_VOL : VOL_OPACITY}
          />
        );
      })}
    </g>
  );
}

/** Drag (or ↑/↓) to trade price-pane height for volume-pane height. */
export function VolumeDivider({
  scale,
  volH,
  setVolH,
  svgRef,
  dragging,
}: {
  scale: Scale;
  volH: number;
  setVolH: (update: (v: number) => number) => void;
  svgRef: RefObject<SVGSVGElement | null>;
  dragging: RefObject<boolean>;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable splitter (WAI-ARIA window splitter) — <hr> cannot hold the grip
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize volume pane"
      aria-valuenow={Math.round(volH)}
      aria-valuemin={MIN_VOL}
      aria-valuemax={MAX_VOL}
      tabIndex={0}
      className="group absolute inset-x-0 z-10 flex h-3 -translate-y-1/2 cursor-ns-resize touch-none select-none items-center justify-center outline-none focus-visible:ring-1 focus-visible:ring-ring"
      style={{ top: `${((scale.plotH + GAP / HALF) / scale.vh) * PERCENT}%` }}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const r = svgRef.current?.getBoundingClientRect();
        if (!r) return;
        const vy = ((e.clientY - r.top) / r.height) * scale.vh;
        setVolH(() => clamp(scale.vh - vy - GAP / HALF, MIN_VOL, MAX_VOL));
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerCancel={() => {
        dragging.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setVolH((v) => Math.min(MAX_VOL, v + VOL_KEY_STEP));
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setVolH((v) => Math.max(MIN_VOL, v - VOL_KEY_STEP));
        }
      }}
    >
      <span className="h-0.75 w-8 rounded-full bg-foreground/35 opacity-0 transition-opacity duration-(--motion-base) group-hover:opacity-100 group-focus-visible:opacity-100" />
    </div>
  );
}

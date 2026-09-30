"use client";

// 21st: ssychui/candle-chart (#22250) — crosshair (SVG) and the OHLC / volume readout (HTML).

import {
  AXIS_W,
  type Candle,
  CROSS,
  CROSS_H,
  clamp,
  DOWN,
  fmtStamp,
  PERCENT,
  type Scale,
  TAG_H,
  TAG_HALF,
  UP,
} from "./scale";

const DOT_R = 3;
const DOT_STROKE = 1.5;
const TAG_RX = 3;
const TAG_TEXT_X = 4;
const TAG_TEXT_Y = 11;
const TAG_FONT = 8.5;
const TAG_OPACITY = 0.7;
const FIXED_PCT = 2;
const OHLC = [
  ["o", "Open"],
  ["h", "High"],
  ["l", "Low"],
  ["c", "Close"],
] as const;

export function Crosshair({
  scale,
  index,
  active,
  up,
  axisFmt,
}: {
  scale: Scale;
  index: number;
  active: Candle;
  up: boolean;
  axisFmt: (n: number) => string;
}) {
  const x = scale.xMid(index);
  const y = scale.yPrice(active.c);
  const hue = up ? UP : DOWN;
  return (
    <g pointerEvents="none">
      <line x1={x} x2={x} y1={0} y2={scale.vh} stroke={CROSS} strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <line x1={0} x2={scale.plotW} y1={y} y2={y} stroke={CROSS_H} strokeDasharray="3 3" strokeWidth="1" />
      <circle cx={x} cy={y} r={DOT_R} fill={hue} stroke="var(--surface)" strokeWidth={DOT_STROKE} />
      <g transform={`translate(${scale.plotW}, ${clamp(y, TAG_HALF, scale.plotH - TAG_HALF) - TAG_HALF})`}>
        <rect
          x={0}
          y={0}
          width={AXIS_W - FIXED_PCT}
          height={TAG_H}
          rx={TAG_RX}
          fill="var(--surface)"
          stroke={hue}
          strokeOpacity={TAG_OPACITY}
        />
        <text
          x={TAG_TEXT_X}
          y={TAG_TEXT_Y}
          fontSize={TAG_FONT}
          fontWeight={600}
          fill={hue}
          className="font-mono tabular-nums"
        >
          {axisFmt(active.c)}
        </text>
      </g>
    </g>
  );
}

export function CrosshairTip({
  scale,
  index,
  active,
  zone,
  flip,
  priceFmt,
}: {
  scale: Scale;
  index: number;
  active: Candle;
  zone: "price" | "volume";
  flip: boolean;
  priceFmt: (n: number) => string;
}) {
  const change = active.c - active.o;
  const up = change >= 0;
  const pct = (change / (active.o || 1)) * PERCENT;
  return (
    <div
      className="pointer-events-none absolute top-1 z-10 min-w-32.5 rounded-lg border border-border bg-surface px-3 py-2.5"
      style={{
        left: `${(scale.xMid(index) / scale.vw) * PERCENT}%`,
        transform: flip ? "translateX(calc(-100% - 0.75rem))" : "translateX(0.75rem)",
      }}
      role="status"
    >
      <div className="font-mono text-micro text-muted-foreground">{fmtStamp(active.t)}</div>
      {zone === "volume" ? (
        <div className="mt-1.5 flex items-center justify-between gap-4">
          <span className="text-micro text-muted-foreground">Volume</span>
          <span className="font-mono text-label text-foreground tabular-nums">{active.v.toFixed(1)}M</span>
        </div>
      ) : (
        <div className="mt-1.5 flex flex-col gap-1">
          {OHLC.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-micro text-muted-foreground">{label}</span>
              <span className="font-mono text-label text-foreground tabular-nums">{priceFmt(active[key])}</span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4">
            <span className="text-micro text-muted-foreground">Chg</span>
            <span className="font-mono text-label tabular-nums" style={{ color: up ? UP : DOWN }}>
              {up ? "+" : "−"}
              {Math.abs(pct).toFixed(FIXED_PCT)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

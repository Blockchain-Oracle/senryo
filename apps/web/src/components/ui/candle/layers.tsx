"use client";

// 21st: ssychui/candle-chart (#22250) — price layers: gridlines + right scale, last-close guide, candles/line/bars.

import { motion, useReducedMotion } from "motion/react";
import { DESK_SLOW_S, deskTransition } from "@/lib/constants/charts";
import {
  AXIS_BASELINE,
  AXIS_BOTTOM_PAD,
  AXIS_FONT,
  AXIS_INSET,
  AXIS_TEXT,
  AXIS_TOP_MIN,
  AXIS_W,
  type Candle,
  clamp,
  DIM_CANDLE,
  DOWN,
  GRID,
  HALF,
  type Scale,
  TAG_H,
  TAG_HALF,
  UP,
} from "./scale";

const LINE_W = 1.6;
const LINE_FILL = 0.07;

export function GridLayer({ scale, axisFmt }: { scale: Scale; axisFmt: (n: number) => string }) {
  return (
    <>
      {scale.ticks.map((t) => (
        <g key={t}>
          <line x1={0} x2={scale.plotW} y1={scale.yPrice(t)} y2={scale.yPrice(t)} stroke={GRID} strokeWidth="1" />
          <text
            x={scale.vw - AXIS_INSET}
            y={clamp(scale.yPrice(t) + AXIS_BASELINE, AXIS_TOP_MIN, scale.plotH - AXIS_BOTTOM_PAD)}
            textAnchor="end"
            fill={AXIS_TEXT}
            fontSize={AXIS_FONT}
            className="font-mono tabular-nums"
          >
            {axisFmt(t)}
          </text>
        </g>
      ))}
    </>
  );
}

const TAG_RX = 3;
const TAG_INSET = 2;
const TAG_TEXT_X = 4;
const TAG_TEXT_Y = 11;

/** The last close — or, with `label`, the live price — as a dotted line, its value tagged on the price axis. */
export function LastCloseGuide({ scale, close, label }: { scale: Scale; close: number; label?: string | undefined }) {
  const y = scale.yPrice(close);
  return (
    <g pointerEvents="none">
      <line
        x1={0}
        x2={scale.plotW}
        y1={y}
        y2={y}
        stroke={UP}
        strokeOpacity="0.4"
        strokeDasharray="2 4"
        strokeWidth="1"
      />
      {label ? (
        <g transform={`translate(${scale.plotW}, ${clamp(y, TAG_HALF, scale.plotH - TAG_HALF) - TAG_HALF})`}>
          <rect x={0} y={0} width={AXIS_W - TAG_INSET} height={TAG_H} rx={TAG_RX} fill={UP} />
          <text
            x={TAG_TEXT_X}
            y={TAG_TEXT_Y}
            fontSize={AXIS_FONT}
            fontWeight={600}
            fill="var(--up-foreground)"
            className="font-mono tabular-nums"
          >
            {label}
          </text>
        </g>
      ) : null}
    </g>
  );
}

export type SeriesKind = "candles" | "line" | "bars";

export function SeriesLayer({
  view,
  scale,
  kind,
  hover,
  up,
}: {
  view: readonly Candle[];
  scale: Scale;
  kind: SeriesKind;
  hover: number | null;
  up: boolean;
}) {
  const reduced = useReducedMotion();
  const { xMid, yPrice, bodyW } = scale;
  const halfBody = bodyW / HALF;
  const linePath = view.map((k, i) => `${i ? "L" : "M"}${xMid(i).toFixed(1)} ${yPrice(k.c).toFixed(1)}`).join(" ");
  return (
    <motion.g
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reduced ? { duration: 0 } : deskTransition(DESK_SLOW_S)}
    >
      {kind === "line" ? (
        <>
          <path
            d={linePath}
            fill="none"
            stroke={up ? UP : DOWN}
            strokeWidth={LINE_W}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={`${linePath} L${xMid(view.length - 1).toFixed(1)} ${scale.plotH} L${xMid(0).toFixed(1)} ${scale.plotH} Z`}
            fill={up ? UP : DOWN}
            opacity={LINE_FILL}
          />
        </>
      ) : (
        view.map((k, i) => {
          const color = k.c >= k.o ? UP : DOWN;
          const top = yPrice(Math.max(k.o, k.c));
          const bottom = yPrice(Math.min(k.o, k.c));
          const x = xMid(i);
          return (
            <g key={k.t} style={{ opacity: hover !== null && hover !== i ? DIM_CANDLE : 1 }}>
              <line
                x1={x}
                x2={x}
                y1={yPrice(k.h)}
                y2={yPrice(k.l)}
                stroke={color}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              {kind === "bars" ? (
                <>
                  <line
                    x1={x - halfBody}
                    x2={x}
                    y1={yPrice(k.o)}
                    y2={yPrice(k.o)}
                    stroke={color}
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={x}
                    x2={x + halfBody}
                    y1={yPrice(k.c)}
                    y2={yPrice(k.c)}
                    stroke={color}
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              ) : (
                <rect x={x - halfBody} y={top} width={bodyW} height={Math.max(1, bottom - top)} fill={color} />
              )}
            </g>
          );
        })
      )}
    </motion.g>
  );
}

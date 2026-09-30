"use client";

// 21st: designali-in/gauge-1 (#3719) — the counted value. The source used an overdamped spring (≈1 s); D2 motion is a
// 200 ms tween on ease-desk ("nothing bounces"), instant under reduced motion.

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { DESK_SLOW_S, deskTransition } from "@/lib/constants/charts";
import { CENTER } from "./arc";

export function useGaugeValue(value: number): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(shown);
  useEffect(() => {
    if (reduced) {
      setShown(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      ...deskTransition(DESK_SLOW_S),
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [value, reduced]);
  return shown;
}

const VALUE_FONT = 30;
const LABEL_FONT = 8;

export function GaugeValue({
  text,
  label,
  valueY,
  labelY,
  valueClassName,
  labelClassName,
}: {
  text: string | null;
  label?: string | undefined;
  valueY: number;
  labelY: number;
  valueClassName?: string | undefined;
  labelClassName?: string | undefined;
}) {
  return (
    <>
      {text !== null && (
        <text
          x={CENTER}
          y={valueY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="currentColor"
          fontSize={VALUE_FONT}
          fontWeight={700}
          className={valueClassName ?? "select-none font-mono tabular-nums"}
        >
          {text}
        </text>
      )}
      {label && (
        <text
          x={CENTER}
          y={labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={LABEL_FONT}
          className={labelClassName ?? "select-none fill-muted-foreground font-mono uppercase"}
        >
          {label}
        </text>
      )}
    </>
  );
}

"use client";
/**
 * A slider with snap marks (21st "Marks Slider", ai2 29217, the `SnapSlider` variant; retokenized): a track, its fill,
 * evenly spaced stops and a thumb — pointer drag with capture on the track, and the keyboard (arrows, Shift for ten
 * steps, Home/End). The stops are visual; the value snaps to `step`. Tradash's size slider in the order sheet (R5.7).
 */
import { motion, useReducedMotion } from "motion/react";
import { type KeyboardEvent, type PointerEvent, useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const PERCENT = 100;
const BIG_STEP = 10;
const SPRING = { type: "spring" as const, stiffness: 500, damping: 30, mass: 0.6 };
const DRAG_SCALE = 1.18;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export interface MarksSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  /** Where the visual stops sit, as fractions of the track (0, ¼, ½, ¾, 1). */
  stops: readonly number[];
  label: string;
  /** What the value means in words, read by assistive tech ("25% of available"). */
  valueText: string;
  onValueChange: (v: number) => void;
  className?: string;
}

export function MarksSlider({
  value,
  min,
  max,
  step,
  stops,
  label,
  valueText,
  onValueChange,
  className,
}: MarksSliderProps) {
  const reduce = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const current = clamp(value, min, max);
  const pct = max > min ? ((current - min) / (max - min)) * PERCENT : 0;
  const commit = useCallback(
    (next: number) => onValueChange(clamp(Math.round(next / step) * step, min, max)),
    [onValueChange, step, min, max],
  );
  const fromX = (clientX: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return current;
    return min + clamp((clientX - rect.left) / rect.width, 0, 1) * (max - min);
  };
  const down = (e: PointerEvent) => {
    e.preventDefault();
    track.current?.setPointerCapture?.(e.pointerId);
    setDragging(true);
    commit(fromX(e.clientX));
  };
  const move = (e: PointerEvent) => {
    if (dragging) commit(fromX(e.clientX));
  };
  const up = (e: PointerEvent) => {
    track.current?.releasePointerCapture?.(e.pointerId);
    setDragging(false);
  };
  const key = (e: KeyboardEvent) => {
    const delta = e.shiftKey ? step * BIG_STEP : step;
    const next =
      e.key === "ArrowLeft" || e.key === "ArrowDown"
        ? current - delta
        : e.key === "ArrowRight" || e.key === "ArrowUp"
          ? current + delta
          : e.key === "Home"
            ? min
            : e.key === "End"
              ? max
              : null;
    if (next === null) return;
    e.preventDefault();
    commit(next);
  };
  return (
    <div className={cn("relative flex w-full touch-none select-none items-center py-2", className)}>
      <div
        ref={track}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        className="relative h-1.5 w-full cursor-pointer rounded-full bg-secondary"
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct}%` }} />
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {stops.map((ratio) => (
            <span
              key={ratio}
              className={cn(
                "absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
                ratio * PERCENT <= pct ? "bg-primary-foreground" : "bg-border",
              )}
              style={{ left: `${ratio * PERCENT}%` }}
            />
          ))}
        </div>
        <motion.button
          type="button"
          role="slider"
          aria-label={label}
          aria-valuenow={Math.round(current)}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuetext={valueText}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            track.current?.setPointerCapture?.(e.pointerId);
            setDragging(true);
          }}
          onKeyDown={key}
          className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow-sm outline-none after:absolute after:-inset-2 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring/50"
          style={{ left: `${pct}%` }}
          animate={{ scale: !reduce && dragging ? DRAG_SCALE : 1 }}
          transition={reduce ? { duration: 0 } : SPRING}
        />
      </div>
    </div>
  );
}

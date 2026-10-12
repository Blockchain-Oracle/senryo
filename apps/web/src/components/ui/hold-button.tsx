"use client";
/**
 * Hold to confirm (P3; 21st ddoemonn/hold-to-confirm #23527 — Mitoshi's place button; the phone's `HoldButton`): the
 * primary pill sweeps a darker fill left to right while the pointer is held and fires `onConfirm` only when the sweep
 * completes; let go (or slide off) early and it drains at 2.5× the speed. When it can't fire, the label is the blocker.
 * A keyboard or assistive-tech activation confirms at once — holding guards fingers and mice, not access.
 */
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { fire } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { HOLD_RELEASE_EASE } from "./constants";

/** How long a full hold takes (the phone's `HOLD_MS`); letting go drains it this many times faster. */
const HOLD_MS = 1200;
const RELEASE_RATE = 2.5;
const MOVE_TOLERANCE = 10;
const MS = 1000;
const PERCENT = 100;

export function HoldButton({
  label,
  holdingLabel = "Keep holding…",
  ready,
  busy = false,
  onConfirm,
  className,
}: {
  label: string;
  holdingLabel?: string;
  ready: boolean;
  busy?: boolean;
  onConfirm: () => void;
  className?: string;
}) {
  const live = ready && !busy;
  const [holding, setHolding] = useState(false);
  const swept = useMotionValue(0);
  const clipPath = useTransform(swept, (v) => `inset(0 ${(1 - v) * PERCENT}% 0 0)`);
  const reduced = useReducedMotion();
  const origin = useRef<{ x: number; y: number } | null>(null);
  const hint = useId();
  const confirm = useRef(onConfirm);
  confirm.current = onConfirm;

  const done = useCallback(() => {
    fire("confirm", { cue: "tap" });
    confirm.current();
  }, []);
  useEffect(() => {
    if (!live) swept.set(0);
  }, [live, swept]);
  useEffect(() => {
    const from = swept.get();
    if (holding) {
      const run = animate(swept, 1, {
        duration: reduced ? 0 : (HOLD_MS * (1 - from)) / MS,
        ease: "linear",
        onComplete: () => {
          setHolding(false);
          swept.set(0);
          done();
        },
      });
      return () => run.stop();
    }
    const run = animate(swept, 0, { duration: (HOLD_MS * from) / RELEASE_RATE / MS, ease: HOLD_RELEASE_EASE });
    return () => run.stop();
  }, [holding, reduced, swept, done]);

  const release = () => {
    origin.current = null;
    setHolding(false);
  };
  return (
    <button
      type="button"
      aria-disabled={!live}
      aria-describedby={live ? hint : undefined}
      onPointerDown={(e) => {
        if (!live || (e.pointerType === "mouse" && e.button !== 0)) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        origin.current = { x: e.clientX, y: e.clientY };
        fire("press", { cue: "tap" });
        setHolding(true);
      }}
      onPointerMove={(e) => {
        const from = origin.current;
        if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > MOVE_TOLERANCE) release();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      onClick={(e) => {
        // A pointer click is the start of a hold; a keyboard or assistive-tech activation (detail 0) confirms.
        if (e.detail === 0 && live) done();
      }}
      onContextMenu={(e) => e.preventDefault()}
      style={{ touchAction: "manipulation", WebkitTouchCallout: "none" }}
      className={cn(
        "relative isolate grid h-14 select-none place-items-center overflow-hidden rounded-full px-6 font-semibold text-button focus-visible:outline-2 focus-visible:outline-ring",
        live ? "cursor-pointer bg-primary text-primary-foreground" : "cursor-not-allowed bg-secondary text-text-3",
        className,
      )}
    >
      <span>{holding ? holdingLabel : label}</span>
      {live ? (
        <motion.span
          aria-hidden
          style={{ clipPath }}
          className="absolute inset-0 grid place-items-center bg-primary-pressed px-6 text-primary-foreground"
        >
          {holdingLabel}
        </motion.span>
      ) : null}
      <span id={hint} className="sr-only">
        Press and hold to confirm. Letting go early cancels.
      </span>
    </button>
  );
}

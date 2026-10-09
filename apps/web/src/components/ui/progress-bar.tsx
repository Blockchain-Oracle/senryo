"use client";
/**
 * 21st:ddoemonn/progress-bar (#23549), retokenized: a labelled bar whose fill springs to its value, with the value in
 * words on the right. Changes from the source: the right-hand text is the caller's (a clock: "1:24 left"), a tone
 * (calm · near · late) colours the fill as time runs down, no indeterminate shimmer, the project's tokens.
 */
import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { cn } from "@/lib/utils";

const FILL = { type: "spring", stiffness: 210, damping: 34, mass: 0.9 } as const;
const PERCENT = 100;
const TONE = { calm: "bg-up", near: "bg-warn", late: "bg-down" } as const;

export function ProgressBar({
  value,
  max,
  label,
  valueText,
  tone = "calm",
  className,
}: {
  value: number;
  max: number;
  label: string;
  valueText: string;
  tone?: keyof typeof TONE;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const labelId = useId();
  const fraction = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span id={labelId} className="truncate text-meta text-text-2">
          {label}
        </span>
        <span className="tnum text-meta text-text-2">{valueText}</span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={valueText}
        className="h-1 w-full overflow-hidden rounded-full bg-secondary"
      >
        <motion.div
          className={cn("h-full origin-left rounded-full", TONE[tone])}
          initial={false}
          animate={{ scaleX: fraction }}
          transition={reduced ? { duration: 0 } : FILL}
          style={{ width: `${PERCENT}%` }}
        />
      </div>
    </div>
  );
}

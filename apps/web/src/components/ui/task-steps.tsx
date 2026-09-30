"use client";

import { MOTION } from "@senryo/tokens";
// 21st: ddoemonn/task-steps (#23569) — https://21st.dev/@ddoemonn/components/task-steps
// D2 execution trace (signed → risk → sent → proposed → voted → finalized). Re-tokenized: --up done tick,
// --down error, muted pending, mono meta; the original springs → desk tweens (nothing bounces).
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const MS_PER_S = 1000;
const FULL_TURN_DEG = 360;
const SPIN_S = 0.8;
const SHIMMER_S = 1.6;
const POP_FROM_SCALE = 0.4;
const ANNOUNCE_DELAY_MS = 500;
const TWEEN = { duration: MOTION.baseMs / MS_PER_S, ease: MOTION.easing } as const;
const STILL = { duration: 0 } as const;

export type TaskStep = {
  id: string;
  label: string;
  meta?: string;
};

export type TaskStepStatus = "pending" | "active" | "done" | "error";

export type UseTaskStepsOptions = {
  steps: readonly TaskStep[];
  /** Index of the step in flight; `steps.length` means all done. */
  current: number;
  failed?: boolean;
};

function statusOf(i: number, current: number, failed: boolean, complete: boolean): TaskStepStatus {
  if (i < current) return "done";
  if (i === current && failed) return "error";
  if (i === current && !complete) return "active";
  return "pending";
}

export function useTaskSteps({ steps, current, failed = false }: UseTaskStepsOptions) {
  const complete = !failed && current >= steps.length;
  const rows = steps.map((step, i) => ({ ...step, status: statusOf(i, current, failed, complete) }));
  const active = rows.find((r) => r.status === "active");
  let sentence = "";
  if (failed) sentence = `Failed at ${steps[Math.min(current, steps.length - 1)]?.label ?? "step"}`;
  else if (complete) sentence = `All ${steps.length} steps complete`;
  else if (active) sentence = `${active.label}, step ${current + 1} of ${steps.length}`;
  return { rows, complete, failed, sentence };
}

const Tick = (
  <svg viewBox="0 0 256 256" className="size-2.5" fill="none" aria-hidden>
    <polyline
      points="216 72 104 184 48 128"
      stroke="currentColor"
      strokeWidth="26"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const Cross = (
  <svg viewBox="0 0 256 256" className="size-2.5" fill="none" aria-hidden>
    <path d="M200 56 56 200 M56 56l144 144" stroke="currentColor" strokeWidth="26" strokeLinecap="round" />
  </svg>
);

const Arc = ({ spin }: { spin: boolean }) => (
  <motion.svg
    viewBox="0 0 16 16"
    className="size-3"
    aria-hidden
    animate={{ rotate: spin ? FULL_TURN_DEG : 0 }}
    transition={spin ? { duration: SPIN_S, ease: "linear", repeat: Number.POSITIVE_INFINITY } : STILL}
  >
    <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
    <path d="M8 2 a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </motion.svg>
);

const TONE: Record<TaskStepStatus, string> = {
  done: "text-foreground/80",
  active: "font-medium text-foreground",
  error: "font-medium text-down",
  pending: "text-muted-foreground",
};

export type TaskStepsProps = UseTaskStepsOptions & {
  label?: string;
  className?: string;
};

export function TaskSteps({ steps, current, failed = false, label = "Task progress", className }: TaskStepsProps) {
  const { rows, complete, sentence } = useTaskSteps({ steps, current, failed });
  const reduced = useReducedMotion() === true;
  const pop = reduced ? { opacity: 0 } : { opacity: 0, scale: POP_FROM_SCALE };
  const [spoken, setSpoken] = useState("");

  useEffect(() => {
    if (!sentence) return;
    const t = setTimeout(() => setSpoken(sentence), ANNOUNCE_DELAY_MS);
    return () => clearTimeout(t);
  }, [sentence]);

  return (
    <div className={cn("w-full", className)}>
      <ol aria-label={label} className="space-y-0.5">
        {rows.map((row) => (
          <li
            key={row.id}
            aria-current={row.status === "active" ? "step" : undefined}
            className="flex h-7 items-center gap-2.5 px-1"
          >
            <span className="relative grid size-4 shrink-0 place-items-center">
              <AnimatePresence initial={false}>
                {row.status === "done" && (
                  <motion.span
                    key="done"
                    className="col-start-1 row-start-1 grid size-4 place-items-center rounded-sm bg-up/15 text-up"
                    initial={pop}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, transition: STILL }}
                    transition={reduced ? STILL : TWEEN}
                  >
                    {Tick}
                  </motion.span>
                )}
                {row.status === "error" && (
                  <motion.span
                    key="error"
                    className="col-start-1 row-start-1 grid size-4 place-items-center rounded-sm bg-down/15 text-down"
                    initial={pop}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, transition: STILL }}
                    transition={reduced ? STILL : TWEEN}
                  >
                    {Cross}
                  </motion.span>
                )}
                {row.status === "active" && (
                  <motion.span
                    key="active"
                    className="col-start-1 row-start-1 text-primary"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: STILL }}
                    transition={reduced ? STILL : TWEEN}
                  >
                    <Arc spin={!reduced} />
                  </motion.span>
                )}
                {row.status === "pending" && (
                  <motion.span
                    key="pending"
                    className="col-start-1 row-start-1 size-1.5 rounded-xs bg-muted-foreground/40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: STILL }}
                    transition={STILL}
                  />
                )}
              </AnimatePresence>
            </span>

            {row.status === "active" && !reduced ? (
              <motion.span
                className="min-w-0 flex-1 truncate bg-[linear-gradient(90deg,var(--muted-foreground)_38%,var(--foreground)_50%,var(--muted-foreground)_62%)] bg-size-[220%_100%] bg-clip-text font-mono text-caption font-medium text-transparent"
                animate={{ backgroundPosition: ["120% 0", "-120% 0"] }}
                transition={{ duration: SHIMMER_S, ease: "linear", repeat: Number.POSITIVE_INFINITY }}
              >
                {row.label}
              </motion.span>
            ) : (
              <span
                className={cn(
                  "min-w-0 flex-1 truncate font-mono text-caption transition-colors duration-(--motion-slow)",
                  TONE[row.status],
                )}
              >
                {row.label}
              </span>
            )}

            {row.meta ? (
              <span
                className={cn(
                  "shrink-0 font-mono text-micro text-muted-foreground tnum transition-opacity duration-(--motion-slow)",
                  row.status === "done" ? "opacity-100" : "opacity-0",
                )}
                aria-hidden={row.status !== "done"}
              >
                {row.meta}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <span role="status" className="sr-only">
        {spoken}
      </span>
      <span className="sr-only" aria-live={complete || failed ? "polite" : "off"}>
        {complete ? "Run complete" : failed ? "Run failed" : ""}
      </span>
    </div>
  );
}

export default TaskSteps;

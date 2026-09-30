"use client";

import { MOTION } from "@senryo/tokens";
// 21st: ddoemonn/segmented-control (#23552) — https://21st.dev/@ddoemonn/components/segmented-control
// D2 re-tokenized: secondary well + hairline, foreground thumb with background ink, mono label-size caps by default.
// Motion: the original spring → a 160 ms desk tween (D2 "nothing bounces"); reduced motion jumps.
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const MS_PER_S = 1000;
const PERCENT = 100;
const THUMB_TWEEN = { duration: MOTION.baseMs / MS_PER_S, ease: MOTION.easing } as const;

const SEG =
  "flex min-h-9 items-center justify-center px-3 text-center font-mono text-label font-medium uppercase whitespace-nowrap";

export type SegmentedOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type SegmentedControlProps = {
  options: readonly SegmentedOption[];
  label: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  /** Stretch to the container width instead of hugging the labels. */
  fill?: boolean;
};

export function SegmentedControl({
  options,
  label,
  value,
  defaultValue,
  onValueChange,
  className,
  fill = false,
}: SegmentedControlProps) {
  const count = Math.max(1, options.length);
  const template = `repeat(${count}, minmax(0, 1fr))`;

  const [internal, setInternal] = useState(() => defaultValue ?? options[0]?.value ?? "");
  const [hovered, setHovered] = useState(-1);

  const controlled = value !== undefined;
  const current = controlled ? value : internal;
  const found = options.findIndex((o) => o.value === current);
  const index = found < 0 ? 0 : found;

  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const emit = useRef(onValueChange);
  emit.current = onValueChange;

  const reduced = useReducedMotion();
  const pos = useMotionValue(index);
  const thumbX = useTransform(pos, (v) => `${v * PERCENT}%`);
  const maskX = useTransform(pos, (v) => `${-v * PERCENT}%`);

  useEffect(() => {
    if (reduced) {
      pos.set(index);
      return;
    }
    const controls = animate(pos, index, THUMB_TWEEN);
    return () => controls.stop();
  }, [index, reduced, pos]);

  const select = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next);
      if (next !== current) emit.current?.(next);
    },
    [controlled, current],
  );

  const seek = useCallback(
    (from: number, dir: number) => {
      let i = from;
      for (let k = 0; k < count; k++) {
        i = (i + dir + count) % count;
        if (!options[i]?.disabled) return i;
      }
      return from;
    },
    [count, options],
  );

  const go = useCallback(
    (i: number) => {
      const option = options[i];
      if (!option || option.disabled) return;
      buttons.current[i]?.focus();
      select(option.value);
    },
    [options, select],
  );

  const onKeyDown = (e: KeyboardEvent, i: number) => {
    const moves: Record<string, () => number> = {
      ArrowRight: () => seek(i, 1),
      ArrowDown: () => seek(i, 1),
      ArrowLeft: () => seek(i, -1),
      ArrowUp: () => seek(i, -1),
      Home: () => seek(count - 1, 1),
      End: () => seek(0, -1),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    go(move());
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "relative select-none rounded-xl border border-border bg-secondary p-0.5",
        fill ? "block w-full" : "inline-block",
        className,
      )}
    >
      <div className="relative grid" style={{ gridTemplateColumns: template, touchAction: "manipulation" }}>
        {options.map((option, i) => (
          <span
            key={option.value}
            aria-hidden
            className={cn(
              SEG,
              "pointer-events-none",
              option.disabled
                ? "text-muted-foreground/40"
                : hovered === i && i !== index
                  ? "text-foreground"
                  : "text-muted-foreground",
            )}
          >
            {option.label}
          </span>
        ))}

        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden rounded-lg bg-foreground"
          style={{ width: `${PERCENT / count}%`, x: thumbX }}
          initial={false}
        >
          <motion.div className="absolute inset-0" style={{ x: maskX }} initial={false}>
            <div
              className="absolute inset-y-0 left-0 grid"
              style={{ width: `${count * PERCENT}%`, gridTemplateColumns: template }}
            >
              {options.map((option) => (
                <span key={option.value} className={cn(SEG, "text-background")}>
                  {option.label}
                </span>
              ))}
            </div>
          </motion.div>
        </motion.div>

        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: template }}
          onPointerLeave={() => setHovered(-1)}
        >
          {options.map((option, i) => (
            // biome-ignore lint/a11y/useSemanticElements: WAI-ARIA APG radiogroup with roving tabindex over a sliding thumb
            <button
              key={option.value}
              ref={(node) => {
                buttons.current[i] = node;
              }}
              type="button"
              role="radio"
              aria-checked={i === index}
              aria-disabled={option.disabled || undefined}
              tabIndex={i === index ? 0 : -1}
              onClick={() => !option.disabled && select(option.value)}
              onKeyDown={(e) => onKeyDown(e, i)}
              onPointerEnter={() => !option.disabled && setHovered(i)}
              className="cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <span className="sr-only">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SegmentedControl;

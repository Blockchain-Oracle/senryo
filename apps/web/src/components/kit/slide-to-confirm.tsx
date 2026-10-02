"use client";

// 21st: starc007/slide-action-button (#29304, search "slide to confirm button") — drag the thumb to the end to confirm,
// springing back when released early; the arrow morphs into a check. Senryo: the side's tone (long green / short red /
// primary), `busy` holds the rail still with a spinner, `disabled` shows the blocker as the label, and a completed slide
// stays completed until `resetKey` changes — one slide is one confirmation, never two. Enter / Space on the thumb
// confirms too (the web's explicit confirm, and the accessible path).
import { Loader2 } from "lucide-react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { type KeyboardEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  EASE_OUT,
  FADE_S,
  SLIDE_GUTTER_PX,
  SLIDE_ICON_STOPS,
  SLIDE_LABEL_FADE,
  SLIDE_LABEL_OPACITY,
  SLIDE_THRESHOLD,
  SPRING_LAYOUT,
  SPRING_PRESS,
} from "@/lib/constants/motion";
import { cn } from "@/lib/utils";

const PRESS_SCALE = 0.94;

export type SlideTone = "up" | "down" | "primary";

const FILL: Record<SlideTone, string> = { up: "bg-up", down: "bg-down", primary: "bg-primary" };
const THUMB: Record<SlideTone, string> = {
  up: "bg-up text-up-foreground",
  down: "bg-down text-down-foreground",
  primary: "bg-primary text-primary-foreground",
};

export function SlideToConfirm({
  label,
  doneLabel = "Confirmed",
  tone = "primary",
  disabled = false,
  busy = false,
  resetKey,
  onConfirm,
  className,
}: {
  label: ReactNode;
  doneLabel?: ReactNode;
  tone?: SlideTone;
  disabled?: boolean;
  busy?: boolean;
  /** The reviewed intent's identity: a new one re-arms the slide. */
  resetKey: string;
  onConfirm: () => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLButtonElement>(null);
  const done = useRef(false);
  const x = useMotionValue(0);
  const [max, setMax] = useState(0);
  const [completed, setCompleted] = useState(false);
  const safe = Math.max(max, 1);
  const progress = useTransform(x, [0, safe], [0, 1]);
  const labelOpacity = useTransform(
    x,
    SLIDE_LABEL_FADE.map((f) => f * safe),
    [...SLIDE_LABEL_OPACITY],
  );
  const iconPath = useTransform(
    progress,
    [...SLIDE_ICON_STOPS],
    ["M 8 5 L 15 12 L 8 19", "M 7 8 L 12 14 L 17 10", "M 5 12 L 10 17 L 19 7"],
  );

  useLayoutEffect(() => {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!track || !thumb) return;
    const measure = () => setMax(Math.max(track.clientWidth - thumb.clientWidth - SLIDE_GUTTER_PX, 0));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    observer.observe(thumb);
    return () => observer.disconnect();
  }, []);

  const moveTo = (target: number) => {
    if (reduce) x.set(target);
    else animate(x, target, SPRING_LAYOUT);
  };

  // A new reviewed intent re-arms the slide; the same one never fires twice.
  useEffect(() => {
    done.current = false;
    setCompleted(false);
    x.set(0);
  }, [resetKey, x]);

  const locked = disabled || busy;
  const complete = () => {
    if (done.current || locked || max === 0) return;
    done.current = true;
    setCompleted(true);
    moveTo(max);
    onConfirm();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    complete();
  };

  return (
    <div
      ref={trackRef}
      className={cn(
        "relative h-16 w-full select-none overflow-hidden rounded-lg bg-raised-2 p-1",
        locked && "opacity-70",
        className,
      )}
    >
      <motion.span
        aria-hidden
        style={{ scaleX: progress }}
        className={cn("absolute inset-0 origin-left will-change-transform", FILL[tone])}
      />
      <motion.span
        aria-hidden
        style={{ opacity: labelOpacity }}
        className="pointer-events-none absolute inset-0 grid place-items-center pl-14 text-button text-foreground"
      >
        {label}
      </motion.span>
      <motion.span
        aria-live="polite"
        animate={{ opacity: completed ? 1 : 0 }}
        transition={{ duration: reduce ? 0 : FADE_S, ease: EASE_OUT }}
        className="pointer-events-none absolute inset-0 grid place-items-center text-button text-up-foreground"
      >
        {completed ? doneLabel : null}
      </motion.span>
      <motion.button
        ref={thumbRef}
        type="button"
        aria-label={typeof label === "string" ? `${label} (press Enter to confirm)` : "Confirm"}
        aria-disabled={locked}
        drag={completed || locked ? false : "x"}
        dragConstraints={{ left: 0, right: max }}
        dragElastic={0}
        dragMomentum={false}
        style={{ x }}
        onDragEnd={() => {
          if (x.get() >= max * SLIDE_THRESHOLD) complete();
          else moveTo(0);
        }}
        onKeyDown={onKeyDown}
        {...(reduce || completed || locked ? {} : { whileTap: { scale: PRESS_SCALE } })}
        transition={SPRING_PRESS}
        className={cn(
          "relative z-10 grid size-14 cursor-grab touch-none place-items-center rounded-md shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:cursor-grabbing",
          THUMB[tone],
          (completed || locked) && "cursor-default",
        )}
      >
        {busy ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : (
          <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden>
            <motion.path
              d={iconPath}
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </motion.button>
    </div>
  );
}

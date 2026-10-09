"use client";
/**
 * 21st:arihantcodes_1f7b8c4d/quantity-stepper (#29940, Spectrum UI), retokenized: a pill with −, a rolling value and +;
 * the digits roll in the direction of travel, a press squishes, holding repeats with acceleration, and pushing past
 * min or max shakes the value in the down tone. Changes from the source: `motion/react` (not framer-motion), the value
 * shown through `format` (dollars, cents), an `label` for the spinbutton, the project's tokens.
 */
import { Minus, Plus } from "lucide-react";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "motion/react";
import { type KeyboardEvent, type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface QuantityStepperProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** What the spinbutton is ("Take profit"). */
  label: string;
  format?: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

const HOLD_DELAY_MS = 400;
const HOLD_INTERVAL_MS = 80;
const HOLD_FAST_INTERVAL_MS = 40;
const HOLD_FAST_AFTER = 10;
const FLASH_MS = 400;
const PAGE_STEPS = 10;
const ROLL_PX = 12;
const SQUISH = 0.85;
const SPRING_SNAPPY = { type: "spring", stiffness: 500, damping: 30 } as const;
const ROLL_SPRING = { type: "spring", stiffness: 400, damping: 30 } as const;
const ROLL_REPEAT = { duration: 0.1, ease: "easeOut" } as const;
const SHAKE_PX = 4;
const HALF = 2;
const SHAKE = [0, -SHAKE_PX, SHAKE_PX, -SHAKE_PX / HALF, SHAKE_PX / HALF, 0];
const SHAKE_SEC = 0.3;
const ICON = 15;

const variants = {
  enter: (direction: number) => ({ y: direction * ROLL_PX, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (direction: number) => ({ y: direction * -ROLL_PX, opacity: 0 }),
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function QuantityStepper({
  value,
  onValueChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  label,
  format = String,
  disabled = false,
  className,
}: QuantityStepperProps) {
  const reduce = useReducedMotion();
  const [direction, setDirection] = useState(1);
  const [flash, setFlash] = useState(0);
  const [repeating, setRepeating] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const shake = useAnimationControls();
  const current = clamp(value, min, max);
  const valueRef = useRef(current);
  valueRef.current = current;
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null);
  const count = useRef(0);

  const stopRepeat = useCallback(() => {
    if (delay.current !== null) clearTimeout(delay.current);
    if (repeat.current !== null) clearInterval(repeat.current);
    delay.current = null;
    repeat.current = null;
    count.current = 0;
    setRepeating(false);
  }, []);
  useEffect(() => stopRepeat, [stopRepeat]);

  useEffect(() => {
    if (flash === 0) return;
    if (!reduce) {
      shake.set({ x: 0 });
      void shake.start({ x: SHAKE, transition: { duration: SHAKE_SEC, ease: "easeInOut" } });
    }
    const id = setTimeout(() => setFlash(0), FLASH_MS);
    return () => clearTimeout(id);
  }, [flash, reduce, shake]);

  const stepBy = useCallback(
    (delta: number) => {
      const next = clamp(valueRef.current + delta, min, max);
      if (next === valueRef.current) {
        setFlash((n) => n + 1);
        setAnnouncement(delta < 0 ? `Lowest is ${format(min)}` : `Highest is ${format(max)}`);
        return false;
      }
      valueRef.current = next;
      setDirection(delta > 0 ? 1 : -1);
      onValueChange(next);
      setAnnouncement(`${label} ${format(next)}`);
      return true;
    },
    [min, max, onValueChange, format, label],
  );

  const startHold = (delta: number) => (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) return;
    stopRepeat();
    if (!stepBy(delta)) return;
    delay.current = setTimeout(() => {
      setRepeating(true);
      const tick = () => {
        if (!stepBy(delta)) return stopRepeat();
        count.current += 1;
        if (count.current === HOLD_FAST_AFTER) {
          if (repeat.current !== null) clearInterval(repeat.current);
          repeat.current = setInterval(tick, HOLD_FAST_INTERVAL_MS);
        }
      };
      repeat.current = setInterval(tick, HOLD_INTERVAL_MS);
    }, HOLD_DELAY_MS);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (disabled) return;
    const moves: Record<string, number> = {
      ArrowUp: current + step,
      ArrowDown: current - step,
      PageUp: current + step * PAGE_STEPS,
      PageDown: current - step * PAGE_STEPS,
      Home: min,
      End: max,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const clamped = clamp(next, min, max);
    if (clamped === current) {
      if (event.key !== "Home" && event.key !== "End") setFlash((n) => n + 1);
      return;
    }
    setDirection(clamped > current ? 1 : -1);
    onValueChange(clamped);
  };

  // The squish rides the press (whileTap), so it holds steady while a hold repeats.
  const press = reduce || disabled ? {} : { whileTap: { scale: SQUISH } };
  const roll = reduce || flash > 0 ? { duration: 0 } : repeating ? ROLL_REPEAT : ROLL_SPRING;
  const buttonClass =
    "flex size-8 shrink-0 touch-manipulation items-center justify-center rounded-full text-text-2 transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring";

  return (
    <fieldset
      aria-label={label}
      className={cn(
        "m-0 inline-flex h-10 min-w-0 select-none items-center gap-1 rounded-full border-0 bg-secondary/60 px-1",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <motion.button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={`Lower ${label.toLowerCase()}`}
        onPointerDown={startHold(-step)}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
        onPointerCancel={stopRepeat}
        {...press}
        transition={reduce ? { duration: 0 } : SPRING_SNAPPY}
        className={cn(buttonClass, current <= min && "opacity-40")}
      >
        <Minus size={ICON} aria-hidden />
      </motion.button>
      <motion.span
        role="spinbutton"
        aria-valuenow={current}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={format(current)}
        aria-label={label}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={onKeyDown}
        animate={shake}
        className={cn(
          "tnum flex h-8 min-w-16 items-center justify-center overflow-hidden px-1 font-semibold text-row-title transition-colors focus-visible:outline-2 focus-visible:outline-ring",
          flash > 0 ? "text-down" : "text-foreground",
        )}
      >
        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <motion.span
            key={current}
            className="inline-block"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={roll}
          >
            {format(current)}
          </motion.span>
        </AnimatePresence>
      </motion.span>
      <motion.button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={`Raise ${label.toLowerCase()}`}
        onPointerDown={startHold(step)}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
        onPointerCancel={stopRepeat}
        {...press}
        transition={reduce ? { duration: 0 } : SPRING_SNAPPY}
        className={cn(buttonClass, current >= max && "opacity-40")}
      >
        <Plus size={ICON} aria-hidden />
      </motion.button>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </fieldset>
  );
}

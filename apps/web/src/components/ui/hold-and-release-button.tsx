"use client";

// 21st: kokonutd/hold-and-release-button (#8) — https://21st.dev/@kokonutd/components/hold-and-release-button
// D2 hold-to-confirm: solid --primary button, 500 ms linear shade sweep (primary-foreground/30 via clip-path), fires `onConfirm`
// once when the hold completes. Pointer, touch and keyboard (Space/Enter held) supported; reduced motion keeps the
// timer but skips the sweep. framer-motion → motion/react; the delete-demo styling is gone.
import {
  type AnimationPlaybackControls,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

const MS_PER_S = 1000;
const PERCENT = 100;
export const HOLD_TO_CONFIRM_MS = 500;
const RELEASE_S = 0.1;
const HOLD_KEYS = new Set([" ", "Enter"]);

interface ButtonHoldAndReleaseProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onPointerDown" | "onPointerUp" | "onKeyDown" | "onKeyUp"> {
  holdDuration?: number;
  label?: ReactNode;
  releaseLabel?: ReactNode;
  icon?: ReactNode;
  onConfirm?: () => void;
  fillClassName?: string;
}

function ButtonHoldAndRelease({
  className,
  holdDuration = HOLD_TO_CONFIRM_MS,
  label = "Hold to confirm",
  releaseLabel = "Keep holding…",
  icon,
  onConfirm,
  fillClassName,
  disabled,
  ...props
}: ButtonHoldAndReleaseProps) {
  const [holding, setHolding] = useState(false);
  const progress = useMotionValue(0);
  const clip = useTransform(progress, (p) => `inset(0 ${PERCENT - p * PERCENT}% 0 0)`);
  const reduced = useReducedMotion() === true;
  const run = useRef<AnimationPlaybackControls | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirm = useRef(onConfirm);
  confirm.current = onConfirm;

  const clear = useCallback(() => {
    run.current?.stop();
    run.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  const complete = useCallback(() => {
    progress.set(1);
    setHolding(false);
    confirm.current?.();
  }, [progress]);

  const start = useCallback(() => {
    if (disabled || run.current || timer.current) return;
    setHolding(true);
    progress.set(0);
    if (reduced) {
      timer.current = setTimeout(() => {
        timer.current = null;
        complete();
      }, holdDuration);
      return;
    }
    run.current = animate(progress, 1, {
      duration: holdDuration / MS_PER_S,
      ease: "linear",
      onComplete: () => {
        run.current = null;
        complete();
      },
    });
  }, [disabled, reduced, holdDuration, progress, complete]);

  const end = useCallback(() => {
    if (!run.current && !timer.current) return;
    clear();
    setHolding(false);
    animate(progress, 0, { duration: reduced ? 0 : RELEASE_S });
  }, [clear, progress, reduced]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!HOLD_KEYS.has(e.key)) return;
    e.preventDefault();
    if (!e.repeat) start();
  };
  const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!HOLD_KEYS.has(e.key)) return;
    e.preventDefault();
    end();
  };

  const content = (
    <span className="flex w-full items-center justify-center gap-2">
      {icon}
      {holding ? releaseLabel : label}
    </span>
  );

  return (
    <button
      type="button"
      disabled={disabled}
      aria-describedby={undefined}
      className={cn(
        "relative inline-flex h-12 min-w-40 touch-none select-none items-center justify-center overflow-hidden rounded-lg border border-primary bg-primary px-4 font-mono text-body font-bold text-primary-foreground outline-none transition-colors duration-(--motion-fast) ease-desk focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start();
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onBlur={end}
      onContextMenu={(e) => e.preventDefault()}
      {...props}
    >
      {content}
      <motion.span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 flex items-center bg-primary-foreground/30 px-4 text-primary-foreground",
          fillClassName,
        )}
        style={{ clipPath: clip }}
      >
        {content}
      </motion.span>
    </button>
  );
}

export { ButtonHoldAndRelease };

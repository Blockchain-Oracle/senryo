"use client";
/**
 * 21st:adrielzimbril/handle-reel (#33159), retokenized: a slot-machine reel that tumbles through a list and decelerates
 * onto its target. Changes from the source: no prefix or editable landing slot (Lucky's reels land on the sealed
 * draw), started by `spinId` and landing only once the draw is known (`target` set), the landed row lit in the
 * project's primary, reduced motion lands at once, and `onLand` fires when the motion ends so the deal can appear.
 */
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const ROWS = 3;
const CYCLES = 3;
/** The source's deceleration curve and length. */
const EASE_X1 = 0.65;
const EASE_X2 = 0.35;
const EASE = [EASE_X1, 0, EASE_X2, 1] as const;
const SPIN_SEC = 2.4;
const HALF = 2;

function shuffled<T>(xs: readonly T[]): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

export function SlotReel(p: {
  items: readonly string[];
  /** The value to land on; null while the draw is still being made (the reel keeps tumbling). */
  target: string | null;
  /** A new number starts a new spin. */
  spinId: number;
  label: string;
  onLand?: () => void;
  className?: string;
  /** How a row draws (a market's mark beside its symbol, R2.8); the plain value otherwise. Keep it one text line high. */
  face?: (item: string) => ReactNode;
}) {
  const reduce = useReducedMotion();
  const y = useMotionValue(0);
  const probe = useRef<HTMLDivElement>(null);
  const [row, setRow] = useState(0);
  const [landed, setLanded] = useState(false);
  const centre = Math.floor(ROWS / HALF);

  const track = useMemo(() => {
    const pool = p.items.length > 0 ? p.items : ["—"];
    // Before the first spin the reel is in order: the static HTML and the first client render must match (a shuffle
    // during render broke hydration). A spin reshuffles; the target lands at index `centre`.
    const order = (xs: readonly string[]) => (p.spinId === 0 ? [...xs] : shuffled(xs));
    const lead = order(pool).slice(0, centre);
    const spins = Array.from({ length: CYCLES }, () => order(pool)).flat();
    return [...lead, p.target ?? pool[0] ?? "—", ...spins];
  }, [p.spinId, p.target, p.items]);

  useLayoutEffect(() => {
    const h = probe.current?.offsetHeight ?? 0;
    if (h && h !== row) setRow(h);
  }, [row]);

  const at = (i: number) => (row * ROWS) / HALF - (i * row + row / HALF);

  useEffect(() => {
    if (!row || p.spinId === 0) return;
    setLanded(false);
    if (p.target === null) {
      // Tumble while the draw is made.
      y.set(at(track.length - 1));
      const loop = animate(y, [at(track.length - 1), at(centre + 1)], {
        duration: SPIN_SEC,
        ease: "linear",
        repeat: Number.POSITIVE_INFINITY,
      });
      return () => loop.stop();
    }
    if (reduce) {
      y.set(at(centre));
      setLanded(true);
      p.onLand?.();
      return;
    }
    const settle = animate(y, at(centre), {
      duration: SPIN_SEC,
      ease: EASE,
      onComplete: () => {
        setLanded(true);
        p.onLand?.();
      },
    });
    return () => settle.stop();
  }, [row, p.spinId, p.target, reduce]);

  return (
    <div className={cn("flex flex-col items-center gap-1", p.className)}>
      <span className="text-meta text-text-3">{p.label}</span>
      <div
        role="status"
        className="relative w-full overflow-hidden rounded-xl bg-secondary"
        style={{ height: row ? row * ROWS : undefined }}
        aria-live="polite"
        aria-label={landed && p.target ? `${p.label}: ${p.target}` : `${p.label}: spinning`}
      >
        <div ref={probe} aria-hidden className="invisible absolute px-3 py-2 font-semibold text-section-title">
          M
        </div>
        <motion.div style={{ y }} aria-hidden className="flex flex-col items-center">
          {track.map((item, i) => (
            <div
              key={i}
              className={cn(
                "tnum px-3 py-2 font-semibold text-section-title transition-colors",
                landed && i === centre ? "text-primary" : "text-text-3",
              )}
            >
              {p.face ? p.face(item) : item}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

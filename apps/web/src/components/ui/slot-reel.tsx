"use client";
/**
 * 21st:adrielzimbril/handle-reel (#33159), retokenized: a slot-machine reel that tumbles through a list and decelerates
 * onto its target. Changes from the source: no prefix or editable landing slot (Lucky's reels land on the sealed
 * draw), started by `spinId` and landing only once the draw is known (`target` set), the landed row lit in the
 * project's primary, reduced motion lands at once, and `onLand` fires when the motion ends so the deal can appear.
 * R7.4 (Lucky's machine): each reel keeps tumbling `stopAfterMs` past the draw (720 / 980 / 1240 — the stagger), then
 * stops in a short settle that overshoots a few pixels and springs back (a thunk, not a glide); `onTick` fires as each
 * row passes the payline (the ratchet's sound), at most every `TICK_GAP_MS`.
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
/** The stop: a 0.3 s settle on a curve that overshoots and returns (≈ 4 px on a row). */
const SETTLE_SEC = 0.3;
const OVERSHOOT_X1 = 0.34;
const OVERSHOOT_Y1 = 1.56;
const OVERSHOOT_X2 = 0.64;
const OVERSHOOT = [OVERSHOOT_X1, OVERSHOOT_Y1, OVERSHOOT_X2, 1] as const;
const TICK_GAP_MS = 60;

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
  /** How long this reel keeps tumbling once the draw is known (the machine's stagger). */
  stopAfterMs?: number;
  /** A row passed the payline. */
  onTick?: () => void;
  /** The machine's look: a deep window on the arena, no label row. */
  machine?: boolean;
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

  // The ratchet: a tick each time a row crosses the payline.
  const onTick = useRef(p.onTick);
  onTick.current = p.onTick;
  useEffect(() => {
    if (!row) return;
    let last = Math.round(y.get() / row);
    let lastAt = 0;
    return y.on("change", (v) => {
      const i = Math.round(v / row);
      const now = performance.now();
      if (i !== last && now - lastAt >= TICK_GAP_MS) {
        lastAt = now;
        onTick.current?.();
      }
      last = i;
    });
  }, [row, y]);

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
    if (p.stopAfterMs !== undefined) {
      // The machine: tumble on for this reel's stagger, then thunk into place.
      y.set(at(track.length - 1));
      const loop = animate(y, [at(track.length - 1), at(centre + 1)], {
        duration: SPIN_SEC,
        ease: "linear",
        repeat: Number.POSITIVE_INFINITY,
      });
      let settle: ReturnType<typeof animate> | undefined;
      const timer = setTimeout(() => {
        loop.stop();
        y.set(at(centre + 1));
        settle = animate(y, at(centre), {
          duration: SETTLE_SEC,
          ease: OVERSHOOT,
          onComplete: () => {
            setLanded(true);
            p.onLand?.();
          },
        });
      }, p.stopAfterMs);
      return () => {
        clearTimeout(timer);
        loop.stop();
        settle?.stop();
      };
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
      <span className={cn("text-meta text-text-3", p.machine && "sr-only")}>{p.label}</span>
      <div
        role="status"
        className={cn("relative w-full overflow-hidden rounded-xl", p.machine ? "lucky-window" : "bg-secondary")}
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

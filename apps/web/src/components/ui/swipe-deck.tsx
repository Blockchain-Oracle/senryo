"use client";
/**
 * 21st:ddoemonn/swipe-deck (#23568), retokenized: a Tinder-style deck — drag a card past the threshold (or flick it),
 * use ← / → or the two buttons — with the next cards stacked behind it, its decision badges growing with the drag.
 * Changes from the source: controlled (`index` is the first undecided card, so the deck follows what the server has;
 * a card leaves only when its decision lands), no undo (a decision here is final), the badges and buttons named by the
 * caller (Down ← · → Up for a duel), the project's tokens and motion, and the buttons disabled while `busy`.
 */
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring", stiffness: 260, damping: 34, mass: 0.8 } as const;
const RETURN = { type: "spring", stiffness: 150, damping: 27, mass: 1 } as const;
/** The exit's ease-in (cubic-bezier 0.4, 0, 1, 1): it accelerates away. */
const LEAVE_X1 = 0.4;
const LEAVE = [LEAVE_X1, 0, 1, 1] as const;
const EXIT_DISTANCE = 560;
const ROTATE_AT = 200;
const ROTATE_DEG = 8;
const FADE_FROM = 150;
const FADE_TO = 340;
const DEPTH_Y = 10;
const DEPTH_SCALE = 0.045;
const DRAG_SCALE = 1.03;
const FLICK_SHARE = 0.35;

export type SwipeSide = "left" | "right";

export function SwipeDeck<T>({
  items,
  index,
  itemKey,
  itemLabel,
  children,
  onDecide,
  leftLabel,
  rightLabel,
  busy = false,
  emptyLabel,
  threshold = 92,
  flick = 520,
  peek = 3,
  className,
}: {
  items: readonly T[];
  /** The first undecided item. */
  index: number;
  itemKey: (item: T) => string;
  itemLabel: (item: T) => string;
  children: (item: T) => ReactNode;
  onDecide: (item: T, side: SwipeSide) => void;
  leftLabel: string;
  rightLabel: string;
  busy?: boolean;
  emptyLabel: string;
  threshold?: number;
  flick?: number;
  peek?: number;
  className?: string;
}) {
  const hintId = useId();
  const reduced = useReducedMotion() === true;
  const [drag, setDrag] = useState<{ dir: -1 | 0 | 1; share: number }>({ dir: 0, share: 0 });
  const [leaving, setLeaving] = useState<-1 | 1>(1);
  const current = items[index];
  const stack = items.slice(index, index + Math.max(1, peek));
  const done = current === undefined;

  const decide = (side: SwipeSide) => {
    if (busy || !current) return;
    setLeaving(side === "right" ? 1 : -1);
    setDrag({ dir: 0, share: 0 });
    onDecide(current, side);
  };
  /** ← and → decide from either button, like the source's deck. */
  const keys = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") decide("left");
    else if (e.key === "ArrowRight") decide("right");
  };
  const release = (dx: number, vx: number) => {
    const far = Math.abs(dx) >= threshold;
    const fast = Math.abs(vx) >= flick && Math.abs(dx) >= threshold * FLICK_SHARE;
    if (far || fast) decide((far ? dx : vx) > 0 ? "right" : "left");
    else setDrag({ dir: 0, share: 0 });
  };

  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <section aria-label="Card deck" aria-describedby={hintId} className="relative h-60 w-full rounded-xl">
        <motion.div
          aria-hidden={!done}
          initial={false}
          animate={{ opacity: done ? 1 : 0 }}
          transition={reduced ? { duration: 0 } : SPRING}
          className="absolute inset-x-5 inset-y-0 grid place-items-center rounded-xl bg-secondary px-4 text-center text-body text-text-2"
        >
          {emptyLabel}
        </motion.div>
        <AnimatePresence initial={false} custom={leaving}>
          {stack.map((item, depth) => (
            <DeckCard
              key={itemKey(item)}
              depth={depth}
              active={depth === 0 && !busy}
              reduced={reduced}
              label={itemLabel(item)}
              leftLabel={leftLabel}
              rightLabel={rightLabel}
              drag={depth === 0 ? drag : { dir: 0, share: 0 }}
              next={depth === 1 ? drag.share : 0}
              onMove={(dx) =>
                setDrag({ dir: dx === 0 ? 0 : dx > 0 ? 1 : -1, share: Math.min(1, Math.abs(dx) / threshold) })
              }
              onRelease={release}
            >
              {children(item)}
            </DeckCard>
          ))}
        </AnimatePresence>
      </section>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={done || busy}
          onClick={() => decide("left")}
          onKeyDown={keys}
          className="h-14 rounded-xl bg-down-surface font-semibold text-button text-down transition-transform active:scale-97 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
          ← {leftLabel}
        </button>
        <button
          type="button"
          disabled={done || busy}
          onClick={() => decide("right")}
          onKeyDown={keys}
          className="h-14 rounded-xl bg-up-surface font-semibold text-button text-up transition-transform active:scale-97 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
        >
          {rightLabel} →
        </button>
      </div>
      <p id={hintId} className="sr-only">
        Drag the card, or press the buttons or the arrow keys: left for {leftLabel}, right for {rightLabel}.
      </p>
    </div>
  );
}

function DeckCard({
  depth,
  active,
  reduced,
  label,
  leftLabel,
  rightLabel,
  drag,
  next,
  onMove,
  onRelease,
  children,
}: {
  depth: number;
  active: boolean;
  reduced: boolean;
  label: string;
  leftLabel: string;
  rightLabel: string;
  drag: { dir: -1 | 0 | 1; share: number };
  /** How far the card above is through its drag: this one rises to meet it. */
  next: number;
  onMove: (dx: number) => void;
  onRelease: (dx: number, vx: number) => void;
  children: ReactNode;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-ROTATE_AT, 0, ROTATE_AT], [-ROTATE_DEG, 0, ROTATE_DEG], { clamp: false });
  const fade = useTransform(x, [-FADE_TO, -FADE_FROM, 0, FADE_FROM, FADE_TO], [0, 1, 1, 1, 0]);
  const skip = useRef(reduced);
  skip.current = reduced;
  useEffect(() => {
    if (x.get() === 0) return;
    const controls = animate(x, 0, skip.current ? { duration: 0 } : RETURN);
    return () => controls.stop();
  }, [x]);
  const y = depth * DEPTH_Y - next * DEPTH_Y;
  const scale = 1 - depth * DEPTH_SCALE + next * DEPTH_SCALE;
  const badge = (side: -1 | 1, text: string) => {
    const on = drag.dir === side;
    return (
      <motion.span
        aria-hidden
        initial={false}
        animate={{ opacity: on ? drag.share : 0 }}
        className={cn(
          "pointer-events-none absolute top-3 rounded-md bg-background px-2 py-1 font-semibold text-meta uppercase",
          side === 1 ? "right-3 text-up" : "left-3 text-down",
        )}
      >
        {text}
      </motion.span>
    );
  };
  return (
    <motion.div
      role="group"
      aria-label={label}
      aria-hidden={depth !== 0}
      variants={{
        exit: (dir: number) => ({
          x: dir * EXIT_DISTANCE,
          zIndex: 12,
          transition: reduced ? { duration: 0 } : { x: { duration: 0.3, ease: LEAVE } },
        }),
      }}
      initial={{ y, scale }}
      animate={{ y, scale }}
      exit="exit"
      transition={reduced ? { duration: 0 } : SPRING}
      drag={active ? "x" : false}
      dragDirectionLock
      dragMomentum={false}
      dragElastic={1}
      dragConstraints={{ left: 0, right: 0 }}
      whileDrag={{ scale: reduced ? 1 : DRAG_SCALE }}
      onDrag={(_e, info) => onMove(info.offset.x)}
      onDragEnd={(_e, info) => onRelease(info.offset.x, info.velocity.x)}
      style={{ x, rotate, opacity: fade, zIndex: 10 - depth, transformOrigin: "50% 100%", touchAction: "pan-y" }}
      className={cn(
        "absolute inset-x-5 top-0 h-54 select-none overflow-hidden rounded-xl bg-card",
        active ? "cursor-grab shadow-lg active:cursor-grabbing" : "shadow-sm",
      )}
    >
      {children}
      {depth === 0 ? badge(-1, leftLabel) : null}
      {depth === 0 ? badge(1, rightLabel) : null}
    </motion.div>
  );
}

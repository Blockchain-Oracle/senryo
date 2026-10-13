"use client";
/**
 * A position's mark inside its life (D-343, Codex direction 15 §1; the lane `CountdownRing`'s geometry): a 40 px ring,
 * 2 px, draining from twelve o'clock to the position's end on the server's seconds, gliding linearly between them
 * (stepping once a second with Reduce Motion). The last ten seconds thicken it and strengthen its contrast — never a
 * warning colour. Cash-out lock doesn't stop it: it counts to settlement.
 */
import { type BookEntry, LAST_SECONDS, positionSpan } from "@senryo/calls";
import { marketId } from "@senryo/identity";
import { EntityMark } from "@/components/identity/entity-mark";
import { cn } from "@/lib/utils";

const SIZE = 40;
const MARK = 32;
const STROKE = 2;
const LAST_STROKE = 3;
const R = (SIZE - LAST_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;

export function PositionRing({ e, nowSec }: { e: BookEntry; nowSec: number }) {
  const span = positionSpan(e);
  const left = span && nowSec > 0 ? Math.max(0, span.toSec - nowSec) : null;
  const life = span && left !== null ? Math.min(1, left / Math.max(1, span.toSec - span.fromSec)) : null;
  const last = left !== null && left <= LAST_SECONDS;
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center">
      {life !== null ? (
        <svg aria-hidden width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="absolute inset-0">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-muted" />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            strokeWidth={last ? LAST_STROKE : STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - life)}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            className={cn(
              "transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none",
              last ? "stroke-foreground" : "stroke-text-3",
            )}
          />
        </svg>
      ) : null}
      <EntityMark id={marketId(e.symbol)} size={MARK} decorative />
    </span>
  );
}

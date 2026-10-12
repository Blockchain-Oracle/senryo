"use client";
/**
 * The chain (P3, D-326; the phone's `LegSockets`): four leg sockets joined by a line — an empty one waits, a picked one
 * holds the market's mark with its direction and lane; a link lights once both its ends are filled. A new leg settles
 * on a spring after its mark's flight (`flyMark`). Clicking a filled socket opens the slip on narrow screens.
 */
import type { ParlayPick } from "@senryo/calls";
import { PARLAY } from "@senryo/config";
import { lane, sideName } from "@senryo/core";
import { marketId } from "@senryo/identity";
import { ArrowDown, ArrowUp } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import type { RefObject } from "react";
import { EntityMark } from "@/components/identity/entity-mark";
import { cn } from "@/lib/utils";
import { FLY_MS } from "./fly";

const MARK = 40;
const MS = 1000;

export function LegSockets({
  picks,
  socketRefs,
  onOpen,
}: {
  picks: readonly ParlayPick[];
  socketRefs: RefObject<(HTMLElement | null)[]>;
  onOpen: () => void;
}) {
  const reduced = useReducedMotion();
  const slots = Array.from({ length: PARLAY.maxLegs }, (_, i) => picks[i]);
  return (
    <div className="flex flex-col gap-2">
      <ol aria-label={chainLabel(picks)} className="flex justify-between">
        {slots.map((p, i) => (
          <li key={i} className="relative flex flex-1 flex-col items-center gap-1">
            {i > 0 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-7 right-1/2 h-0.5 w-full -translate-y-1/2 transition-colors duration-(--motion-base)",
                  p && slots[i - 1] ? "bg-foreground" : "bg-secondary",
                )}
              />
            ) : null}
            <button
              type="button"
              ref={(el) => {
                if (socketRefs.current) socketRefs.current[i] = el;
              }}
              disabled={!p}
              onClick={onOpen}
              aria-hidden
              tabIndex={-1}
              className={cn("relative z-10 grid size-14 place-items-center rounded-full", "bg-secondary")}
            >
              {p ? (
                <motion.span
                  key={`${p.symbol}:${p.band}`}
                  className="relative"
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 18, delay: reduced ? 0 : FLY_MS / MS }}
                >
                  <EntityMark id={marketId(p.symbol)} size={MARK} decorative />
                  <span
                    className={cn(
                      "absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full text-background",
                      p.band === 0 ? "bg-up" : "bg-down",
                    )}
                  >
                    {p.band === 0 ? (
                      <ArrowUp className="size-3" strokeWidth={3} />
                    ) : (
                      <ArrowDown className="size-3" strokeWidth={3} />
                    )}
                  </span>
                </motion.span>
              ) : (
                <span className="font-semibold text-meta text-text-3">{i + 1}</span>
              )}
            </button>
            <span className={cn("text-center text-micro", p ? "text-foreground" : "text-text-3")}>
              {p ? `${p.symbol} · ${lane(p.cadenceSec)}` : i < PARLAY.minLegs ? "Leg" : "Optional"}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-center text-meta text-text-3">
        Pick {PARLAY.minLegs}–{PARLAY.maxLegs} calls. Every leg must come true.
      </p>
    </div>
  );
}

function chainLabel(picks: readonly ParlayPick[]): string {
  if (picks.length === 0) return `No legs yet. Pick ${PARLAY.minLegs} to ${PARLAY.maxLegs} calls.`;
  const legs = picks.map((p) => `${p.symbol} ${sideName(p.band)} ${lane(p.cadenceSec)}`).join(", ");
  return `${picks.length} of ${PARLAY.maxLegs} legs: ${legs}`;
}

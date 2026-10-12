"use client";
/**
 * The slip's stamp (D-331, Codex direction 12): an 88 px Kinpaku seal at −4° — a foil frame, the lacquer field, a fine
 * foil rule and the verdict in gold-leaf words ("Cashed out" / "Gain"). Gold is the seal's; the result's tone is the
 * figure's. It presses once when a result is seen arriving (scale 1.12 → 0.98 → 1 and y −8 → 0 over 220 ms; a fade
 * with reduced motion); history and exports show it at rest.
 */
import type { SlipStamp } from "@senryo/calls";
import { motion, type Transition, useReducedMotion } from "motion/react";

/** The press: in to 0.98 over the first 120 ms of 220, then settled at 1. */
const PRESS_FROM = 1.12;
const PRESS_UNDER = 0.98;
const PRESS_TURN = 0.55;
const PRESS: Transition = { duration: 0.22, times: [0, PRESS_TURN, 1] };
const FADE: Transition = { duration: 0.1 };
const LIFT_Y = -8;

export function ReceiptStamp({ stamp, press = false }: { stamp: SlipStamp; press?: boolean }) {
  const reduce = useReducedMotion();
  const motionProps = !press
    ? {}
    : reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: FADE }
      : {
          initial: { opacity: 0, scale: PRESS_FROM, y: LIFT_Y },
          animate: { opacity: 1, scale: [PRESS_FROM, PRESS_UNDER, 1], y: [LIFT_Y, 0, 0] },
          transition: PRESS,
        };
  return (
    <motion.div className="receipt-stamp" role="img" aria-label={stamp.lines.join(" ")} {...motionProps}>
      <div className="receipt-stamp-field">
        <div className="receipt-stamp-words">
          {stamp.lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

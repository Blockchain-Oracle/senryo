/** Motion for the D2 chart components — from @senryo/tokens MOTION (120–200 ms, bezier(0.2,0,0,1), nothing bounces). */
import { MOTION } from "@senryo/tokens";

const MS_PER_S = 1000;

export const DESK_EASE = MOTION.easing;
export const DESK_FAST_S = MOTION.fastMs / MS_PER_S;
export const DESK_BASE_S = MOTION.baseMs / MS_PER_S;
export const DESK_SLOW_S = MOTION.slowMs / MS_PER_S;

export const deskTransition = (durationS: number = DESK_BASE_S, delayS = 0) => ({
  duration: durationS,
  ease: DESK_EASE,
  delay: delayS,
});

import { MOTION, SPRING_ENERGY_THRESHOLD, type SpringSpec, SPRING as TOKEN_SPRING } from "@senryo/tokens";
import { Easing, ReduceMotion, type WithSpringConfig } from "react-native-reanimated";

/**
 * Living Lacquer motion families (direction §4, Codex consult D-191) for Reanimated 4. Every family has its own timing;
 * ordinary transitions decelerate on `cubic-bezier(0.2, 0.8, 0.2, 1)`. Springs never take a `duration` (the ms values
 * in MOTION are choreography targets). Reduced motion follows the device (`ReduceMotion.System`).
 */
export const EASE = Easing.bezier(...MOTION.easing);
/** The iOS drawer curve: sheets leave the bottom edge fast and settle long (M02/M12). */
export const EASE_SHEET = Easing.bezier(...MOTION.sheetEasing);

/** Step-1 names still read by existing components: press · selection · page push. */
export const DURATION = { fast: MOTION.fastMs, base: MOTION.baseMs, slow: MOTION.slowMs } as const;

function spring(s: SpringSpec): WithSpringConfig {
  return {
    mass: s.mass,
    stiffness: s.stiffness,
    damping: s.damping,
    overshootClamping: !s.overshoot,
    energyThreshold: SPRING_ENERGY_THRESHOLD,
    reduceMotion: ReduceMotion.System,
  };
}

/** Compact selector · tall detail/transaction · fan (Send leads with overshoot) · dock active region · ruler snap. */
export const SPRING = {
  compactSelector: spring(TOKEN_SPRING.compactSelector),
  tallDetail: spring(TOKEN_SPRING.tallDetail),
  fanLead: spring(TOKEN_SPRING.fanLead),
  fan: spring(TOKEN_SPRING.fan),
  dockActive: spring(TOKEN_SPRING.dockActive),
  rulerSnap: spring(TOKEN_SPRING.rulerSnap),
  sheetRelease: spring(TOKEN_SPRING.sheetRelease),
  dockBubble: spring(TOKEN_SPRING.dockBubble),
} as const;

/** Timed families (ms) and scroll distances (pt). */
export const TIMING = {
  press: MOTION.pressMs,
  pressRelease: MOTION.pressReleaseMs,
  sheetEnter: MOTION.sheetEnterMs,
  sheetExit: MOTION.sheetExitMs,
  stagger: MOTION.staggerMs,
  staggerItem: MOTION.staggerItemMs,
  selection: MOTION.selectionMs,
  pagePush: MOTION.pagePushMs,
  compactSelector: MOTION.compactSelectorMs,
  tallDetail: MOTION.tallDetailMs,
  parentChild: MOTION.parentChildMs,
  fanItem: MOTION.fanItemMs,
  fanStagger: MOTION.fanStaggerMs,
  fanBackdrop: MOTION.fanBackdropMs,
  fanToggle: MOTION.fanToggleMs,
  fanExit: MOTION.fanExitMs,
  fanExitItem: MOTION.fanExitItemMs,
  fanExitStagger: MOTION.fanExitStaggerMs,
  dockActive: MOTION.dockActiveMs,
  numberChange: MOTION.numberChangeMs,
  chartReveal: MOTION.chartRevealMs,
  onboardingScene: MOTION.onboardingSceneMs,
  qrReveal: MOTION.qrRevealMs,
  ambientLoop: MOTION.ambientLoopMs,
  completionFoil: MOTION.completionFoilMs,
  /** Reduced motion swaps travel for a crossfade of this length. */
  reducedMotion: MOTION.reducedMotionMs,
} as const;

/** The plus rotates into × by this many degrees; the Home header collapses over this scroll distance. */
export const FAN_TOGGLE_DEG = MOTION.fanToggleDeg;
export const HEADER_COLLAPSE_DISTANCE = MOTION.headerCollapseDistance;
/** Press feedback scale on tappable plates (no bounce). */
export const PRESS_SCALE = MOTION.pressScale;
/** Staggered content rises this far (pt) as it fades in; the page under a sheet steps back to this scale. */
export const STAGGER_RISE = MOTION.staggerRise;
export const SHEET_PARENT_SCALE = MOTION.sheetParentScale;

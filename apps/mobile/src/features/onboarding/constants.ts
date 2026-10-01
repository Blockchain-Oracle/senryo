/** The welcome story's layout and pacing (J1). Scene travel time is the token `TIMING.onboardingScene` (850 ms). */
export const STORY = {
  /** A scene stays this long before the story moves on by itself (until the user touches it). */
  autoAdvanceMs: 5_000,
  /** Horizontal travel before a touch becomes a swipe (so a tap stays a tap). */
  panActivate: 12,
  /** A swipe faster than this (pt/s) moves one scene regardless of distance. */
  flickVelocity: 500,
  /** Tapping the left third of the picture goes back; the rest goes forward. */
  backZone: 0.33,
  segmentHeight: 4,
  /** Two lines of headline room plus two of body, so the picture doesn't jump between scenes. */
  copyMinHeight: 104,
} as const;

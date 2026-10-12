/** Sheet drag physics (ported, spec client.md); the springs are the theme's motion families (SPRING, direction §4). */
export const SHEET = {
  /** Past a quarter of its height (120 pt at most), or flicked faster than 900 pt/s, a drag closes the sheet. */
  closeFraction: 0.25,
  closeDistance: 120,
  closeVelocity: 900,
  /** Upward drag is resisted ÷6. */
  upwardResistance: 6,
  activeOffsetY: 8,
  failOffsetX: 24,
  scrollThrottle: 16,
  maxHeight: 0.9,
  /** A sheet with detents stops this far under the top safe area at its tallest (D-321). */
  topGap: 8,
  /** A flick past this speed (pt/s) moves a sheet with detents one stop. */
  detentVelocity: 500,
} as const;

/** A long list's rests (the market sheet, D-321): it opens at 62 % and drags to 88 % and full. */
export const LIST_DETENTS = [0.62, 0.88, 1] as const;

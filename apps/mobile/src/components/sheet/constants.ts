/** Sheet drag physics (ported, spec client.md); the springs are the theme's motion families (SPRING, direction §4). */
export const SHEET = {
  /** Past a quarter of its height, or flicked faster than 900 pt/s, a drag closes the sheet. */
  closeFraction: 0.25,
  closeVelocity: 900,
  /** Upward drag is resisted ÷6. */
  upwardResistance: 6,
  activeOffsetY: 8,
  failOffsetX: 24,
  scrollThrottle: 16,
  maxHeight: 0.9,
} as const;

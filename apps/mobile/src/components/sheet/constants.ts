/** Sheet physics (ported, spec client.md): a firm spring with no visible bounce past the top. */
export const SHEET = {
  spring: { damping: 26, stiffness: 260, mass: 0.9, overshootClamping: true },
  /** Past a quarter of its height, or flicked faster than 900 pt/s, a drag closes the sheet. */
  closeFraction: 0.25,
  closeVelocity: 900,
  /** Upward drag is resisted ÷6. */
  upwardResistance: 6,
  activeOffsetY: 8,
  failOffsetX: 24,
  scrollThrottle: 16,
  blurIntensity: 12,
  maxHeight: 0.9,
} as const;

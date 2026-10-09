/**
 * Win confetti (the phone's `components/kit/Confetti.tsx`, Owarine's toasts burst; 21st.dev motiondotdev/motion-confetti
 * #24692 for the shape mix): two emitters at 18 % and 82 % of the width near the bottom, 34 pieces each, launched up
 * and outward, slowed by drag and pulled by gravity, fading over the second half of 1.1 s.
 */
export const CONFETTI = {
  perEmitter: 34,
  emitters: [0.18, 0.82],
  originY: 0.86,
  lifeMs: 1_100,
  fadeFrom: 0.5,
  speedMin: 3.6,
  speedSpread: 3.4,
  spread: 0.9,
  outward: 0.42,
  gravity: 0.14,
  dragMin: 0.982,
  dragSpread: 0.012,
  spin: 0.4,
  wMin: 4,
  wSpread: 4,
  hMin: 6,
  hSpread: 6,
  stripRatio: 2.4,
  frameMs: 1000 / 60,
  shapes: 3,
  maxDpr: 2,
} as const;

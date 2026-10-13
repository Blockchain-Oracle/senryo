/**
 * The replay video's frame (Q3, D-350; Codex direction 17 §2): 1080 × 1350 (4:5 — X and Instagram's feed, Fomo's size),
 * laid out after Fomo's card in Senryo's look: the dark brand ground and card, the trader's portrait, handle, date and
 * Kinpaku stamp on top; the chart (plot 48–824 × 264–632, the head pinned at x 594, the price pill at x 848); the token
 * panel (market, the PnL at 112, ROI, three stats) with no inner box; the brand band with the lockup, the code and a QR
 * to the trade. Pixels at the frame's own size; the in-app preview scales the whole frame down.
 */
export const FILM_W = 1080;
export const FILM_H = 1350;

export const LAYOUT = {
  card: { x: 12, y: 12, w: 1056, h: 1154, radius: 60 },
  portrait: { x: 48, y: 48, size: 144 },
  handle: { x: 228, base: 104, size: 52, min: 38, maxW: 500 },
  date: { right: 1032, base: 92, size: 34 },
  mode: { right: 1032, base: 160, size: 28 },
  stamp: { x: 228, y: 124, size: 104, ring: 4, rule: 7, wordSize: 24, tiltDeg: -4 },
  plot: { x: 48, y: 264, w: 776, h: 368 },
  grid: { step: 48, dot: 1.5, alpha: 0.06 },
  line: { width: 6, glow: 24, glowAlpha: 0.14 },
  head: { r: 10 },
  rule: { width: 2, on: 12, off: 12, alpha: 0.4 },
  pill: { x: 848, w: 184, h: 56, radius: 10, size: 32, top: 264, bottom: 576 },
  labels: { right: 1032, size: 28, clear: 40 },
  ticks: { base: 676, size: 28 },
  level: { width: 2, dash: 10, labelSize: 26, zoneAlpha: 0.07 },
  moment: { notch: 24, leader: 2, labelSize: 30, captionSize: 26, maxW: 280, gap: 12 },
  provenance: { x: 48, base: 724, size: 24 },
  panel: { x: 48, y: 728, w: 984 },
  market: { mark: 72, markY: 756, x: 140, nameBase: 798, nameSize: 44, idBase: 846, idSize: 30 },
  figure: { base: 892, size: 28 },
  pnl: { base: 1006, size: 112, min: 88, maxW: 660 },
  roi: { x: 740, base: 978, size: 46 },
  /** Three columns from the panel's left edge (x 48, 376, 704). */
  stats: { column: 328, labelBase: 1068, valueBase: 1118, labelSize: 30, valueSize: 40 },
  lockup: { x: 48, y: 1214, w: 325, h: 88 },
  referral: { x: 440, labelBase: 1232, codeBase: 1290, labelSize: 30, codeSize: 42, codeMin: 28, maxW: 384 },
  qr: { x: 888, y: 1188, size: 144 },
} as const;

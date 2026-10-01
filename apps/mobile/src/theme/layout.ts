import { HAIRLINE_PX, MOTION, RADIUS, SPACE } from "@senryo/tokens";
import { Easing } from "react-native-reanimated";

export { HAIRLINE_PX, RADIUS, SPACE };

/** Fixed chrome and component sizes (pt), the phone layout of the D2 preview at 390 px. */
export const SIZE = {
  touch: 44,
  strip: 48,
  gutter: SPACE.lg,
  icon: 18,
  iconSm: 14,
  dot: 6,
  buttonHeight: 48,
  buttonHeightSm: 36,
  chartEquity: 220,
  chartCandles: 260,
  sparkline: 28,
  sparklineWidth: 72,
  heatmap: 200,
  gaugeRing: 8,
  partitionBar: 8,
  handleWidth: 36,
  handleHeight: 4,
  qr: 180,
  cardAspect: 1.586,
  maxToastWidth: 384,
  skeletonLine: 14,
  skeletonSmall: 10,
  skeletonRow: 44,
  skeletonPlate: 96,
  cardChipWidth: 36,
  cardChipHeight: 28,
  seal: 88,
  sealStroke: 2,
  /** Identity marks (v2-plan §5.12): market rows 32–40, market detail ~48, table cells, inline chips and badges. */
  markRow: 36,
  markDetail: 48,
  markCell: 24,
  /** Token discs: USDC's owner minimum is 32 px (Circle brand guide). */
  markToken: 32,
  markInline: 20,
  markChip: 16,
} as const;

/** Motion: 120–200 ms on `bezier(0.2, 0, 0, 1)`; nothing bounces except the sheet's clamped spring (D-004). */
export const EASE = Easing.bezier(...MOTION.easing);
export const DURATION = { fast: MOTION.fastMs, base: MOTION.baseMs, slow: MOTION.slowMs } as const;
/** Skeleton breathing (ms) and its opacity range — static under Reduce Motion. */
export const SKELETON = { periodMs: 900, from: 0.55, to: 1 } as const;
/** Disabled controls dim to this opacity. */
export const DISABLED_OPACITY = 0.45;
/** Press feedback scale on tappable plates. */
export const PRESS_SCALE = 0.98;

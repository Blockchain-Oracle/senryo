import { HAIRLINE_PX, RADIUS, SPACE, ELEVATION as TOKEN_ELEVATION } from "@senryo/tokens";
import type { ViewStyle } from "react-native";

export { HAIRLINE_PX, RADIUS, SPACE };

/** Fixed chrome and component sizes (pt) at the 402×874 reference viewport (direction §3/§5; Codex S1b.6 consult, D-191). */
export const SIZE = {
  /** Minimum touch target and row height; both grow with content and Dynamic Type. */
  touch: 44,
  rowMinHeight: 64,
  strip: 48,
  gutter: SPACE.inset,
  /** Lucide utility icons: 24 (16 small), one consistent stroke. */
  icon: 24,
  iconSm: 16,
  iconStroke: 2,
  dot: 6,
  /** Buttons: primary 56, secondary 48, compact 44 (shape in BUTTON). */
  buttonHeight: 56,
  buttonHeightSecondary: 48,
  buttonHeightSm: 44,
  inputHeight: 52,
  /** The one large field of a full-page step (Fomo F04/F07: 66 pt, 16 pt corners). */
  fieldHeight: 64,
  /** Chips are 32 visually (34 in a category row); their hit area stays ≥ 44 (hitSlop). */
  chipHeight: 32,
  chipRowHeight: 34,
  modeCapsuleHeight: 34,
  avatarXs: 24,
  avatarSm: 32,
  avatarMd: 40,
  avatarLg: 56,
  avatarXl: 80,
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

/** Three-context native dock; scroll content clears its tallest central anchor. */
export const DOCK = {
  height: 68,
  inset: 28,
  /** Relative to the bottom safe area; never closer to the screen edge than `minBottom`. */
  bottomOffset: -4,
  minBottom: 12,
} as const;

/** Distance from the screen’s bottom edge to the dock’s bottom edge. */
export function dockBottom(safeBottom: number): number {
  return Math.max(DOCK.minBottom, safeBottom + DOCK.bottomOffset);
}

/** Native reference controls are flat pills; outlines are explicit secondary actions. */
export const BUTTON = {
  radius: { md: 28, sm: 22 },
  rim: 1,
  icon: 20,
  /** A round utility control (F16): 36 pt visible, 44 pt target. */
  utility: 36,
} as const;

/** Native reference sheets attach to the edges with rounded top corners; content clears the safe area. */
export const SHEET_SHAPE = {
  inset: 0,
  radius: 24,
  handleTop: 14,
  handleBottom: 14,
  padding: 16,
  rowRadius: 20,
  rowMinHeight: 70,
  rowGap: 12,
} as const;

/** Shadows (RN `boxShadow`): the dock and sheets only; raised content surfaces carry none. */
const shadow = (e: (typeof TOKEN_ELEVATION)[keyof typeof TOKEN_ELEVATION]): ViewStyle => ({
  boxShadow: `${e.x}px ${e.y}px ${e.blur}px ${e.spread}px ${e.color}`,
});
export const ELEVATION = {
  dock: shadow(TOKEN_ELEVATION.dock),
  sheet: shadow(TOKEN_ELEVATION.sheet),
} as const;
/** Skeleton breathing (ms) and its opacity range — static under Reduce Motion. */
export const SKELETON = { periodMs: 1200, from: 0.65, to: 1 } as const;
/** Disabled controls dim to this opacity. */
export const DISABLED_OPACITY = 0.5;

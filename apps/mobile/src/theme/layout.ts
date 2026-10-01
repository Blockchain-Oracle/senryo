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
  /** Pill buttons: primary 56, secondary 48, compact 44. */
  buttonHeight: 56,
  buttonHeightSecondary: 48,
  buttonHeightSm: 44,
  inputHeight: 52,
  /** Chips are 32 visually; their hit area stays ≥ 44 (hitSlop). */
  chipHeight: 32,
  modeCapsuleHeight: 44,
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

/**
 * Floating dock (C15, direction §5): a ~64 pt capsule, 16 pt from each side, 12 pt above the bottom safe area. Content
 * scrolls with `contentBottom` + the safe-area inset so nothing sits under it (Fomo's overlap is the defect we fix).
 */
export const DOCK = {
  height: 64,
  inset: 16,
  bottomOffset: 12,
  iconSize: 24,
  labelGap: 4,
  /** 12 offset + 64 dock + 16 clearance. */
  contentBottom: 92,
} as const;

/**
 * Phantom fan (C18, P19/M06): 48 pt circles 72 pt apart centre-to-centre in a right column, labels 16 pt to their left;
 * the plus trigger sits 16 pt from the right, 16 pt above the dock.
 */
export const FAN = {
  circle: 48,
  spacing: 72,
  labelGap: 16,
  trigger: 48,
  triggerIcon: 24,
  triggerRight: 16,
  triggerBottom: DOCK.contentBottom,
} as const;

/** Shadows (RN `boxShadow`): the dock and sheets only; raised content surfaces carry none. */
const shadow = (e: (typeof TOKEN_ELEVATION)[keyof typeof TOKEN_ELEVATION]): ViewStyle => ({
  boxShadow: `${e.x}px ${e.y}px ${e.blur}px ${e.spread}px ${e.color}`,
});
export const ELEVATION = { dock: shadow(TOKEN_ELEVATION.dock), sheet: shadow(TOKEN_ELEVATION.sheet) } as const;

/** Skeleton breathing (ms) and its opacity range — static under Reduce Motion. */
export const SKELETON = { periodMs: 1200, from: 0.65, to: 1 } as const;
/** Disabled controls dim to this opacity. */
export const DISABLED_OPACITY = 0.5;

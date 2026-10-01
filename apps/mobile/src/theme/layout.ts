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

/**
 * Floating dock (C15; Fomo F12/F16, measured at 2 px per pt): an icon-only capsule about 54 pt high that sits low, in
 * the home-indicator band, with the active destination inside a lighter bubble. The plus (Phantom P12/P19) is a
 * separate disc on the same row at the right, so it never covers list content. Scroll content ends above the row
 * (`useDockInset`), so nothing sits under either.
 */
export const DOCK = {
  height: 56,
  inset: 28,
  /** Relative to the bottom safe area; never closer to the screen edge than `minBottom`. */
  bottomOffset: -4,
  minBottom: 12,
  /** Gap between the capsule and the plus disc; the capsule pads its five slots by `padding`. */
  plusGap: 12,
  padding: 3,
  iconSize: 24,
  iconStroke: 2,
  iconStrokeActive: 2.25,
  /** The active bubble: 4 pt from the capsule's top and bottom, 1 pt inside its slot; it stretches while it travels. */
  bubbleInset: 4,
  bubbleGap: 1,
  bubbleStretch: 1.14,
  iconPop: 1.1,
} as const;

/** Distance from the screen's bottom edge to the dock's (and the plus's) bottom edge. */
export function dockBottom(safeBottom: number): number {
  return Math.max(DOCK.minBottom, safeBottom + DOCK.bottomOffset);
}

/**
 * Phantom fan (C18, P19/M06): 48 pt circles 72 pt apart centre-to-centre in a right column, labels 16 pt to their left.
 * The plus is a 48 pt disc at the right of the dock row, centred on the dock's height; the column is centred on it.
 */
export const FAN = {
  circle: 48,
  spacing: 72,
  labelGap: 16,
  trigger: 48,
  triggerIcon: 24,
  triggerRight: DOCK.inset,
} as const;

/**
 * Buttons (Fomo F01/F09/F36/F44; Codex consult 1 Oct): rounded rectangles, never full pills — 56 high with 12 pt
 * corners, 44 with 10. A filled button carries a 1 pt top highlight inside the fill (`rim`), which is what gives the
 * reference buttons their depth; a spinner or leading icon sits in a 20 pt slot.
 */
export const BUTTON = {
  radius: { md: 12, sm: 10 },
  rim: 1,
  icon: 20,
  /** A round utility control (F16): 36 pt visible, 44 pt target. */
  utility: 36,
} as const;

/**
 * Sheets (Fomo F08/F20/F36/F44): a compact sheet floats `inset` from the left, right and bottom edges with large
 * corners all round; its rows are borderless filled cards. Tall sheets attach to the edges and keep only top corners.
 */
export const SHEET_SHAPE = {
  inset: 8,
  radius: 38,
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
/** The primary button's lift, as the outer half of its `boxShadow` (the inner half is its top highlight). */
const b = TOKEN_ELEVATION.button;
export const BUTTON_LIFT = `${b.x}px ${b.y}px ${b.blur}px ${b.spread}px ${b.color}`;

/** Skeleton breathing (ms) and its opacity range — static under Reduce Motion. */
export const SKELETON = { periodMs: 1200, from: 0.65, to: 1 } as const;
/** Disabled controls dim to this opacity. */
export const DISABLED_OPACITY = 0.5;

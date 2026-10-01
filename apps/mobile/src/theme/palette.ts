import { DARK as DARK_TOKENS, LIGHT as LIGHT_TOKENS, type Palette as TokenPalette } from "@senryo/tokens";

/**
 * The app palette: every role from `@senryo/tokens` (the only colour source, Living Lacquer D-168) plus the few washes
 * React Native needs precomputed (it has no color-mix()). One `roles()` per theme, same keys in both.
 * This folder is the only place a hex or rgba() may appear in apps/mobile (invariant design-literals-mobile).
 */
const HEX_RADIX = 16;
const BYTE = 255;
const RED_SHIFT = 16;
const GREEN_SHIFT = 8;
const HEX_BODY_START = 1;

function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(HEX_BODY_START), HEX_RADIX);
  return `rgba(${(n >> RED_SHIFT) & BYTE}, ${(n >> GREEN_SHIFT) & BYTE}, ${n & BYTE}, ${alpha})`;
}

/** Directional wash strengths (fractions of the up/down colour) and the chart area fill (D-191). */
const WASH = { soft: 0.12, strong: 0.24, chartFill: 0.16, chartFillEnd: 0 } as const;
/** Edge light (fractions): the top highlight on a filled primary, the faint edge of a raised fill, the dock bubble. */
const RIM = { primary: 0.2, surface: 0.06, bubble: 0.12, bubbleEdge: 0.16 } as const;

function roles(t: TokenPalette) {
  return {
    ...t,
    /** Page ground, panels and hairlines under their app names. */
    ground: t.background,
    ink: t.foreground,
    inkMuted: t.mutedForeground,
    hairline: t.border,
    upWash: withAlpha(t.up, WASH.soft),
    /** Mode and status plates are the opaque Living Lacquer surfaces (Codex consult §4), not alpha washes. */
    practiceWash: t.practiceSurface,
    mainnetWash: t.mainnetSurface,
    downWash: withAlpha(t.down, WASH.soft),
    upWashStrong: withAlpha(t.up, WASH.strong),
    downWashStrong: withAlpha(t.down, WASH.strong),
    warnWash: t.warningSurface,
    destructiveWash: t.destructiveSurface,
    chartFillTop: withAlpha(t.chartUp, WASH.chartFill),
    chartFillBottom: withAlpha(t.chartUp, WASH.chartFillEnd),
    /** Ordinary sheets dim the parent (#00000066 / #17151F38); the fan has its own `fanScrim` over live blur. */
    scrim: t.sheetScrim,
    /** Depth without borders: 1 px inner highlights (Fomo's buttons, sheets and dock bubble). */
    primaryRim: withAlpha(t.primaryForeground, RIM.primary),
    surfaceRim: withAlpha(t.foreground, RIM.surface),
    glassBubble: withAlpha(t.foreground, RIM.bubble),
    glassBubbleRim: withAlpha(t.foreground, RIM.bubbleEdge),
    /** Text on a light plate (QR card) in both themes. */
    paper: LIGHT_TOKENS.card,
    paperInk: LIGHT_TOKENS.foreground,
    /** The mode names on the story artwork's light label plates (light-theme inks in both themes). */
    paperPractice: LIGHT_TOKENS.practice,
    paperMainnet: LIGHT_TOKENS.mainnet,
    /** Text on the Kinpaku card's lacquer (the art is black in both themes). */
    onLacquer: DARK_TOKENS.foreground,
    onLacquerMuted: DARK_TOKENS.mutedForeground,
    /** Content surfaces carry no shadow (direction §3); the toast needs one colour for its plate border only. */
    transparent: "transparent",
  };
}

export type Palette = ReturnType<typeof roles>;
export const DARK: Palette = roles(DARK_TOKENS);
export const LIGHT: Palette = roles(LIGHT_TOKENS);

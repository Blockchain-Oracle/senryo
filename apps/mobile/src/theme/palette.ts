import { DARK as DARK_TOKENS, LIGHT as LIGHT_TOKENS, type Palette as TokenPalette } from "@senryo/tokens";

/**
 * The app palette: every role from `@senryo/tokens` (the only colour source, D-004) plus the few washes React Native
 * needs precomputed (it has no color-mix()). Ported structure: one `roles()` per theme, same keys in both.
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

/** Wash strengths (fractions of the base colour), matching the web's `color-mix` percentages. */
const WASH = { soft: 0.12, strong: 0.24, scrim: 0.72, chartFill: 0.28, chartFillEnd: 0 } as const;

function roles(t: TokenPalette, dark: boolean) {
  return {
    ...t,
    /** Page ground, panels and hairlines under their app names. */
    ground: t.background,
    ink: t.foreground,
    inkMuted: t.mutedForeground,
    hairline: t.border,
    upWash: withAlpha(t.up, WASH.soft),
    /** Mode surfaces (S8.22): the capsule and selector rows tint with their mode colour. */
    practiceWash: withAlpha(t.practice, WASH.soft),
    mainnetWash: withAlpha(t.mainnet, WASH.soft),
    downWash: withAlpha(t.down, WASH.soft),
    upWashStrong: withAlpha(t.up, WASH.strong),
    downWashStrong: withAlpha(t.down, WASH.strong),
    warnWash: withAlpha(t.warn, WASH.soft),
    destructiveWash: withAlpha(t.destructive, WASH.soft),
    chartFillTop: withAlpha(t.chartUp, WASH.chartFill),
    chartFillBottom: withAlpha(t.chartUp, WASH.chartFillEnd),
    scrim: withAlpha(dark ? DARK_TOKENS.background : LIGHT_TOKENS.foreground, WASH.scrim),
    /** Text on a light plate (QR card) in both themes. */
    paper: LIGHT_TOKENS.card,
    paperInk: LIGHT_TOKENS.foreground,
    /** Text on the Kinpaku card's lacquer (the art is black in both themes). */
    onLacquer: DARK_TOKENS.foreground,
    onLacquerMuted: DARK_TOKENS.mutedForeground,
    /** Shadows are off in D2; the toast needs one colour for its plate border only. */
    transparent: "transparent",
  };
}

export type Palette = ReturnType<typeof roles>;
export const DARK: Palette = roles(DARK_TOKENS, true);
export const LIGHT: Palette = roles(LIGHT_TOKENS, false);

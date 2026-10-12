/**
 * The arcade's ink (D-316): the arena and the direction fills — the same in both themes, the arena always near-black.
 * The web reads them from the theme's tokens on the stage, the phone from its palette. `tint` gives a token at an
 * alpha for glows, trails and particles, as `rgba(r, g, b, a)` (the web's canvas and Skia both parse it).
 */
export interface ArcadeInk {
  arena: string;
  raised: string;
  ink: string;
  up: string;
  down: string;
  range: string;
  accent: string;
}

const HEX_SHORT = 4;
const HEX_LONG = 7;
const RED = 1;
const GREEN = 3;
const BLUE = 5;
const BYTE = 2;
const RADIX = 16;

/** A `#RRGGBB` token at `alpha` (0–1); anything else passes through. */
export function tint(hex: string, alpha: number): string {
  let h = hex;
  if (h.length === HEX_SHORT) h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  if (h.length !== HEX_LONG || h[0] !== "#") return hex;
  const c = (i: number) => Number.parseInt(h.slice(i, i + BYTE), RADIX);
  return `rgba(${c(RED)}, ${c(GREEN)}, ${c(BLUE)}, ${alpha})`;
}

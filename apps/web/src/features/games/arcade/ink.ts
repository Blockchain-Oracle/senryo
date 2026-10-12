/**
 * The arcade's ink (D-316): the arena and the direction fills, read once per run from the theme's tokens on the stage
 * (`--arena`, `--up-fill`…, the same in both themes — the arena is always near-black). `tint` gives a token at an
 * alpha for glows, trails and particles.
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

export function readInk(el: HTMLElement): ArcadeInk {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    arena: v("--arena"),
    raised: v("--arena-raised"),
    ink: v("--arena-ink"),
    up: v("--up-fill"),
    down: v("--down-fill"),
    range: v("--range-fill"),
    accent: v("--accent"),
  };
}

/** A `#RRGGBB` token at `alpha` (0–1); anything else passes through. */
export function tint(hex: string, alpha: number): string {
  let h = hex;
  if (h.length === HEX_SHORT) h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  if (h.length !== HEX_LONG || h[0] !== "#") return hex;
  const c = (i: number) => Number.parseInt(h.slice(i, i + BYTE), RADIX);
  return `rgb(${c(RED)} ${c(GREEN)} ${c(BLUE)} / ${alpha})`;
}

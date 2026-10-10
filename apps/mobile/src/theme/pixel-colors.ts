/**
 * The games' pixel marks on the phone's palette (`@senryo/identity` `PixelMark`, R2.8; the web's `lib/pixel-colors.ts`):
 * Up and Down in the chart's direction colours, the coin in gold leaf, the plate's frame in the accent, cut-outs in
 * the ground.
 */
import type { PixelColors } from "@senryo/identity";
import { type Palette, withAlpha } from "./palette";

const SOFT = 0.35;

export function pixelColors(color: Palette): PixelColors {
  return {
    up: color.chartUp,
    down: color.chartDown,
    gold: color.gold,
    accent: color.accent,
    ground: color.ground,
    soft: withAlpha(color.ink, SOFT),
  };
}

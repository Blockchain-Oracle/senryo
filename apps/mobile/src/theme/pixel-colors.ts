/**
 * The games' pixel marks on the phone's palette (`@senryo/identity` `PixelMark`, R2.8; the web's `lib/pixel-colors.ts`):
 * Up and Down in the chart's direction colours, the coin and the plate's mark in gold leaf, cut-outs in the ground.
 */
import type { PixelColors } from "@senryo/identity";
import { MATERIAL } from "@senryo/tokens";
import { type Palette, withAlpha } from "./palette";

const SOFT = 0.35;

export function pixelColors(color: Palette): PixelColors {
  return {
    up: color.chartUp,
    down: color.chartDown,
    // Gold leaf the material (the same in both themes), not the `gold` text role, which is darkened to read on light.
    gold: MATERIAL.goldLeaf.mid,
    ground: color.ground,
    soft: withAlpha(color.ink, SOFT),
  };
}

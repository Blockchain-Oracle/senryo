/**
 * The games' pixel marks on the web's tokens (`@senryo/identity` `PixelMark`, R2.8): Up and Down in the chart's
 * direction colours, the coin and the plate's mark in gold leaf, eye cut-outs in the ground.
 */
import type { PixelColors } from "@senryo/identity";

export const PIXEL_COLORS: PixelColors = {
  up: "var(--chart-up)",
  down: "var(--chart-down)",
  // Gold leaf the material (the same in both themes), not `--gold`, which is darkened to read as text on light.
  gold: "var(--gold-leaf-mid)",
  ground: "var(--background)",
  soft: "color-mix(in srgb, var(--foreground) 35%, transparent)",
};

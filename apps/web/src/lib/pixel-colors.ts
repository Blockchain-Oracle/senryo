/**
 * The games' pixel marks on the web's tokens (`@senryo/identity` `PixelMark`, R2.8): Up and Down in the chart's
 * direction colours, the coin in gold leaf, the plate's frame in the accent, eye cut-outs in the ground.
 */
import type { PixelColors } from "@senryo/identity";

export const PIXEL_COLORS: PixelColors = {
  up: "var(--chart-up)",
  down: "var(--chart-down)",
  gold: "var(--gold)",
  accent: "var(--accent)",
  ground: "var(--background)",
  soft: "color-mix(in srgb, var(--foreground) 35%, transparent)",
};

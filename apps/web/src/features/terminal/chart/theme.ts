/**
 * The chart's colours and canvas fonts from the app's tokens (the phone's chart roles: up and down lines, ink, the
 * ground as the tags' ink, the muted helper, the dark ink on the pill), re-read when the theme flips.
 */
import { FONT_PX, FONT_WEIGHT } from "./constants";
import type { ChartTheme } from "./draw";

export function readChartTheme(el: Element): { chart: ChartTheme; dots: string } {
  const cs = getComputedStyle(el);
  const v = (name: string) => cs.getPropertyValue(name).trim();
  const sans = `${v("--font-inter") || "Inter"}, ${v("--font-sans-family") || "system-ui"}`;
  const jp = `${v("--font-noto-jp") || "Noto Sans JP"}, ${sans}`;
  // Prices on the canvas (the pill and the tags) are money: the condensed display face (R2.3); the axis stays Inter.
  const display = `${v("--font-condensed") || "Roboto Condensed"}, ${sans}`;
  const font = (weight: number, px: number, family = sans) => `${weight} ${px}px ${family}`;
  return {
    chart: {
      up: v("--chart-up"),
      down: v("--chart-down"),
      ink: v("--foreground"),
      inverse: v("--background"),
      helper: v("--text-3"),
      onLine: v("--up-foreground"),
      axisFont: font(FONT_WEIGHT.axis, FONT_PX.axis),
      pillFont: font(FONT_WEIGHT.pill, FONT_PX.pill, display),
      pillSmallFont: font(FONT_WEIGHT.pill, FONT_PX.pillSmall, display),
      tagFont: font(FONT_WEIGHT.tag, FONT_PX.tag, display),
      markFont: font(FONT_WEIGHT.mark, FONT_PX.mark, jp),
    },
    dots: v("--border"),
  };
}

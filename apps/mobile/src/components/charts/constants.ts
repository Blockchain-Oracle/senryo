/** Chart drawing constants (pt), D2: 1.5 pt lines, no bounce, only a few labels. */
export const CHART = {
  stroke: 1.5,
  dot: 4,
  padTop: 8,
  padBottom: 4,
  padLeft: 6,
  padRight: 6,
  timeTicks: 5,
  minPoints: 2,
  /** A pannable chart opens on this many newest candles (F32 shows about this many on a phone). */
  panVisible: 96,
  /** Horizontal travel (pt) before a drag pans the chart; vertical travel past it hands the touch to the page. */
  panSlop: 12,
  axisFontSize: 10,
  yTicks: 4,
  /** Candle body width as a fraction of the slot. */
  candleWidthFraction: 0.6,
  /**
   * The current-price line (Fomo F32): a 1 pt dotted rule across the plot and a filled label on the price axis, with
   * 4 × 2 pt of padding around its figure and 3 pt corners.
   */
  lastStroke: 1,
  lastDash: 2,
  lastGap: 3,
  lastPadX: 4,
  lastPadY: 2,
  lastRadius: 3,
} as const;

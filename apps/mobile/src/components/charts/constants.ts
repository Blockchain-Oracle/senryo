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
  axisFontSize: 10,
  yTicks: 4,
  /** Candle body width as a fraction of the slot. */
  candleWidthFraction: 0.6,
} as const;

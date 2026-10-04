import {
  DashPathEffect,
  RoundedRect,
  type SkFont,
  Line as SkiaLine,
  Text as SkiaText,
  useFont,
  vec,
} from "@shopify/react-native-skia";
import { useMemo } from "react";
import { View } from "react-native";
import { Candlestick, type CandlestickOptionsFn, CartesianChart, useChartTransformState } from "victory-native";
import { clockTime } from "~/lib/format";
import { toPlot } from "~/lib/money";
import { SIZE, useTheme } from "~/theme";
import { CHART_FONT } from "~/theme/fonts";
import { CHART } from "./constants";

/** Saved candle settings (FT106): body on/off, the up/down colour pair, colour by previous close. */
export interface CandleStyle {
  body: boolean;
  palette: "greenRed" | "cyanRose";
  previousClose: boolean;
}

/** One OHLC bucket in integer base units (`decimals` places), `t` in ms. */
export interface ChartCandle {
  t: number;
  open: bigint;
  high: bigint;
  low: bigint;
  close: bigint;
}

/** The current price to mark on the chart: its value (same base units as the candles) and the text for its label. */
export interface LastPrice {
  value: bigint;
  label: string;
}

/**
 * RN port of 21st Candle Chart #22250: victory-native XL `Candlestick` in the token colours, price axis on the right in
 * Inter (theme CHART_FONT), time ticks below. Candles are indexed Chainlink rounds (D-020, D-163: no fabricated ticks — gaps
 * stay gaps). `style` applies the saved candle settings (FT106): body on/off, the colour pair, colour by previous close.
 * `last` draws the current-price line (Fomo F32): a dotted rule across the plot with a filled label on the price axis,
 * green when the price is at or above the newest candle's open and red below it; the price scale widens to keep it in
 * view. `reference` draws a second, solid line with a quiet label at the plot's left (a position's entry, flow book
 * C5 step 2), also kept in view. `axisDecimals`, `axisPrefix` and `formatTime` word the two axes (an FX pair needs five decimals; a year needs
 * dates).
 */
export function CandleChart({
  candles,
  decimals,
  style,
  height = SIZE.chartCandles,
  last,
  reference,
  axisDecimals = 0,
  axisPrefix = "",
  formatTime = clockTime,
  pannable = false,
}: {
  candles: ChartCandle[];
  decimals: number;
  style?: CandleStyle;
  height?: number;
  last?: LastPrice;
  /** A fixed level to mark (an entry price): a solid line and its label. */
  reference?: LastPrice;
  axisDecimals?: number;
  axisPrefix?: string;
  formatTime?: (ms: number) => string;
  /**
   * FT096 (F32/F35 reframing): open on the newest `CHART.panVisible` candles and drag sideways through the rest. The
   * drag starts only on a clearly horizontal move, so the page around it still scrolls.
   */
  pannable?: boolean;
}) {
  const { color } = useTheme();
  const up = style?.palette === "cyanRose" ? color.chart3 : color.chartUp;
  const down = style?.palette === "cyanRose" ? color.chart4 : color.chartCandleDown;
  const font = useFont(CHART_FONT, CHART.axisFontSize);
  const data = useMemo(
    () =>
      candles.map((c) => ({
        t: c.t,
        open: toPlot(c.open, decimals),
        high: toPlot(c.high, decimals),
        low: toPlot(c.low, decimals),
        close: toPlot(c.close, decimals),
      })),
    [candles, decimals],
  );
  const lastAt = last ? toPlot(last.value, decimals) : undefined;
  const refAt = reference ? toPlot(reference.value, decimals) : undefined;
  // The price scale spans the candles, the current price and the reference, so no line is drawn outside the plot.
  const domain = useMemo(() => {
    const marks = [lastAt, refAt].filter((v): v is number => v !== undefined);
    if (marks.length === 0) return undefined;
    let lo = Math.min(...marks);
    let hi = Math.max(...marks);
    for (const c of data) {
      lo = Math.min(lo, c.low);
      hi = Math.max(hi, c.high);
    }
    return { y: [lo, hi] as [number, number] };
  }, [data, lastAt, refAt]);
  // The price distance the current-price label covers on the axis; figures inside it are left out (F32 shows one).
  const covered = domain ? ((domain.y[1] - domain.y[0]) * CHART.lastClear) / Math.max(1, height - CHART.xAxisBand) : 0;
  // Colour by previous close compares each close with the preceding candle's (the first falls back to open/close).
  const options: CandlestickOptionsFn | undefined = style
    ? (c) => {
        const prev = style.previousClose ? data[c.datumIndex - 1] : undefined;
        const rising = prev ? c.close > prev.close : c.isPositive;
        const falling = prev ? c.close < prev.close : c.isNegative;
        const tone = rising ? up : falling ? down : color.chartNeutral;
        return { body: { color: tone, opacity: style.body ? 1 : 0 }, wick: { color: tone } };
      }
    : undefined;
  const transform = useChartTransformState();
  const pan = pannable && data.length > CHART.panVisible;
  const firstShown = pan ? data[data.length - CHART.panVisible] : undefined;
  const lastShown = data[data.length - 1];
  if (candles.length < CHART.minPoints) return null;
  const newest = data[data.length - 1];
  const rising = lastAt !== undefined && newest !== undefined && lastAt >= newest.open;
  const lastTone = rising ? up : down;
  return (
    <View
      style={{ height }}
      accessible
      accessibilityLabel={last ? `Price candles, current price ${last.label}` : "Price candles"}
    >
      <CartesianChart
        data={data}
        xKey="t"
        yKeys={["open", "high", "low", "close"]}
        padding={{ left: CHART.padLeft, right: CHART.padRight }}
        domainPadding={{ top: CHART.padTop, bottom: CHART.padTop, left: CHART.padLeft, right: CHART.padRight }}
        {...(domain ? { domain } : {})}
        {...(pan && firstShown && lastShown
          ? {
              viewport: { x: [firstShown.t, lastShown.t] as [number, number] },
              transformState: transform.state,
              transformConfig: {
                pan: {
                  dimensions: "x" as const,
                  activeOffsetX: [-CHART.panSlop, CHART.panSlop] as [number, number],
                  failOffsetY: [-CHART.panSlop, CHART.panSlop] as [number, number],
                },
                pinch: { enabled: false },
              },
            }
          : {})}
        xAxis={{
          font,
          tickCount: CHART.timeTicks,
          labelColor: color.inkMuted,
          lineColor: color.transparent,
          formatXLabel: (ms) => formatTime(ms),
        }}
        yAxis={[
          {
            yKeys: ["open", "high", "low", "close"],
            font,
            tickCount: CHART.yTicks,
            axisSide: "right",
            labelColor: color.inkMuted,
            lineColor: color.hairline,
            formatYLabel: (v) =>
              lastAt !== undefined && Math.abs(v - lastAt) < covered
                ? ""
                : `${axisPrefix}${v.toLocaleString("en-US", { minimumFractionDigits: axisDecimals, maximumFractionDigits: axisDecimals })}`,
          },
        ]}
        frame={{ lineColor: color.transparent }}
        renderOutside={({ chartBounds, yScale, canvasSize }) =>
          last && lastAt !== undefined && font ? (
            <LastLabel
              text={last.label}
              font={font}
              y={yScale(lastAt)}
              left={chartBounds.right}
              canvasWidth={canvasSize.width}
              fill={lastTone}
              ink={rising ? color.upForeground : color.downForeground}
            />
          ) : null
        }
      >
        {({ points, chartBounds, yScale }) => (
          <>
            <Candlestick
              openPoints={points.open}
              highPoints={points.high}
              lowPoints={points.low}
              closePoints={points.close}
              chartBounds={chartBounds}
              candleColors={{ positive: up, negative: down, neutral: color.chartNeutral }}
              {...(options ? { candleOptions: options } : {})}
            />
            {refAt !== undefined ? (
              <>
                <SkiaLine
                  p1={vec(chartBounds.left, yScale(refAt))}
                  p2={vec(chartBounds.right, yScale(refAt))}
                  color={color.text2}
                  strokeWidth={CHART.lastStroke}
                />
                {reference && font ? (
                  <SkiaText
                    x={chartBounds.left + CHART.lastPadX}
                    y={yScale(refAt) - CHART.lastPadY}
                    text={reference.label}
                    font={font}
                    color={color.text2}
                  />
                ) : null}
              </>
            ) : null}
            {lastAt !== undefined ? (
              <SkiaLine
                p1={vec(chartBounds.left, yScale(lastAt))}
                p2={vec(chartBounds.right, yScale(lastAt))}
                color={lastTone}
                strokeWidth={CHART.lastStroke}
              >
                <DashPathEffect intervals={[CHART.lastDash, CHART.lastGap]} />
              </SkiaLine>
            ) : null}
          </>
        )}
      </CartesianChart>
    </View>
  );
}

/** The current price as a filled label on the price axis, centred on its line and kept inside the canvas. */
function LastLabel({
  text,
  font,
  y,
  left,
  canvasWidth,
  fill,
  ink,
}: {
  text: string;
  font: SkFont;
  y: number;
  left: number;
  canvasWidth: number;
  fill: string;
  ink: string;
}) {
  const metrics = font.getMetrics();
  const textWidth = font.measureText(text).width;
  const width = textWidth + 2 * CHART.lastPadX;
  const plateHeight = metrics.descent - metrics.ascent + 2 * CHART.lastPadY;
  const x = Math.max(0, Math.min(left, canvasWidth - width));
  const top = y - plateHeight / 2;
  return (
    <>
      <RoundedRect x={x} y={top} width={width} height={plateHeight} r={CHART.lastRadius} color={fill} />
      <SkiaText x={x + CHART.lastPadX} y={top + CHART.lastPadY - metrics.ascent} text={text} font={font} color={ink} />
    </>
  );
}

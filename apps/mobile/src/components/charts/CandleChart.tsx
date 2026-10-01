import { useFont } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { View } from "react-native";
import { Candlestick, type CandlestickOptionsFn, CartesianChart } from "victory-native";
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

/**
 * RN port of 21st Candle Chart #22250: victory-native XL `Candlestick` in the token colours, price axis on the right in
 * Inter (theme CHART_FONT), time ticks below. Candles are indexed Chainlink rounds (D-020, D-163: no fabricated ticks — gaps
 * stay gaps). `style` applies the saved candle settings (FT106): body on/off, the colour pair, colour by previous close.
 */
export function CandleChart({
  candles,
  decimals,
  style,
  height = SIZE.chartCandles,
}: {
  candles: ChartCandle[];
  decimals: number;
  style?: CandleStyle;
  height?: number;
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
  if (candles.length < CHART.minPoints) return null;
  return (
    <View style={{ height }} accessible accessibilityLabel="Price candles">
      <CartesianChart
        data={data}
        xKey="t"
        yKeys={["open", "high", "low", "close"]}
        padding={{ left: CHART.padLeft, right: CHART.padRight }}
        domainPadding={{ top: CHART.padTop, bottom: CHART.padTop, left: CHART.padLeft, right: CHART.padRight }}
        xAxis={{
          font,
          tickCount: CHART.timeTicks,
          labelColor: color.inkMuted,
          lineColor: color.transparent,
          formatXLabel: (ms) => clockTime(ms),
        }}
        yAxis={[
          {
            yKeys: ["open", "high", "low", "close"],
            font,
            tickCount: CHART.yTicks,
            axisSide: "right",
            labelColor: color.inkMuted,
            lineColor: color.hairline,
            formatYLabel: (v) => v.toLocaleString("en-US", { maximumFractionDigits: 0 }),
          },
        ]}
        frame={{ lineColor: color.transparent }}
      >
        {({ points, chartBounds }) => (
          <Candlestick
            openPoints={points.open}
            highPoints={points.high}
            lowPoints={points.low}
            closePoints={points.close}
            chartBounds={chartBounds}
            candleColors={{ positive: up, negative: down, neutral: color.chartNeutral }}
            {...(options ? { candleOptions: options } : {})}
          />
        )}
      </CartesianChart>
    </View>
  );
}

import { useFont } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Candlestick, CartesianChart } from "victory-native";
import { clockTime } from "~/lib/format";
import { toPlot } from "~/lib/money";
import { SIZE, useTheme } from "~/theme";
import { CHART_FONT } from "~/theme/fonts";
import { CHART } from "./constants";

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
 * stay gaps).
 */
export function CandleChart({ candles, decimals }: { candles: ChartCandle[]; decimals: number }) {
  const { color } = useTheme();
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
  if (candles.length < CHART.minPoints) return null;
  return (
    <View style={styles.chart} accessible accessibilityLabel="Price candles, hourly">
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
            candleColors={{ positive: color.chartUp, negative: color.chartCandleDown, neutral: color.inkMuted }}
          />
        )}
      </CartesianChart>
    </View>
  );
}

const styles = StyleSheet.create({ chart: { height: SIZE.chartCandles } });

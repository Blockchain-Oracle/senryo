import { useFont } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Candlestick, CartesianChart } from "victory-native";
import { DECIMALS } from "~/lib/constants/units";
import { clockTime } from "~/lib/format";
import { toPlot } from "~/lib/money";
import type { Candle } from "~/lib/sample";
import { SIZE, useTheme } from "~/theme";
import { CHART_FONT } from "~/theme/fonts";
import { CHART } from "./constants";

/**
 * RN port of 21st Candle Chart #22250: victory-native XL `Candlestick` in D2 colours, price axis on the right in
 * JetBrains Mono, time ticks below. Candles are oracle rounds + fills in S4/S8 (D-020: no fabricated ticks); the
 * preview draws `SAMPLE_CANDLES`.
 */
export function CandleChart({ candles }: { candles: Candle[] }) {
  const { color } = useTheme();
  const font = useFont(CHART_FONT, CHART.axisFontSize);
  const data = useMemo(
    () =>
      candles.map((c) => ({
        t: c.t,
        open: toPlot(c.openE8, DECIMALS.oracle),
        high: toPlot(c.highE8, DECIMALS.oracle),
        low: toPlot(c.lowE8, DECIMALS.oracle),
        close: toPlot(c.closeE8, DECIMALS.oracle),
      })),
    [candles],
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

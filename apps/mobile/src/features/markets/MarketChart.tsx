import { DECIMALS } from "@senryo/core";
import { useCandles } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { CandleChart } from "~/components/charts/CandleChart";
import { CHART } from "~/components/charts/constants";
import { ReadingView } from "~/components/kit/states";
import { useCandleStyle } from "~/features/trade/candle-style";
import { price18, priceDecimalsOf } from "~/lib/money";
import { SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";
import { PeriodChips } from "./PeriodChips";
import { axisTimeLabel, CHART_PERIODS, DEFAULT_PERIOD, dayLabel, type PeriodKey, periodOf } from "./periods";
import { QuietLine } from "./QuietLine";
import type { MarketLine } from "./useMarketLine";

const MS_PER_SECOND = 1000;

/**
 * Market detail's chart (Fomo F32): candles of indexed Chainlink rounds running to the left edge of the screen, the
 * current oracle price as a dotted line with its label on the price axis, and period chips under it. Each period is a
 * candle size the indexer keeps (`periods.ts`); the caption says which, and from when the drawn data starts. The chart
 * fades in once when a period's data arrives — never on a price tick — and the block keeps its height while the next
 * period loads, so the page under it does not jump.
 */
export function MarketChart({ line }: { line: MarketLine }) {
  const { color } = useTheme();
  const client = useQueryClient();
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD);
  const chosen = periodOf(period);
  const candles = useCandles(line.symbol, chosen.interval);
  const style = useCandleStyle();
  const decimals = priceDecimalsOf(line.marketId);
  const rows = candles.status === "fresh" || candles.status === "stale" ? candles.value : undefined;
  const first = rows?.[0];
  // Mapped once per candle read, not per price tick: the chart only re-plots when the candles change.
  const plotted = useMemo(
    () =>
      (rows ?? []).map((c) => ({
        t: c.openTime * MS_PER_SECOND,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    [rows],
  );
  return (
    <View style={styles.wrap}>
      <View style={styles.chart}>
        <ReadingView
          reading={candles}
          loading="chart"
          loadingLabel="Loading Chainlink rounds"
          retry={() => void client.invalidateQueries()}
        >
          {(loaded) =>
            loaded.length < CHART.minPoints ? (
              <QuietLine>No rounds in this window yet</QuietLine>
            ) : (
              <Animated.View key={period} entering={FadeIn.duration(TIMING.chartReveal)} style={styles.bleed}>
                <CandleChart
                  decimals={DECIMALS.e18}
                  style={style}
                  axisDecimals={decimals}
                  axisPrefix="$"
                  formatTime={(ms) => axisTimeLabel(chosen.axis, ms)}
                  last={{ value: line.price18, label: `$${price18(line.price18, decimals)}` }}
                  candles={plotted}
                  pannable
                />
              </Animated.View>
            )
          }
        </ReadingView>
      </View>
      <PeriodChips options={CHART_PERIODS} value={period} onChange={setPeriod} label="Chart period" />
      <Text style={[TYPE.meta, { color: color.text3 }]}>
        Chainlink {line.symbol}/USD · Monad · {chosen.candle} candles
        {first ? ` since ${dayLabel(first.openTime * MS_PER_SECOND)}` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.md },
  chart: { minHeight: SIZE.chartCandles, justifyContent: "center" },
  /** F32: the candles run to the left edge of the screen; the price axis keeps the right gutter. */
  bleed: { marginLeft: -SIZE.gutter },
});

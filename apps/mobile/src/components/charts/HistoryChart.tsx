/**
 * A USD candle chart over a history read (J11 tokens, review S03 discovery; market detail's chart, F32): the candles
 * with the live price as the current-price line, pannable, the period chips under it and a caption naming the source
 * and candle size. The caller owns the period (its hook reads by interval); a source with no history, or a window with
 * no trades, says so instead of drawing anything.
 */

import type { Reading } from "@senryo/core";
import { DECIMALS } from "@senryo/core";
import type { TokenCandle } from "@senryo/query";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { CandleChart } from "~/components/charts/CandleChart";
import { CHART } from "~/components/charts/constants";
import { ReadingView } from "~/components/kit/states";
import { PeriodChips } from "~/features/markets/PeriodChips";
import { axisTimeLabel, CHART_PERIODS, type PeriodKey, periodOf } from "~/features/markets/periods";
import { QuietLine } from "~/features/markets/QuietLine";
import { tokenPrice, tokenPriceDecimals } from "~/features/tokens/format";
import { useCandleStyle } from "~/features/trade/candle-style";
import { SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";

const MS_PER_SECOND = 1000;
const PRICE_DECIMALS = 18;

/** What any history source hands the chart: candles with their source, or why there are none. */
export type HistoryReading = Reading<
  { kind: "history"; candles: TokenCandle[]; source: { text: string } } | { kind: "none"; reason: string }
>;

export function HistoryChart({
  reading,
  period,
  onPeriod,
  priceUsd18,
  caption,
  loadingLabel,
  retry,
}: {
  reading: HistoryReading;
  period: PeriodKey;
  onPeriod: (next: PeriodKey) => void;
  priceUsd18: bigint | undefined;
  /** What the chart is, before the candle size and source ("BTC/USD · Perpl"). */
  caption: string;
  loadingLabel: string;
  retry: () => void;
}) {
  const { color } = useTheme();
  const chosen = periodOf(period);
  const style = useCandleStyle();
  const history = reading.status === "fresh" || reading.status === "stale" ? reading.value : undefined;
  const plotted = useMemo(
    () =>
      history?.kind === "history"
        ? history.candles.map((c) => ({ t: c.t * MS_PER_SECOND, open: c.o, high: c.h, low: c.l, close: c.c }))
        : [],
    [history],
  );
  const reference = priceUsd18 ?? plotted.at(-1)?.close;
  const decimals = reference ? tokenPriceDecimals(reference) : DECIMALS.cents;
  return (
    <View style={styles.wrap}>
      <View style={styles.chart}>
        <ReadingView reading={reading} loading="chart" loadingLabel={loadingLabel} retry={retry}>
          {(loaded) =>
            loaded.kind === "none" || plotted.length < CHART.minPoints ? (
              <QuietLine>{loaded.kind === "none" ? loaded.reason : "No trades in this window yet"}</QuietLine>
            ) : (
              <Animated.View key={period} entering={FadeIn.duration(TIMING.chartReveal)} style={styles.bleed}>
                <CandleChart
                  decimals={PRICE_DECIMALS}
                  style={style}
                  axisDecimals={decimals}
                  axisPrefix="$"
                  formatTime={(ms) => axisTimeLabel(chosen.axis, ms)}
                  {...(priceUsd18 ? { last: { value: priceUsd18, label: tokenPrice(priceUsd18) } } : {})}
                  candles={plotted}
                  pannable
                />
              </Animated.View>
            )
          }
        </ReadingView>
      </View>
      <PeriodChips options={CHART_PERIODS} value={period} onChange={onPeriod} label="Chart period" />
      <Text style={[TYPE.meta, { color: color.text3 }]}>
        {caption} · {chosen.candle} candles{history?.kind === "history" ? ` · ${history.source.text}` : ""}
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

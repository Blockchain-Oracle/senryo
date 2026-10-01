/**
 * A token's price chart (J11; market detail's chart, F32): candles of the token's own Uniswap v4 pool in USD with the
 * live mid price as the current-price line, the period chips under it, and the source named with its candle size —
 * GeckoTerminal, which indexes the pool's swaps. A pool it doesn't index, or one with no trades in the window, says so
 * instead of drawing anything.
 */
import type { SpotToken } from "@senryo/config";
import { DECIMALS } from "@senryo/core";
import { useTokenCandles } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { CandleChart } from "~/components/charts/CandleChart";
import { CHART } from "~/components/charts/constants";
import { ReadingView } from "~/components/kit/states";
import { PeriodChips } from "~/features/markets/PeriodChips";
import { axisTimeLabel, CHART_PERIODS, DEFAULT_PERIOD, type PeriodKey, periodOf } from "~/features/markets/periods";
import { QuietLine } from "~/features/markets/QuietLine";
import { useCandleStyle } from "~/features/trade/candle-style";
import { SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";
import { tokenPrice, tokenPriceDecimals } from "./format";

const MS_PER_SECOND = 1000;
const PRICE_DECIMALS = 18;

export function TokenChart({ token, priceUsd18 }: { token: SpotToken; priceUsd18: bigint | undefined }) {
  const { color } = useTheme();
  const client = useQueryClient();
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD);
  const chosen = periodOf(period);
  const candles = useTokenCandles(token, chosen.interval);
  const style = useCandleStyle();
  const history = candles.status === "fresh" || candles.status === "stale" ? candles.value : undefined;
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
        <ReadingView
          reading={candles}
          loading="chart"
          loadingLabel="Loading the pool's trades"
          retry={() => void client.invalidateQueries({ queryKey: ["spot"] })}
        >
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
                />
              </Animated.View>
            )
          }
        </ReadingView>
      </View>
      <PeriodChips options={CHART_PERIODS} value={period} onChange={setPeriod} label="Chart period" />
      <Text style={[TYPE.meta, { color: color.text3 }]}>
        {token.symbol}/USD · Uniswap v4 pool · {chosen.candle} candles
        {history?.kind === "history" ? ` · ${history.source.text}` : ""}
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

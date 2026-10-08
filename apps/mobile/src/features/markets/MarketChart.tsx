import { DECIMALS } from "@senryo/core";
import { useCandles, usePriceTick, useQueryEnv } from "@senryo/query";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { CandleChart } from "~/components/charts/CandleChart";
import { CHART } from "~/components/charts/constants";
import { PriceLineChart } from "~/components/charts/PriceLineChart";
import { Segmented } from "~/components/kit/Segmented";
import { ReadingView } from "~/components/kit/states";
import { useCandleStyle } from "~/features/trade/candle-style";
import { price18, priceDecimalsOf } from "~/lib/money";
import { SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";
import { PeriodChips } from "./PeriodChips";
import { axisTimeLabel, CHART_PERIODS, DEFAULT_PERIOD, dayLabel, type PeriodKey, periodOf } from "./periods";
import { QuietLine } from "./QuietLine";
import { ageLabel } from "./session";
import type { MarketLine } from "./useMarketLine";
import { useNowSec } from "./useNowSec";

const STALE_SOURCE_SEC = 15n;
const MS_PER_SECOND = 1000;
const GAP_INTERVALS = 2;
const CHART_MODES = [
  { value: "line", label: "Line" },
  { value: "candles", label: "Candles" },
] as const;

/**
 * Market detail's chart (Fomo F32): candles of indexed Chainlink rounds running to the left edge of the screen, the
 * current oracle price as a dotted line with its label on the price axis, and period chips under it. Each period is a
 * candle size the indexer keeps (`periods.ts`); the caption says which, and from when the drawn data starts. The chart
 * fades in once when a period's data arrives — never on a price tick — and the block keeps its height while the next
 * period loads, so the page under it does not jump.
 */
export function MarketChart({
  line,
  entry,
  profitable,
}: {
  line: Pick<MarketLine, "symbol" | "marketId" | "price18" | "updatedAt">;
  /** A held position's entry, drawn as a second line (flow book C5 step 2). */
  entry?: bigint | undefined;
  profitable?: boolean | undefined;
}) {
  const { color } = useTheme();
  const client = useQueryClient();
  const env = useQueryEnv();
  const tick = usePriceTick(line.symbol);
  const now = useNowSec();
  const [window, setWindow] = useState<"live" | "history">("live");
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD);
  const [mode, setMode] = useState<"line" | "candles">("line");
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
  const samples = useMemo(
    () =>
      (rows ?? [])
        .filter((c) => c.openTime <= Number(line.updatedAt))
        .map((c) => ({
          // Completed buckets are closing samples; an open bucket ends at the latest observed source time.
          t: Math.min(c.openTime + chosen.interval, Number(line.updatedAt)) * MS_PER_SECOND,
          value: c.close,
        })),
    [rows, chosen.interval, line.updatedAt],
  );
  return (
    <View style={styles.wrap}>
      <Segmented
        options={[
          { value: "live", label: "Live" },
          { value: "history", label: "History" },
        ]}
        value={window}
        onChange={setWindow}
        label="Chart window"
      />
      {window === "live" ? (
        <>
          <PriceLineChart
            samples={[...(tick?.samples ?? [])]}
            profitable={profitable}
            last={{
              t: Number(line.updatedAt) * MS_PER_SECOND,
              value: line.price18,
              label: `$${price18(line.price18, decimals)}`,
            }}
            maxGapMs={30_000}
            windowMs={120_000}
            entry={entry === undefined ? undefined : { value: entry, label: `Entry $${price18(entry, decimals)}` }}
          />
          <Text style={[TYPE.meta, { color: color.text3 }]}>
            {tick?.status ?? "Waiting for stream"} · {now - line.updatedAt > STALE_SOURCE_SEC ? "stale source · " : ""}
            updated {ageLabel(line.updatedAt, now)} · observed oracle rounds
          </Text>
        </>
      ) : (
        <>
          <View style={styles.switch}>
            <Segmented options={CHART_MODES} value={mode} onChange={setMode} label="Chart style" />
          </View>
          <View style={styles.chart}>
            <ReadingView
              reading={candles}
              loading="chart"
              loadingLabel={env.marketHistory ? "Loading local oracle rounds" : "Loading Chainlink rounds"}
              retry={() => void client.invalidateQueries()}
            >
              {(loaded) =>
                mode === "line" ? (
                  <PriceLineChart
                    samples={samples}
                    profitable={profitable}
                    last={{
                      t: Number(line.updatedAt) * MS_PER_SECOND,
                      value: line.price18,
                      label: `$${price18(line.price18, decimals)}`,
                    }}
                    maxGapMs={chosen.interval * MS_PER_SECOND * GAP_INTERVALS}
                    entry={
                      entry === undefined ? undefined : { value: entry, label: `Entry $${price18(entry, decimals)}` }
                    }
                  />
                ) : loaded.length < CHART.minPoints ? (
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
                      {...(entry === undefined
                        ? {}
                        : { reference: { value: entry, label: `Entry $${price18(entry, decimals)}` } })}
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
            {env.marketHistory?.label ?? "Chainlink"} · {chosen.candle} {mode === "line" ? "closes" : "candles"}
            {first ? ` · since ${dayLabel(first.openTime * MS_PER_SECOND)}` : ""}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.md },
  chart: { minHeight: SIZE.chartCandles, justifyContent: "center" },
  /** F32: the candles run to the left edge of the screen; the price axis keeps the right gutter. */
  bleed: { marginLeft: -SIZE.gutter },
  switch: { alignSelf: "flex-end", width: 168 },
});

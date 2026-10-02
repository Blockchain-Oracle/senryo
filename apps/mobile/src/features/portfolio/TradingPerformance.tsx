import type { Address } from "@senryo/core";
import { useEquityHistory, useNetFlows } from "@senryo/query";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { EquityChart } from "~/components/charts/EquityChart";
import { PeriodChips } from "~/components/kit/PeriodChips";
import { ReadingView, Skeleton } from "~/components/kit/states";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { useAccountRetry } from "./account";
import { MS_PER_SECOND, WINDOW_SEC } from "./constants";
import { QuietLine } from "./QuietLine";

const TIMEFRAMES = [
  { value: "1H", label: "1H" },
  { value: "24H", label: "24H" },
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "ALL", label: "All" },
] as const;
type Timeframe = (typeof TIMEFRAMES)[number]["value"];

export function TradingPerformance({ address }: { address: Address }) {
  const { color } = useTheme();
  const [frame, setFrame] = useState<Timeframe>("24H");
  const curve = useEquityHistory(address, WINDOW_SEC[frame]);
  const retry = useAccountRetry();
  const known = curve.status === "fresh" || curve.status === "stale" ? curve.value : undefined;
  const flows = useNetFlows(address, known?.[0]?.timestamp);
  const moved = flows.status === "fresh" || flows.status === "stale" ? flows.value.net : undefined;
  const first = known?.[0]?.equityInit;
  const last = known?.at(-1)?.equityInit;
  const tone =
    first !== undefined && last !== undefined && moved !== undefined && last - first - moved < 0n ? "down" : "up";
  return (
    <View style={styles.stack}>
      <Text style={[TYPE.rowTitle, { color: color.ink }]}>Trading performance</Text>
      {curve.status === "unknown" ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Loading balance history">
          <Skeleton height={SIZE.chartEquity} />
        </View>
      ) : (
        <ReadingView reading={curve} retry={retry}>
          {(points) =>
            points.length < 2 ? (
              <QuietLine>The chart starts with your first deposit or trade.</QuietLine>
            ) : (
              <EquityChart
                points={points.map((p) => ({ t: p.timestamp * MS_PER_SECOND, equity6: p.equityInit }))}
                tone={tone}
              />
            )
          }
        </ReadingView>
      )}
      <View style={styles.periods}>
        <PeriodChips options={TIMEFRAMES} value={frame} onChange={setFrame} label="Chart period" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ stack: { gap: SPACE.sm }, periods: { alignItems: "flex-end" } });

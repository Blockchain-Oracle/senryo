import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { EquityChart } from "~/components/charts/EquityChart";
import { PreviewBadge } from "~/components/kit/PreviewBadge";
import { Screen } from "~/components/kit/Screen";
import { Segmented } from "~/components/kit/Segmented";
import { SectionLabel } from "~/components/kit/Surface";
import { EmptyState, ReadingView } from "~/components/kit/states";
import { BucketRegister } from "~/features/portfolio/BucketRegister";
import { PositionsTable } from "~/features/portfolio/PositionsTable";
import { ROUTES } from "~/lib/constants/routes";
import { arrow, signedPct, signedUsd, usd } from "~/lib/money";
import { SAMPLE_BUCKETS, SAMPLE_EQUITY, SAMPLE_POSITIONS } from "~/lib/sample";
import { useSample } from "~/lib/useSample";
import { HERO_FONT_SCALE, SPACE, TYPE, useTheme } from "~/theme";

const TIMEFRAMES = [
  { value: "1H", label: "1H" },
  { value: "24H", label: "24H" },
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "ALL", label: "All" },
] as const;
type Timeframe = (typeof TIMEFRAMES)[number]["value"];

/** Portfolio (D2 home): equity hero + chart, the bucket register, positions. Empty state = the Add-money card. */
export default function Portfolio() {
  const { color } = useTheme();
  const [frame, setFrame] = useState<Timeframe>("24H");
  const buckets = useSample("buckets", SAMPLE_BUCKETS);
  const equity = useSample("equity", SAMPLE_EQUITY);
  const positions = useSample("positions", SAMPLE_POSITIONS);
  return (
    <Screen>
      <PreviewBadge />
      <ReadingView reading={buckets} loading="line" loadingLabel="Reading your balance">
        {(b) => {
          const up = b.change24h6 >= 0n;
          return (
            <View style={styles.hero}>
              <SectionLabel>EQUITY · RISK-ADJUSTED</SectionLabel>
              <Text
                maxFontSizeMultiplier={HERO_FONT_SCALE}
                accessibilityLabel={`Equity ${usd(b.equity6)}`}
                style={[TYPE.numHero, { color: color.ink }]}
              >
                {usd(b.equity6)}
              </Text>
              <Text style={[TYPE.numSm, { color: up ? color.up : color.down }]}>
                {arrow(b.change24h6)} {signedUsd(b.change24h6)} ({signedPct(b.change24hBps)}) 24h
              </Text>
            </View>
          );
        }}
      </ReadingView>
      <ReadingView reading={equity} loading="chart" loadingLabel="Loading equity history">
        {(points) => <EquityChart points={points} />}
      </ReadingView>
      <Segmented options={TIMEFRAMES} value={frame} onChange={setFrame} label="Chart timeframe" />
      <ReadingView reading={buckets} loading="plate" loadingLabel="Reading buckets">
        {(b) => <BucketRegister buckets={b} />}
      </ReadingView>
      <ReadingView reading={positions} loading="list" loadingLabel="Syncing positions">
        {(list) => (
          <View style={styles.section}>
            <SectionLabel>POSITIONS · {list.length}</SectionLabel>
            {list.length === 0 ? (
              <EmptyState
                why="No open positions"
                detail="Gold and silver trade 24/5 at the oracle price. Start small in practice mode."
                action={{ label: "Browse markets", onPress: () => router.navigate(ROUTES.markets) }}
              />
            ) : (
              <PositionsTable positions={list} />
            )}
          </View>
        )}
      </ReadingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: SPACE.sm },
  section: { gap: SPACE.md },
});

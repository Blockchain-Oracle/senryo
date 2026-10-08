import { usePerplConnection, usePerplLivePrice, usePerplMarketTerms } from "@senryo/query";
import type { ReactNode } from "react";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PriceLineChart } from "~/components/charts/PriceLineChart";
import { Segmented } from "~/components/kit/Segmented";
import { ageLabel } from "~/features/markets/session";
import { useNowSec } from "~/features/markets/useNowSec";
import { tokenPrice } from "~/features/tokens/format";
import { DEV_WORKSPACE } from "~/lib/dev/config";
import { SPACE, TYPE, useTheme } from "~/theme";

const MODES = [
  { value: "live", label: "Live" },
  { value: "history", label: "History" },
] as const;
const MS_PER_SECOND = 1000;
const MAX_GAP_MS = 30_000;
/** Observed mark ticks, separate from traded OHLC history. Never backfill an animated price into past data. */
export function PerplLiveChart({
  marketId,
  history,
  entry,
  profitable,
  compact = false,
}: {
  marketId: number;
  history: ReactNode;
  entry?: { value: bigint; label: string } | undefined;
  profitable?: boolean | undefined;
  compact?: boolean | undefined;
}) {
  const tick = usePerplLivePrice(marketId);
  const connection = usePerplConnection();
  const terms = usePerplMarketTerms(marketId);
  const paused = (terms.status === "fresh" || terms.status === "stale") && terms.value.paused;
  const [mode, setMode] = useState<"live" | "history">("live");
  const now = useNowSec();
  const { color } = useTheme();
  const stale = !tick || now - BigInt(Math.floor(tick.at / MS_PER_SECOND)) > BigInt(MAX_GAP_MS / MS_PER_SECOND);
  return (
    <View style={styles.wrap}>
      {!DEV_WORKSPACE ? (
        <View style={styles.switch}>
          <Segmented options={MODES} value={mode} onChange={setMode} label="Price chart" />
        </View>
      ) : null}
      {mode === "history" ? (
        history
      ) : tick ? (
        <>
          <PriceLineChart
            samples={tick.samples.map((s) => ({ t: s.at, value: s.price18 }))}
            last={{ t: tick.at, value: tick.price18, label: tokenPrice(tick.price18) }}
            sourceLabel="Perpl mark"
            maxGapMs={MAX_GAP_MS}
            windowMs={120_000}
            entry={entry}
            profitable={profitable}
            compact={compact}
          />
          <Text style={[TYPE.meta, { color: stale ? color.warn : color.text3 }]}>
            {`${DEV_WORKSPACE ? "Local fork · " : ""}Perpl mark · ${paused ? "market paused · " : ""}${connection.state} · ${stale ? "stale source · " : ""}updated ${ageLabel(BigInt(Math.floor(tick.at / MS_PER_SECOND)), now)}`}
          </Text>
        </>
      ) : (
        <View style={[styles.wait, compact ? styles.waitCompact : null]}>
          <Text style={[TYPE.meta, { color: color.text3 }]}>Connecting to Perpl prices…</Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { gap: SPACE.md },
  switch: { alignSelf: "flex-end", width: 168 },
  wait: { height: 220, justifyContent: "center", alignItems: "center" },
  waitCompact: { height: 156 },
});

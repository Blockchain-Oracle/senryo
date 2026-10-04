import { usePredictionHistory } from "@senryo/query";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Polyline } from "react-native-svg";
import { EmptyState, ReadingView } from "~/components/kit/states";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { percent, time } from "./format";
import { useFocused } from "./useFocused";

const BPS_ONE = 10_000;

const HEIGHT = SIZE.chartEquity;
const PAD = SPACE.sm;
/** FT051/52: actual outcome-price samples, positioned by time on a fixed 0–100% axis, never underlying USD prices. */
export function OutcomeChart({ id, outcome, label }: { id: string; outcome: number; label: string }) {
  const focused = useFocused();
  const data = usePredictionHistory("polymarket", id, outcome, focused);
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const known = data.reading.status === "fresh" || data.reading.status === "stale" ? data.reading.value.points : [];
  const first = known[0],
    last = known.at(-1);
  const span = first && last ? last.t - first.t : 0;
  const polyline = useMemo(
    () =>
      span > 0 && first
        ? known
            .map(
              (p) =>
                `${PAD + ((p.t - first.t) / span) * (width - PAD * 2)},${PAD + (1 - p.priceBps / BPS_ONE) * (HEIGHT - PAD * 2)}`,
            )
            .join(" ")
        : "",
    [known, first, span, width],
  );
  const point = selected === null ? last : (known.find((p) => p.t === selected) ?? last);
  return (
    <View style={styles.wrap}>
      <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
        {label} share price · {point ? `${percent(point.priceBps)} · ${time(point.t)}` : "History"}
      </Text>
      <View style={styles.chart} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <ReadingView
          reading={data.reading}
          loading="chart"
          loadingLabel="Loading outcome-price history"
          retry={data.retry}
        >
          {(history) =>
            history.points.length < 2 || !span ? (
              <EmptyState
                why={
                  history.points.length === 1
                    ? "One price observation in this window"
                    : "No price history available for this window"
                }
              />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${label} price history, ${history.points.length} observations. Tap to inspect a sample.`}
                onPress={(e) => {
                  if (!first || width <= PAD * 2) return;
                  const target =
                    first.t + Math.max(0, Math.min(1, (e.nativeEvent.locationX - PAD) / (width - PAD * 2))) * span;
                  const nearest = known.reduce((a, b) => (Math.abs(a.t - target) < Math.abs(b.t - target) ? a : b));
                  setSelected(nearest.t);
                }}
              >
                <Svg width={width} height={HEIGHT} accessibilityElementsHidden>
                  <Line x1={PAD} x2={width - PAD} y1={HEIGHT / 2} y2={HEIGHT / 2} stroke={color.hairline} />
                  <Polyline
                    points={polyline}
                    fill="none"
                    stroke={outcome === 0 ? color.up : color.down}
                    strokeWidth={2}
                  />
                </Svg>
              </Pressable>
            )
          }
        </ReadingView>
      </View>
      <View style={styles.axis}>
        <Text style={[TYPE.meta, { color: color.text3 }]}>0–100% · {first ? time(first.t) : ""}</Text>
        <Text style={[TYPE.meta, { color: color.text3 }]}>{last ? time(last.t) : ""}</Text>
      </View>
      <Text style={[TYPE.meta, { color: color.text3 }]}>
        Polymarket outcome-price observations · Tap chart for a sample
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  chart: { minHeight: HEIGHT, justifyContent: "center" },
  axis: { flexDirection: "row", justifyContent: "space-between", gap: SPACE.sm },
});

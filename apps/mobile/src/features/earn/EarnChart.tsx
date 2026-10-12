/**
 * A pool share's value over time (P5, D-325; Codex: plot unit value, never deposits): the hourly rolls' value ÷ supply
 * from the indexer, closed by the value now, as a Skia line with a faint fill (`@senryo/calls` `seriesGeometry`, the
 * day lines' geometry generalised). 1D / 7D / 30D above it; drag across to read any hour — a quiet tick as the reading
 * moves to the next hour. With fewer than two hours it says so instead of drawing a line.
 */
import { plotValue, type SharePoint, seriesGeometry, shareChartBounds, sharePriceText } from "@senryo/calls";
import { Canvas, Circle, Line, Path, Skia, vec } from "@shopify/react-native-skia";
import { useMemo, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { fire } from "~/feedback/fire";
import { SPACE, TYPE, useTheme } from "~/theme";
import { withAlpha } from "~/theme/palette";

const HEIGHT = 160;
const PAD = 12;
const STROKE = 2;
const FILL_ALPHA = 0.1;
/** The scrub's vertical rule. */
const RULE_ALPHA = 0.3;
const DOT = 4;
const MS = 1000;
const HHMM = 5;
const TIME_START = 11;
const DATE_LEN = 10;

const timeOf = (hour: number, longRange: boolean) => {
  const iso = new Date(hour * MS).toISOString();
  return longRange
    ? `${iso.slice(0, DATE_LEN)} ${iso.slice(TIME_START, TIME_START + HHMM)} UTC`
    : `${iso.slice(TIME_START, TIME_START + HHMM)} UTC`;
};

export function EarnChart({
  series,
  tone,
  longRange,
}: {
  series: readonly SharePoint[];
  tone: "up" | "down" | "muted";
  longRange: boolean;
}) {
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const [at, setAt] = useState<number | null>(null);
  const g = useMemo(
    () =>
      width > 0
        ? seriesGeometry(
            series.map((p) => plotValue(p.e12)),
            width,
            HEIGHT,
            PAD,
            shareChartBounds(series),
          )
        : null,
    [series, width],
  );
  const paths = useMemo(
    () => (g ? { line: Skia.Path.MakeFromSVGString(g.d), area: Skia.Path.MakeFromSVGString(g.area) } : null),
    [g],
  );
  const hue = tone === "up" ? color.up : tone === "down" ? color.down : color.ink;
  const last = series.length - 1;
  const pick = (x: number) => {
    const i = Math.max(0, Math.min(last, Math.round((x / Math.max(1, width)) * last)));
    setAt((prev) => {
      if (prev !== i) fire("tick");
      return i;
    });
  };
  const scrub = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => scheduleOnRN(pick, e.x))
    .onUpdate((e) => scheduleOnRN(pick, e.x))
    .onFinalize(() => scheduleOnRN(setAt, null));
  const shown = at === null ? series[last] : series[at];
  if (series.length < 2) {
    return (
      <View style={[styles.empty, { backgroundColor: color.card }]}>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          The line starts after the pool's first settled hour.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      <Text accessibilityLiveRegion="polite" style={[TYPE.caption, { color: color.inkMuted }]}>
        {shown ? `${at === null ? "Now" : timeOf(shown.hour, longRange)} · ${sharePriceText(shown.e12)} a share` : " "}
      </Text>
      <GestureDetector gesture={scrub}>
        <View
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          accessibilityRole="image"
          accessibilityLabel={`A share's value, from ${sharePriceText(series[0]?.e12 ?? 0n)} to ${sharePriceText(series[last]?.e12 ?? 0n)}`}
          style={styles.canvas}
        >
          {g && paths?.line && paths.area ? (
            <Canvas style={StyleSheet.absoluteFill}>
              <Path path={paths.area} color={withAlpha(hue, FILL_ALPHA)} />
              <Path
                path={paths.line}
                color={hue}
                style="stroke"
                strokeWidth={STROKE}
                strokeCap="round"
                strokeJoin="round"
              />
              {at !== null && series[at] ? (
                <>
                  <Line
                    p1={vec(g.x(at), 0)}
                    p2={vec(g.x(at), HEIGHT)}
                    color={withAlpha(color.ink, RULE_ALPHA)}
                    strokeWidth={1}
                  />
                  <Circle cx={g.x(at)} cy={g.y(plotValue(series[at]?.e12 ?? 0n))} r={DOT} color={hue} />
                </>
              ) : null}
            </Canvas>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.xs },
  canvas: { height: HEIGHT },
  empty: { height: HEIGHT, borderRadius: SPACE.md, alignItems: "center", justifyContent: "center", padding: SPACE.lg },
});

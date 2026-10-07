import { Canvas, Circle, DashPathEffect, Line, Path, Skia, vec } from "@shopify/react-native-skia";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useDerivedValue, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { toPlot } from "~/lib/money";
import { EASE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

export interface PriceSample {
  t: number;
  value: bigint;
}
const HEIGHT = 220;
const AXIS = 74;
const PAD = 18;
const GRID_X = 20;
const GRID_Y = 30;
const DOT = 1;
const HEAD_RADIUS = 4;
const HEAD_DURATION_MS = 220;
const RANGE_PAD = 0.12;
const MIN_RANGE_FRACTION = 0.001;
const PRICE_DECIMALS = 18;
const ENTRY_DASH_LENGTH = 4;
const ENTRY_DASH_GAP = 5;
const ENTRY_DASH = [ENTRY_DASH_LENGTH, ENTRY_DASH_GAP];

/** U01's dotted line workspace. Only the newest head eases; raw prices remain the trading authority. */
export function PriceLineChart({
  samples,
  last,
  entry,
  maxGapMs,
  profitable,
  sourceLabel = "oracle",
}: {
  samples: PriceSample[];
  last: PriceSample & { label: string };
  entry?: { value: bigint; label: string } | undefined;
  maxGapMs: number;
  profitable?: boolean | undefined;
  sourceLabel?: string | undefined;
}) {
  const { color } = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const plot = Math.max(1, width - AXIS);
  const model = useMemo(() => {
    const points = samples.filter((s) => s.t <= last.t && s.value > 0n);
    // A current oracle observation is not backfilled into the unobserved past.
    const span = Math.max(last.t - (points[0]?.t ?? last.t), maxGapMs);
    const firstAt = last.t - span;
    const values = [...points.map((s) => toPlot(s.value, PRICE_DECIMALS)), toPlot(last.value, PRICE_DECIMALS)];
    if (entry) values.push(toPlot(entry.value, PRICE_DECIMALS));
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const range = Math.max(hi - lo, Math.abs(hi) * MIN_RANGE_FRACTION);
    const low = lo - range * RANGE_PAD;
    const high = hi + range * RANGE_PAD;
    const x = (at: number) => PAD + ((at - firstAt) / span) * (plot - PAD * 2);
    const y = (value: bigint) => PAD + ((high - toPlot(value, PRICE_DECIMALS)) / (high - low)) * (HEIGHT - PAD * 2);
    const path = Skia.Path.Make();
    let previous: PriceSample | undefined;
    for (const point of points) {
      if (!previous || point.t - previous.t > maxGapMs) path.moveTo(x(point.t), y(point.value));
      else path.lineTo(x(point.t), y(point.value));
      previous = point;
    }
    const tail = points.at(-1);
    return {
      path,
      x: x(last.t),
      y: y(last.value),
      tail: tail && last.t - tail.t <= maxGapMs ? { x: x(tail.t), y: y(tail.value) } : undefined,
      entryY: entry ? y(entry.value) : undefined,
    };
  }, [samples, last.t, last.value, entry, maxGapMs, plot]);
  const headY = useSharedValue(model.y);
  useEffect(() => {
    headY.value = reduced ? model.y : withTiming(model.y, { duration: HEAD_DURATION_MS, easing: EASE });
  }, [model.y, reduced, headY]);
  const tail = model.tail;
  const headX = model.x;
  const headPath = useDerivedValue(() => {
    const path = Skia.Path.Make();
    if (tail) {
      path.moveTo(tail.x, tail.y);
      path.lineTo(headX, headY.value);
    }
    return path;
  });
  const tone = (profitable ?? true) ? color.up : color.down;
  const grid = useMemo(
    () =>
      Array.from({ length: Math.max(0, Math.floor(plot / GRID_X)) }, (_, col) =>
        Array.from({ length: Math.floor(HEIGHT / GRID_Y) }, (_, row) => ({
          x: col * GRID_X + PAD,
          y: row * GRID_Y + PAD,
        })),
      ),
    [plot],
  );
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={styles.chart}
      accessible
      accessibilityLabel={`Price line, current ${sourceLabel} ${last.label}${entry ? `, ${entry.label}` : ""}. Gaps have no observations.`}
    >
      {width > 0 ? (
        <Canvas style={StyleSheet.absoluteFill}>
          {grid.flatMap((column, i) =>
            column.map((point, j) => (
              <Circle key={`${i}:${j}`} cx={point.x} cy={point.y} r={DOT} color={color.hairline} />
            )),
          )}
          {model.entryY !== undefined ? (
            <Line p1={vec(PAD, model.entryY)} p2={vec(plot, model.entryY)} color={color.text3} strokeWidth={1}>
              <DashPathEffect intervals={ENTRY_DASH} />
            </Line>
          ) : null}
          <Path path={model.path} color={tone} style="stroke" strokeWidth={2.5} strokeJoin="round" strokeCap="round" />
          <Path path={headPath} color={tone} style="stroke" strokeWidth={2.5} strokeCap="round" />
          <Circle cx={model.x} cy={headY} r={HEAD_RADIUS} color={tone} />
        </Canvas>
      ) : null}
      {entry ? <Text style={[TYPE.meta, styles.entry, { color: color.text3 }]}>{entry.label}</Text> : null}
      <View style={[styles.label, { top: Math.max(PAD, Math.min(HEIGHT - SIZE.touch, model.y - SPACE.sm)) }]}>
        <Text style={[TYPE.moneyMeta, { color: tone }]}>{last.label}</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  chart: { height: HEIGHT },
  label: { position: "absolute", right: 0, maxWidth: AXIS, paddingVertical: SPACE.xs },
  entry: { position: "absolute", left: PAD, top: 0 },
});

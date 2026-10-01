import { DECIMALS } from "@senryo/core";
import { Circle, Group, LinearGradient, vec } from "@shopify/react-native-skia";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Area, CartesianChart, type ChartBounds, Line, useChartPressState } from "victory-native";
import { fire } from "~/feedback/fire";
import { clockTime } from "~/lib/format";
import { toPlot, usd } from "~/lib/money";
import { EASE, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";
import { CHART } from "./constants";

/** One equity sample: time (ms) and risk-adjusted equity (usd6). */
export interface EquityPoint {
  t: number;
  equity6: bigint;
}

const DAY_MS = 86_400_000;
/** No point is under the finger. */
const NO_POINT = -1;

/** "14:02" inside a day's window, "12 Sep · 14:02" across days — a clock time alone says nothing on a month chart. */
function stamp(t: number, spanMs: number): string {
  if (spanMs <= DAY_MS) return clockTime(t);
  const day = new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${day} · ${clockTime(t)}`;
}

/**
 * The balance chart (Fomo F16's portfolio curve; RN port of 21st Balance Chart #30538): a victory-native XL (Skia)
 * line over a fading area, bare on the page — no frame, no grid, no axis. The window's high sits quietly at the top
 * right and its low at the bottom left; holding the chart scrubs it, and the point under the finger reads out its
 * value and time in place (a `tick` when the finger lands). The curve draws once, left to right, when its data
 * arrives (direction §4: 600–900 ms) and never again on a refresh. Skia draws on the UI thread; the path only
 * rebuilds when `points` changes. `tone` is how the window went — the caller decides net of money moved in or out —
 * so the curve never reads green while the balance header says the period lost money.
 */
export function EquityChart({ points, tone = "up" }: { points: EquityPoint[]; tone?: "up" | "down" }) {
  const { color } = useTheme();
  const ink = tone === "up" ? color.chartUp : color.chartDown;
  const fill =
    tone === "up" ? [color.chartFillTop, color.chartFillBottom] : [color.chartDownFillTop, color.chartDownFillBottom];
  const reduce = useReducedMotion();
  const data = useMemo(() => points.map((p) => ({ t: p.t, equity: toPlot(p.equity6, DECIMALS.usd6) })), [points]);
  const { state, isActive } = useChartPressState({ x: 0, y: { equity: 0 } });
  const [scrub, setScrub] = useState(NO_POINT);
  const drawn = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    drawn.value = withTiming(1, { duration: TIMING.chartReveal, easing: EASE });
  }, [drawn]);
  useAnimatedReaction(
    () => isActive,
    (active, was) => {
      if (active && !was) scheduleOnRN(fire, "tick");
    },
  );
  useAnimatedReaction(
    () => state.matchedIndex.value,
    (index, was) => {
      if (index !== was) scheduleOnRN(setScrub, index);
    },
  );
  const [minP, maxP] = useMemo(() => {
    let lo = points[0];
    let hi = points[0];
    for (const p of points) {
      if (lo && p.equity6 < lo.equity6) lo = p;
      if (hi && p.equity6 > hi.equity6) hi = p;
    }
    return [lo, hi];
  }, [points]);
  if (points.length < CHART.minPoints) return null;
  const first = points[0];
  const last = points.at(-1);
  const span = first && last ? last.t - first.t : 0;
  const held = isActive ? points[scrub] : undefined;

  return (
    <View
      accessible
      accessibilityLabel={`Balance chart, low ${minP ? usd(minP.equity6, 0) : ""}, high ${maxP ? usd(maxP.equity6, 0) : ""}`}
    >
      <View style={styles.edge}>
        <Text style={[TYPE.moneyMeta, { color: held ? color.ink : color.transparent }]} numberOfLines={1}>
          {held ? `${usd(held.equity6)} · ${stamp(held.t, span)}` : " "}
        </Text>
        <Text style={[TYPE.moneyMeta, { color: color.text3 }]}>{maxP ? usd(maxP.equity6, 0) : ""}</Text>
      </View>
      <View style={styles.chart}>
        <CartesianChart
          data={data}
          xKey="t"
          yKeys={["equity"]}
          chartPressState={state}
          domainPadding={{ top: CHART.padTop, bottom: CHART.padBottom }}
        >
          {({ points: pts, chartBounds }) => (
            <>
              <Reveal bounds={chartBounds} progress={drawn}>
                <Area points={pts.equity} y0={chartBounds.bottom} curveType="linear">
                  <LinearGradient start={vec(0, chartBounds.top)} end={vec(0, chartBounds.bottom)} colors={fill} />
                </Area>
                <Line points={pts.equity} color={ink} strokeWidth={CHART.stroke} curveType="linear" />
              </Reveal>
              {isActive ? (
                <Circle cx={state.x.position} cy={state.y.equity.position} r={CHART.dot} color={ink} />
              ) : null}
            </>
          )}
        </CartesianChart>
      </View>
      <Text style={[TYPE.moneyMeta, { color: color.text3 }]}>{minP ? usd(minP.equity6, 0) : ""}</Text>
    </View>
  );
}

/** Clips the curve to the drawn share of the plot, so it appears from the left edge rather than fading in whole. */
function Reveal({
  bounds,
  progress,
  children,
}: {
  bounds: ChartBounds;
  progress: SharedValue<number>;
  children: ReactNode;
}) {
  const clip = useDerivedValue(() => ({
    x: bounds.left,
    y: 0,
    width: (bounds.right - bounds.left) * progress.value,
    height: bounds.bottom,
  }));
  return <Group clip={clip}>{children}</Group>;
}

const styles = StyleSheet.create({
  chart: { height: SIZE.chartEquity },
  edge: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: SPACE.sm },
});

import { Circle, LinearGradient, vec } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAnimatedReaction } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Area, CartesianChart, Line, useChartPressState } from "victory-native";
import { fire } from "~/feedback/fire";
import { DECIMALS } from "~/lib/constants/units";
import { clockTime } from "~/lib/format";
import { toPlot, usd } from "~/lib/money";
import type { EquityPoint } from "~/lib/sample";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { CHART } from "./constants";

/**
 * RN port of 21st Balance Chart #30538: victory-native XL (Skia) area + line, the max label top-right and the min
 * bottom-left, time ticks under it, press to scrub (a `tick` when the finger lands). Skia draws on the UI thread; the
 * path only rebuilds when `points` changes.
 */
export function EquityChart({ points }: { points: EquityPoint[] }) {
  const { color } = useTheme();
  const data = useMemo(() => points.map((p) => ({ t: p.t, equity: toPlot(p.equity6, DECIMALS.usd) })), [points]);
  const { state, isActive } = useChartPressState({ x: 0, y: { equity: 0 } });
  useAnimatedReaction(
    () => isActive,
    (active, was) => {
      if (active && !was) scheduleOnRN(fire, "tick");
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
  const ticks = useMemo(() => {
    const step = Math.max(1, Math.floor(points.length / (CHART.timeTicks - 1)));
    return points.filter((_, i) => i % step === 0).slice(0, CHART.timeTicks);
  }, [points]);
  if (points.length < CHART.minPoints) return null;

  return (
    <View
      accessible
      accessibilityLabel={`Equity chart, low ${minP ? usd(minP.equity6, 0) : ""}, high ${maxP ? usd(maxP.equity6, 0) : ""}`}
    >
      <Text style={[TYPE.numSm, styles.max, { color: color.inkMuted }]}>{maxP ? usd(maxP.equity6, 0) : ""}</Text>
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
              <Area points={pts.equity} y0={chartBounds.bottom} curveType="linear">
                <LinearGradient
                  start={vec(0, chartBounds.top)}
                  end={vec(0, chartBounds.bottom)}
                  colors={[color.chartFillTop, color.chartFillBottom]}
                />
              </Area>
              <Line points={pts.equity} color={color.chartUp} strokeWidth={CHART.stroke} curveType="linear" />
              {isActive ? (
                <Circle cx={state.x.position} cy={state.y.equity.position} r={CHART.dot} color={color.chartUp} />
              ) : null}
            </>
          )}
        </CartesianChart>
      </View>
      <Text style={[TYPE.numSm, { color: color.inkMuted }]}>{minP ? usd(minP.equity6, 0) : ""}</Text>
      <View style={styles.ticks}>
        {ticks.map((p) => (
          <Text key={p.t} style={[TYPE.caption, { color: color.inkMuted }]}>
            {clockTime(p.t)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { height: SIZE.chartEquity },
  max: { alignSelf: "flex-end" },
  ticks: { flexDirection: "row", justifyContent: "space-between", marginTop: SPACE.sm },
});

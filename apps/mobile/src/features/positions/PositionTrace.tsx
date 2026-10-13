/**
 * The position's own path (D-343, Codex direction 15): its recorded PnL — not the market's chart — as a 1.5 pt line
 * over a faint zero, broken where the recording has holes, with a still endpoint; coloured by the PnL's sign now.
 * Too little recorded leaves the slot quiet (no invented flat line); hidden balances suppress it.
 */
import { type ReplaySample, traceGeometry } from "@senryo/calls";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { useTheme } from "~/theme";

export const TRACE_W = 64;
export const TRACE_H = 20;
const LINE = 1.5;
const END_R = 2;
const ZERO_ALPHA = 0.35;
const DIM_ALPHA = 0.4;

export function PositionTrace({ samples, dim }: { samples: readonly ReplaySample[] | null; dim: boolean }) {
  const { color } = useTheme();
  const g = traceGeometry(samples, TRACE_W, TRACE_H);
  if (!g) return <View style={styles.slot} />;
  const tone = g.tone === "up" ? color.up : g.tone === "down" ? color.down : color.inkMuted;
  return (
    <Svg width={TRACE_W} height={TRACE_H} opacity={dim ? DIM_ALPHA : 1} accessibilityElementsHidden>
      <Line
        x1={0}
        x2={TRACE_W}
        y1={g.zeroY}
        y2={g.zeroY}
        stroke={color.inkMuted}
        strokeWidth={1}
        opacity={ZERO_ALPHA}
      />
      <Path d={g.d} stroke={tone} strokeWidth={LINE} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {dim ? null : <Circle cx={g.end.x} cy={g.end.y} r={END_R} fill={tone} />}
    </Svg>
  );
}

const styles = StyleSheet.create({
  slot: { width: TRACE_W, height: TRACE_H },
});

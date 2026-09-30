/**
 * Execution trace — RN port of 21st ddoemonn/task-steps (#23569), D2 tokens (web twin:
 * apps/web/src/components/ui/task-steps.tsx): signed → risk check → sent → proposed → voted → finalized. Done rows
 * get an --up tick, the failing row a --down cross, the row in flight a spinning arc, pending rows stay muted; meta
 * (timings, hashes) in mono on the right. Desk tweens, nothing bounces; static under Reduce Motion.
 */
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path, Polyline } from "react-native-svg";
import { DURATION, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

export interface TraceStep {
  id: string;
  label: string;
  meta?: string | undefined;
}

export type TraceRowStatus = "pending" | "active" | "done" | "error";

const SPIN_MS = 800;
const FULL_TURN = 360;
const ICON_BOX = 16;
const GLYPH = 10;
const GLYPH_VIEW = 256;
const GLYPH_STROKE = 26;
const ARC_VIEW = 16;
const ARC_R = 6;
const ARC_STROKE = 2;
const TRACK_OPACITY = 0.25;
const ROW_HEIGHT = 28;

function statusOf(i: number, current: number, failed: boolean): TraceRowStatus {
  if (i < current) return "done";
  if (i === current) return failed ? "error" : "active";
  return "pending";
}

function Spinner({ tint }: { tint: string }) {
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);
  useEffect(() => {
    if (!reduced) turn.value = withRepeat(withTiming(FULL_TURN, { duration: SPIN_MS, easing: Easing.linear }), -1);
    return () => cancelAnimation(turn);
  }, [reduced, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <Svg width={SIZE.iconSm - ARC_STROKE} height={SIZE.iconSm - ARC_STROKE} viewBox={`0 0 ${ARC_VIEW} ${ARC_VIEW}`}>
        <Circle
          cx={ARC_VIEW / 2}
          cy={ARC_VIEW / 2}
          r={ARC_R}
          fill="none"
          stroke={tint}
          strokeOpacity={TRACK_OPACITY}
          strokeWidth={ARC_STROKE}
        />
        <Path d="M8 2 a6 6 0 0 1 6 6" fill="none" stroke={tint} strokeWidth={ARC_STROKE} strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
}

function Glyph({ status }: { status: TraceRowStatus }) {
  const { color } = useTheme();
  if (status === "active") return <Spinner tint={color.ink} />;
  if (status === "pending") return <View style={[styles.dot, { backgroundColor: color.hairline }]} />;
  const done = status === "done";
  return (
    <Animated.View
      entering={FadeIn.duration(DURATION.base)}
      style={[styles.badge, { backgroundColor: done ? color.upWash : color.downWash }]}
    >
      <Svg width={GLYPH} height={GLYPH} viewBox={`0 0 ${GLYPH_VIEW} ${GLYPH_VIEW}`}>
        {done ? (
          <Polyline
            points="216 72 104 184 48 128"
            fill="none"
            stroke={color.up}
            strokeWidth={GLYPH_STROKE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <Path
            d="M200 56 56 200 M56 56l144 144"
            stroke={color.down}
            strokeWidth={GLYPH_STROKE}
            strokeLinecap="round"
          />
        )}
      </Svg>
    </Animated.View>
  );
}

export function ExecutionTrace({
  steps,
  current,
  failed = false,
  label = "Execution trace",
}: {
  steps: readonly TraceStep[];
  /** Index of the step in flight; `steps.length` = all done. */
  current: number;
  failed?: boolean;
  label?: string;
}) {
  const { color } = useTheme();
  const complete = !failed && current >= steps.length;
  const active = steps[Math.min(current, steps.length - 1)];
  const sentence = failed
    ? `Failed at ${active?.label ?? "a step"}`
    : complete
      ? `All ${steps.length} steps complete`
      : `${active?.label ?? ""}, step ${current + 1} of ${steps.length}`;
  return (
    <View accessible accessibilityLabel={`${label}. ${sentence}`} accessibilityLiveRegion="polite" style={styles.list}>
      {steps.map((step, i) => {
        const status = statusOf(i, current, failed);
        const ink =
          status === "error"
            ? color.down
            : status === "pending"
              ? color.inkMuted
              : status === "done"
                ? color.inkMuted
                : color.ink;
        return (
          <View key={step.id} style={styles.row}>
            <View style={styles.icon}>
              <Glyph status={status} />
            </View>
            <Text
              style={[status === "active" ? TYPE.bodyStrong : TYPE.body, styles.label, { color: ink }]}
              numberOfLines={1}
            >
              {step.label}
            </Text>
            {step.meta ? <Text style={[TYPE.micro, { color: color.inkMuted }]}>{step.meta}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: SPACE.xxs },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, minHeight: ROW_HEIGHT },
  icon: { width: ICON_BOX, height: ICON_BOX, alignItems: "center", justifyContent: "center" },
  badge: { width: ICON_BOX, height: ICON_BOX, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  dot: { width: SIZE.dot, height: SIZE.dot, borderRadius: RADIUS.pill },
  label: { flex: 1 },
});

/**
 * What a link asked the terminal to have ready (D-340): a trade side, a position's Cash out — ringed in the
 * selected-control magenta, pulsing three times (still under Reduce Motion); never pressed.
 */
import type { ReactNode } from "react";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { RADIUS, useTheme } from "~/theme";

const RING = 3;
const PULSE_MS = 600;
const PULSES = 3;
const DIM = 0.35;

export function ReadyRing({ on, radius = RADIUS.md, children }: { on: boolean; radius?: number; children: ReactNode }) {
  const { color } = useTheme();
  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = on
      ? withRepeat(
          withSequence(
            withTiming(DIM, { duration: PULSE_MS, reduceMotion: ReduceMotion.System }),
            withTiming(1, { duration: PULSE_MS, reduceMotion: ReduceMotion.System }),
          ),
          PULSES,
        )
      : withTiming(0, { duration: PULSE_MS });
  }, [on, glow]);
  const ring = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <Animated.View style={{ borderRadius: radius + RING * 2 }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          { borderRadius: radius + RING * 2, borderColor: color.accent, margin: -RING * 2, borderWidth: RING },
          ring,
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: StyleSheet.absoluteFill,
});

/**
 * Setup's progress bar (A2, §0.9 "Setup": a progress bar on top; 21st.dev sean0205/c-progress-7, id 29469 — its bar
 * ported, its checklist left out because the steps are pages): a 3 pt track across the gutter with the filled part in
 * the primary ink. The fill travels from the previous step's share to this one's when the page arrives, so moving on
 * reads as progress; Reduce Motion places it. VoiceOver reads "Step 2 of 5".
 */
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { EASE, RADIUS, SIZE, TIMING, useTheme } from "~/theme";
import type { SetupStep } from "./progress";

/** The pages the bar counts; `done` and the terms sheet sit after it. */
const COUNTED: readonly SetupStep[] = ["handle", "dollars", "first-call", "one-tap", "notifications"];
const TRACK_HEIGHT = 3;
const PERCENT = 100;

export function SetupProgress({ step }: { step: SetupStep }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const at = COUNTED.indexOf(step);
  const index = at < 0 ? COUNTED.length : at + 1;
  const share = index / COUNTED.length;
  const from = Math.max(0, (index - 1) / COUNTED.length);
  const fill = useSharedValue(reduce ? share : from);
  useEffect(() => {
    fill.value = reduce ? share : withTiming(share, { duration: TIMING.sheetEnter, easing: EASE });
  }, [share, reduce, fill]);
  const bar = useAnimatedStyle(() => ({ width: `${fill.value * PERCENT}%` }));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${Math.min(index, COUNTED.length)} of ${COUNTED.length}`}
      style={[styles.track, { backgroundColor: color.raised2 }]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: color.action }, bar]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: TRACK_HEIGHT, borderRadius: RADIUS.pill, overflow: "hidden", marginHorizontal: SIZE.gutter },
  fill: { height: TRACK_HEIGHT, borderRadius: RADIUS.pill },
});

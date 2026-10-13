/**
 * The replay's scrubber (Codex direction 18 §B): a 2 pt rail with the played part in ink and a 12 pt thumb, in a 44 pt
 * touch height; a tap jumps, a drag scrubs, and either one tells the sheet, which pauses. It reads and writes the
 * sheet's one clock (`t`, film ms), so the preview, the clock text and the sound move with it. VoiceOver adjusts it in
 * tenths of the film.
 */
import { useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, type SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { RADIUS, useTheme } from "~/theme";

const TOUCH = 44;
const RAIL = 2;
const THUMB = 12;
const HALF = 2;
const STEPS = 10;

export function Scrubber({
  t,
  totalMs,
  onSeek,
  label,
}: {
  t: SharedValue<number>;
  totalMs: number;
  onSeek: () => void;
  label: string;
}) {
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const seekTo = (x: number) => {
    "worklet";
    t.value = width > 0 ? Math.min(totalMs, Math.max(0, (x / width) * totalMs)) : t.value;
  };
  const gesture = Gesture.Exclusive(
    Gesture.Pan()
      .onStart((e) => {
        runOnJS(onSeek)();
        seekTo(e.x);
      })
      .onUpdate((e) => seekTo(e.x)),
    Gesture.Tap().onEnd((e) => {
      runOnJS(onSeek)();
      seekTo(e.x);
    }),
  );
  const played = useAnimatedStyle(() => ({ width: totalMs > 0 ? (t.value / totalMs) * width : 0 }));
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: (totalMs > 0 ? (t.value / totalMs) * width : 0) - THUMB / HALF }],
  }));
  const nudge = (dir: number) => {
    onSeek();
    t.value = Math.min(totalMs, Math.max(0, t.value + (dir * totalMs) / STEPS));
  };
  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.touch}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === "increment" ? 1 : -1)}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      >
        <View style={[styles.rail, { backgroundColor: color.hairline }]}>
          <Animated.View style={[styles.played, { backgroundColor: color.ink }, played]} />
        </View>
        <Animated.View style={[styles.thumb, { backgroundColor: color.ink }, thumb]} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  touch: { flex: 1, height: TOUCH, justifyContent: "center" },
  rail: { height: RAIL, borderRadius: RAIL, overflow: "hidden" },
  played: { height: RAIL },
  thumb: {
    position: "absolute",
    left: 0,
    top: (TOUCH - THUMB) / HALF,
    width: THUMB,
    height: THUMB,
    borderRadius: RADIUS.pill,
  },
});

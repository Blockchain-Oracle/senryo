/**
 * A slider that snaps to marks (21st.dev #29217 ai2/slider-marks — track, fill, marks, thumb — rebuilt with Gesture
 * Handler and Reanimated): drag or tap anywhere on the track, the thumb settles on the nearest mark, each new mark a
 * haptic tick; VoiceOver adjusts it a mark at a time. The marks are the scale (labels under each), not chips.
 */
import { useEffect, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { fire } from "~/feedback/fire";
import { EASE, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";

const TRACK = 6;
const THUMB = 24;
const HALF = 2;

export function MarksSlider({
  marks,
  value,
  onChange,
  format,
  label,
}: {
  marks: readonly number[];
  value: number;
  onChange: (next: number) => void;
  format: (v: number) => string;
  label: string;
}) {
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, marks.indexOf(value));
  const last = Math.max(1, marks.length - 1);
  const step = width > 0 ? (width - THUMB) / last : 0;
  const x = useSharedValue(index * step);
  useEffect(() => {
    x.value = withTiming(index * step, { duration: TIMING.press, easing: EASE });
  }, [index, step, x]);
  const pick = (i: number) => {
    const next = marks[Math.min(last, Math.max(0, i))];
    if (next === undefined || next === value) return;
    fire("tick");
    onChange(next);
  };
  const toIndex = (px: number) => {
    "worklet";
    return step > 0 ? Math.round((px - THUMB / HALF) / step) : 0;
  };
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(pick)(toIndex(e.x)))
    .onUpdate((e) => runOnJS(pick)(toIndex(e.x)));
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const fill = useAnimatedStyle(() => ({ width: x.value + THUMB / HALF }));
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: format(value) }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => pick(index + (e.nativeEvent.actionName === "increment" ? 1 : -1))}
    >
      <GestureDetector gesture={pan}>
        <View style={styles.hit} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
          <View style={[styles.track, { backgroundColor: color.muted }]}>
            <Animated.View style={[styles.fill, { backgroundColor: color.ink }, fill]} />
          </View>
          {marks.map((m, i) => (
            <View
              key={m}
              style={[styles.mark, { left: i * step + THUMB / HALF - 1, backgroundColor: color.inkMuted }]}
            />
          ))}
          <Animated.View style={[styles.thumb, { backgroundColor: color.accent }, thumb]} />
        </View>
      </GestureDetector>
      <View style={styles.labels}>
        {marks.map((m, i) => (
          <Text
            key={m}
            style={[
              TYPE.chipLabel,
              styles.label,
              { left: i * step, width: THUMB, color: i === index ? color.ink : color.inkMuted },
            ]}
          >
            {format(m)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { height: SIZE.touch, justifyContent: "center" },
  track: { height: TRACK, borderRadius: TRACK / HALF, marginHorizontal: THUMB / HALF, overflow: "hidden" },
  fill: { position: "absolute", left: -THUMB / HALF, top: 0, bottom: 0, borderRadius: TRACK / HALF },
  mark: {
    position: "absolute",
    width: 2,
    height: TRACK + SPACE.sm,
    borderRadius: 1,
    top: (SIZE.touch - TRACK) / HALF - SPACE.xs,
  },
  thumb: {
    position: "absolute",
    left: 0,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / HALF,
    top: (SIZE.touch - THUMB) / HALF,
  },
  labels: { height: SPACE.lg + SPACE.xs },
  label: { position: "absolute", textAlign: "center" },
});

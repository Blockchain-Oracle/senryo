/**
 * Leverage — RN port of 21st originui/slider (#304) with D2 detents (web twin: apps/web/src/components/ui/slider.tsx).
 * Integer steps 1…max on a hairline track; the thumb follows the finger on the UI thread (GH Pan) and settles on the
 * step; `tick` per step, `snap` at the ends (F10). Detent marks (1/2/5/10 up to max) sit under the track and jump when
 * tapped. VoiceOver: adjustable, increment/decrement by one step.
 */
import { useEffect, useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { LEVERAGE_DETENTS } from "~/features/trade/constants";
import { fire } from "~/feedback/fire";
import { DURATION, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const THUMB = 22;
const TRACK = 4;
const MIN = 1;
const THUMB_BORDER = 2;

export function LeverageSlider({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const span = Math.max(max - MIN, 1);
  const x = useSharedValue(0);
  const startX = useSharedValue(0);
  const last = useSharedValue(value);

  useEffect(() => {
    last.value = value;
    x.value = withTiming(((value - MIN) / span) * width, { duration: DURATION.fast });
  }, [value, span, width, x, last]);

  const commit = (next: number) => {
    fire(next === MIN || next === max ? "snap" : "tick");
    onChange(next);
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      startX.value = e.x - THUMB / 2;
      x.value = Math.min(Math.max(startX.value, 0), width);
    })
    .onUpdate((e) => {
      const nx = Math.min(Math.max(startX.value + e.translationX, 0), width);
      x.value = nx;
      const step = Math.round(MIN + (nx / Math.max(width, 1)) * span);
      if (step !== last.value) {
        last.value = step;
        scheduleOnRN(commit, step);
      }
    })
    .onFinalize(() => {
      x.value = withTiming(((last.value - MIN) / span) * width, { duration: DURATION.fast });
    });

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const fill = useAnimatedStyle(() => ({ width: x.value }));
  const detents = LEVERAGE_DETENTS.filter((d) => d <= max);

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Leverage"
      accessibilityValue={{ min: MIN, max, now: value, text: `${value} times` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        const next = e.nativeEvent.actionName === "increment" ? Math.min(value + 1, max) : Math.max(value - 1, MIN);
        if (next !== value) commit(next);
      }}
      style={styles.wrap}
    >
      <GestureDetector gesture={pan}>
        <View style={styles.hit} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width - THUMB)}>
          <View style={[styles.track, { backgroundColor: color.muted }]}>
            <Animated.View style={[styles.fill, { backgroundColor: color.primary }, fill]} />
          </View>
          <Animated.View style={[styles.thumb, { backgroundColor: color.ground, borderColor: color.primary }, thumb]} />
        </View>
      </GestureDetector>
      <View style={styles.marks}>
        {detents.map((d) => (
          <Pressable
            key={d}
            hitSlop={SPACE.sm}
            onPress={() => d !== value && commit(d)}
            style={[styles.mark, { left: ((d - MIN) / span) * width }]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            <Text style={[TYPE.micro, { color: d === value ? color.primary : color.inkMuted }]}>{d}x</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.xs },
  hit: { height: SIZE.touch, justifyContent: "center" },
  track: { height: TRACK, borderRadius: RADIUS.pill, marginHorizontal: THUMB / 2, overflow: "hidden" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0 },
  thumb: {
    position: "absolute",
    width: THUMB,
    height: THUMB,
    borderRadius: RADIUS.pill,
    borderWidth: THUMB_BORDER,
  },
  marks: { height: SIZE.skeletonLine, marginHorizontal: 0 },
  mark: { position: "absolute", width: THUMB, alignItems: "center" },
});

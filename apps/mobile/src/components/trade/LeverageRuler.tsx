/**
 * The centred graduated leverage ruler (C40/FT103, Fomo F38/M14; never a plain slider — direction §5.11): a strip of
 * multiples on fine top and bottom rails, the selected multiple centred in the link blue, the rest fading toward the
 * edges. Direct gesture: the strip follows the finger on the UI thread, a tick (haptic) per step, and on release it
 * snaps to the nearest multiple on the ruler spring (1/500/40, clamped to 1…the market's max — metals 10×, FX 20×).
 * Tapping a multiple jumps to it. Reduce Motion: no spring, a ~100 ms move. VoiceOver: adjustable, ± one step.
 * Reference-native reconstruction (no 21st source preserves the anatomy) — recorded in `.21st/design.json`.
 */
import { useEffect, useState } from "react";
import { type LayoutChangeEvent, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import {
  RULER_FADE_STEPS,
  RULER_FLING_SEC,
  RULER_MIN_OPACITY,
  RULER_STEP,
  RULER_TICK,
} from "~/features/trade/constants";
import { fire } from "~/feedback/fire";
import { HAIRLINE_PX, SIZE, SPACE, SPRING, TIMING, TYPE, useTheme } from "~/theme";

const MIN = 1;

export function LeverageRuler({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const top = Math.max(max, MIN);
  const steps = Array.from({ length: top - MIN + 1 }, (_, i) => MIN + i);
  const limit = -(top - MIN) * RULER_STEP;
  // offset 0 centres 1×; each step left by RULER_STEP.
  const offset = useSharedValue(-(value - MIN) * RULER_STEP);
  const start = useSharedValue(0);
  const last = useSharedValue(value);
  const dragging = useSharedValue(false);

  useEffect(() => {
    if (dragging.value) return;
    last.value = value;
    const target = -(value - MIN) * RULER_STEP;
    offset.value = reduce
      ? withTiming(target, { duration: TIMING.reducedMotion })
      : withSpring(target, SPRING.rulerSnap);
  }, [value, offset, last, dragging, reduce]);

  const commit = (next: number) => {
    fire(next === MIN || next === top ? "snap" : "tick");
    onChange(next);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-SPACE.xs, SPACE.xs])
    .failOffsetY([-SPACE.lg, SPACE.lg])
    .onBegin(() => {
      dragging.value = true;
      start.value = offset.value;
    })
    .onUpdate((e) => {
      const next = Math.min(0, Math.max(limit, start.value + e.translationX));
      offset.value = next;
      const step = Math.round(-next / RULER_STEP) + MIN;
      if (step !== last.value) {
        last.value = step;
        scheduleOnRN(commit, step);
      }
    })
    .onEnd((e) => {
      const projected = Math.min(0, Math.max(limit, offset.value + e.velocityX * RULER_FLING_SEC));
      const step = Math.round(-projected / RULER_STEP) + MIN;
      if (step !== last.value) {
        last.value = step;
        scheduleOnRN(commit, step);
      }
      const target = -(step - MIN) * RULER_STEP;
      offset.value = reduce
        ? withTiming(target, { duration: TIMING.reducedMotion })
        : withSpring(target, SPRING.rulerSnap);
    })
    .onFinalize(() => {
      dragging.value = false;
    });

  const strip = useAnimatedStyle(() => ({
    transform: [{ translateX: width / 2 - RULER_STEP / 2 + offset.value }],
  }));

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Leverage"
      accessibilityValue={{ min: MIN, max: top, now: value, text: `${value} times` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        const next = e.nativeEvent.actionName === "increment" ? Math.min(value + 1, top) : Math.max(value - 1, MIN);
        if (next !== value) commit(next);
      }}
      style={styles.wrap}
    >
      <GestureDetector gesture={pan}>
        <View style={styles.window} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
          <View style={[styles.rail, styles.railTop, { backgroundColor: color.border }]} />
          <View style={[styles.rail, styles.railBottom, { backgroundColor: color.border }]} />
          <Animated.View style={[styles.strip, strip]}>
            {steps.map((step) => (
              <Mark key={step} step={step} offset={offset} onPress={() => step !== value && commit(step)} />
            ))}
          </Animated.View>
        </View>
      </GestureDetector>
      <Text style={[TYPE.meta, styles.caption, { color: color.text3 }]}>Leverage</Text>
    </View>
  );
}

/** One multiple: its ticks on both rails and its label, faded by distance from the centre, blue when centred. */
function Mark({ step, offset, onPress }: { step: number; offset: SharedValue<number>; onPress: () => void }) {
  const { color } = useTheme();
  const centre = -(step - MIN) * RULER_STEP;
  const fade = useAnimatedStyle(() => {
    const away = Math.abs(offset.value - centre) / RULER_STEP;
    return { opacity: Math.max(RULER_MIN_OPACITY, 1 - away / RULER_FADE_STEPS) };
  });
  const ink = useAnimatedStyle(() => {
    const near = Math.min(1, Math.abs(offset.value - centre) / RULER_STEP);
    return { color: interpolateColor(near, [0, 1], [color.link, color.text2]) };
  });
  const tick = useAnimatedStyle(() => {
    const near = Math.min(1, Math.abs(offset.value - centre) / RULER_STEP);
    return { backgroundColor: interpolateColor(near, [0, 1], [color.link, color.border]) };
  });
  return (
    <Animated.View style={[styles.mark, fade]}>
      <Animated.View style={[styles.tick, styles.tickTop, tick]} />
      <Pressable
        onPress={onPress}
        accessibilityElementsHidden
        importantForAccessibility="no"
        hitSlop={SPACE.sm}
        style={styles.labelHit}
      >
        <Animated.Text style={[TYPE.rowStrong, ink]}>{step}x</Animated.Text>
      </Pressable>
      <Animated.View style={[styles.tick, styles.tickBottom, tick]} />
    </Animated.View>
  );
}

const STRIP_HEIGHT = SIZE.touch + 2 * RULER_TICK;

const styles = StyleSheet.create({
  wrap: { gap: SPACE.xs, alignItems: "stretch" },
  window: { height: STRIP_HEIGHT, overflow: "hidden", justifyContent: "center" },
  rail: { position: "absolute", left: 0, right: 0, height: HAIRLINE_PX },
  railTop: { top: 0 },
  railBottom: { bottom: 0 },
  strip: { position: "absolute", left: 0, top: 0, bottom: 0, flexDirection: "row" },
  mark: { width: RULER_STEP, alignItems: "center", justifyContent: "center" },
  tick: { position: "absolute", width: HAIRLINE_PX * 2, height: RULER_TICK },
  tickTop: { top: 0 },
  tickBottom: { bottom: 0 },
  labelHit: { minHeight: SIZE.touch, justifyContent: "center", paddingHorizontal: SPACE.xxs },
  caption: { textAlign: "center" },
});

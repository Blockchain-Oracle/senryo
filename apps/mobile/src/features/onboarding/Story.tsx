import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { fire } from "~/feedback/fire";
import { EASE, RADIUS, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";
import { STORY } from "./constants";
import { StoryHero } from "./StoryHero";
import { SCENES } from "./scenes";

const LAST = SCENES.length - 1;
const FIRST = SCENES[0] as (typeof SCENES)[number];

/**
 * The welcome story (J1, FT001; Solflare C01/C02 adapted): six progress segments, the layered hero, one headline and
 * one sentence. It is a story, not a checklist: Create / sign in / browse sit below it and work from the first frame
 * (review 1 Oct §4). Swipe, tap the picture's right or left side, tap a segment, or use the VoiceOver adjust action.
 * It advances by itself until the user touches it; never while a screen reader is on, under Reduce Motion or in the
 * background, and it stops on the last scene.
 */
export function Story() {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const position = useSharedValue(0);
  const width = useSharedValue(1);
  const start = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const touched = useRef(false);
  const scene = SCENES[index] ?? FIRST;

  useAnimatedReaction(
    () => Math.round(position.value),
    (now, before) => {
      if (now !== before) scheduleOnRN(setIndex, now);
    },
  );

  const go = useCallback(
    (target: number) => {
      const to = Math.max(0, Math.min(LAST, target));
      position.value = withTiming(to, {
        duration: reduce ? TIMING.reducedMotion : TIMING.onboardingScene,
        easing: EASE,
      });
    },
    [position, reduce],
  );
  const step = useCallback(
    (by: number) => {
      touched.current = true;
      fire("tick");
      go(Math.round(position.value) + by);
    },
    [go, position],
  );
  const jump = (to: number) => {
    touched.current = true;
    fire("tick");
    go(to);
  };

  useEffect(() => {
    if (reduce) return;
    let reader = false;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      reader = on;
    });
    const sub = AccessibilityInfo.addEventListener("screenReaderChanged", (on) => {
      reader = on;
    });
    const timer = setInterval(() => {
      const current = Math.round(position.value);
      if (touched.current || reader || AppState.currentState !== "active" || current >= LAST) return;
      go(current + 1);
    }, STORY.autoAdvanceMs);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [go, position, reduce]);

  const hold = () => {
    touched.current = true;
  };
  const pan = Gesture.Pan()
    .activeOffsetX([-STORY.panActivate, STORY.panActivate])
    .onStart(() => {
      start.value = position.value;
      scheduleOnRN(hold);
    })
    .onUpdate((e) => {
      if (reduce) return;
      position.value = Math.max(0, Math.min(LAST, start.value - e.translationX / width.value));
    })
    .onEnd((e) => {
      const flick = Math.abs(e.velocityX) > STORY.flickVelocity ? -Math.sign(e.velocityX) : 0;
      const dragged = Math.round(start.value - e.translationX / width.value);
      scheduleOnRN(go, flick === 0 ? dragged : Math.round(start.value) + flick);
    });
  const tap = Gesture.Tap().onEnd((e) => {
    scheduleOnRN(step, e.x < width.value * STORY.backZone ? -1 : 1);
  });

  return (
    <View style={styles.wrap}>
      <View style={styles.segments}>
        {SCENES.map((s, i) => (
          <Pressable
            key={s.key}
            onPress={() => jump(i)}
            hitSlop={{ top: SPACE.md, bottom: SPACE.md }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.segmentTap}
          >
            <View style={[styles.segment, { backgroundColor: i === index ? color.ink : color.raised2 }]} />
          </Pressable>
        ))}
      </View>
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <View
          style={styles.stage}
          onLayout={(e) => {
            width.value = Math.max(1, e.nativeEvent.layout.width);
          }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`${scene.title} ${scene.body}`}
          accessibilityValue={{ text: `Scene ${index + 1} of ${SCENES.length}. ${scene.art}` }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 1 : -1)}
        >
          <StoryHero position={position} reduce={reduce} />
        </View>
      </GestureDetector>
      <Animated.View
        key={scene.key}
        entering={FadeIn.duration(TIMING.selection)}
        style={styles.copy}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={[TYPE.sheetTitle, styles.center, { color: color.ink }]}>{scene.title}</Text>
        <Text style={[TYPE.body, styles.center, { color: color.text2 }]}>{scene.body}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: SIZE.gutter, gap: SPACE.md },
  segments: { flexDirection: "row", gap: SPACE.xs, paddingTop: SPACE.sm },
  segmentTap: { flex: 1 },
  segment: { height: STORY.segmentHeight, borderRadius: RADIUS.pill },
  stage: { flex: 1 },
  copy: { gap: SPACE.xs, minHeight: STORY.copyMinHeight, justifyContent: "flex-start" },
  center: { textAlign: "center" },
});

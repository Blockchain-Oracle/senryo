/**
 * A permission primer in the first-run setup (Solflare S14, Phantom P10 adapted; C06/C07): the authored art in the
 * middle of the page, one title and one sentence under it, a reserved line for what just happened, then "Turn on" and
 * "Not now" pinned to the bottom. The primer is ours; the OS prompt it leads to stays the OS's own (kept separate,
 * C07). The art settles in once, then moves once in its own way (the bell sways, the lock lifts); when the permission
 * is granted it answers with one small swell. Reduce Motion: it is simply there.
 */
import { type ReactNode, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/kit/Button";
import { EASE, SIZE, SPACE, SPRING, TIMING, TYPE, useTheme } from "~/theme";
import type { SetupStep } from "./progress";
import { SetupProgress } from "./SetupProgress";
import { arriving, SetupBar } from "./SetupScreen";

/** The art is drawn square with room around its subject; this wide on the page, so the subject reads at S14/P10 scale. */
export const PRIMER_ART = 248;
/** It settles from a little small; nothing appears from nothing. */
const ART_FROM_SCALE = 0.9;
/** The one gesture after it lands: a bell's sway about its cord (each swing smaller) or a lock's lift (pt). */
const SWAY_FIRST_DEG = 7;
const SWAY_DECAY = -0.7;
const SWAY_SWINGS = 3;
const SWAY_DEG = [...Array.from({ length: SWAY_SWINGS }, (_, i) => SWAY_FIRST_DEG * SWAY_DECAY ** i), 0];
const LIFT_PT = -10;
/** The answer to a granted permission. */
const SWELL_SCALE = 1.06;
const COPY_ORDER = 2;
const ACTION_ORDER = 3;

export type PrimerMotion = "sway" | "lift";
export type PrimerTone = "up" | "muted" | "warn";

export interface PrimerAction {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
}

export function PrimerScreen({
  step,
  art,
  motion,
  title,
  body,
  status,
  granted,
  primary,
  secondary,
  onBack,
  onSkip,
}: {
  step: SetupStep;
  art: ReactNode;
  motion: PrimerMotion;
  title: string;
  body: string;
  /** What the last attempt did, in place; the line's height is kept so nothing jumps. */
  status?: { text: string; tone: PrimerTone } | undefined;
  /** The permission is on: the art swells once. */
  granted: boolean;
  primary: PrimerAction;
  secondary?: PrimerAction | undefined;
  onBack?: () => void;
  /** Every primer can be skipped (A2); Skip moves on like "Not now". */
  onSkip?: () => void;
}) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const gesture = useSharedValue(0);
  const swell = useSharedValue(1);

  useEffect(() => {
    if (reduce) return;
    const settle = TIMING.onboardingScene;
    const step = TIMING.selection;
    gesture.value =
      motion === "sway"
        ? withDelay(settle, withSequence(...SWAY_DEG.map((deg) => withTiming(deg, { duration: step, easing: EASE }))))
        : withDelay(settle, withSequence(withSpring(LIFT_PT, SPRING.fan), withSpring(0, SPRING.fan)));
  }, [reduce, motion, gesture]);

  useEffect(() => {
    if (!granted || reduce) return;
    swell.value = withSequence(
      withTiming(SWELL_SCALE, { duration: TIMING.press, easing: EASE }),
      withSpring(1, SPRING.fan),
    );
  }, [granted, reduce, swell]);

  const artStyle = useAnimatedStyle(() => ({
    transform:
      motion === "sway"
        ? [{ rotate: `${gesture.value}deg` }, { scale: swell.value }]
        : [{ translateY: gesture.value }, { scale: swell.value }],
  }));
  const tone = { up: color.up, muted: color.text3, warn: color.warn } as const;

  return (
    <View style={[styles.root, { backgroundColor: color.ground, paddingTop: insets.top + SPACE.sm }]}>
      <SetupProgress step={step} />
      <SetupBar onBack={onBack} onSkip={onSkip} />
      <View style={styles.centre}>
        <Animated.View
          entering={ZoomIn.duration(TIMING.onboardingScene).withInitialValues({
            transform: [{ scale: ART_FROM_SCALE }],
          })}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Animated.View style={[styles.art, motion === "sway" ? styles.cord : null, artStyle]}>{art}</Animated.View>
        </Animated.View>
        <Animated.View entering={arriving(COPY_ORDER)} style={styles.copy}>
          <Text accessibilityRole="header" style={[TYPE.stepTitle, styles.center, { color: color.ink }]}>
            {title}
          </Text>
          <Text style={[TYPE.body, styles.center, { color: color.text2 }]}>{body}</Text>
          <Text
            accessibilityLiveRegion="polite"
            style={[TYPE.rowDetail, styles.center, { color: tone[status?.tone ?? "muted"] }]}
          >
            {status?.text ?? " "}
          </Text>
        </Animated.View>
      </View>
      <Animated.View
        entering={arriving(ACTION_ORDER)}
        style={[styles.footer, { paddingBottom: insets.bottom + SPACE.md }]}
      >
        <Button {...primary} />
        {/* The second action's place is kept when it goes, so the page doesn't shift as the answer lands. */}
        {secondary ? <Button variant="secondary" {...secondary} /> : <View style={styles.slot} />}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.xl, paddingHorizontal: SPACE.xl },
  art: { width: PRIMER_ART, height: PRIMER_ART },
  // A bell swings from where its cord is tied.
  cord: { transformOrigin: "top" },
  copy: { gap: SPACE.sm },
  center: { textAlign: "center" },
  footer: { paddingHorizontal: SPACE.xl, gap: SPACE.sm },
  slot: { height: SIZE.buttonHeight },
});

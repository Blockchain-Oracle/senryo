/**
 * A first-run setup step (A2; Fomo F04–F07): the progress bar on top, back and Skip in the corners with the seal
 * between them, one centred title and one short line, the step's content, and the primary action pinned to the
 * bottom — above the keyboard when a field is focused, so it is never covered (F04/F07). A quiet text action can sit
 * above the primary ("Have a code?"). Content arrives in a short stagger behind the page push.
 */
import { ids } from "@senryo/identity";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EntityMark } from "~/components/identity/EntityMark";
import { ChevronLeft } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { SIZE, SPACE, STAGGER_RISE, TIMING, TYPE, useTheme } from "~/theme";
import type { SetupStep } from "./progress";
import { SetupProgress } from "./SetupProgress";

const SEAL = ids.brand("senryo");

/** The i-th block of a step rises into place behind the previous one. */
export function arriving(i: number) {
  return FadeInDown.duration(TIMING.staggerItem)
    .delay(i * TIMING.stagger)
    .withInitialValues({ transform: [{ translateY: STAGGER_RISE }] });
}

export function SetupScreen({
  step,
  title,
  body,
  onBack,
  onSkip,
  children,
  footer,
}: {
  step: SetupStep;
  title: string;
  /** One short line under the title (no sentences on setup pages, D-237). */
  body: string;
  /** Omit on the first step: there is nothing to go back to once the account exists. */
  onBack?: () => void;
  onSkip?: () => void;
  children: ReactNode;
  /** The pinned actions (a primary `Button`, optionally a quiet one above it). */
  footer: ReactNode;
}) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const lift = useAnimatedStyle(() => ({
    paddingBottom: Math.max(insets.bottom, keyboard.height.value) + SPACE.md,
  }));
  return (
    <View style={[styles.root, { backgroundColor: color.ground, paddingTop: insets.top + SPACE.sm }]}>
      <SetupProgress step={step} />
      <SetupBar onBack={onBack} onSkip={onSkip} />
      <Animated.View entering={arriving(0)} style={styles.heading}>
        <Text accessibilityRole="header" style={[TYPE.stepTitle, styles.center, { color: color.ink }]}>
          {title}
        </Text>
        {body ? <Text style={[TYPE.body, styles.center, { color: color.text2 }]}>{body}</Text> : null}
      </Animated.View>
      <Animated.View entering={arriving(1)} style={styles.content}>
        {children}
      </Animated.View>
      <Animated.View entering={arriving(2)} style={[styles.footer, lift]}>
        {footer}
      </Animated.View>
    </View>
  );
}

/** Back and Skip in the corners with the seal between them; either corner may be empty. */
export function SetupBar({ onBack, onSkip }: { onBack?: (() => void) | undefined; onSkip?: (() => void) | undefined }) {
  const { color } = useTheme();
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            onPress={() => {
              fire("tick");
              onBack();
            }}
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={SPACE.md}
            style={styles.tap}
          >
            <ChevronLeft size={SIZE.icon} strokeWidth={SIZE.iconStroke} color={color.text2} />
          </Pressable>
        ) : null}
      </View>
      <EntityMark id={SEAL} size={SIZE.avatarSm} variant="symbol" decorative ground={color.ground} />
      <View style={[styles.side, styles.end]}>
        {onSkip ? (
          <Pressable
            onPress={() => {
              fire("tick");
              onSkip();
            }}
            accessibilityRole="button"
            accessibilityLabel="Skip this step"
            hitSlop={SPACE.md}
            style={styles.tap}
          >
            <Text style={[TYPE.buttonLabel, { color: color.text3 }]}>Skip</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: SIZE.touch + SPACE.md,
    paddingHorizontal: SIZE.gutter,
  },
  side: { flex: 1, flexDirection: "row" },
  end: { justifyContent: "flex-end" },
  tap: { minWidth: SIZE.touch, minHeight: SIZE.touch, justifyContent: "center" },
  heading: { gap: SPACE.sm, paddingHorizontal: SPACE.xl, paddingTop: SPACE.xl, paddingBottom: SPACE.xl },
  center: { textAlign: "center" },
  content: { flex: 1, paddingHorizontal: SPACE.xl },
  footer: { paddingHorizontal: SPACE.xl, paddingTop: SPACE.md, gap: SPACE.sm },
});

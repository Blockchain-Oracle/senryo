/** U14 setup: clear heading, recessed form and keyboard-anchored action. */
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, ReduceMotion, useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "~/components/kit/symbols";
import { fire } from "~/feedback/fire";
import { FONT, SIZE, SPACE, STAGGER_RISE, TIMING, TYPE, useTheme } from "~/theme";
import type { SetupStep } from "./progress";
import { SetupProgress } from "./SetupProgress";

/** The i-th block of a step rises into place behind the previous one. */
export function arriving(i: number) {
  return FadeInDown.duration(TIMING.staggerItem)
    .delay(i * TIMING.stagger)
    .reduceMotion(ReduceMotion.System)
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
  onBack?: (() => void) | undefined;
  onSkip?: (() => void) | undefined;
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
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={[TYPE.stepTitle, styles.title, { color: color.ink }]}>
          {title}
        </Text>
        {body ? <Text style={[TYPE.body, styles.body, { color: color.text2 }]}>{body}</Text> : null}
      </View>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentBody}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {children}
      </ScrollView>
      <Animated.View style={[styles.footer, lift]}>{footer}</Animated.View>
    </View>
  );
}

/** Retained Back and optional Skip; account access never depends on decoration. */
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
  heading: { gap: SPACE.sm, paddingHorizontal: SIZE.gutter, paddingTop: SPACE.md, paddingBottom: SPACE.xl },
  title: { fontFamily: FONT.display, textAlign: "left" },
  body: { textAlign: "left" },
  content: { flex: 1 },
  contentBody: { flexGrow: 1, paddingHorizontal: SIZE.gutter, paddingBottom: SPACE.lg },
  footer: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.md, gap: SPACE.sm },
});

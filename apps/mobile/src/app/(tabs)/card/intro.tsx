import { router, Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/kit/Button";
import { useHideDockWhileFocused } from "~/components/shell/dock-context";
import { CardFace } from "~/features/card/CardFace";
import { CardHero } from "~/features/card/CardHero";
import { fire } from "~/feedback/fire";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { RADIUS, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";

const STEPS = [
  {
    title: "A card on your balance",
    body: "Kinpaku spends from Free to spend: the part of your balance your positions don’t need.",
  },
  {
    title: "It never touches your margin",
    body: "What a position needs stays locked. A purchase that would reach it is declined, so a card payment can’t cause a liquidation.",
  },
  {
    title: "In preview",
    body: "Card issuance and identity verification depend on the issuer. Your actual status and activity appear on the Card tab.",
  },
] as const;
const LAST = STEPS.length - 1;
const DOT = SPACE.sm;

/**
 * Kinpaku's first-use tutorial (C21; Solflare S16/S17): three full-page steps over the Card tab — the card art, one
 * headline, one sentence each — with Next / Got it pinned at the bottom and the dock hidden. Shown once per device
 * (Got it or Skip records it); "How it works" under the card opens it again.
 */
export default function CardIntro() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  useHideDockWhileFocused("card-intro");
  const [step, setStep] = useState(0);
  const done = () => {
    storage.set(STORAGE_KEYS.cardIntroSeen, true);
    fire("confirm");
    router.back();
  };
  const current = STEPS[step] ?? STEPS[0];
  return (
    <View style={[styles.root, { backgroundColor: color.ground, paddingBottom: insets.bottom + SPACE.md }]}>
      <Stack.Screen
        options={{
          title: "",
          headerRight: () => <Button label="Skip" variant="ghost" size="sm" block={false} onPress={done} />,
        }}
      />
      <View style={styles.art}>
        <CardHero>
          <CardFace />
        </CardHero>
      </View>
      <Animated.View
        key={step}
        entering={FadeIn.duration(TIMING.selection)}
        exiting={FadeOut.duration(TIMING.press)}
        style={styles.copy}
      >
        <Text accessibilityRole="header" style={[TYPE.stepTitle, styles.center, { color: color.ink }]}>
          {current.title}
        </Text>
        <Text style={[TYPE.body, styles.center, { color: color.text2 }]}>{current.body}</Text>
      </Animated.View>
      <View style={styles.dots} accessibilityLabel={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <View key={s.title} style={[styles.dot, { backgroundColor: i === step ? color.ink : color.raised2 }]} />
        ))}
      </View>
      <View style={styles.footer}>
        <Button
          label={step === LAST ? "Got it" : "Next"}
          onPress={() => {
            if (step === LAST) return done();
            fire("tick");
            setStep(step + 1);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: SIZE.gutter },
  art: { flex: 1, justifyContent: "center", paddingHorizontal: SPACE.sm },
  copy: { gap: SPACE.sm, minHeight: SIZE.skeletonPlate + SPACE.xxl },
  center: { textAlign: "center" },
  dots: { flexDirection: "row", justifyContent: "center", gap: SPACE.sm, paddingVertical: SPACE.lg },
  dot: { width: DOT, height: DOT, borderRadius: RADIUS.pill },
  footer: { gap: SPACE.sm },
});

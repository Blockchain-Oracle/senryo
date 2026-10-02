import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/kit/Button";
import { useHideDockWhileFocused } from "~/components/shell/dock-context";
import { CardFace } from "~/features/card/CardFace";
import { CardHero } from "~/features/card/CardHero";
import { CARD_RISK_LINE } from "~/features/card/constants";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { RADIUS, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";

/** The progress bar's segments (Solflare S16: one segment per step across the top). */
const SEGMENT_HEIGHT = 3;

/** The explainer's three steps (E1 step 3): a title and one line each. The second is the corrected risk fact. */
function steps(practice: boolean) {
  return [
    { title: "Spend your balance", line: "Uses what positions don’t need" },
    { title: "Holds count as risk", line: CARD_RISK_LINE },
    practice
      ? { title: "Test card", line: "Practice money · simulate payments" }
      : { title: "No charge", line: "Holds show, nothing is paid" },
  ] as const;
}

/**
 * Kinpaku's first-run explainer (E1 step 3; Solflare S16/S17): three full-page steps over the Card tab — the floating
 * card art, a title and one line each — with segment progress at the top, Skip, and Next / Got it pinned at the bottom;
 * the dock is hidden. It replaces the old intro's "a card payment can't cause a liquidation" (defect 8): a payment is
 * approved only if it fits Spendable, but its hold and any debt then count against your positions. Shown once per
 * device before the first Get card (`?then=get` continues into it); "How it works" opens it again.
 */
export default function CardIntro() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const network = useNetwork();
  const { then } = useLocalSearchParams<{ then?: string }>();
  useHideDockWhileFocused("card-intro");
  const [step, setStep] = useState(0);
  const all = steps(network.key === "testnet");
  const last = all.length - 1;
  const done = () => {
    storage.set(STORAGE_KEYS.cardIntroSeen, true);
    fire("confirm");
    if (then === "get") router.replace(ROUTES.cardGet);
    else router.back();
  };
  const current = all[step] ?? all[0];
  return (
    <View style={[styles.root, { backgroundColor: color.ground, paddingBottom: insets.bottom + SPACE.md }]}>
      <Stack.Screen
        options={{
          title: "",
          headerRight: () => <Button label="Skip" variant="ghost" size="sm" block={false} onPress={done} />,
        }}
      />
      <View style={styles.segments} accessibilityLabel={`Step ${step + 1} of ${all.length}`}>
        {all.map((s, i) => (
          <Segment key={s.title} on={i <= step} />
        ))}
      </View>
      <View style={styles.art}>
        <CardHero floating>
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
        <Text style={[TYPE.body, styles.center, { color: color.text2 }]}>{current.line}</Text>
      </Animated.View>
      <Button
        label={step === last ? "Got it" : "Next"}
        onPress={() => {
          if (step === last) return done();
          fire("tick");
          setStep(step + 1);
        }}
      />
    </View>
  );
}

function Segment({ on }: { on: boolean }) {
  const { color } = useTheme();
  const fill = useAnimatedStyle(() => ({
    opacity: withTiming(on ? 1 : 0, { duration: TIMING.selection }),
  }));
  return (
    <View style={[styles.segment, { backgroundColor: color.raised2 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: color.ink }, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: SIZE.gutter, gap: SPACE.lg },
  segments: { flexDirection: "row", gap: SPACE.xs, paddingTop: SPACE.xs },
  segment: { flex: 1, height: SEGMENT_HEIGHT, borderRadius: RADIUS.pill, overflow: "hidden" },
  art: { flex: 1, justifyContent: "center", paddingHorizontal: SPACE.lg },
  copy: { gap: SPACE.sm, minHeight: SIZE.skeletonPlate },
  center: { textAlign: "center" },
});

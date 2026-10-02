import { NATIVE_ART } from "@senryo/identity/native";
import { useMyProfile } from "@senryo/query";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/kit/Button";
import { arriving } from "~/features/setup/SetupScreen";
import { useSetupNav } from "~/features/setup/useSetupNav";
import { fire } from "~/feedback/fire";
import { useSessionRunner } from "~/lib/account/use-session-runner";
import { useNetwork } from "~/lib/network";
import { storage } from "~/lib/storage";
import { SPACE, TIMING, TYPE, useTheme } from "~/theme";

const Foil = NATIVE_ART["completion-foil"]?.symbol;
/** The foil is drawn square; this wide on the page. */
const FOIL = 240;
/** It settles from a little small; nothing appears from nothing. */
const FOIL_FROM_SCALE = 0.9;
/** Stagger positions: the copy follows the seal, the action follows the copy. */
const COPY_ORDER = 2;
const ACTION_ORDER = 4;

/**
 * Setup — completion (A2 step 7; the terms sheet rises over Home after it) (C08; Solflare S13/M18 adapted): the gold-leaf foil with the pressed seal arrives, one
 * line says what now exists (the account, and the @handle when one was claimed), and one action opens Home. The foil
 * is the first-pass master (S1b.3, review B12 open) and is still: its flex is a material effect that needs a shader,
 * and a flat wobble would only pretend. Shown only after the account really exists and the earlier steps are recorded.
 */
export default function DoneStep() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const network = useNetwork();
  const { next, address } = useSetupNav("done");
  const profile = useMyProfile(address, useSessionRunner());
  const handle = profile.status === "fresh" || profile.status === "stale" ? profile.value?.handle : undefined;
  useEffect(() => {
    if (!address) return;
    const key = `senryo.welcome-complete:${address.toLowerCase()}`;
    if (storage.getBoolean(key)) return;
    storage.set(key, true);
    fire("confirm", { sound: "onboarding" });
  }, [address]);
  const practice = network.key === "testnet";
  return (
    <View style={[styles.root, { backgroundColor: color.ground, paddingTop: insets.top }]}>
      <View style={styles.centre}>
        <Animated.View
          entering={ZoomIn.duration(TIMING.completionFoil).withInitialValues({
            transform: [{ scale: FOIL_FROM_SCALE }],
          })}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {Foil ? <Foil width={FOIL} height={FOIL} /> : null}
        </Animated.View>
        <Animated.View entering={arriving(COPY_ORDER)} style={styles.copy}>
          <Text accessibilityRole="header" style={[TYPE.stepTitle, styles.center, { color: color.ink }]}>
            {handle ? `You’re in, @${handle}` : "You’re in"}
          </Text>
          <Text style={[TYPE.body, styles.center, { color: color.text2 }]}>
            {practice ? "Open your first trade" : "Add money to start"}
          </Text>
        </Animated.View>
      </View>
      <Animated.View
        entering={arriving(ACTION_ORDER)}
        style={[styles.footer, { paddingBottom: insets.bottom + SPACE.md }]}
      >
        <Button label="Go to Home" onPress={next} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACE.xl, paddingHorizontal: SPACE.xl },
  copy: { gap: SPACE.sm },
  center: { textAlign: "center" },
  footer: { paddingHorizontal: SPACE.xl },
});

import { ids } from "@senryo/identity";
import { useMyProfile } from "@senryo/query";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { arriving } from "~/features/setup/SetupScreen";
import { useSetupNav } from "~/features/setup/useSetupNav";
import { fire } from "~/feedback/fire";
import { useSessionRunner } from "~/lib/account/use-session-runner";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";

const SEAL = ids.brand("senryo");
/** The seal settles from a little small; nothing appears from nothing. */
const SEAL_FROM_SCALE = 0.9;
/** Stagger positions: the copy follows the seal, the action follows the copy. */
const COPY_ORDER = 2;
const ACTION_ORDER = 4;

/**
 * Setup step 5 — completion (C08; Solflare S13/M18 adapted): the seal arrives, one line says what now exists (the
 * account, and the @handle when one was claimed), and one action opens Home. The gold-leaf foil that flexes behind
 * the seal is original art still in review (S1b.3); until it merges the seal stands alone — no flat wobble pretending
 * to be material. Shown only after the account really exists and the earlier steps are recorded.
 */
export default function DoneStep() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const network = useNetwork();
  const { next, address } = useSetupNav("done");
  const profile = useMyProfile(address, useSessionRunner());
  const handle = profile.status === "fresh" || profile.status === "stale" ? profile.value?.handle : undefined;
  useEffect(() => {
    fire("confirm", { sound: "unlock" });
  }, []);
  const practice = network.key === "testnet";
  return (
    <View style={[styles.root, { backgroundColor: color.ground, paddingTop: insets.top }]}>
      <View style={styles.centre}>
        <Animated.View
          entering={ZoomIn.duration(TIMING.completionFoil).withInitialValues({
            transform: [{ scale: SEAL_FROM_SCALE }],
          })}
        >
          <EntityMark id={SEAL} size={SIZE.seal} variant="symbol" decorative ground={color.ground} />
        </Animated.View>
        <Animated.View entering={arriving(COPY_ORDER)} style={styles.copy}>
          <Text accessibilityRole="header" style={[TYPE.stepTitle, styles.center, { color: color.ink }]}>
            {handle ? `You’re in, @${handle}` : "You’re in"}
          </Text>
          <Text style={[TYPE.body, styles.center, { color: color.text2 }]}>
            {practice
              ? "Your account is ready in Practice mode. Claim your paper money on Home and open your first position."
              : "Your account is ready. Add money on Home to open your first position."}
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

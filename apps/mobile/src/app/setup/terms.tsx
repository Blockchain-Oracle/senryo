import { type Href, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { Button } from "~/components/kit/Button";
import { Check } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { acknowledgeTerms } from "~/features/legal/acknowledged";
import { SetupScreen } from "~/features/setup/SetupScreen";
import { useSetupNav } from "~/features/setup/useSetupNav";
import { fire } from "~/feedback/fire";
import { ROUTES } from "~/lib/constants/routes";
import { BUTTON, HAIRLINE_PX, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const POINTS = [
  "Your account is a passkey only you hold. Nobody, including us, can recover it or move your funds.",
  "Leverage multiplies losses as well as gains. A position can be liquidated and you can lose what you put in.",
  "Practice mode uses paper money with no value. Real money starts only when you switch to Mainnet.",
] as const;
const ROW_PRESS_SCALE = 0.985;
const BOX = SIZE.icon;
const BOX_CHECK = 16;

/**
 * Setup step 4 — terms (C12; Fomo F08/F36): the three things that matter in plain words, links to the full terms and
 * privacy notice (read in the app), and one checkbox. Continue is the quiet plate until the box is checked (F08 → F36).
 * This step cannot be skipped. The acknowledged version is stored for the account, so new terms ask again.
 */
export default function TermsStep() {
  const { color } = useTheme();
  const { next, back, address } = useSetupNav("terms");
  const press = usePressScale(ROW_PRESS_SCALE);
  const [agreed, setAgreed] = useState(false);
  const link = (label: string, href: string) => (
    <Text
      accessibilityRole="link"
      onPress={() => router.push(href as Href)}
      style={[TYPE.bodyStrong, { color: color.link }]}
    >
      {label}
    </Text>
  );
  return (
    <SetupScreen
      title="Before you start"
      body="Three things to know, and the terms you’re agreeing to."
      onBack={back}
      footer={
        <Button
          label="Continue"
          disabled={!agreed}
          onPress={() => {
            if (address) acknowledgeTerms(address);
            fire("confirm");
            next();
          }}
        />
      }
    >
      <View style={styles.points}>
        {POINTS.map((p, i) => (
          <View key={p} style={styles.point}>
            <Text style={[TYPE.rowTitle, { color: color.text3 }]}>{i + 1}</Text>
            <Text style={[TYPE.body, styles.flex, { color: color.text2 }]}>{p}</Text>
          </View>
        ))}
      </View>
      <Animated.View style={press.style}>
        <Pressable
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          onPress={() => {
            fire("tick");
            setAgreed((v) => !v);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreed }}
          accessibilityLabel="I have read and agree to the Terms of use and the Privacy notice"
          style={[styles.agree, { backgroundColor: color.card }]}
        >
          <View
            style={[
              styles.box,
              agreed
                ? { backgroundColor: color.primary, borderColor: color.primary }
                : { backgroundColor: color.transparent, borderColor: color.text3 },
            ]}
          >
            {agreed ? (
              <Check size={BOX_CHECK} strokeWidth={SIZE.iconStroke + 1} color={color.primaryForeground} />
            ) : null}
          </View>
          <Text style={[TYPE.body, styles.flex, { color: color.ink }]}>
            I have read and agree to the {link("Terms of use", ROUTES.accountTerms)} and the{" "}
            {link("Privacy notice", ROUTES.accountPrivacy)}.
          </Text>
        </Pressable>
      </Animated.View>
    </SetupScreen>
  );
}

const styles = StyleSheet.create({
  points: { gap: SPACE.lg, paddingBottom: SPACE.xl },
  point: { flexDirection: "row", gap: SPACE.md },
  flex: { flex: 1 },
  agree: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    padding: SPACE.lg,
    borderRadius: BUTTON.radius.md + SPACE.xs,
  },
  // A checkbox is a control boundary: its outline is the unchecked state.
  box: {
    width: BOX,
    height: BOX,
    borderRadius: SPACE.xs + SPACE.xxs,
    borderWidth: HAIRLINE_PX + HAIRLINE_PX / 2,
    alignItems: "center",
    justifyContent: "center",
  },
});

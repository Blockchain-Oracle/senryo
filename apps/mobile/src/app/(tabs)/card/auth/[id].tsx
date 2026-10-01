import { Stack, useLocalSearchParams } from "expo-router";
import { Check, Circle, X } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "~/components/kit/Screen";
import { Panel } from "~/components/kit/Surface";
import { SampleTag } from "~/features/card/SampleTag";
import { signedUsd } from "~/lib/money";
import { type CardAuth, SAMPLE_CARD } from "~/lib/sample";
import { HERO_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** What each step means for the account, in plain words (the card draws only on Free to spend). */
const STEPS = {
  held: "Held · the amount is set aside from Free to spend while the merchant confirms.",
  settled: "Settled · the merchant took the payment; the hold became a charge.",
  declined: "Declined · nothing was charged and the hold was released.",
  pending: "Settles when the merchant confirms, usually within a few days.",
} as const;

type StepState = "done" | "next" | "failed";

/**
 * One card authorization (inventory: "Authorization / spend detail"): merchant, amount and what happened to it, step by
 * step. There is no issued card yet, so the record is the sample one and says so; no times are shown because the
 * sample has none.
 */
export default function AuthorizationScreen() {
  const { color } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = SAMPLE_CARD.auths.find((a) => a.id === id);
  if (!auth) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Authorization" }} />
        <Text style={[TYPE.body, { color: color.text2 }]}>This authorization isn’t here any more.</Text>
      </Screen>
    );
  }
  const steps = stepsOf(auth);
  return (
    <Screen contentStyle={styles.page}>
      <Stack.Screen options={{ title: "Authorization" }} />
      <View style={styles.hero}>
        <View style={styles.titleLine}>
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>{auth.merchant}</Text>
          <SampleTag />
        </View>
        <Text maxFontSizeMultiplier={HERO_FONT_SCALE} style={[TYPE.displayBalance, { color: color.ink }]}>
          {signedUsd(-auth.amount6)}
        </Text>
      </View>
      <Panel style={styles.steps}>
        {steps.map((step) => (
          <View key={step.text} style={styles.step}>
            {step.state === "done" ? (
              <Check size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.up} />
            ) : step.state === "failed" ? (
              <X size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.down} />
            ) : (
              <Circle size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
            )}
            <Text style={[TYPE.row, styles.flex, { color: step.state === "next" ? color.text3 : color.ink }]}>
              {step.text}
            </Text>
          </View>
        ))}
      </Panel>
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
        Sample record: there is no issued card yet, so nothing here was charged.
      </Text>
    </Screen>
  );
}

function stepsOf(auth: CardAuth): { text: string; state: StepState }[] {
  if (auth.state === "declined") return [{ text: STEPS.declined, state: "failed" }];
  if (auth.state === "settled") {
    return [
      { text: STEPS.held, state: "done" },
      { text: STEPS.settled, state: "done" },
    ];
  }
  return [
    { text: STEPS.held, state: "done" },
    { text: STEPS.pending, state: "next" },
  ];
}

const styles = StyleSheet.create({
  page: { gap: SPACE.xl },
  hero: { gap: SPACE.xs },
  titleLine: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  steps: { padding: SPACE.lg, gap: SPACE.md },
  step: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.md },
  flex: { flex: 1 },
});

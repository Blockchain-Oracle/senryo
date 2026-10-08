/**
 * The "Get P$100" card of setup step 3 (A2, B15; Fomo F16's promotion card at hero scale): card art is one of the few
 * raised surfaces allowed (D-237 rule 5) — a practice-wash plate with the koban art, the amount large, "No real value"
 * in the practice ink, and one line for where the claim is (or why it stopped). The amount is the server's own
 * starter credit, never a constant; until it is read the card says "Practice money".
 */
import { NATIVE_ART } from "@senryo/identity/native";
import { StyleSheet, Text, View } from "react-native";
import Animated, { ReduceMotion, ZoomIn } from "react-native-reanimated";
import { CircleCheck } from "~/components/kit/symbols";
import type { StarterPhase } from "~/lib/account/use-starter";
import { SHEET_SHAPE, SIZE, SPACE, TIMING, TYPE, useTheme } from "~/theme";

const Koban = NATIVE_ART["xau-koban"]?.symbol;
const ART = 112;
const ART_FROM_SCALE = 0.9;

const REASON: Partial<Record<string, string>> = {
  RATE_LIMITED: "One claim per phone a day",
  BUDGET_EXHAUSTED: "Today’s practice budget is used · tomorrow",
  GEO_BLOCKED: "Not available in your region",
  RELAYER_BUSY: "Busy · try again in a moment",
  NOT_DEPLOYED: "Not live on this network yet",
  UNREACHABLE: "Offline right now · try again soon",
  RELAY_REVERTED: "Didn’t settle · nothing changed",
  AUTH: "Face ID didn’t confirm · try again",
};

/** One short line per claim phase (D-237: no sentences). */
export function starterLine(phase: StarterPhase): string {
  switch (phase.kind) {
    case "done":
      return "Added to your account";
    case "claimed":
      return "Already in your account";
    case "pending":
      return "Pending · check status";
    case "unchecked":
      return "Couldn’t check · retry";
    case "signing":
      return "Signing…";
    case "sending":
      return "Sending…";
    case "settling":
      return "Adding…";
    case "failed":
      return REASON[phase.code] ?? "Something went wrong · try again";
    default:
      return "Free · we pay the network fee";
  }
}

export function PracticeMoneyCard({
  amount,
  line,
  credited,
}: {
  amount: string | undefined;
  line: string;
  credited: boolean;
}) {
  const { color } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: color.practiceWash }]}>
      <Animated.View
        entering={ZoomIn.duration(TIMING.onboardingScene)
          .reduceMotion(ReduceMotion.System)
          .withInitialValues({ transform: [{ scale: ART_FROM_SCALE }] })}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Koban ? <Koban width={ART} height={ART} /> : null}
      </Animated.View>
      <View style={styles.copy}>
        <View style={styles.amount}>
          <Text style={[TYPE.numLg, { color: color.ink }]}>{amount ?? "Practice money"}</Text>
          {credited ? <CircleCheck size={SIZE.icon} color={color.up} /> : null}
        </View>
        <Text style={[TYPE.label, { color: color.practice }]}>No real value</Text>
        <Text accessibilityLiveRegion="polite" style={[TYPE.rowDetail, styles.center, { color: color.text2 }]}>
          {line}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    gap: SPACE.lg,
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.lg,
    borderRadius: SHEET_SHAPE.rowRadius,
  },
  copy: { alignItems: "center", gap: SPACE.xs },
  amount: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  center: { textAlign: "center" },
});

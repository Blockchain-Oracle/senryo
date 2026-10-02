import { Stack, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { Screen } from "~/components/kit/Screen";
import { KeyValue } from "~/components/kit/Surface";
import { useCardSummary } from "~/features/card/useCardSummary";
import { usd } from "~/lib/money";
import { SPACE, TYPE, useTheme } from "~/theme";

const USD6_PER_CENT = 10_000n;
/** Deep links resolve only actual service activity. Unknown records never fall back to a sample merchant. */
export default function AuthorizationScreen() {
  const { color } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const summary = useCardSummary();
  const row = summary.data?.recent.find((event) => event.id === id);
  return (
    <Screen>
      <Stack.Screen options={{ title: "Card activity" }} />
      {row ? (
        <View style={{ gap: SPACE.md }}>
          <Text style={[TYPE.sheetTitle, { color: color.ink }]}>{row.merchantDescriptor ?? "Card activity"}</Text>
          <Text style={[TYPE.displayBalance, { color: color.ink }]}>{usd(row.amountCents * USD6_PER_CENT)}</Text>
          <KeyValue label="Status" value={row.status} />
          <KeyValue label="Recorded" value={new Date(row.receivedAt).toLocaleString()} />
        </View>
      ) : (
        <Text style={[TYPE.body, { color: color.text3 }]}>
          {summary.isPending
            ? "Reading card activity…"
            : "This record is unavailable. Open Card for your recent activity."}
        </Text>
      )}
    </Screen>
  );
}

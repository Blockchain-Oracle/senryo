import { formatUnits } from "@senryo/core";
import { useMarketAccount } from "@senryo/query";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmountHero } from "~/components/kit/AmountHero";
import { Button } from "~/components/kit/Button";
import { usePullRefresh } from "~/components/kit/PullRefresh";
import { EmptyState } from "~/components/kit/states";
import { ContextTabs } from "~/components/shell/ContextTabs";
import { useDockInset } from "~/components/shell/dock-context";
import { ModeCapsule } from "~/components/shell/ModeCapsule";
import { NotificationsBell } from "~/features/notifications/NotificationsBell";
import { ContextualFaceId } from "~/features/setup/ContextualFaceId";
import { SetupResume } from "~/features/setup/SetupResume";
import { useAccount } from "~/lib/account/provider";
import { accountRequiredRoute, ROUTES } from "~/lib/constants/routes";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

const DOLLAR_DECIMALS = 6;
const CENTS = 2;

/**
 * Home between the pivot cleanup (S1) and the phone loop (S5, D-256): the dollar balance on the active network, the
 * setup resume and Receive. S5 replaces it with the UGLYCASH balance card, the featured live window and open calls.
 */
export default function Home() {
  const address = useAccount().hint?.address;
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useDockInset();
  const refresh = usePullRefresh();
  const account = useMarketAccount(address);
  const text =
    account.status === "fresh" || account.status === "stale"
      ? `$${formatUnits(account.value.balance, DOLLAR_DECIMALS, CENTS)}`
      : "$—";
  return (
    <View style={[styles.fill, { backgroundColor: color.ground, paddingTop: insets.top }]}>
      <View style={styles.utilities}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>Senryo</Text>
        <View style={styles.utilityActions}>
          <ModeCapsule compact />
          <NotificationsBell />
        </View>
      </View>
      <ContextTabs />
      <ScrollView
        refreshControl={refresh}
        contentContainerStyle={[styles.content, { paddingBottom: bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {address ? (
          <>
            <AmountHero text={text} accessibilityLabel={`Balance ${text}`} />
            <SetupResume />
            <Button label="Receive" variant="secondary" onPress={() => router.push(ROUTES.receive)} />
            <EmptyState
              why="Live markets are on their way"
              detail="Up or Down calls on crypto and stocks arrive with the next update."
            />
          </>
        ) : (
          <EmptyState
            why="Call the next move"
            detail="Up or Down on live prices, in dollars."
            action={{ label: "Create account", onPress: () => router.push(accountRequiredRoute("make a call")) }}
          />
        )}
      </ScrollView>
      <ContextualFaceId key={address} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  utilities: {
    minHeight: SIZE.touch,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SIZE.gutter,
  },
  utilityActions: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  content: { paddingHorizontal: SIZE.gutter, gap: SPACE.md },
});

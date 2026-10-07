import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePullRefresh } from "~/components/kit/PullRefresh";
import { ArrowLeftRight } from "~/components/kit/symbols";
import { ContextTabs } from "~/components/shell/ContextTabs";
import { useDockInset } from "~/components/shell/dock-context";
import { ModeCapsule } from "~/components/shell/ModeCapsule";
import { AccountStrip } from "~/features/auth/AccountStrip";
import { CardFace } from "~/features/card/CardFace";
import { GuestHome } from "~/features/home/GuestHome";
import { HomeBalance } from "~/features/home/HomeHeader";
import { HomeTabs } from "~/features/home/HomeTabs";
import { TopTrades } from "~/features/home/TopTrades";
import { NotificationsBell } from "~/features/notifications/NotificationsBell";
import { RiskBanner } from "~/features/portfolio/RiskBanner";
import { ContextualFaceId } from "~/features/setup/ContextualFaceId";
import { SetupResume } from "~/features/setup/SetupResume";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** U04/U14 hierarchy, with genuine account data and all retained money/trading entry points. */
export default function Home() {
  const { open } = useLocalSearchParams<{ open?: string }>();
  const address = useAccount().hint?.address;
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useDockInset();
  const refresh = usePullRefresh();
  useEffect(() => {
    if (open !== "add-money") return;
    router.setParams({ open: undefined });
    router.push(ROUTES.addMoney);
  }, [open]);
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
            <HomeBalance />
            <SetupResume />
            <AccountStrip />
            <RiskBanner />
            <View style={[styles.portfolio, { backgroundColor: color.card }]}>
              <View style={styles.portfolioHeading}>
                <View style={styles.text}>
                  <Text style={[TYPE.rowTitle, { color: color.ink }]}>Your portfolio</Text>
                  <Text style={[TYPE.rowDetail, { color: color.text3 }]}>Assets and open positions</Text>
                </View>
                <Pressable
                  onPress={() => router.navigate(ROUTES.markets)}
                  accessibilityRole="button"
                  style={[styles.trade, { backgroundColor: color.action, boxShadow: `0px 0px 16px 0px ${color.glow}` }]}
                >
                  <Text style={[TYPE.buttonCompact, { color: color.actionInk }]}>Trade</Text>
                </Pressable>
              </View>
              <HomeTabs />
            </View>
            <Pressable
              onPress={() => router.push(ROUTES.transfer)}
              accessibilityRole="button"
              style={[styles.transfer, { backgroundColor: color.card }]}
            >
              <ArrowLeftRight size={SIZE.icon} color={color.ink} />
              <Text style={[TYPE.rowTitle, { color: color.ink }]}>Send, receive or swap</Text>
            </Pressable>
            <Text accessibilityRole="header" style={[TYPE.rowTitle, styles.more, { color: color.ink }]}>
              More for you
            </Text>
            <Pressable
              onPress={() => router.navigate(ROUTES.card)}
              accessibilityRole="button"
              accessibilityLabel="Explore Kinpaku card"
              style={[styles.card, { backgroundColor: color.card }]}
            >
              <Text style={[TYPE.rowDetail, { color: color.text2 }]}>Kinpaku</Text>
              <Text style={[TYPE.sectionTitle, { color: color.ink }]}>Your card, connected.</Text>
              <CardFace />
            </Pressable>
            <TopTrades />
          </>
        ) : (
          <GuestHome />
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
  portfolio: { borderRadius: 30, padding: SPACE.lg, gap: SPACE.md },
  portfolioHeading: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  text: { flex: 1, gap: SPACE.xs },
  trade: { borderRadius: RADIUS.pill, minHeight: SIZE.touch, paddingHorizontal: SPACE.lg, justifyContent: "center" },
  transfer: {
    borderRadius: RADIUS.lg,
    flexDirection: "row",
    alignItems: "center",
    padding: SPACE.lg,
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
  },
  more: { paddingTop: SPACE.lg },
  card: { borderRadius: 30, padding: SPACE.lg, gap: SPACE.sm },
});

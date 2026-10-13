/**
 * Home (S5.10): the balance rolling, the one-tap chip, your open positions live with their Cash out (R5.3) and the
 * live markets to call on. A guest gets the promise, one way in and the same live markets to look around (R2 sim pass:
 * "Look around" used to land on the promise alone). Setup resume and the Face ID prompt stay on Home. Search floats
 * above the dock (R6.9, UGLYCASH U10).
 */

import { useLiveBook } from "@senryo/calls/react";
import { formatUnits } from "@senryo/core";
import { marketKeys, useCatalog, useMarketAccount } from "@senryo/query";
import { useFont } from "@shopify/react-native-skia";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import Animated, { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/kit/Button";
import { type LiveFigure, LiveOdometer } from "~/components/kit/LiveOdometer";
import { usePullRefresh } from "~/components/kit/PullRefresh";
import { EmptyState } from "~/components/kit/states";
import { useDockInset } from "~/components/shell/dock-context";
import { ModeCapsule } from "~/components/shell/ModeCapsule";
import { MarketRow } from "~/features/markets/MarketRow";
import { RoundClock } from "~/features/markets/RoundClock";
import { NotificationsBell } from "~/features/notifications/NotificationsBell";
import { PositionsList } from "~/features/positions/PositionsList";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { SearchLauncher, useLauncherInset } from "~/features/search/SearchLauncher";
import { useLauncherScroll } from "~/features/search/useLauncher";
import { ContextualFaceId } from "~/features/setup/ContextualFaceId";
import { SetupResume } from "~/features/setup/SetupResume";
import { fire } from "~/feedback/fire";
import { useAppTrader } from "~/lib/account/guest";
import { accountRequiredRoute } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { OneTapChip } from "./OneTapChip";

const BALANCE_SIZE = 44;
const BALANCE_HEIGHT = 56;
const DOLLAR_DECIMALS = 6;
const CENTS = 2;

export function HomeScreen() {
  // The passkey account, else a Practice guest who has started (R5.10): its balance and positions show here too.
  const trader = useAppTrader();
  const address = trader.owner;
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  // The floating search sits above the dock: the last row scrolls clear of both (R6.9).
  const dockInset = useDockInset();
  const launcherInset = useLauncherInset();
  const bottom = Math.max(dockInset, launcherInset);
  // Reading down tucks the launcher behind the dock; scrolling up brings it back (the owner's review, 13 Oct).
  const launcher = useLauncherScroll();
  // Pull down refreshes everything on Home, as on Markets and Calls (D4: Home was the one tab that couldn't).
  const refresh = usePullRefresh();
  const account = useMarketAccount(address);
  const book = useLiveBook();
  const catalog = useCatalog();
  const client = useQueryClient();
  const [, setSymbol] = useMMKVString(STORAGE_KEYS.terminalSymbol, storage);
  const font = useFont(require("../../../assets/fonts/InterDisplay-SemiBold.ttf"), BALANCE_SIZE);
  const balance = useSharedValue<LiveFigure>({ text: "$—", trend: 0 });
  const previous = useRef<bigint | undefined>(undefined);
  const value = "value" in account ? account.value.balance : undefined;
  useEffect(() => {
    if (value === undefined) return;
    const was = previous.current;
    previous.current = value;
    balance.value = {
      text: `$${formatUnits(value, DOLLAR_DECIMALS, CENTS)}`,
      trend: was === undefined || was === value ? 0 : value > was ? 1 : -1,
    };
  }, [value, balance]);

  const watch = (symbol: string) => {
    fire("tick");
    setSymbol(symbol);
    router.navigate("/trade");
  };

  const markets = (heading: string) => (
    <View style={styles.section}>
      <SectionHeading>{heading}</SectionHeading>
      <RoundClock />
      {"value" in catalog ? (
        catalog.value.markets.map((m) => (
          <MarketRow key={m.symbol} symbol={m.symbol} name={m.name} onOpen={() => watch(m.symbol)} />
        ))
      ) : catalog.status === "failed" ? (
        <Button
          label="Markets didn't load · Try again"
          variant="ghost"
          onPress={() => void client.invalidateQueries({ queryKey: marketKeys.all })}
        />
      ) : null}
    </View>
  );

  return (
    <View style={[styles.fill, { backgroundColor: color.ground, paddingTop: insets.top }]}>
      <View style={styles.utilities}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>Senryo</Text>
        <View style={styles.utilityActions}>
          <ModeCapsule compact />
          <NotificationsBell />
        </View>
      </View>
      <Animated.ScrollView
        refreshControl={refresh}
        onScroll={launcher.onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingBottom: bottom }]}
      >
        {address ? (
          <>
            <View style={styles.hero}>
              <Text style={[TYPE.caption, { color: color.inkMuted }]}>Balance</Text>
              <LiveOdometer
                source={balance}
                font={font}
                color={color.ink}
                height={BALANCE_HEIGHT}
                sensitive
                accessibilityLabel={
                  value === undefined ? "Balance" : `Balance $${formatUnits(value, DOLLAR_DECIMALS, CENTS)}`
                }
              />
              {trader.guest ? (
                <Button
                  label="Make a passkey to keep it"
                  variant="secondary"
                  size="sm"
                  block={false}
                  onPress={() => router.push(accountRequiredRoute("keep your test dollars"))}
                />
              ) : (
                <OneTapChip />
              )}
            </View>
            <SetupResume />
            {book.entries.length > 0 || book.parlays > 0 ? (
              <View style={styles.section}>
                <SectionHeading>Open positions</SectionHeading>
                <PositionsList empty="none" />
              </View>
            ) : null}
            {markets("Call the next move")}
          </>
        ) : (
          <>
            <EmptyState
              why="Call the next move"
              detail="Up or Down on live prices. Practice needs no sign-up: pick one."
              action={{ label: "Make a call", onPress: () => watch("BTC") }}
            />
            {markets("Markets")}
          </>
        )}
      </Animated.ScrollView>
      <SearchLauncher shown={launcher.shown} />
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
  content: { paddingHorizontal: SIZE.gutter, gap: SPACE.lg },
  hero: { gap: SPACE.sm, paddingTop: SPACE.md },
  section: { gap: SPACE.xs },
});

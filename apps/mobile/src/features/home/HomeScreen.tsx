/**
 * Home (S5.10): the balance rolling, the one-tap chip, your open calls (tap to watch them in the terminal) and the live
 * markets to call on. A guest gets the promise and one way in. Setup resume and the Face ID prompt stay on Home.
 */
import { formatUnits } from "@senryo/core";
import { marketKeys, useCatalog, useMarketAccount, useTickets } from "@senryo/query";
import { useFont } from "@shopify/react-native-skia";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "~/components/kit/Button";
import { type LiveFigure, LiveOdometer } from "~/components/kit/LiveOdometer";
import { EmptyState } from "~/components/kit/states";
import { useDockInset } from "~/components/shell/dock-context";
import { ModeCapsule } from "~/components/shell/ModeCapsule";
import { MarketRow } from "~/features/markets/MarketsScreen";
import { NotificationsBell } from "~/features/notifications/NotificationsBell";
import { SectionHeading } from "~/features/profile/SectionHeading";
import { ContextualFaceId } from "~/features/setup/ContextualFaceId";
import { SetupResume } from "~/features/setup/SetupResume";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { accountRequiredRoute } from "~/lib/constants/routes";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { OneTapChip } from "./OneTapChip";

const BALANCE_SIZE = 44;
const BALANCE_HEIGHT = 56;
const DOLLAR_DECIMALS = 6;
const CENTS = 2;
const OPEN = new Set(["committed", "open", "closing"]);

export function HomeScreen() {
  const address = useAccount().hint?.address;
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useDockInset();
  const account = useMarketAccount(address);
  const tickets = useTickets(address);
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

  const open = "value" in tickets ? tickets.value.tickets.filter((t) => OPEN.has(t.state)) : [];
  const watch = (symbol: string) => {
    fire("tick");
    setSymbol(symbol);
    router.navigate("/trade");
  };

  return (
    <View style={[styles.fill, { backgroundColor: color.ground, paddingTop: insets.top }]}>
      <View style={styles.utilities}>
        <Text style={[TYPE.rowTitle, { color: color.ink }]}>Senryo</Text>
        <View style={styles.utilityActions}>
          <ModeCapsule compact />
          <NotificationsBell />
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom }]}>
        {address ? (
          <>
            <View style={styles.hero}>
              <Text style={[TYPE.caption, { color: color.inkMuted }]}>Balance</Text>
              <LiveOdometer
                source={balance}
                font={font}
                color={color.ink}
                height={BALANCE_HEIGHT}
                accessibilityLabel={
                  value === undefined ? "Balance" : `Balance $${formatUnits(value, DOLLAR_DECIMALS, CENTS)}`
                }
              />
              <OneTapChip />
            </View>
            <SetupResume />
            {open.length > 0 ? (
              <View style={styles.section}>
                <SectionHeading>Open calls</SectionHeading>
                {open.map((t) => (
                  <MarketRow
                    key={String(t.ticketId)}
                    symbol={t.symbol}
                    name={`Pays $${formatUnits(t.payout, DOLLAR_DECIMALS, CENTS)} if right`}
                    onOpen={() => watch(t.symbol)}
                  />
                ))}
              </View>
            ) : null}
            <View style={styles.section}>
              <SectionHeading>Call the next move</SectionHeading>
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
  content: { paddingHorizontal: SIZE.gutter, gap: SPACE.lg },
  hero: { gap: SPACE.sm, paddingTop: SPACE.md },
  section: { gap: SPACE.xs },
});

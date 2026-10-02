/**
 * Market detail's sticky bottom (Fomo F32/F35; flow book C2 step 5): when the market isn't open, or the engine is
 * paused, a one-line state banner sits above the buttons; then Short (red, left) and Long (green, right), 54 pt with
 * 12 pt corners, each opening the ticket on its side — the buttons stay live and the ticket names any blocker. The
 * terms gate runs first (A11: terms sheet once per account; a guest gets the account sheet carrying the ticket), then
 * the first Mainnet ticket per account passes eligibility. A market that can't trade here gets one disabled row
 * with a lock and its word instead.
 */
import type { MarketStatus } from "@senryo/core";
import { type Href, router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Info, Lock } from "~/components/kit/symbols";
import { usePressScale } from "~/components/kit/usePressScale";
import { hasConfirmedEligibility } from "~/features/legal/eligibility";
import { ProtocolBanner, SessionBanner } from "~/features/markets/MarketBanners";
import { fire } from "~/feedback/fire";
import { useAccount } from "~/lib/account/provider";
import { useTermsGate } from "~/lib/account/terms-gate";
import { ROUTES, type TicketSide, ticketRoute } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { BUTTON, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** Fomo F32 measures the sticky buttons at 54 pt (inside the 52–56 pt band). */
const SIDE_HEIGHT = 54;
const PRESSED = 0.85;

function Bottom({ children }: { children: ReactNode }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bottom, { paddingBottom: insets.bottom + SPACE.sm, backgroundColor: color.ground }]}>
      {children}
    </View>
  );
}

export function SideBar({
  symbol,
  status,
  calendarId,
}: {
  symbol: string;
  status: MarketStatus | undefined;
  calendarId: number;
}) {
  const network = useNetwork();
  const address = useAccount().hint?.address;
  const gate = useTermsGate();
  const open = (side: TicketSide) => {
    fire("press");
    const ticket = ticketRoute(symbol, side);
    gate(
      () => {
        // FT101 / M13: real money asks once per account, before its first ticket; Practice never does.
        if (network.key === "mainnet" && address && !hasConfirmedEligibility(address)) {
          router.push(`${ROUTES.eligibility}?next=${encodeURIComponent(ticket)}` as Href);
          return;
        }
        router.push(ticket);
      },
      { verb: "trade", next: ticket },
    );
  };
  return (
    <Bottom>
      <ProtocolBanner />
      {status ? <SessionBanner status={status} calendarId={calendarId} symbol={symbol} /> : null}
      <View style={styles.sides}>
        <SideButton side="short" symbol={symbol} onPress={() => open("short")} />
        <SideButton side="long" symbol={symbol} onPress={() => open("long")} />
      </View>
    </Bottom>
  );
}

function SideButton({ side, symbol, onPress }: { side: TicketSide; symbol: string; onPress: () => void }) {
  const { color } = useTheme();
  const press = usePressScale();
  const long = side === "long";
  const word = long ? "Long" : "Short";
  return (
    <Animated.View style={[styles.flex, press.style]}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${word} ${symbol}`}
        accessibilityHint="Opens the order ticket"
        style={({ pressed }) => [
          styles.side,
          { backgroundColor: long ? color.up : color.down, opacity: pressed ? PRESSED : 1 },
        ]}
      >
        <Text style={[TYPE.buttonLabel, { color: long ? color.upForeground : color.downForeground }]}>{word}</Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * The bar of a market that can't trade here (flow book C2 step 6): one disabled row — a lock and its word ("Opening
 * soon", "Mainnet", "No feed") — and, when `onInfo` is given, an ⓘ that opens the reason.
 */
export function LockedBar({ word, onInfo }: { word: string; onInfo?: () => void }) {
  const { color } = useTheme();
  return (
    <Bottom>
      <Pressable
        disabled={!onInfo}
        onPress={() => {
          fire("tick");
          onInfo?.();
        }}
        accessibilityRole={onInfo ? "button" : "text"}
        accessibilityLabel={`Trading locked: ${word}`}
        {...(onInfo ? { accessibilityHint: "Says why" } : {})}
        style={[styles.locked, { backgroundColor: color.card }]}
      >
        <Lock size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} />
        <Text style={[TYPE.buttonLabel, { color: color.text3 }]}>{word}</Text>
        {onInfo ? <Info size={SIZE.iconSm} strokeWidth={SIZE.iconStroke} color={color.text3} /> : null}
      </Pressable>
    </Bottom>
  );
}

const styles = StyleSheet.create({
  bottom: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm, gap: SPACE.sm },
  sides: { flexDirection: "row", gap: SPACE.md },
  flex: { flex: 1 },
  side: { height: SIDE_HEIGHT, borderRadius: BUTTON.radius.md, alignItems: "center", justifyContent: "center" },
  locked: {
    height: SIDE_HEIGHT,
    borderRadius: BUTTON.radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.sm,
  },
});

import { router, Stack, useLocalSearchParams } from "expo-router";
import { type RefObject, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { useDockInset, useHideDockWhileFocused } from "./dock-context";
import { registerList } from "./probe";

/**
 * S1b.7 navigation spike (D-193) screens: each tab is its own Expo Router stack (list → detail page push), the list is
 * long enough to test scroll restoration, and Home's detail opens a transaction-entry screen that hides the dock.
 * Dev-only (`app/dev-shell-spike`, never linked from the app).
 */
export const SPIKE_ROOT = "/dev-shell-spike";
export const SPIKE_TABS = ["home", "markets", "card", "social", "you"] as const;
export type SpikeTab = (typeof SPIKE_TABS)[number];
const LABEL: Record<SpikeTab, string> = {
  home: "Home",
  markets: "Markets",
  card: "Card",
  social: "Social",
  you: "You",
};

const ROW_COUNT = 40;
/** The row whose window position proves scroll restoration (it sits well below the first screen). */
export const PROBE_ROW = 20;
const ROWS = Array.from({ length: ROW_COUNT }, (_, i) => i + 1);

const measureTop = (ref: RefObject<View | null>) =>
  new Promise<number>((resolve) => ref.current?.measureInWindow((_x, y) => resolve(y)));
const measureBottom = (ref: RefObject<View | null>) =>
  new Promise<number>((resolve) => ref.current?.measureInWindow((_x, y, _w, h) => resolve(y + h)));

export function SpikeStack() {
  return <Stack screenOptions={{ headerShown: false, animation: "default" }} />;
}

/** Each tab's route file passes its own tab (segments are global: they name the focused route, not this screen's). */
export function SpikeList({ tab }: { tab: SpikeTab }) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useDockInset();
  const scrollRef = useRef<ScrollView>(null);
  const probeRef = useRef<View>(null);
  const lastRef = useRef<View>(null);
  const [offset, setOffset] = useState(0);
  useEffect(
    () =>
      registerList(tab, {
        scrollTo: (y) => scrollRef.current?.scrollTo({ y, animated: false }),
        scrollToEnd: () => scrollRef.current?.scrollToEnd({ animated: false }),
        probeRowY: () => measureTop(probeRef),
        lastRowBottom: () => measureBottom(lastRef),
      }),
    [tab],
  );
  return (
    <ScrollView
      ref={scrollRef}
      onScroll={(e) => setOffset(e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={SPIKE_SCROLL_THROTTLE_MS}
      style={{ backgroundColor: color.ground }}
      contentContainerStyle={{
        paddingTop: insets.top + SPACE.lg,
        paddingBottom: bottom,
        paddingHorizontal: SPACE.inset,
      }}
    >
      <Text style={[TYPE.pageTitle, { color: color.ink }]}>{LABEL[tab]}</Text>
      <Text style={[TYPE.meta, styles.meta, { color: color.text3 }]}>
        Shell spike · {LABEL[tab]} stack · scroll offset {Math.round(offset)} pt
      </Text>
      {ROWS.map((n) => (
        <Pressable
          key={n}
          ref={n === PROBE_ROW ? probeRef : n === ROW_COUNT ? lastRef : undefined}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: `${SPIKE_ROOT}/${tab}/detail`, params: { row: String(n) } })}
          style={({ pressed }) => [
            styles.row,
            { backgroundColor: pressed ? color.rowPressed : color.card, borderColor: color.border },
          ]}
        >
          <Text style={[TYPE.row, { color: color.ink }]}>Row {n}</Text>
          <Text style={[TYPE.meta, { color: n === PROBE_ROW ? color.link : color.text3 }]}>
            {n === PROBE_ROW ? "Probe row" : "Push detail"}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function SpikeDetail({ tab }: { tab: SpikeTab }) {
  const { row } = useLocalSearchParams<{ row?: string }>();
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, { backgroundColor: color.ground, paddingTop: insets.top + SPACE.lg }]}>
      <Text style={[TYPE.pageTitle, { color: color.ink }]}>Detail · row {row ?? "?"}</Text>
      <Text style={[TYPE.body, { color: color.text2 }]}>
        Pushed on the {LABEL[tab]} stack. Switch tabs and come back: this page should still be here.
      </Text>
      <SpikeButton label="Back" onPress={() => router.back()} />
      {tab === "home" ? (
        <SpikeButton label="Open transaction entry" onPress={() => router.push(`${SPIKE_ROOT}/home/ticket`)} />
      ) : null}
    </View>
  );
}

export function SpikeTicket() {
  useHideDockWhileFocused("ticket");
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, { backgroundColor: color.popover, paddingTop: insets.top + SPACE.lg }]}>
      <Text style={[TYPE.sheetTitle, { color: color.ink }]}>Transaction entry</Text>
      <Text style={[TYPE.body, { color: color.text2 }]}>The dock hides while a transaction is being entered.</Text>
      <SpikeButton label="Back" onPress={() => router.back()} />
    </View>
  );
}

function SpikeButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { color } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: pressed ? color.primaryPressed : color.primary }]}
    >
      <Text style={[TYPE.buttonLabel, { color: color.primaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

const SPIKE_SCROLL_THROTTLE_MS = 16;

const styles = StyleSheet.create({
  meta: { marginBottom: SPACE.lg },
  row: {
    minHeight: SIZE.rowMinHeight,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: SPACE.lg,
    marginBottom: SPACE.sm,
    justifyContent: "center",
    gap: SPACE.xxs,
  },
  page: { flex: 1, paddingHorizontal: SPACE.inset, gap: SPACE.lg },
  button: {
    height: SIZE.buttonHeight,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});

/**
 * Home's body (flow book §0.9 Home): Positions · Assets · Earn as underline tabs (Fomo F09's Watchlist / Tokens /
 * Perps grammar) instead of stacked boxed sections. The chosen tab is a per-viewer convenience kept on the device.
 */
import { ids } from "@senryo/identity";
import { useLpVault } from "@senryo/query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { EntityMark } from "~/components/identity/EntityMark";
import { UnderlineTabs } from "~/components/kit/UnderlineTabs";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { CONTROL_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";
import { AssetsTab } from "./AssetsTab";
import { PositionsSection } from "./PositionsSection";

type HomeTab = "positions" | "assets" | "earn";
const TABS: readonly { value: HomeTab; label: string }[] = [
  { value: "positions", label: "Positions" },
  { value: "assets", label: "Assets" },
  { value: "earn", label: "Earn" },
];

function savedTab(): HomeTab {
  const v = storage.getString(STORAGE_KEYS.homeTab);
  return v === "assets" || v === "earn" ? v : "positions";
}

export function HomeTabs() {
  const [tab, setTab] = useState<HomeTab>(savedTab);
  return (
    <View style={styles.wrap}>
      <UnderlineTabs
        options={TABS}
        value={tab}
        onChange={(next) => {
          setTab(next);
          storage.set(STORAGE_KEYS.homeTab, next);
        }}
        label="Home sections"
      />
      <Animated.View key={tab} entering={FadeIn}>
        {tab === "positions" ? <PositionsSection bare /> : tab === "assets" ? <AssetsTab /> : <EarnTab />}
      </Animated.View>
    </View>
  );
}

function EarnTab() {
  const { color } = useTheme();
  const vault = useLpVault(useAccount().hint?.address);
  const value = vault.status === "fresh" || vault.status === "stale" ? vault.value : undefined;
  const invested = value ? value.sharesValue + value.pendingValue : 0n;
  if (!value || invested === 0n)
    return (
      <QuietLine action={{ label: "Deposit", onPress: () => router.push(ROUTES.lp) }}>Earn from the pool</QuietLine>
    );
  return (
    <Pressable
      onPress={() => router.push(ROUTES.lp)}
      accessibilityRole="button"
      accessibilityLabel={`Senryo pool, ${usd(invested)} invested`}
      style={styles.row}
    >
      <EntityMark id={ids.brand("senryo")} size={SIZE.markDetail} variant="symbol" decorative />
      <View style={styles.text}>
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowTitle, { color: color.ink }]}>
          Senryo pool
        </Text>
        <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowDetail, { color: color.text2 }]}>
          {value.pending.length > 0 ? "Redemption pending" : "Earns from trading"}
        </Text>
      </View>
      <Text maxFontSizeMultiplier={CONTROL_FONT_SCALE} style={[TYPE.rowAmount, { color: color.ink }]}>
        {usd(invested)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    paddingVertical: SPACE.sm,
  },
  text: { flex: 1, gap: SPACE.xxs },
});

import { ids } from "@senryo/identity";
import { usePortfolio } from "@senryo/query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { Skeleton } from "~/components/kit/states";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { HERO_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

const MS_PER_SECOND = 1000;
const UPDATED_THRESHOLD_SEC = 5;

export function HomeSeal() {
  const { color } = useTheme();
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Senryo home">
      <EntityMark id={ids.brand("senryo")} size={SIZE.avatarSm} variant="symbol" decorative ground={color.ground} />
    </View>
  );
}
export function CompactBalance() {
  const { color } = useTheme();
  const portfolio = usePortfolio(useAccount().hint?.address);
  if (portfolio.status !== "fresh" && portfolio.status !== "stale") return null;
  if (!portfolio.value.components.some((c) => c.supported !== false && c.valueUsd6 !== undefined)) return null;
  return (
    <Text style={[TYPE.rowAmount, { color: color.ink }]} numberOfLines={1}>
      {portfolio.value.quality === "partial" ? "≈ " : ""}
      {usd(portfolio.value.totalUsd6)}
    </Text>
  );
}
export function ExpandedBalance() {
  const { color } = useTheme();
  const address = useAccount().hint?.address;
  const portfolio = usePortfolio(address);
  if (!address) return null;
  const known = portfolio.status === "fresh" || portfolio.status === "stale" ? portfolio.value : undefined;
  const age = known ? Math.max(0, Math.floor(Date.now() / MS_PER_SECOND) - Number(known.timestamp)) : 0;
  const available = known?.components.some((c) => c.supported !== false && c.valueUsd6 !== undefined);
  return (
    <View style={styles.hero}>
      <Pressable
        onPress={() => router.push(ROUTES.balanceDetails)}
        accessibilityRole="button"
        accessibilityLabel="Total portfolio. Open valuation details."
        style={styles.amounts}
      >
        <Text style={[TYPE.rowDetail, { color: color.text2 }]}>Total portfolio</Text>
        {known && available ? (
          <Text
            maxFontSizeMultiplier={HERO_FONT_SCALE}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
            numberOfLines={1}
            style={[TYPE.displayBalance, { color: color.ink }]}
          >
            {usd(known.totalUsd6)}
          </Text>
        ) : portfolio.status === "failed" || (known && !available) ? (
          <Text style={[TYPE.row, { color: color.text3 }]}>Balance unavailable</Text>
        ) : (
          <Skeleton width={200} height={SIZE.skeletonRow} />
        )}
        <Text style={[TYPE.meta, { color: color.text3 }]}>
          {known?.quality === "partial"
            ? "Partial · View details"
            : portfolio.status === "stale"
              ? "Updated earlier · View details"
              : age > UPDATED_THRESHOLD_SEC
                ? `Updated ${age}s ago · View details`
                : "Estimated value · View details"}
        </Text>
      </Pressable>
      <View style={styles.actions}>
        <Button label="Add money" style={styles.grow} onPress={() => router.push(ROUTES.addMoney)} />
        <Button label="Withdraw" variant="outline" style={styles.grow} onPress={() => router.push(ROUTES.withdraw)} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  hero: { gap: SPACE.lg, paddingTop: SPACE.sm, paddingBottom: SPACE.lg },
  amounts: { gap: SPACE.xs },
  actions: { flexDirection: "row", gap: SPACE.sm },
  grow: { flex: 1 },
});

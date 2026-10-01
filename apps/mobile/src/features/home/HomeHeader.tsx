import { RISK } from "@senryo/core";
import { ids } from "@senryo/identity";
import { useAccountRisk, useEquityHistory } from "@senryo/query";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Button } from "~/components/kit/Button";
import { Skeleton } from "~/components/kit/states";
import { DAY_SEC } from "~/features/portfolio/constants";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { arrow, signedPct, signedUsd, usd } from "~/lib/money";
import { HERO_FONT_SCALE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * Home's collapsing header pieces (C16/C19, FT069/FT073; Codex S1b.7 consult #9). The bar keeps the 千 seal and — once
 * collapsed — the compact balance; the expanded block is the "Risk-adjusted balance" with its sourced 24 h change
 * ("24h —" when unknown) and the primary Add money pill (Fomo's Deposit, F09). Unknown balances are skeletons, never
 * $0.00 (D-020).
 */
const SEAL = ids.brand("senryo");

export function HomeSeal() {
  const { color } = useTheme();
  return (
    <View accessible accessibilityRole="header" accessibilityLabel="Senryo home">
      <EntityMark id={SEAL} size={SIZE.avatarSm} variant="symbol" decorative ground={color.ground} />
    </View>
  );
}

function useBalance() {
  const address = useAccount().hint?.address;
  const risk = useAccountRisk(address, "finalized");
  const day = useEquityHistory(address, DAY_SEC);
  const equity = risk.status === "fresh" || risk.status === "stale" ? risk.value.equityInit : undefined;
  const first = day.status === "fresh" || day.status === "stale" ? day.value[0] : undefined;
  const change = first && equity !== undefined ? equity - first.equityInit : undefined;
  const changeBps =
    first && first.equityInit > 0n && change !== undefined ? (change * RISK.BPS) / first.equityInit : undefined;
  return { address, equity, change, changeBps };
}

/** The collapsed bar's balance. Nothing until the balance is known. */
export function CompactBalance() {
  const { color } = useTheme();
  const { equity } = useBalance();
  if (equity === undefined) return null;
  return (
    <Text style={[TYPE.rowAmount, { color: color.ink }]} numberOfLines={1}>
      {usd(equity)}
    </Text>
  );
}

export function ExpandedBalance() {
  const { color } = useTheme();
  const { address, equity, change, changeBps } = useBalance();
  if (!address) return null;
  return (
    <View style={styles.hero}>
      <View style={styles.amounts}>
        <Text style={[TYPE.meta, { color: color.text3 }]}>Risk-adjusted balance</Text>
        {equity === undefined ? (
          <Skeleton width="60%" height={TYPE.displayBalance.lineHeight ?? SIZE.skeletonPlate} />
        ) : (
          <Text
            maxFontSizeMultiplier={HERO_FONT_SCALE}
            adjustsFontSizeToFit
            numberOfLines={1}
            accessibilityLabel={`Risk-adjusted balance ${usd(equity)}`}
            style={[TYPE.displayBalance, { color: color.ink }]}
          >
            {usd(equity)}
          </Text>
        )}
        {change === undefined ? (
          <Text style={[TYPE.moneyMeta, { color: color.text3 }]}>24h —</Text>
        ) : (
          <Text style={[TYPE.moneyMeta, { color: change >= 0n ? color.up : color.down }]}>
            {arrow(change)} {signedUsd(change)}
            {changeBps === undefined ? "" : ` (${signedPct(changeBps)})`} · 24h
          </Text>
        )}
      </View>
      <Button label="Add money" block={false} onPress={() => router.push(ROUTES.addMoney)} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: "row", alignItems: "center", gap: SPACE.md, paddingTop: SPACE.sm, paddingBottom: SPACE.lg },
  amounts: { flex: 1, gap: SPACE.xxs },
});

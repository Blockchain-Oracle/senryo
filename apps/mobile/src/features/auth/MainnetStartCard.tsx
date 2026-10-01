/**
 * The Mainnet counterpart of the practice starter card (S8.24, D-179). Real money has no free drip (native drips need
 * a bot check, D-166), so the way in is a deposit. AUSD or USDC sent to the account's own inbox is credited by the
 * keeper, so no MON is needed. From MAINNET_TOPUP_MIN_EQUITY_USD6 of balance on, Senryo adds the gas for trades
 * (D-171). On Portfolio it hides once the account holds money (the balance is the proof).
 */
import { MAINNET_TOPUP_MIN_EQUITY_USD6 } from "@senryo/config";
import { useAccountRisk } from "@senryo/query";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Icon } from "~/components/kit/Icon";
import { useAccount } from "~/lib/account/provider";
import { fundQrRoute } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

export function MainnetStartCard({ hideWhenFunded = false }: { hideWhenFunded?: boolean }) {
  const { color } = useTheme();
  const account = useAccount();
  const risk = useAccountRisk(account.hint?.address);
  const known = risk.status === "fresh" || risk.status === "stale";
  // No flash: on Portfolio the card waits for the balance, then shows only to an account that holds nothing yet.
  if (hideWhenFunded && (!known || risk.value.equityInit > 0n)) return null;
  return (
    <View style={[styles.card, { borderColor: color.mainnet, backgroundColor: color.mainnetWash }]}>
      <View style={styles.head}>
        <View style={styles.title}>
          <Icon name="coins" size={SIZE.iconSm} tint={color.mainnet} />
          <Text style={[TYPE.label, { color: color.ink }]}>START WITH REAL MONEY</Text>
        </View>
        <Text style={[TYPE.micro, styles.pill, { color: color.mainnet, borderColor: color.mainnet }]}>MAINNET</Text>
      </View>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        Deposit AUSD or USDC from any Monad wallet or exchange. You don't need MON: Senryo credits the deposit, and once
        your balance reaches {usd(MAINNET_TOPUP_MIN_EQUITY_USD6)} it adds the gas for your trades.
      </Text>
      <Button label="Deposit" variant="outline" onPress={() => router.navigate(fundQrRoute("monad"))} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm, padding: SPACE.md, gap: SPACE.sm },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  pill: { borderWidth: HAIRLINE_PX, borderRadius: RADIUS.sm, paddingHorizontal: SPACE.xs, paddingVertical: SPACE.xxs },
});

/**
 * The Mainnet counterpart of the practice starter card (S8.24, D-179). Real money has no free drip (native drips need
 * a bot check, D-166), so the way in is a deposit. AUSD or USDC sent to the account's own inbox is credited by the
 * keeper, so no MON is needed. From MAINNET_TOPUP_MIN_EQUITY_USD6 of balance on, Senryo adds the gas for trades
 * (D-171). On Portfolio it hides once the account holds money (the balance is the proof). A mainnet wash card: filled,
 * 20 pt corners, no border.
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
import { SHEET_SHAPE, SIZE, SPACE, TYPE, useTheme } from "~/theme";

export function MainnetStartCard({ hideWhenFunded = false }: { hideWhenFunded?: boolean }) {
  const { color } = useTheme();
  const account = useAccount();
  const risk = useAccountRisk(account.hint?.address);
  const known = risk.status === "fresh" || risk.status === "stale";
  // No flash: on Portfolio the card waits for the balance, then shows only to an account that holds nothing yet.
  if (hideWhenFunded && (!known || risk.value.equityInit > 0n)) return null;
  return (
    <View style={[styles.card, { backgroundColor: color.mainnetWash }]}>
      <View style={styles.head}>
        <View style={styles.title}>
          <Icon name="coins" size={SIZE.iconSm} tint={color.mainnet} />
          <Text style={[TYPE.rowTitle, { color: color.ink }]}>Start with real money</Text>
        </View>
        <Text style={[TYPE.label, { color: color.mainnet }]}>Mainnet</Text>
      </View>
      <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
        Deposit AUSD or USDC from any Monad wallet or exchange. You don't need MON: Senryo credits the deposit, and once
        your balance reaches {usd(MAINNET_TOPUP_MIN_EQUITY_USD6)} it adds the gas for your trades.
      </Text>
      <Button label="Deposit" variant="outline" onPress={() => router.navigate(fundQrRoute("monad"))} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: SHEET_SHAPE.rowRadius, padding: SPACE.lg, gap: SPACE.md },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACE.sm },
  title: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, flexShrink: 1 },
});

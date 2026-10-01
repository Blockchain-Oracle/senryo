import { useAccountRisk } from "@senryo/query";
import { router, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { ReadingView } from "~/components/kit/states";
import { PrelaunchMainnet } from "~/features/network/PrelaunchMainnet";
import { WithdrawToSelf } from "~/features/withdraw/WithdrawToSelf";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork, useReadOnlyNetwork } from "~/lib/network";
import { SPACE, TYPE, useTheme } from "~/theme";

/**
 * Withdraw (J2): out of the account to your own wallet — the same passkey holds it. Sending to someone else is the
 * Send page (a fresh passkey check), one tap away; cash-out to another chain arrives with intents (Aurora, S9).
 */
export default function WithdrawScreen() {
  const { color } = useTheme();
  const network = useNetwork();
  const readOnly = useReadOnlyNetwork();
  const address = useAccount().hint?.address;
  const risk = useAccountRisk(address, "latest");
  const practice = network.key === "testnet";
  return (
    <Screen contentStyle={styles.page}>
      <Stack.Screen options={{ title: "Withdraw" }} />
      <Text style={[TYPE.rowDetail, { color: practice ? color.practice : color.mainnet }]}>
        {practice ? "Practice · Paper money" : "Mainnet · Real money"} · {network.name}
      </Text>
      {readOnly ? (
        <PrelaunchMainnet surface="portfolio" />
      ) : !address ? (
        <View style={styles.quiet}>
          <Text style={[TYPE.body, { color: color.text2 }]}>Create an account to withdraw.</Text>
          <Button label="Create account" block={false} onPress={() => router.push(ROUTES.accountRequired)} />
        </View>
      ) : (
        <ReadingView reading={risk} loading="plate" loadingLabel="Reading what can leave">
          {(snapshot) => <WithdrawToSelf snapshot={snapshot} />}
        </ReadingView>
      )}
      {readOnly || !address ? null : (
        <Button
          label="Send to someone else"
          variant="ghost"
          size="sm"
          onPress={() => router.push(ROUTES.withdrawSend)}
        />
      )}
      <Text style={[TYPE.rowDetail, { color: color.text3 }]}>
        Sending to someone else asks for a fresh passkey check. Cash-out to another chain arrives with intents.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: SPACE.lg },
  quiet: { alignItems: "flex-start", gap: SPACE.md },
});

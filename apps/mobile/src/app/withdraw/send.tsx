import { useAccountRisk } from "@senryo/query";
import { router, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { ReadingView } from "~/components/kit/states";
import { PrelaunchMainnet } from "~/features/network/PrelaunchMainnet";
import { SendToAddress } from "~/features/withdraw/SendToAddress";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork, useReadOnlyNetwork } from "~/lib/network";
import { SPACE, TYPE, useTheme } from "~/theme";

/** Send (the fan's first action; FT058/C38): to an address or @handle, behind a fresh passkey check. */
export default function SendScreen() {
  const { color } = useTheme();
  const network = useNetwork();
  const readOnly = useReadOnlyNetwork();
  const address = useAccount().hint?.address;
  const risk = useAccountRisk(address, "latest");
  const practice = network.key === "testnet";
  return (
    <Screen contentStyle={styles.page}>
      <Stack.Screen options={{ title: "Send" }} />
      <Text style={[TYPE.rowDetail, { color: practice ? color.practice : color.mainnet }]}>
        {practice ? "Practice · Paper money" : "Mainnet · Real money"} · {network.name}
      </Text>
      {readOnly ? (
        <PrelaunchMainnet surface="portfolio" />
      ) : !address ? (
        <View style={styles.quiet}>
          <Text style={[TYPE.body, { color: color.text2 }]}>Create an account to send.</Text>
          <Button label="Create account" block={false} onPress={() => router.push(ROUTES.accountRequired)} />
        </View>
      ) : (
        <ReadingView reading={risk} loading="plate" loadingLabel="Reading what can leave">
          {(snapshot) => <SendToAddress snapshot={snapshot} />}
        </ReadingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: SPACE.lg },
  quiet: { alignItems: "flex-start", gap: SPACE.md },
});

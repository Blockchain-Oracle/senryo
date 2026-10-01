import { collateralId } from "@senryo/identity";
import { useAccountRisk } from "@senryo/query";
import { router, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { MarkedLine } from "~/components/identity/MarkedLine";
import { Button } from "~/components/kit/Button";
import { Screen } from "~/components/kit/Screen";
import { Panel } from "~/components/kit/Surface";
import { ReadingView } from "~/components/kit/states";
import { SwapTicket } from "~/features/fund/SwapTicket";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { usd } from "~/lib/money";
import { useNetwork, useReadOnlyNetwork } from "~/lib/network";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * Swap USDC ↔ AUSD inside the account (F26): the ticket on Mainnet. In Practice there is no AUSD/USDC pool on the
 * test network, so the page says so and shows what the account holds of each test token; before the Mainnet launch
 * it says when swaps open. A guest is asked to create an account first.
 */
export default function SwapScreen() {
  const { color } = useTheme();
  const network = useNetwork();
  const readOnly = useReadOnlyNetwork();
  const address = useAccount().hint?.address;
  const risk = useAccountRisk(address, "finalized");
  const practice = network.key === "testnet";
  return (
    <Screen contentStyle={styles.page}>
      <Stack.Screen options={{ title: "Swap" }} />
      <Text style={[TYPE.rowDetail, { color: practice ? color.practice : color.mainnet }]}>
        {practice ? "Practice · Paper money" : "Mainnet · Real money"} · {network.name}
      </Text>
      {!address ? (
        <View style={styles.quiet}>
          <Text style={[TYPE.body, styles.center, { color: color.text2 }]}>Create an account to swap.</Text>
          <Button label="Create account" block={false} onPress={() => router.push(ROUTES.accountRequired)} />
        </View>
      ) : readOnly ? (
        <Text style={[TYPE.body, { color: color.text2 }]}>Swaps open with Mainnet trading.</Text>
      ) : (
        <ReadingView reading={risk} loading="plate" loadingLabel="Reading your balances">
          {(snapshot) =>
            practice ? (
              <View style={styles.quietStack}>
                <Text style={[TYPE.body, { color: color.text2 }]}>
                  Swaps run on Mainnet, through the AUSD/USDC pool on Uniswap. The test network has no such pool, so
                  practice money stays in the test tokens you hold.
                </Text>
                <Panel style={styles.rows}>
                  <MarkedLine
                    id={collateralId(network.chainId, "AUSD")}
                    label="AUSD · test token"
                    value={usd(snapshot.ausd)}
                    size={SIZE.markToken}
                  />
                  <MarkedLine
                    id={collateralId(network.chainId, "USDC")}
                    label="USDC · test token"
                    value={usd(snapshot.usdc)}
                    size={SIZE.markToken}
                  />
                </Panel>
              </View>
            ) : (
              <SwapTicket snapshot={snapshot} />
            )
          }
        </ReadingView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { gap: SPACE.lg },
  quiet: { alignItems: "center", gap: SPACE.md, paddingTop: SPACE.xl },
  quietStack: { gap: SPACE.lg },
  center: { textAlign: "center" },
  rows: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.sm },
});

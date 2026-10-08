import { ids } from "@senryo/identity";
import { parseSavedDeposits } from "@senryo/query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { Button } from "~/components/kit/Button";
import { DepositAddress } from "~/features/fund/DepositAddress";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useNetwork } from "~/lib/network";
import { STORAGE_KEYS, storage } from "~/lib/storage";
import { SIZE, SPACE, TYPE, useTheme } from "~/theme";
/** Reopening a saved address only reconciles that original provider route; it never requests a new one. */
export default function SavedDepositScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const owner = useAccount().hint?.address.toLowerCase();
  const chainId = useNetwork().chainId;
  const { color } = useTheme();
  const [raw] = useMMKVString(STORAGE_KEYS.depositAddresses, storage);
  const deposit = parseSavedDeposits(raw).find(
    (d) =>
      (d.depositAddress.toLowerCase() === id?.toLowerCase() ||
        `${d.fromChain}:${d.depositAddress}`.toLowerCase() === id?.toLowerCase()) &&
      d.account === owner &&
      d.chainId === chainId,
  );
  return (
    <ScrollView contentContainerStyle={[styles.body, { backgroundColor: color.ground }]}>
      <Stack.Screen options={{ title: "Saved deposit" }} />
      {deposit ? (
        <DepositAddress
          deposit={deposit}
          chainName={deposit.sourceName ?? `Chain ${deposit.fromChain}`}
          chainMark={deposit.sourceMark ?? ids.evmChain(deposit.fromChain)}
          onInfo={() => router.push(`${ROUTES.addMoney}?panel=chain`)}
        />
      ) : (
        <>
          <Text style={[TYPE.rowStrong, { color: color.ink }]}>
            This saved route is unavailable for the current account and network.
          </Text>
          <Text style={[TYPE.rowDetail, { color: color.text2 }]}>
            Return to the original account and network to check its deposit. Existing submitted money stays in Activity.
          </Text>
          <Button label="Open Activity" onPress={() => router.push(ROUTES.activity)} />
        </>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({ body: { padding: SIZE.gutter, gap: SPACE.lg, flexGrow: 1 } });

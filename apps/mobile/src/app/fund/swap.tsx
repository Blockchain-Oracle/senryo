import { router, Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBackOverSheet } from "~/components/shell/useBackOverSheet";
import { SwapView } from "~/features/swap/SwapView";
import { useAccount } from "~/lib/account/provider";
import { useNetwork } from "~/lib/network";
import { SIZE, SPACE, useTheme } from "~/theme";

/**
 * Swap any ↔ any (B6): the Plus fan's Swap, an asset's Swap circle (`?pay=<address>`) and a composed route
 * (`&receive=<address>`). The same ticket in Practice, where the slide says swaps run on Mainnet.
 */
export default function SwapScreen() {
  const { color } = useTheme();
  const chainId = useNetwork().chainId;
  const address = useAccount().hint?.address;
  useBackOverSheet();
  const insets = useSafeAreaInsets();
  const { pay, receive } = useLocalSearchParams<{ pay?: string; receive?: string }>();
  return (
    <View style={[styles.page, { backgroundColor: color.ground, paddingBottom: insets.bottom + SPACE.sm }]}>
      <Stack.Screen options={{ title: "Swap" }} />
      <SwapView
        key={`${address}:${chainId}:${pay ?? ""}:${receive ?? ""}`}
        initialPay={pay}
        initialReceive={receive}
        onLeave={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm },
});

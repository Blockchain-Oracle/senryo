import { router, Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { QuietLine } from "~/features/portfolio/QuietLine";
import type { DestinationTab } from "~/features/withdraw/DestinationStep";
import { WithdrawFlow } from "~/features/withdraw/WithdrawFlow";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useTheme } from "~/theme";

const TABS: readonly DestinationTab[] = ["monad", "chain", "bank"];

/** Withdraw any asset (B8–B10): `?asset=<address>` opens on that asset, `?to=monad|chain|bank` on that tab. */
export default function WithdrawScreen() {
  const { color } = useTheme();
  const address = useAccount().hint?.address;
  const { asset, to } = useLocalSearchParams<{ asset?: string; to?: string }>();
  const tab = TABS.find((t) => t === to);
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <Stack.Screen options={{ title: "Withdraw" }} />
      {address ? (
        <WithdrawFlow key={address} {...(asset ? { initialAsset: asset } : {})} {...(tab ? { initialTab: tab } : {})} />
      ) : (
        <QuietLine action={{ label: "Create account", onPress: () => router.push(ROUTES.accountRequired) }}>
          Sign in to withdraw
        </QuietLine>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

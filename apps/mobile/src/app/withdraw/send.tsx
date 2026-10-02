import { router, Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { QuietLine } from "~/features/portfolio/QuietLine";
import { SendFlow } from "~/features/send/SendFlow";
import { useAccount } from "~/lib/account/provider";
import { ROUTES } from "~/lib/constants/routes";
import { useTheme } from "~/theme";

/** Send (the fan's first action; B7): `?asset=<address>` preselects the asset, `?to=<address or @handle>` the person. */
export default function SendScreen() {
  const { color } = useTheme();
  const address = useAccount().hint?.address;
  const { asset, to } = useLocalSearchParams<{ asset?: string; to?: string }>();
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <Stack.Screen options={{ title: "Send" }} />
      {address ? (
        <SendFlow key={address} {...(asset ? { initialAsset: asset } : {})} {...(to ? { initialTo: to } : {})} />
      ) : (
        <QuietLine action={{ label: "Create account", onPress: () => router.push(ROUTES.accountRequired) }}>
          Sign in to send
        </QuietLine>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

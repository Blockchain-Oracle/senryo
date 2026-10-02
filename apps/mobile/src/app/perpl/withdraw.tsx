import { Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PerplWithdraw } from "~/features/perpl/PerplWithdraw";
import { SIZE, SPACE, useTheme } from "~/theme";

/** `/perpl/withdraw` — move free AUSD from Perpl back to the wallet (D1; flow book C4 "Withdraw ›"). A pushed page. */
export default function PerplWithdrawScreen() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.page, { backgroundColor: color.ground, paddingBottom: insets.bottom + SPACE.sm }]}>
      <Stack.Screen options={{ title: "Move back from Perpl" }} />
      <PerplWithdraw />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: SIZE.gutter, paddingTop: SPACE.sm },
});

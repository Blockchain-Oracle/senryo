import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "~/components/kit/states";
import { SIZE, SPACE, useTheme } from "~/theme";

/**
 * Markets between the pivot cleanup (S1) and the phone loop (S5, D-256). S5 builds it from the market catalogue
 * (D-268): Crypto · Stocks · Hot, live prices, countdowns and the window chips.
 */
export default function Markets() {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.fill, { backgroundColor: color.ground, paddingTop: insets.top }]}>
      <View style={styles.content}>
        <EmptyState why="Live markets are on their way" detail="BTC, ETH, SOL, MON, TSLA, NVDA and more." />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.lg },
});

import type { ReactNode } from "react";
import { ScrollView, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { SIZE, SPACE, useTheme } from "~/theme";
import { usePullRefresh } from "./PullRefresh";

interface Props {
  children: ReactNode;
  /** The screen's own refetch; without one, every query on screen refetches. */
  onRefresh?: () => Promise<unknown> | undefined;
  /** false for screens that manage their own scrolling (a FlashList). */
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}

/**
 * A page: the D2 ground, the 16 pt gutter, pull to refresh, and automatic insets so content clears the header and
 * the native tab bar. The ScrollView is the screen's first child so iOS 18's tab bar reads its scroll edge correctly.
 */
export function Screen({ children, onRefresh, scroll = true, contentStyle }: Props) {
  const { color } = useTheme();
  const refreshControl = usePullRefresh(onRefresh);
  if (!scroll) return <View style={[styles.fill, { backgroundColor: color.ground }]}>{children}</View>;
  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: color.ground }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.body, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: SIZE.gutter, paddingBottom: SPACE.xxxl, gap: SPACE.xl },
});

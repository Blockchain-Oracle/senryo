import type { ReactNode } from "react";
import { ScrollView, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { useDockInset } from "~/components/shell/dock-context";
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
 * A page: the ground, the 20 pt gutter, pull to refresh, the header inset, and a bottom inset that clears the floating
 * dock and the fan's plus when the page sits inside the tab shell (S1b.7; Fomo's dock overlap X03 is the defect we fix).
 */
export function Screen({ children, onRefresh, scroll = true, contentStyle }: Props) {
  const { color } = useTheme();
  const refreshControl = usePullRefresh(onRefresh);
  const bottom = useDockInset();
  if (!scroll) return <View style={[styles.fill, { backgroundColor: color.ground }]}>{children}</View>;
  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: color.ground }]}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.body, { paddingBottom: Math.max(bottom, SPACE.xxxl) }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  body: { padding: SIZE.gutter, gap: SPACE.xl },
});

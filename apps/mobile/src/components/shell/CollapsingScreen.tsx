import type { ReactNode } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePullRefresh } from "~/components/kit/PullRefresh";
import { HAIRLINE_PX, HEADER_COLLAPSE_DISTANCE, SIZE, SPACE, useTheme } from "~/theme";
import { ContextTabs } from "./ContextTabs";
import { HEADER_COMPACT_FROM, HEADER_EXPANDED_UNTIL, SCROLL_THROTTLE_MS } from "./constants";
import { useDockInset } from "./dock-context";
import { ModeCapsule } from "./ModeCapsule";

/**
 * A tab root with the C16 collapsing header (M09, direction §5):
 * - a fixed bar that never scrolls away — `left` (the seal or the tab's title) and the mode control at the upper
 *   right, so mode is always on screen — with a compact middle (Home's balance, a tab's title) that fades in over the
 *   last part of the collapse, and the tab's round `utilities` (F16) before the mode control. Fomo centres the
 *   compact balance (F12); ours is centred in the space the full-label mode control leaves (adapted);
 * - an optional `status` line under the bar (the trading-session chip, for an account). There is no universal
 *   utility strip (Codex consult 1 Oct): a guest sees the bar and the page, nothing between;
 * - `expanded` content at the top of the scroll that fades as it leaves, and an optional `sticky` row (Markets'
 *   category chips) that pins under the bar.
 * The collapse is scroll-driven over HEADER_COLLAPSE_DISTANCE (132 pt) — no timer. Scroll survives tab switches
 * because the tab stays mounted (D-193), and the collapse follows it because it is derived from the offset. Content
 * clears the dock row.
 */
export function CollapsingScreen({
  left,
  compact,
  expanded,
  sticky,
  utilities,
  status,
  children,
  onRefresh,
  contentStyle,
}: {
  left: ReactNode;
  /** The bar's middle once collapsed (a compact balance, a title). */
  compact?: ReactNode;
  /** Top-of-scroll content that collapses away (big balance + Add money, a large title). */
  expanded?: ReactNode;
  sticky?: ReactNode;
  /** Round utility controls in the bar, before the mode control (alerts, settings). */
  utilities?: ReactNode;
  /** A status line under the bar; nothing is drawn when it renders nothing. */
  status?: ReactNode;
  children: ReactNode;
  onRefresh?: () => Promise<unknown> | undefined;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = useDockInset();
  const refreshControl = usePullRefresh(onRefresh);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const progress = useDerivedValue(() => Math.min(1, Math.max(0, scrollY.value / HEADER_COLLAPSE_DISTANCE)));
  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [HEADER_COMPACT_FROM, 1], [0, 1], "clamp"),
  }));
  const rule = useAnimatedStyle(() => ({ opacity: progress.value }));
  return (
    <View style={[styles.fill, { backgroundColor: color.ground }]}>
      <View style={[styles.bar, { paddingTop: insets.top, backgroundColor: color.ground }]}>
        <View style={styles.row}>
          <View style={styles.side}>{left}</View>
          <Animated.View
            style={[styles.middle, compactStyle]}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {compact}
          </Animated.View>
          {utilities}
          <ModeCapsule />
        </View>
        <ContextTabs />
        {status ? <View style={styles.status}>{status}</View> : null}
        <Animated.View style={[styles.rule, { backgroundColor: color.hairline }, rule]} />
      </View>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={SCROLL_THROTTLE_MS}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={sticky ? [1] : undefined}
        contentContainerStyle={{ paddingBottom: bottom }}
      >
        <Expanded progress={progress}>{expanded}</Expanded>
        {sticky ? <View style={{ backgroundColor: color.ground }}>{sticky}</View> : null}
        <View style={[styles.body, contentStyle]}>{children}</View>
      </Animated.ScrollView>
    </View>
  );
}

function Expanded({ progress, children }: { progress: SharedValue<number>; children: ReactNode }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, HEADER_EXPANDED_UNTIL], [1, 0], "clamp"),
  }));
  return <Animated.View style={[styles.expanded, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { zIndex: 1 },
  row: {
    minHeight: SIZE.touch + SPACE.md,
    paddingHorizontal: SIZE.gutter,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
  },
  side: { flexDirection: "row", alignItems: "center", gap: SPACE.sm, flexShrink: 1 },
  middle: { flex: 1, minWidth: 0, alignItems: "center" },
  status: { paddingHorizontal: SIZE.gutter, paddingBottom: SPACE.sm, alignItems: "flex-start" },
  rule: { height: HAIRLINE_PX },
  expanded: { paddingHorizontal: SIZE.gutter },
  body: { paddingHorizontal: SIZE.gutter, paddingTop: SPACE.lg, gap: SPACE.xl },
});

import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Skeleton } from "~/components/kit/states";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * Home's small shared pieces: the quiet section heading (Fomo F16 "Positions (0)", F09 "Weekly Top Trades") and the
 * skeletons that hold each section's final shape while it loads.
 */

/** A section's name with its count in quiet ink, and an optional quiet summary at the right. */
export function SectionHeading({ title, count, trailing }: { title: string; count?: number; trailing?: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={[TYPE.rowTitle, { color: color.ink }]}>
        {title}
        {count === undefined ? null : <Text style={{ color: color.text3 }}> {count}</Text>}
      </Text>
      {trailing}
    </View>
  );
}

/** Skeleton line widths inside a loading row (pt). */
const ROW_TITLE_WIDTH = 96;
const ROW_DETAIL_WIDTH = 148;
const ROW_RESULT_WIDTH = 88;

/** Rows in the position-row anatomy while positions are still being read. */
export function PositionRowsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Syncing positions">
      {Array.from({ length: rows }, (_, i) => i).map((i) => (
        <View key={i} style={styles.row}>
          <View style={styles.mark}>
            <Skeleton width={SIZE.markDetail} height={SIZE.markDetail} />
          </View>
          <View style={styles.rowText}>
            <Skeleton width={ROW_TITLE_WIDTH} />
            <Skeleton width={ROW_DETAIL_WIDTH} height={SIZE.skeletonSmall} />
          </View>
          <View style={styles.rowResult}>
            <Skeleton width={ROW_RESULT_WIDTH} />
            <Skeleton width={ROW_RESULT_WIDTH - SPACE.xl} height={SIZE.skeletonSmall} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: SPACE.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    minHeight: SIZE.rowMinHeight,
    paddingVertical: SPACE.sm,
  },
  mark: { borderRadius: RADIUS.pill, overflow: "hidden" },
  rowText: { flex: 1, gap: SPACE.sm },
  rowResult: { alignItems: "flex-end", gap: SPACE.sm },
});

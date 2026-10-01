/**
 * The quiet pieces every Social view shares (build brief §2; Fomo F16 "No positions yet"): an empty or unavailable
 * state is one centred line in the tertiary ink with at most one action, never a boxed panel; loading is rows of the
 * shape that will arrive; a section opens with its title and, when it is known, its count.
 */
import { MAINNET } from "@senryo/config";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/kit/Button";
import { Skeleton } from "~/components/kit/states";
import { useNetwork } from "~/lib/network";
import { RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

export interface QuietAction {
  label: string;
  onPress: () => void;
  loading?: boolean;
}

export function QuietLine({ text, action, tight = false }: { text: string; action?: QuietAction; tight?: boolean }) {
  const { color } = useTheme();
  return (
    <View style={[styles.quiet, tight ? styles.tight : null]}>
      <Text style={[TYPE.body, styles.center, { color: color.text3 }]}>{text}</Text>
      {action ? (
        <Button
          label={action.label}
          onPress={action.onPress}
          loading={action.loading ?? false}
          variant="outline"
          size="sm"
          block={false}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

/** Which money a figure is in, where the mode capsule isn't on screen (pushed pages, sheets): a small filled plate. */
export function ModeBadge() {
  const { color } = useTheme();
  const network = useNetwork();
  const real = network.key === MAINNET.key;
  return (
    <Text
      style={[
        TYPE.chipLabel,
        styles.badge,
        real
          ? { color: color.mainnet, backgroundColor: color.mainnetWash }
          : { color: color.practice, backgroundColor: color.practiceWash },
      ]}
    >
      {network.modeLabel}
    </Text>
  );
}

export function SectionHeading({
  title,
  count,
  trailing,
}: {
  title: string;
  count?: number | undefined;
  /** At the far edge of the heading (the mode a section's money is in). */
  trailing?: ReactNode;
}) {
  const { color } = useTheme();
  return (
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={[TYPE.sectionTitle, { color: color.ink }]}>
        {title}
      </Text>
      {count === undefined ? null : <Text style={[TYPE.row, { color: color.text3 }]}>{count}</Text>}
      {trailing ? <View style={styles.headingEnd}>{trailing}</View> : null}
    </View>
  );
}

/** Four rows fill a phone's first screen of a list. */
const SKELETON_ROWS = ["a", "b", "c", "d"] as const;
/** Skeleton line widths: a name, then a shorter second line. */
const NAME_WIDTH = "46%";
const DETAIL_WIDTH = "30%";
const TRAILING_WIDTH = 64;

/** Rows of people while a list loads: the avatar disc, two lines, and what sits at the trailing edge. */
export function PeopleSkeleton({ rows = SKELETON_ROWS.length }: { rows?: number }) {
  const { color } = useTheme();
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" accessibilityState={{ busy: true }}>
      {SKELETON_ROWS.slice(0, rows).map((key) => (
        <View key={key} style={styles.row}>
          <View style={[styles.disc, { backgroundColor: color.skeleton }]} />
          <View style={styles.lines}>
            <Skeleton width={NAME_WIDTH} />
            <Skeleton width={DETAIL_WIDTH} height={SIZE.skeletonSmall} />
          </View>
          <Skeleton width={TRAILING_WIDTH} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  quiet: { alignItems: "center", gap: SPACE.lg, paddingVertical: SPACE.xxxl, paddingHorizontal: SPACE.lg },
  tight: { paddingVertical: SPACE.lg },
  center: { textAlign: "center" },
  action: { alignSelf: "center" },
  badge: { borderRadius: RADIUS.xs, paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xxs, overflow: "hidden" },
  heading: { flexDirection: "row", alignItems: "baseline", gap: SPACE.sm },
  headingEnd: { flex: 1, alignItems: "flex-end" },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: SIZE.rowMinHeight },
  disc: { width: SIZE.avatarMd, height: SIZE.avatarMd, borderRadius: RADIUS.pill },
  lines: { flex: 1, gap: SPACE.sm },
});

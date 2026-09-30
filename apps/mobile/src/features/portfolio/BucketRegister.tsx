import { StyleSheet, Text, View } from "react-native";
import { Panel } from "~/components/kit/Surface";
import { BPS_DENOMINATOR } from "~/lib/constants/units";
import { pct, usd } from "~/lib/money";
import type { SampleBuckets } from "~/lib/sample";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/**
 * The one balance split (D2 register + 21st Partition Bar #26545): Free to trade, Free to spend, Locked, and the
 * fourth bucket In Perpl (D-010: not counted in Free to spend). Widths are bps of the total, integer math.
 */
export function BucketRegister({ buckets }: { buckets: SampleBuckets }) {
  const { color } = useTheme();
  const cells = [
    { key: "trade", label: "FREE·TRADE", value: buckets.freeToTrade6, tint: color.up },
    { key: "spend", label: "FREE·SPEND", value: buckets.freeToSpend6, tint: color.gold },
    { key: "locked", label: "LOCKED", value: buckets.locked6, tint: color.inkMuted },
    { key: "perpl", label: "IN PERPL", value: buckets.inPerpl6, tint: color.chart5 },
  ] as const;
  const total = cells.reduce((sum, c) => sum + c.value, 0n);
  const share = (v: bigint) => (total === 0n ? 0n : (v * BPS_DENOMINATOR) / total);
  return (
    <View style={styles.wrap}>
      <Panel style={styles.grid}>
        {cells.map((c, i) => (
          <View
            key={c.key}
            accessible
            accessibilityLabel={`${c.label.replace("·", " ")} ${usd(c.value, 0)}`}
            style={[styles.cell, i % 2 === 1 ? { borderLeftWidth: HAIRLINE_PX, borderColor: color.hairline } : null,
              i >= 2 ? { borderTopWidth: HAIRLINE_PX, borderColor: color.hairline } : null]}
          >
            <Text style={[TYPE.label, { color: color.inkMuted }]}>{c.label}</Text>
            <Text style={[TYPE.numMd, { color: c.tint }]}>{usd(c.value, 0)}</Text>
          </View>
        ))}
      </Panel>
      <View style={styles.bar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {cells.map((c) => (
          <View key={c.key} style={[styles.segment, { flex: Number(share(c.value)), backgroundColor: c.tint }]} />
        ))}
      </View>
      <View style={styles.legend}>
        {cells.map((c) => (
          <Text key={c.key} style={[TYPE.caption, { color: color.inkMuted }]}>
            <Text style={{ color: c.tint }}>■ </Text>
            {pct(share(c.value))}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.md },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "50%", padding: SPACE.md, gap: SPACE.xs },
  bar: { flexDirection: "row", height: SIZE.partitionBar, gap: SPACE.xs },
  segment: { borderRadius: RADIUS.sm },
  legend: { flexDirection: "row", justifyContent: "space-between" },
});

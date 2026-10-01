import { BPS_DENOMINATOR } from "@senryo/core";
import { ids } from "@senryo/identity";
import { StyleSheet, Text, View } from "react-native";
import { EntityMark } from "~/components/identity/EntityMark";
import { Panel } from "~/components/kit/Surface";
import { pct, usd } from "~/lib/money";
import { HAIRLINE_PX, RADIUS, SIZE, SPACE, TYPE, useTheme } from "~/theme";

/** The fourth bucket is Perpl's: its own venue mark, not a colour swatch. */
const PERPL = ids.venue("perpl");

export interface Buckets {
  freeToTrade6: bigint;
  freeToSpend6: bigint;
  locked6: bigint;
  /** Read from Perpl (D-010, display only); undefined until the Perpl account is connected (S7) — shown as "—". */
  inPerpl6: bigint | undefined;
}

/**
 * The one balance split (D2 register + 21st Partition Bar #26545): Free to trade, Free to spend, Locked, and the
 * fourth bucket In Perpl (D-010: not counted in Free to spend). Widths are bps of the total, integer math; a negative
 * Free to trade (under water) draws as zero width and shows its sign.
 */
export function BucketRegister({ buckets }: { buckets: Buckets }) {
  const { color } = useTheme();
  const cells = [
    { key: "trade", label: "FREE·TRADE", value: buckets.freeToTrade6, tint: color.up },
    { key: "spend", label: "FREE·SPEND", value: buckets.freeToSpend6, tint: color.gold },
    { key: "locked", label: "LOCKED", value: buckets.locked6, tint: color.inkMuted },
    { key: "perpl", label: "IN PERPL", value: buckets.inPerpl6, tint: color.chart5 },
  ] as const;
  const width = (v: bigint | undefined) => (v === undefined || v < 0n ? 0n : v);
  const total = cells.reduce((sum, c) => sum + width(c.value), 0n);
  const share = (v: bigint | undefined) => (total === 0n ? 0n : (width(v) * BPS_DENOMINATOR) / total);
  return (
    <View style={styles.wrap}>
      <Panel style={styles.grid}>
        {cells.map((c, i) => (
          <View
            key={c.key}
            accessible
            accessibilityLabel={`${c.label.replace("·", " ")} ${c.value === undefined ? "not connected" : usd(c.value, 0)}`}
            style={[
              styles.cell,
              i % 2 === 1 ? { borderLeftWidth: HAIRLINE_PX, borderColor: color.hairline } : null,
              i >= 2 ? { borderTopWidth: HAIRLINE_PX, borderColor: color.hairline } : null,
            ]}
          >
            <View style={styles.label}>
              {c.key === "perpl" ? <EntityMark id={PERPL} size={SIZE.markChip} variant="symbol" decorative /> : null}
              <Text style={[TYPE.label, { color: color.inkMuted }]}>{c.label}</Text>
            </View>
            <Text style={[TYPE.numMd, { color: c.value === undefined ? color.inkMuted : c.tint }]}>
              {c.value === undefined ? "—" : usd(c.value, 0)}
            </Text>
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
          <View key={c.key} style={styles.label}>
            {c.key === "perpl" ? (
              <EntityMark id={PERPL} size={SIZE.markChip} variant="symbol" decorative />
            ) : (
              <Text style={[TYPE.caption, { color: c.tint }]}>■</Text>
            )}
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{pct(share(c.value))}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.md },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "50%", padding: SPACE.md, gap: SPACE.xs },
  label: { flexDirection: "row", alignItems: "center", gap: SPACE.xs },
  bar: { flexDirection: "row", height: SIZE.partitionBar, gap: SPACE.xs },
  segment: { borderRadius: RADIUS.sm },
  legend: { flexDirection: "row", justifyContent: "space-between" },
});
